require('dotenv').config();

const {
    Client,
    LocalAuth,
    MessageMedia
} = require('whatsapp-web.js');

const qrcode = require('qrcode-terminal');
const Groq = require('groq-sdk');
const ytDlp = require('yt-dlp-exec');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const {
    botReact
} = require('./reactions');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    }
});

const games = new Map();
const scores = new Map();
const playSessions = new Map();

const quotes = [
    'Hitam bukan berarti ambatukam.',
    'Tidak semua hal harus jomok.',
    'Kesalahan adalah awal kesuksesan.',
    'Kalau belum bisa, berarti belum selesai belajar.',
    'Sedikit kemajuan tetap merupakan kemajuan.',
    'Jangan membandingkan prosesmu dengan proses orang lain.',
    'Kadang istirahat adalah bagian dari perjalanan.',
    'Konsisten lebih penting daripada sempurna.',
    'Hari buruk tidak berarti hidupmu buruk.',
    'Mulai dari yang gagal kata Samuel.',
    'Gagal sekali bukan berarti gagal selamanya.',
    'Belajar memang lambat, tapi hasilnya bisa panjang.',
    'Tidak perlu terburu-buru untuk menjadi hebat.',
    'Hal besar biasanya dimulai dari langkah kecil.',
    'Kalau bingung, sederhanakan dulu.',
    'Kemajuan tidak selalu terlihat setiap hari.',
    'Tetap berjalan meskipun langkahnya kecil.',
    'Jangan menyerah hanya karena hasilnya belum terlihat.',
    'Pengalaman datang dari mencoba.',
    'Masa depan dibangun dari kebiasaan hari ini.'
];

const facts = [
    'Gurita memiliki tiga jantung.',
    'Cahaya Matahari membutuhkan sekitar 8 menit 20 detik untuk mencapai Bumi.',
    'Air dapat ditemukan dalam tiga wujud utama: padat, cair, dan gas.',
    'Bumi berputar pada porosnya sehingga terjadi siang dan malam.',
    'Bulan tidak menghasilkan cahaya sendiri, tetapi memantulkan cahaya Matahari.',
    'DNA menyimpan informasi genetik makhluk hidup.',
    'Jerapah dan manusia sama-sama memiliki tujuh tulang leher.',
    'Antarktika merupakan benua yang paling dingin di Bumi.',
    'Saturnus memiliki sistem cincin yang sangat jelas terlihat.',
    'Lebah menggunakan tarian untuk membantu memberi informasi lokasi sumber makanan.',
    'Air mendidih pada sekitar 100 derajat Celsius pada tekanan udara standar.',
    'Bumi bukanlah bola sempurna karena sedikit pepat di bagian kutub.',
    'Suara tidak dapat merambat di ruang hampa.',
    'Mars memiliki dua satelit alami yang dikenal sebagai Phobos dan Deimos.',
    'Tumbuhan menggunakan fotosintesis untuk mengubah energi cahaya menjadi energi kimia.',
    'Kelelawar adalah satu-satunya kelompok mamalia yang benar-benar mampu terbang.',
    'Gunung Everest merupakan titik tertinggi di permukaan Bumi di atas permukaan laut.',
    'Petir dapat menghasilkan suhu yang sangat tinggi.',
    'Jantung manusia berdetak puluhan ribu kali dalam sehari.',
    'Mata manusia dapat membedakan jutaan kombinasi warna.'
];

function getPlayerKey(message) {
    return message.from + ':' + (message.author || message.from);
}

function addScore(playerKey, points) {
    scores.set(
        playerKey,
        (scores.get(playerKey) || 0) + points
    );
}

function getIndonesiaDateParts() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());

    const result = {};

    for (const part of parts) {
        if (part.type !== 'literal') {
            result[part.type] = part.value;
        }
    }

    return {
        year: Number(result.year),
        month: Number(result.month),
        day: Number(result.day)
    };
}

