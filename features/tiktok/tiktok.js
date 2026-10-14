const path = require('path');
const fs = require('fs');
const os = require('os');
const ytDlp = require('yt-dlp-exec');
const ffmpegPath = require('ffmpeg-static');

async function handleTikTok(message, url, client) {
    let videoPath = null;
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

        const tempDir = path.join(os.tmpdir(), 'wa-bot-tiktok');

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();

        videoPath = path.join(
            tempDir,
            `tiktok_${timestamp}.mp4`
        );

        audioPath = path.join(
            tempDir,
            `tiktok_${timestamp}.mp3`
        );

        console.log('TIKTOK DOWNLOAD:', videoPath);

        await ytDlp(url, {
            output: videoPath,
            format: 'best[ext=mp4]/best',
            noPlaylist: true,
            ffmpegLocation: ffmpegPath
        });

        console.log('TIKTOK VIDEO READY:', videoPath);

        if (!fs.existsSync(videoPath)) {
            throw new Error('File video tidak ditemukan setelah download.');
        }

        await message.reply('📥 Otw bro...');

        const { MessageMedia } = require('whatsapp-web.js');

        const videoMedia = MessageMedia.fromFilePath(videoPath);

        await message.reply(
            videoMedia,
            undefined,
            {
                sendMediaAsDocument: false
            }
        );

        console.log('TIKTOK VIDEO SENT');

        // Audio MP3
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

    } catch (error) {
        console.error('TIKTOK ERROR:', error);

        await message.reply(
            '❌ Gagal memproses TikTok.\n' +
            'Cek link atau lihat log PM2.'
        );

    } finally {
        // Hapus file sementara
        try {
            if (videoPath && fs.existsSync(videoPath)) {
                fs.unlinkSync(videoPath);
                console.log('TIKTOK VIDEO DELETED');
            }

            if (audioPath && fs.existsSync(audioPath)) {
                fs.unlinkSync(audioPath);
                console.log('TIKTOK AUDIO DELETED');
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