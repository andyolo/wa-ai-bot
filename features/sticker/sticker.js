
const { MessageMedia } = require('whatsapp-web.js');
const sharp = require('sharp');

async function handleSticker(message, args = []) {
    const fullMode = args.some(
        arg => String(arg).toLowerCase() === '-f'
    );

    try {
        let sourceMessage = message;

        // Ambil media dari pesan yang dibalas jika command
        // tidak membawa media sendiri.
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
            hasQuotedMsg: message.hasQuotedMsg,
            id: sourceMessage.id?._serialized
        });

        // Unduh media menggunakan API resmi whatsapp-web.js.
        let media;

        try {
            media = await sourceMessage.downloadMedia();
        } catch (error) {
            console.error(
                '[STICKER DOWNLOAD ERROR]',
                error?.stack || error
            );

            await message.reply(
                'Gagal mengunduh media dari WhatsApp jir. Coba kirim ulang fotonya.'
            );
            return;
        }

        if (!media?.data) {
            await message.reply(
                'Data media kosong. Coba kirim ulang fotonya jir.'
            );
            return;
        }

        if (!media.mimetype?.startsWith('image/')) {
            await message.reply(
                'Fitur ini baru mendukung gambar, video belum didukung jir.'
            );
            return;
        }

        const inputBuffer = Buffer.from(media.data, 'base64');

        // -f mempertahankan seluruh gambar tanpa crop.
        // Mode normal juga memakai contain agar gambar tidak terpotong.
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

        // Kompres lagi jika ukuran stiker melebihi 1 MB.
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
                stickerName: fullMode ? 'LRV BOT FULL' : 'LRV BOT',
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