function formatDateIndonesia() {
    const date = getIndonesiaDateParts();

    const days = [
        'Minggu',
        'Senin',
        'Selasa',
        'Rabu',
        'Kamis',
        'Jumat',
        'Sabtu'
    ];

    const months = [
        'Januari',
        'Februari',
        'Maret',
        'April',
        'Mei',
        'Juni',
        'Juli',
        'Agustus',
        'September',
        'Oktober',
        'November',
        'Desember'
    ];

    const localDate = new Date(
        date.year,
        date.month - 1,
        date.day
    );

    return (
        days[localDate.getDay()] +
        ', ' +
        date.day +
        ' ' +
        months[date.month - 1] +
        ' ' +
        date.year
    );
}

function daysUntilChristmas(year) {
    const now = getIndonesiaDateParts();
 
    const today = Date.UTC(
        now.year,
        now.month - 1,
        now.day
    );

    const christmas = Date.UTC(
        year,
        11,
        25
    );

    return Math.round(
        (christmas - today) / 86400000
    );
}

function formatYouTubeDuration(duration) {
    if (!duration) {
        return 'Durasi tidak diketahui';
    }

    const match = duration.match(
        /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
    );

    if (!match) {
        return 'Durasi tidak diketahui';
    }

    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    const seconds = Number(match[3] || 0);

    if (hours > 0) {
        return (
            hours +
            ':' +
            String(minutes).padStart(2, '0') +
            ':' +
            String(seconds).padStart(2, '0')
        );
    }

    return (
        minutes +
        ':' +
        String(seconds).padStart(2, '0')
    );
}

async function downloadYouTubeMP3(videoUrl) {
    const outputDir = path.join(
        __dirname,
        'downloads'
    );

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, {
            recursive: true
        });
    }

    const outputPath = path.join(
        outputDir,
        Date.now() + '.mp3'
    );

    await ytDlp(
        videoUrl,
        {
            format: '251',
            extractAudio: true,
            audioFormat: 'mp3',
            audioQuality: '128K',
            output: outputPath,
            ffmpegLocation: ffmpegPath,
            noPlaylist: true,
            jsRuntimes: 'node'
        }
    );

    if (!fs.existsSync(outputPath)) {
        throw new Error(
            'File MP3 tidak ditemukan setelah proses download.'
        );
    }

    return outputPath;
}
async function convertToVoiceNote(inputPath) {
    if (!ffmpegPath) {
        throw new Error('ffmpeg-static tidak tersedia.');
    }

   const outputPath = 
        inputPath.replace(/\.mp3$/i, '.ogg');

    await execFileAsync(ffmpegPath, [
        '-y',
        '-i', inputPath,
        '-vn',
        '-c:a', 'libopus',
        '-b:a', '64k',
        '-vbr', 'on',
        '-application', 'voip',
        '-ar', '48000',
        '-ac', '1',
        outputPath
    ]);

    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
        throw new Error('Konversi voice note OGG gagal.');
    }

    return outputPath;
}

async function botReply(message, text) {
    await message.reply(text);

    try {
        await message.react('☁️');
    } catch (error) {
        console.error(
            'REACTION ERROR:',
            error.message
        );
    }
}

