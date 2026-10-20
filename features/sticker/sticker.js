const { MessageMedia } = require('whatsapp-web.js');
const sharp = require('sharp');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');
const { execFile } = require('child_process');
const { getQuotedMessage } = require('../quoted-message');

const execFileAsync = promisify(execFile);
const MAX_STICKER_BYTES = 1024 * 1024;
const ANIMATED_STICKER_DURATION_SECONDS = 6;

async function replyInCommandChat(message, text) {
    if (message.fromMe) {
        await message.client.sendMessage(
            message.id?.remote || message.from,
            text
        );
        return;
    }

    await message.reply(text);
}

async function createAnimatedSticker(inputBuffer) {
    if (!ffmpegPath) {
        throw new Error('ffmpeg-static tidak tersedia.');
    }

    const tempDir = await fs.promises.mkdtemp(
        path.join(os.tmpdir(), 'wa-ai-sticker-')
    );
    const inputPath = path.join(tempDir, 'input-video');
    const outputPath = path.join(tempDir, 'sticker.webp');

    try {
        await fs.promises.writeFile(inputPath, inputBuffer);

        for (const settings of [
            { fps: 15, quality: 70 },
            { fps: 10, quality: 50 },
            { fps: 8, quality: 35 }
        ]) {
            const filter =
                `fps=${settings.fps},` +
                'scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,' +
                'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,' +
                'format=yuva420p';

            await execFileAsync(ffmpegPath, [
                '-y',
                '-i', inputPath,
                '-t', String(ANIMATED_STICKER_DURATION_SECONDS),
                '-an',
                '-vf', filter,
                '-c:v', 'libwebp_anim',
                '-lossless', '0',
                '-q:v', String(settings.quality),
                '-preset', 'default',
                '-loop', '0',
                '-vsync', '0',
                outputPath
            ], {
                windowsHide: true,
                maxBuffer: 10 * 1024 * 1024
            });

            const outputBuffer =
                await fs.promises.readFile(outputPath);

            if (outputBuffer.length <= MAX_STICKER_BYTES) {
                return outputBuffer;
            }

            await fs.promises.unlink(outputPath);
        }

        throw new Error(
            'Ukuran stiker animasi melebihi 1 MB setelah dikompres.'
        );
    } finally {
        await fs.promises.rm(tempDir, {
            recursive: true,
            force: true
        });
    }
}

