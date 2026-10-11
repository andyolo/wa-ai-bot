const { MessageMedia } = require('whatsapp-web.js');
const sharp = require('sharp');

async function handleSticker(message, args = []) {
    const fullMode = args.some(
        arg => String(arg).toLowerCase() === '-f'
    );

    try {
        let sourceMessage = message;

        // Ambil media dari pesan yang dibalas jika diperlukan.
        if (!sourceMessage.hasMedia && message.hasQuotedMsg) {
            try {
                const quoted = await message.getQuotedMessage();

                if (quoted?.hasMedia) {
                    sourceMessage = quoted;
                }
            } catch (error) {
                console.error(
                    '[STICKER QUOTED ERROR]',
                    error?.stack || error
                );
            }
        }

        if (!sourceMessage.hasMedia) {
            await message.reply(
                'Kirim foto bersama /s atau balas foto dengan /s jir.'
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

                        if (
                            msg.mediaData.mediaStage !== 'RESOLVED'
                        ) {
                            await msg.downloadMedia({
                                downloadEvenIfExpensive: true,
                                rmrReason: 1
                            });
                        }

                        if (
                            !msg.directPath ||
                            !msg.mediaKey ||
                            !msg.encFilehash
                        ) {
                            throw new Error(
                                'Data enkripsi atau directPath media tidak lengkap.'
                            );
                        }

                        const manager =
                            window.require('WAWebDownloadManager')
                                .downloadManager;

                        const mockQpl = {
                            addAnnotations() { return this; },
                            end() {},
                            start() { return this; },
                            addPoint() { return this; }
                        };

                        const decrypted =
                            await manager.downloadAndMaybeDecrypt({
                                directPath: msg.directPath,
                                encFilehash: msg.encFilehash,
                                filehash: msg.filehash,
                                mediaKey: msg.mediaKey,
                                mediaKeyTimestamp: msg.mediaKeyTimestamp,
                                mimetype: msg.mimetype,
                                type: msg.type,
                                signal: undefined,
                                mediaObject: msg,
                                qpl: mockQpl
                            });

                        return {
                            data: decrypted.toString('base64'),
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

        if (!media.mimetype?.startsWith('image/')) {
            await message.reply(
                'Fitur ini baru mendukung gambar, video belum didukung jir.'
            );
            return;
        }

        const inputBuffer = Buffer.from(media.data, 'base64');

        if (!inputBuffer.length) {
            throw new Error('Buffer gambar kosong.');
        }

        const resizeOptions = {
            width: 512,
            height: 512,
            fit: 'contain',
            position: 'centre',
            background: {
                r: 0,
                g: 0,
                b: 0,
                alpha: 0
            }
        };

        let outputBuffer = await sharp(inputBuffer)
            .rotate()
            .resize(resizeOptions)
            .webp({
                quality: fullMode ? 90 : 80,
                effort: 5
            })
            .toBuffer();

        // Kompres ulang jika ukuran melebihi 1 MB.
        if (outputBuffer.length > 1024 * 1024) {
            outputBuffer = await sharp(inputBuffer)
                .rotate()
                .resize(resizeOptions)
                .webp({
                    quality: 55,
                    effort: 6
                })
                .toBuffer();
        }

        if (outputBuffer.length > 1024 * 1024) {
            throw new Error('Ukuran stiker melebihi 1 MB.');
        }

        const sticker = new MessageMedia(
            'image/webp',
            outputBuffer.toString('base64'),
            'sticker.webp'
        );

        await message.client.sendMessage(
            message.from,
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
            inputBytes: inputBuffer.length,
            outputBytes: outputBuffer.length
        });

    } catch (error) {
        console.error(
            '[STICKER PROCESS ERROR]',
            error?.stack || error
        );

        await message.reply(
            'Gagal memproses stiker jir. Cek log bot.'
        ).catch(() => {});
    }
}

module.exports = { handleSticker };