async function searchYouTube(query) {
    const searchParams = new URLSearchParams({
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: '5',
        regionCode: 'ID',
        relevanceLanguage: 'id',
        key: process.env.YOUTUBE_API_KEY
    });

    const searchResponse = await fetch(
        'https://www.googleapis.com/youtube/v3/search?' +
        searchParams
    );

    const searchData =
        await searchResponse.json();

    if (!searchResponse.ok) {
        console.error(
            'YOUTUBE SEARCH ERROR:',
            searchData
        );

        throw new Error(
            'YouTube Search gagal.'
        );
    }

    const items =
        searchData.items || [];

    if (items.length === 0) {
        return [];
    }

    const videoIds = items
        .map(item => item.id.videoId)
        .filter(Boolean)
        .join(',');

    const videoParams = new URLSearchParams({
        part: 'contentDetails',
        id: videoIds,
        key: process.env.YOUTUBE_API_KEY
    });

    const videoResponse = await fetch(
        'https://www.googleapis.com/youtube/v3/videos?' +
        videoParams
    );

    const videoData =
        await videoResponse.json();

    if (!videoResponse.ok) {
        console.error(
            'YOUTUBE VIDEO ERROR:',
            videoData
        );

        throw new Error(
            'YouTube Video Detail gagal.'
        );
    }

    const durationMap = new Map();

    for (
        const video of videoData.items || []
    ) {
        durationMap.set(
            video.id,
            video.contentDetails.duration
        );
    }

    return items.map(item => ({
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        videoId: item.id.videoId,
        url:
            'https://www.youtube.com/watch?v=' +
            item.id.videoId,
        duration:
            durationMap.get(
                item.id.videoId
            ) || null
    }));
}

client.on('qr', (qr) => {
    console.log(
        'SCAN QR INI DI WHATSAPP:'
    );

    qrcode.generate(
        qr,
        { small: true }
    );
});

client.on('ready', () => {
    console.log(
        'BOT SUDAH TERHUBUNG!'
    );
});

client.on('auth_failure', (message) => {
    console.log(
        'AUTH FAILURE:',
        message
    );
});

client.on('disconnected', (reason) => {
    console.log(
        'BOT TERPUTUS:',
        reason
    );
});

