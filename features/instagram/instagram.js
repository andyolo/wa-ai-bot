const path = require('path');
const fs = require('fs');
const os = require('os');
const ytDlp = require('yt-dlp-exec');
const ffmpegPath = require('ffmpeg-static');
const { MessageMedia } = require('whatsapp-web.js');

async function handleInstagram(message, url, client) {
    let videoPath = null;

    try {
        const parsedUrl = new URL(url);

        const allowedHosts = [
            'instagram.com',
            'www.instagram.com',
            'm.instagram.com'
        ];

        if (!allowedHosts.includes(parsedUrl.hostname)) {
            await message.reply(
                '❌ Gak ada jir.'
            );
            return;
        }

        await message.reply(
            '⏳ OTW bro...'
        );

        console.log('INSTAGRAM URL:', url);

        const tempDir = path.join(
            os.tmpdir(),
            'wa-bot-instagram'
        );

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, {
                recursive: true
            });
        }

        const timestamp = Date.now();

        videoPath = path.join(
            tempDir,
            `instagram_${timestamp}.mp4`
        );

        console.log(
            'INSTAGRAM DOWNLOAD:',
            videoPath
        );

        await ytDlp(url, {
            output: videoPath,
            format: 'best[ext=mp4]/best',
            noPlaylist: true,
            ffmpegLocation: ffmpegPath
        });

        console.log(
            'INSTAGRAM VIDEO READY:',
            videoPath
        );

        if (!fs.existsSync(videoPath)) {
            throw new Error(
                'File video Instagram tidak ditemukan.'
            );
        }

        const media =
            MessageMedia.fromFilePath(videoPath);

        await message.reply(
            media,
            undefined,
            {
                sendMediaAsDocument: false
            }
        );

        console.log(
            'INSTAGRAM VIDEO SENT'
        );

    } catch (error) {

        console.error(
            'INSTAGRAM ERROR:',
            error
        );

        await message.reply(
            '❌ Gagal mengambil video Instagram.\n' +
            'Pastikan link publik dan bisa diakses.'
        );

    } finally {

        try {

            if (
                videoPath &&
                fs.existsSync(videoPath)
            ) {
                fs.unlinkSync(videoPath);

                console.log(
                    'INSTAGRAM VIDEO DELETED'
                );
            }

        } catch (cleanupError) {

            console.error(
                'INSTAGRAM CLEANUP ERROR:',
                cleanupError
            );

        }
    }
}

module.exports = {
    handleInstagram
};