const path = require('path');
const fs = require('fs');
const os = require('os');
const ytDlp = require('yt-dlp-exec');
const ffmpegPath = require('ffmpeg-static');

async function handleTikTok(message, url, client) {
    let downloadDir = null;
    let mediaPaths = [];
    let audioPath = null;

    let parsedUrl;

    try {
        parsedUrl = new URL(url);
    } catch {
        await message.reply(
            '❌ Link TikTok tidak valid.\n' +
            'Contoh: /tt https://www.tiktok.com/@user/video/123'
        );
        return;
    }

    const allowedHosts = [
        'tiktok.com',
        'www.tiktok.com',
        'm.tiktok.com',
        'vm.tiktok.com',
        'vt.tiktok.com'
    ];

    if (!allowedHosts.includes(parsedUrl.hostname)) {
        await message.reply(
            '❌ Link Gak Kebaca bg .\n' +
            'Masukkan link TikTok dengan benar plis .'
        );
        return;
    }

    try {
        await message.reply('⏳ SABAR JIR...');

        console.log('TIKTOK URL:', url);

        const tempRoot = path.join(os.tmpdir(), 'wa-bot-tiktok');

        if (!fs.existsSync(tempRoot)) {
            fs.mkdirSync(tempRoot, { recursive: true });
        }

        downloadDir = fs.mkdtempSync(path.join(tempRoot, 'request-'));

        const outputPrefix = 'tiktok_';

        audioPath = path.join(downloadDir, 'audio.mp3');

        console.log('TIKTOK DOWNLOAD:', downloadDir);

        await ytDlp(url, {
            output: path.join(
                downloadDir,
                `${outputPrefix}%(autonumber)s.%(ext)s`
            ),
            format: 'best[ext=mp4]/best',
            ffmpegLocation: ffmpegPath
        });

        mediaPaths = fs.readdirSync(downloadDir)
            .filter(fileName => fileName.startsWith(outputPrefix))
            .map(fileName => path.join(downloadDir, fileName));

        if (mediaPaths.length === 0) {
            throw new Error('Media TikTok tidak ditemukan setelah download.');
        }

        await message.reply('📥 Otw bro...');

        const { MessageMedia } = require('whatsapp-web.js');
        const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
        const videoExtensions = new Set(['.mp4', '.webm', '.mov', '.mkv']);
        const mediaToSend = mediaPaths.filter(mediaPath => {
            const extension = path.extname(mediaPath).toLowerCase();
            return imageExtensions.has(extension) || videoExtensions.has(extension);
        });

        if (mediaToSend.length === 0) {
            throw new Error('Format media TikTok tidak didukung.');
        }

        for (const mediaPath of mediaToSend) {
            const media = MessageMedia.fromFilePath(mediaPath);

            await message.reply(
                media,
                undefined,
                {
                    sendMediaAsDocument: false
                }
            );
        }

        const videoPath = mediaToSend.find(mediaPath =>
            videoExtensions.has(path.extname(mediaPath).toLowerCase())
        );

        if (videoPath) {
            console.log('TIKTOK VIDEO SENT:', videoPath);
            console.log('TIKTOK AUDIO CONVERT...');

            await ytDlp(url, {
                output: audioPath,
                format: 'bestaudio/best',
                extractAudio: true,
                audioFormat: 'mp3',
                audioQuality: '0',
                noPlaylist: true,
                ffmpegLocation: ffmpegPath
            });

            console.log('TIKTOK AUDIO READY:', audioPath);

            if (fs.existsSync(audioPath)) {
                const audioMedia = MessageMedia.fromFilePath(audioPath);

                await message.reply(
                    audioMedia,
                    undefined,
                    {
                        sendAudioAsVoice: false
                    }
                );

                console.log('TIKTOK AUDIO SENT');
            }
        }

    } catch (error) {
        console.error('TIKTOK ERROR:', error);

        await message.reply(
            '❌ Gagal memproses TikTok.\n' +
            'Cek link atau lihat log PM2.'
        );

    } finally {
        // Hapus file sementara
        try {
            if (downloadDir && fs.existsSync(downloadDir)) {
                for (const fileName of fs.readdirSync(downloadDir)) {
                    fs.unlinkSync(path.join(downloadDir, fileName));
                }
                fs.rmdirSync(downloadDir);
                console.log('TIKTOK TEMP FILES DELETED');
            }
        } catch (cleanupError) {
            console.error(
                'TIKTOK CLEANUP ERROR:',
                cleanupError
            );
        }
    }
}

module.exports = {
    handleTikTok
};