client.on(
    'message_create',
    async (message) => {

        console.log('MESSAGE DEBUG:', {
            fromMe: message.fromMe,
            from: message.from,
            to: message.to,
            body: message.body
        });

        if (
            message.fromMe &&
            !message.body.trim().startsWith('/')
        ) {
            return;
        }

        const playerKey =
            getPlayerKey(message);

        const plainInput =
            message.body.trim();

        if (plainInput.startsWith('/')) {
            await botReact(message);
        }

        /*
         * PILIH HASIL PLAY
         */

        if (/^[1-5]$/.test(plainInput)) {

            const session =
                playSessions.get(
                    playerKey
                );

            if (!session) {
                return;
            }

            const choice =
                Number(plainInput);

            if (
                choice < 1 ||
                choice > session.results.length
            ) {
                return;
            }

            await botReact(message);

            // LANJUTKAN KODE PLAY DI SINI
            
            const selected =
                session.results[
                    choice - 1
                ];

            playSessions.delete(
                playerKey
            );

            console.log(
                'PLAY SELECTED:',
                selected
            );

            await botReply(
                message,
                'Dipilih:\n' +
                selected.title +
                '\n' +
                'Durasi: ' +
                formatYouTubeDuration(
                    selected.duration
                ) +
                '\n' +
                'Uploader: ' +
                selected.channel +
                '\n\n' +
                'Sedang memproses audio...'
            );

 let audioPath = null;
let voicePath = null;

try {
    console.log('PLAY DOWNLOAD:', selected.url);
    audioPath = await downloadYouTubeMP3(selected.url);
    console.log('PLAY MP3 READY:', audioPath);
    voicePath = await convertToVoiceNote(audioPath);
    console.log('PLAY VOICE READY:', voicePath);
    const media = MessageMedia.fromFilePath(voicePath);
   const targetChatId =
    message.id.remote;

console.log(
    'PLAY TARGET:',
    targetChatId
);

await client.sendMessage(
    targetChatId,
    media,
    {
        sendAudioAsVoice: true
    }
);


try {
    console.log(
        'PLAY REACTION: mencoba memberi reaksi ☁️'
    );

    console.log(
        'PLAY REACTION: BERHASIL'
    );

} catch (reactionError) {

    console.error(
        'PLAY REACTION ERROR:',
        reactionError
    );
}


    console.log('PLAY VOICE NOTE TERKIRIM:', voicePath);

    setTimeout(() => {
        for (const filePath of [audioPath, voicePath]) {
            try {
                if (filePath && fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (deleteError) {
                console.error(
                    'DELETE AUDIO ERROR:',
                    deleteError.message
                );
            }
        }
    }, 60000);

} catch (error) {
    console.error('PLAY DOWNLOAD ERROR:', error);

    for (const filePath of [audioPath, voicePath]) {
        try {
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (deleteError) {
            console.error(
                'DELETE FAILED FILE ERROR:',
                deleteError.message
            );
        }
    }

    await botReply(
        message,
        'Gagal memproses audio. Coba pilih lagu lain.'
    );
}

return;
}

        /*
         * SEMUA INPUT SELAIN COMMAND
         */

        if (!message.body.startsWith('/')) {
            return;
        }

        const input =
            message.body.slice(1).trim();

        if (!input) {

            await botReply(
                message,
                'Tulis perintah. Ketik /menu untuk melihat menu.'
            );

            return;
        }

        const parts =
            input.split(/\s+/);

        const command =
            parts[0].toLowerCase();

        const args =
            parts.slice(1);

        try {

            switch (command) {

               case 'menu':
case 'help':
case 'bantuan':

    const menuText =
        `╭━━━「 Gen 1 LRV BOT 」━━━╮
┃
┃ GAME 
┃ /tebak
┃ /jawab angka
┃ /stop
┃ /rps
┃ /skor
┃
┃ INFORMASI
┃ /tanggal
┃ /natal
┃ /quote
┃ /fakta
┃
┃ 🎵 MEDIA
┃ /play
┃
┃ Asisten AI Zoix
┃ /ai 
┃
╰━━━━━━━━━━━━━━━━━━╯

> © 2026 Lrv Squad`;

    await botReply(
        message,
        menuText
    );

    return;
                case 'tanggal': {

                    await botReply(
                        message,
                        'Hari ini: ' +
                        formatDateIndonesia()
                    );

                    return;
                }

                case 'natal': {

                    const now =
                        getIndonesiaDateParts();

                    let christmasYear =
                        now.year;

                    let days =
                        daysUntilChristmas(
                            christmasYear
                        );

                    if (days < 0) {

                        christmasYear++;

                        days =
                            daysUntilChristmas(
                                christmasYear
                            );
                    }

                    await botReply(
                        message,
                        'Natal ' +
                        christmasYear +
                        ' tinggal ' +
                        days +
                        ' hari lagi. 🎄'
                    );

                    return;
                }

                case 'quote': {

                    const quote =
                        quotes[
                            Math.floor(
                                Math.random() *
                                quotes.length
                            )
                        ];

                    await botReply(
                        message,
                        '💬 Quote hari ini:\n' +
                        quote
                    );

                    return;
                }

                case 'fakta': {

                    const fact =
                        facts[
                            Math.floor(
                                Math.random() *
                                facts.length
                            )
                        ];

                    await botReply(
                        message,
                        '🧠 Fakta random:\n' +
                        fact
                    );

                    return;
                }

                case 'play': {

                    const query =
                        args.join(' ');

                    if (!query) {

                        await botReply(
                            message,
                            'Tulis judul yang mau dicari.\n' +
                            'Contoh: /play golden hour'
                        );

                        return;
                    }

                    if (
                        !process.env.YOUTUBE_API_KEY
                    ) {

                        await botReply(
                            message,
                            'YOUTUBE_API_KEY belum dipasang di .env.'
                        );

                        return;
                    }

                    console.log(
                        'YOUTUBE SEARCH:',
                        query
                    );

                    await botReply(
                        message,
                        'Mencari "' +
                        query +
                        '"...'
                    );

                    const results =
                        await searchYouTube(
                            query
                        );

                    if (
                        results.length === 0
                    ) {

                        await botReply(
                            message,
                            'Video tidak ditemukan.'
                        );

                        return;
                    }

                    playSessions.set(
                        playerKey,
                        {
                            query: query,
                            results: results,
                            createdAt:
                                Date.now()
                        }
                    );

                    let reply =
                        'Hasil untuk: ' +
                        query +
                        '\n\n';

                    results.forEach(
                        (item, index) => {

                            reply +=
                                (index + 1) +
                                '. ' +
                                item.title +
                                '\n' +
                                '   Durasi: ' +
                                formatYouTubeDuration(
                                    item.duration
                                ) +
                                '\n' +
                                '   Uploader: ' +
                                item.channel +
                                '\n\n';
                        }
                    );

                    reply +=
                        'Ketik angka 1-' +
                        results.length +
                        ' untuk memilih.';

                    await botReply(
                        message,
                        reply
                    );

                    return;
                }

                case 'tebak': {

                    if (
                        games.has(
                            playerKey
                        )
                    ) {

                        await botReply(
                            message,
                            'Kamu masih punya permainan aktif. Ketik /jawab angka atau /stop.'
                        );

                        return;
                    }

                    games.set(
                        playerKey,
                        {
                            number:
                                Math.floor(
                                    Math.random() *
                                    20
                                ) + 1,
                            attempts: 5
                        }
                    );

                    await botReply(
                        message,
                        'Aku sudah memilih angka 1-20.\n' +
                        'Kamu punya 5 kesempatan.\n\n' +
                        'Ketik /jawab angka.'
                    );

                    return;
                }

                case 'jawab': {

                    const game =
                        games.get(
                            playerKey
                        );

                    if (!game) {

                        await botReply(
                            message,
                            'Belum ada permainan. Ketik /tebak untuk mulai.'
                        );

                        return;
                    }

                    const guess =
                        Number(args[0]);

                    if (
                        !Number.isInteger(
                            guess
                        ) ||
                        guess < 1 ||
                        guess > 20
                    ) {

                        await botReply(
                            message,
                            'Masukkan angka 1-20. Contoh: /jawab 12'
                        );

                        return;
                    }

                    if (
                        guess ===
                        game.number
                    ) {

                        games.delete(
                            playerKey
                        );

                        addScore(
                            playerKey,
                            1
                        );

                        await botReply(
                            message,
                            'Benar! Angkanya ' +
                            game.number +
                            '. Kamu mendapat 1 poin.'
                        );

                        return;
                    }

                    game.attempts--;

                    if (
                        game.attempts <= 0
                    ) {

                        games.delete(
                            playerKey
                        );

                        await botReply(
                            message,
                            'Kesempatan habis! Angkanya ' +
                            game.number +
                            '.'
                        );

                        return;
                    }

                    const hint =
                        guess < game.number
                            ? 'Terlalu kecil'
                            : 'Terlalu besar';

                    await botReply(
                        message,
                        hint +
                        '. Sisa kesempatan: ' +
                        game.attempts +
                        '.'
                    );

                    return;
                }

                case 'stop':

                    if (
                        games.delete(
                            playerKey
                        )
                    ) {

                        await botReply(
                            message,
                            'Permainan dihentikan.'
                        );

                    } else {

                        await botReply(
                            message,
                            'Kamu tidak sedang bermain.'
                        );
                    }

                    return;

                case 'rps': {

                    const choices = [
                        'batu',
                        'gunting',
                        'kertas'
                    ];

                    const playerChoice =
                        (args[0] || '')
                            .toLowerCase();

                    if (
                        !choices.includes(
                            playerChoice
                        )
                    ) {

                        await botReply(
                            message,
                            'Pilih: /rps batu, /rps gunting, atau /rps kertas.'
                        );

                        return;
                    }

                    const botChoice =
                        choices[
                            Math.floor(
                                Math.random() *
                                choices.length
                            )
                        ];

                    let result;

                    if (
                        playerChoice ===
                        botChoice
                    ) {

                        result =
                            'Seri!';

                    } else if (
                        (
                            playerChoice === 'batu' &&
                            botChoice === 'gunting'
                        ) ||
                        (
                            playerChoice === 'gunting' &&
                            botChoice === 'kertas'
                        ) ||
                        (
                            playerChoice === 'kertas' &&
                            botChoice === 'batu'
                        )
                    ) {

                        addScore(
                            playerKey,
                            1
                        );

                        result =
                            'Kamu menang dan mendapat 1 poin!';

                    } else {

                        result =
                            'Aku menang.';
                    }

                    await botReply(
                        message,
                        'Kamu: ' +
                        playerChoice +
                        '\nAku: ' +
                        botChoice +
                        '\n' +
                        result
                    );

                    return;
                }

                case 'skor':

                    await botReply(
                        message,
                        'Skormu: ' +
                        (
                            scores.get(
                                playerKey
                            ) || 0
                        ) +
                        ' poin.'
                    );

                    return;

                case 'ai': {

                    const question =
                        args.join(' ');

                    if (!question) {

                        await botReply(
                            message,
                            'Tulis pertanyaan setelah /ai.\n' +
                            'Contoh: /ai siapa presiden Indonesia saat ini?'
                        );

                        return;
                    }

                    console.log(
                        'AI REQUEST:',
                        question
                    );

                    const response =
                        await groq.chat.completions.create({

                            model:
                                'openai/gpt-oss-120b',

                            messages: [
                                {
                                    role: 'system',
                                    content:
                                        'Kamu adalah AI assistant di bot WhatsApp. ' +
                                        'Jawab dalam bahasa Indonesia. ' +
                                        'Jawaban singkat, jelas, natural, dan langsung ke inti. ' +
                                        'Untuk informasi terbaru atau yang dapat berubah, gunakan web search. ' +
                                        'Periksa tanggal sumber. Jangan mengarang fakta. ' +
                                        'Jangan mencampurkan informasi lama dengan informasi terbaru. ' +
                                        'Untuk tanggal, waktu, dan hitungan hari, gunakan perhitungan sistem jika tersedia. ' +
                                        'Gunakan teks biasa tanpa Markdown.'
                                },
                                {
                                    role: 'user',
                                    content: question
                                }
                            ],

                            tools: [
                                {
                                    type:
                                        'browser_search'
                                }
                            ],

                            tool_choice: 'auto',

                            reasoning_effort:
                                'low',

                            max_completion_tokens:
                                1000
                        });

                    let answer =
                        response.choices &&
                        response.choices[0] &&
                        response.choices[0].message &&
                        response.choices[0].message.content;

                    if (!answer) {

                        answer =
                            'AI tidak memberikan jawaban.';
                    }

                    answer = answer
                        .replace(
                            /【[^】]*】/g,
                            ''
                        )
                        .replace(
                            /\*\*/g,
                            ''
                        )
                        .replace(
                            /__/g,
                            ''
                        )
                        .replace(
                            /~~/g,
                            ''
                        )
                        .replace(
                            /```/g,
                            ''
                        )
                        .replace(
                            /^#+\s*/gm,
                            ''
                        )
                        .replace(
                            /\u00A0/g,
                            ' '
                        )
                        .replace(
                            /\u202F/g,
                            ' '
                        )
                        .replace(
                            /\u2011/g,
                            '-'
                        )
                        .replace(
                            /\u2013/g,
                            '-'
                        )
                        .replace(
                            /\u2014/g,
                            '-'
                        )
                        .replace(
                            /[ \t]+/g,
                            ' '
                        )
                        .trim();

                    console.log(
                        'AI RESPONSE:',
                        answer
                    );

                    await botReply(
                        message,
                        answer
                    );

                    return;
                }

                default:

                    await botReply(
                        message,
                        'Perintah tidak dikenal. Ketik /menu untuk melihat menu.'
                    );

                    return;
            }

        } catch (error) {

            console.error(
                'BOT ERROR:',
                error
            );

            await botReply(
                message,
                'Terjadi kesalahan saat memproses perintah.'
            );
        }
    }
);

client.initialize();