async function handleSticker(message, args = []) {
    const fullMode = args.some(
        arg => String(arg).toLowerCase() === '-f'
    );
    const targetChatId = message.id?.remote || message.from;

    try {
        let sourceMessage = message;

        // Ambil media dari pesan yang dibalas jika diperlukan.
        if (!sourceMessage.hasMedia && message.hasQuotedMsg) {
            const quoted = await getQuotedMessage(message);

            if (quoted?.hasMedia) {
                sourceMessage = quoted;
            }
        }

        if (!sourceMessage.hasMedia) {
            await replyInCommandChat(
                message,
                'Kirim foto/video bersama /s atau balas foto/video dengan /s. Gunakan /s -f agar foto tidak dipotong.'
            );
            return;
        }

        console.log('[STICKER MEDIA DEBUG]', {
            hasMedia: sourceMessage.hasMedia,
            type: sourceMessage.type,
            mimetype: sourceMessage._data?.mimetype,
            id: sourceMessage.id?._serialized
        });

        // Download media dengan metode standar terlebih dahulu.
        let media;

        try {
            media = await sourceMessage.downloadMedia();
        } catch (error) {
            console.error(
                '[STICKER STANDARD DOWNLOAD ERROR]',
                error?.stack || error
            );
        }

        // Fallback melalui WhatsApp Web jika metode standar gagal.
        if (!media?.data) {
            console.warn(
                '[STICKER] Mencoba download melalui WhatsApp Web...'
            );

            const messageId = sourceMessage.id;

            const serializedId =
                messageId?._serialized ||
                (messageId?.remote && messageId?.id
                    ? `${messageId.fromMe ? 'true' : 'false'}_${messageId.remote}_${messageId.id}${messageId.participant ? `_${messageId.participant}` : ''}`
                    : null);

            if (!serializedId) {
                throw new Error(
                    'ID pesan tidak valid: ' +
                    JSON.stringify(messageId)
                );
            }

            const result =
                await sourceMessage.client.pupPage.evaluate(
                    async (msgId) => {
                        const collections =
                            window.require('WAWebCollections');

                        const msg =
                            collections.Msg.get(msgId) ||
                            (
                                await collections.Msg.getMessagesById(
                                    [msgId]
                                )
                            )?.messages?.[0];

                        if (!msg?.mediaData) {
                            return null;
                        }

                        if (msg.mediaData.mediaStage !== 'RESOLVED') {
                            try {
                                await msg.downloadMedia({
                                    downloadEvenIfExpensive: true,
                                    rmrReason: 1
                                });
                            } catch (error) {
                                if (!msg.directPath || !msg.mediaKey) {
                                    throw error;
                                }
                            }
                        }

                        if (!msg.directPath || !msg.mediaKey || !msg.encFilehash) {
                            throw new Error(
                                'Data enkripsi atau directPath media tidak lengkap.'
                            );
                        }

                        const manager =
                            window.require('WAWebDownloadManager')
                                .downloadManager;

                        const mockQpl = new Proxy({}, {
                            get(target, property) {
                                if (property === 'then') {
                                    return undefined;
                                }
                                return () => mockQpl;
                            }
                        });

                        const decrypted =
                            await manager.downloadAndMaybeDecrypt({
                                directPath: msg.directPath,
                                encFilehash: msg.encFilehash,
                                filehash: msg.filehash,
                                mediaKey: msg.mediaKey,
                                mediaKeyTimestamp: msg.mediaKeyTimestamp,
                                mimetype: msg.mimetype,
                                type: msg.type,
                                signal: new AbortController().signal,
                                mediaObject: msg,
                                downloadQpl: mockQpl
                            });

                        const data =
                            await window.WWebJS.arrayBufferToBase64Async(
                                decrypted
                            );

                        return {
                            data,
                            mimetype: msg.mimetype
                        };
                    },
                    serializedId
                );

            if (!result?.data) {
                throw new Error(
                    'Metode standar dan fallback gagal mengambil media.'
                );
            }

            media = result;
        }

        if (!media?.data) {
            throw new Error('Data media kosong.');
        }

        const inputBuffer = Buffer.from(media.data, 'base64');

        if (!inputBuffer.length) {
            throw new Error('Buffer media kosong.');
        }

        let outputBuffer;
        let outputFilename;

        if (media.mimetype?.startsWith('video/')) {
            outputBuffer = await createAnimatedSticker(inputBuffer);
            outputFilename = 'sticker-animated.webp';
        } else if (media.mimetype?.startsWith('image/')) {
            outputBuffer = await sharp(inputBuffer)
                .rotate()
                .resize({
                    width: 512,
                    height: 512,
                    fit: fullMode ? 'contain' : 'cover',
                    position: 'centre',
                    background: {
                        r: 0,
                        g: 0,
                        b: 0,
                        alpha: 0
                    }
                })
                .webp({
                    quality: 80,
                    effort: 5
                })
                .toBuffer();

            if (outputBuffer.length > MAX_STICKER_BYTES) {
                outputBuffer = await sharp(inputBuffer)
                    .rotate()
                    .resize({
                        width: 512,
                        height: 512,
                        fit: fullMode ? 'contain' : 'cover',
                        position: 'centre',
                        background: {
                            r: 0,
                            g: 0,
                            b: 0,
                            alpha: 0
                        }
                    })
                    .webp({
                        quality: 55,
                        effort: 6
                    })
                    .toBuffer();
            }

            outputFilename = 'sticker.webp';
        } else {
            await replyInCommandChat(
                message,
                'Format ini belum didukung. Kirim gambar atau video.'
            );
            return;
        }

        if (outputBuffer.length > MAX_STICKER_BYTES) {
            throw new Error('Ukuran stiker melebihi 1 MB.');
        }

        const sticker = new MessageMedia(
            'image/webp',
            outputBuffer.toString('base64'),
            outputFilename
        );

        await message.client.sendMessage(
            targetChatId,
            sticker,
            {
                sendMediaAsSticker: true,
                stickerName: fullMode
                    ? 'LRV BOT FULL'
                    : 'LRV BOT',
                stickerAuthor: 'Lrv Squad',
                stickerCategories: ['🤖']
            }
        );

        console.log('[STICKER SUCCESS]', {
            mode: fullMode ? 'FULL' : 'NORMAL',
            type: media.mimetype.startsWith('video/') ? 'ANIMATED' : 'IMAGE',
            inputBytes: inputBuffer.length,
            outputBytes: outputBuffer.length
        });

    } catch (error) {
        console.error(
            '[STICKER PROCESS ERROR]',
            error?.stack || error
        );

        try {
            await replyInCommandChat(
                message,
                'Gagal memproses stiker.'
            );
        } catch (replyError) {
            console.error(
                '[STICKER ERROR NOTIFICATION]',
                replyError?.stack || replyError
            );
        }
    }
}

module.exports = { handleSticker };