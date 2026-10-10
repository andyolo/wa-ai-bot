
const { MessageMedia } = require('whatsapp-web.js');
const sharp = require('sharp');

function repairMessageId(msg) {
    if (!msg?.id) return;

    const id = msg.id;

    // WhatsApp Web terbaru bisa menggunakan $1
    // sebagai pengganti _serialized.
    if (!id._serialized && id.$1) {
        id._serialized = id.$1;
    }

    // Fallback jika $1 juga tidak tersedia.
    if (!id._serialized && id.remote && id.id != null) {
        const parts = [
            id.fromMe,
            id.remote,
            id.id
        ];

        if (msg.author) {
            parts.push(msg.author);
        }

        id._serialized = parts.join('_');
    }
}

async function handleSticker(message, args = []) {
    const fullMode =
        (args[0] || '').toLowerCase() === '-f';

    try {
        let sourceMessage = message;

        if (!message.hasMedia && message.hasQuotedMsg) {
            const quoted = await message.getQuotedMessage();

            if (quoted?.hasMedia) {
                sourceMessage = quoted;
            }
        }

        if (!sourceMessage.hasMedia) {
            await message.reply(
                'Kirim foto dengan /s atau balas foto menggunakan /s jir.'
            );
            return;
        }

        repairMessageId(sourceMessage);

        console.log('[STICKER ID CHECK]', {
            id: sourceMessage.id,
            serialized: sourceMessage.id?._serialized
        });

        let media;

        try {
            media = await sourceMessage.downloadMedia();
        } catch (error) {
            console.error(
                '[STICKER DOWNLOAD ERROR]',
                error?.stack || error
            );

            await message.reply(
                'Gagal mengunduh gambar. Cek log bot jir.'
            );
            return;
        }

        if (!media?.data) {
            await message.reply(
                'Gambar tidak berhasil diunduh jir.'
            );
            return;
        }

        if (!media.mimetype?.startsWith('image/')) {
            await message.reply(
                'Yang bisa dijadikan stiker cuma gambar jir.'
            );
            return;
        }

        const inputBuffer = Buffer.from(media.data, 'base64');

        const resizeOptions = {
            width: 512,
            height: 512,
            fit: fullMode ? 'cover' : 'contain',
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
            .webp({ quality: 80, effort: 4 })
            .toBuffer();

        if (outputBuffer.length > 1024 * 1024) {
            outputBuffer = await sharp(inputBuffer)
                .rotate()
                .resize(resizeOptions)
                .webp({ quality: 55, effort: 5 })
                .toBuffer();
        }

        if (outputBuffer.length > 1024 * 1024) {
            throw new Error('Hasil stiker melebihi 1 MB.');
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
                stickerName: 'LRV BOT',
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
