const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { MessageMedia } = require('whatsapp-web.js');
const unzipper = require('unzipper');
const ffmpegPath = require('ffmpeg-static');
const execFileAsync = promisify(execFile);


// ==================================================
// KONFIGURASI
// ==================================================

const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/154.0.0.0 Safari/537.36';

// Izinkan konten R-18?
// Nilai ini bisa diubah SAAT BOT JALAN lewat /nsfw on|off,
// dan otomatis disimpan ke .env supaya tahan restart.
// Makanya pakai 'let', bukan 'const'.
let allowR18 =
    String(process.env.PIXIV_ALLOW_R18 || 'false')
        .toLowerCase() === 'true';

// Maksimal halaman yang dikirim per artwork
const MAX_PAGES =
    Math.max(1, parseInt(process.env.PIXIV_MAX_PAGES || '10', 10) || 10);

// Kualitas gambar: regular (maks 1200px) | original
// WhatsApp toh mengompres ke ~1600px, jadi 'regular'
// hasil akhirnya mirip tapi jauh lebih cepat & ringan.
const QUALITY =
    String(process.env.PIXIV_QUALITY || 'regular')
        .toLowerCase() === 'original'
        ? 'original'
        : 'regular';

// Pengaman ukuran. Hanya berguna kalau kamu set
// PIXIV_QUALITY=original, karena 'regular' selalu kecil.
const MAX_SEND_MB =
    parseFloat(process.env.PIXIV_MAX_SEND_MB || '5');
const SAFE_MAX_SEND_MB =
    Number.isFinite(MAX_SEND_MB) && MAX_SEND_MB > 0
        ? MAX_SEND_MB
        : 5;

const MAX_SEND_BYTES =
    SAFE_MAX_SEND_MB * 1024 * 1024;

const SEND_VIDEO =
    /^(1|true|yes|on)$/i.test(
        String(process.env.PIXIV_SEND_VIDEO || 'false').trim()
    );

const parsedVideoMaxMb =
    parseFloat(process.env.PIXIV_MAX_VIDEO_MB || '16');
const MAX_VIDEO_MB =
    Number.isFinite(parsedVideoMaxMb) && parsedVideoMaxMb > 0
        ? parsedVideoMaxMb
        : 16;
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

// Batas kandidat hasil search yang diacak
const MAX_CANDIDATES = 30;


const R18_ANGKA = parseInt(process.env.PIXIV_R18_CHANCE || '60', 10);
const R18_CHANCE = isNaN(R18_ANGKA)
    ? 60
    : Math.min(100, Math.max(0, R18_ANGKA));


const DELAY_MS = parseInt(process.env.PIXIV_DELAY_MS || '2000', 10) || 2000;

// Lama menunggu sebelum mencoba ulang setelah
// koneksi WhatsApp Web ketahuan putus.
const RECOVERY_MS = parseInt(process.env.PIXIV_RECOVERY_MS || '6000', 10) || 6000;

// Daftar tag yang SELALU disaring, walau ratingnya aman.
//
// Kenapa perlu? Karena konten jorok di Pixiv TIDAK selalu
// ditandai R-18G. Hasil pengukuran: dari 4 karya bertag
// scat, hanya 1 yang R-18G - 3 lainnya lolos, bahkan ada
// 1 yang berating AMAN.
//
// Pencocokan memakai TAG PERSIS (bukan "mengandung"),
// supaya tag tak bersalah seperti ホブルスカート (rok) dan
// スカイライダー (Kamen Rider) tidak ikut kena.
//
// Tag ini selalu disaring; PIXIV_BLOCK_TAGS menambahkan tag kustom.
const DEFAULT_BLOCK_TAGS = [
    'スカトロ',   // scat
    'スカ',       // scat
    '大スカ',     // scat
    '男スカ',     // scat pria
    '女スカ',     // scat wanita
    '排泄',       // ekskresi
    '脱糞',       // buang air besar
    '放尿',       // kencing
    '聖水',       // eufemisme kencing
    'おもらし',   // ngompol
    '糞',         // tinja
    'うんこ',     // tinja
    'グロ',       // grotesque
    '猟奇',       // kejam / aneh
    'リョナ',     // ryona
    'おしっこ',   // kencing
    '尿',         // air seni
    '妊娠',       // kehamilan
    '妊婦',       // ibu hamil
    '孕',         // hamil
    '孕肚',       // perut hamil
    '出産'        // melahirkan
];

const BLOCK_TAGS = [
    ...DEFAULT_BLOCK_TAGS,
    ...(process.env.PIXIV_BLOCK_TAGS
        ? String(process.env.PIXIV_BLOCK_TAGS).split(',')
        : [])
]
    .map(t => String(t).trim().toLowerCase())
    // AI is a source/style, not an unsafe-content rating.
    .filter(tag => tag && tag !== 'novelai' && tag !== 'aiイラスト');

// Lokasi .env, dihitung dari posisi file ini
// (features/pixiv/pixiv.js -> naik 2 tingkat)
const ENV_PATH = path.join(__dirname, '..', '..', '.env');


// ==================================================
// PENGATURAN NSFW (R-18) SAAT BOT JALAN
// ==================================================

// Tulis ulang baris PIXIV_ALLOW_R18 di .env tanpa
// merusak baris lain.
function persistR18(value) {

    try {

        if (!fs.existsSync(ENV_PATH)) {
            console.error('PIXIV: .env tidak ditemukan di', ENV_PATH);
            return false;
        }

        const isiAsli = fs.readFileSync(ENV_PATH, 'utf8');

        const baris = isiAsli.split(/\r?\n/);

        let ketemu = false;

        const barisBaru = baris.map(line => {

            if (/^\s*PIXIV_ALLOW_R18\s*=/.test(line)) {
                ketemu = true;
                return 'PIXIV_ALLOW_R18=' + value;
            }

            return line;
        });

        if (!ketemu) {
            barisBaru.push('PIXIV_ALLOW_R18=' + value);
        }

        fs.writeFileSync(
            ENV_PATH,
            barisBaru.join('\n'),
            'utf8'
        );

        return true;

    } catch (error) {

        console.error('PIXIV GAGAL SIMPAN .env:', error);
        return false;
    }
}

// Dipanggil dari index.js saat /nsfw on|off
function setR18(enabled) {

    allowR18 = Boolean(enabled);

    const tersimpan = persistR18(
        allowR18 ? 'true' : 'false'
    );

    console.log(
        '[PIXIV] NSFW diubah jadi:', allowR18,
        '| tersimpan ke .env:', tersimpan
    );

    return { allowR18, tersimpan };
}

function getR18() {
    return allowR18;
}


const RAW_COOKIE = String(
    process.env.PIXIV_COOKIE ||
    process.env.PIXIV_PHPSESSID ||
    ''
).trim();

// Kalau isinya nggak ada tanda '=', berarti cuma
// nilai session id polos.
const COOKIE_HEADER = RAW_COOKIE
    ? (RAW_COOKIE.includes('=')
        ? RAW_COOKIE
        : `PHPSESSID=${RAW_COOKIE}`)
    : '';


let cookieExpired = false;


let sudahPeringatkanR18 = false;

function buildHeaders() {

    const headers = {
        'User-Agent': UA,
        'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
        'Referer': 'https://www.pixiv.net/'
    };

    if (COOKIE_HEADER && !cookieExpired) {
        headers.Cookie = COOKIE_HEADER;
    }

    return headers;
}

console.log(
    '[PIXIV] Login:',
    COOKIE_HEADER ? 'AKTIF' : 'TANPA LOGIN',
    '| NSFW:',
    allowR18 ? 'AKTIF' : 'MATI'
);

console.log(
    '[PIXIV] Tag disaring:',
    BLOCK_TAGS.length,
    'buah'
);

console.log(
    '[PIXIV] Jeda antar halaman:',
    DELAY_MS,
    'ms | pemulihan:',
    RECOVERY_MS,
    'ms'
);

if (!COOKIE_HEADER) {
    console.log(
        '[PIXIV] Tanpa login, R-18 tidak akan muncul di search ' +
        '(batasan Pixiv, bukan bug).'
    );
}


function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function mb(bytes) {
    return (bytes / 1048576).toFixed(2) + ' MB';
}

function safeUnlink(filePath) {

    try {

        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

    } catch (error) {

        console.error('PIXIV UNLINK ERROR:', error);
    }
}

async function fetchJson(url) {

    const request = () => fetch(url, {
        headers: buildHeaders(),
        signal: AbortSignal.timeout(30000)
    });

    let response = await request();

    
    if (
        response.status === 401 &&
        COOKIE_HEADER &&
        !cookieExpired
    ) {

        cookieExpired = true;

        console.warn(
            '[PIXIV] Cookie ditolak Pixiv (HTTP 401). ' +
            'Kemungkinan sudah expired. ' +
            'Lanjut mode tanpa login - R-18 tidak akan muncul. ' +
            'Ambil PHPSESSID baru lalu update .env.'
        );

        response = await request();
    }

    if (response.status === 401) {
        throw new Error(
            'Ditolak Pixiv (401). Cookie tidak valid.'
        );
    }

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();

    if (json.error) {
        throw new Error(
            json.message || 'Pixiv mengembalikan error'
        );
    }

    return json.body;
}

function extractIllustId(input) {

    const patterns = [
        /artworks\/(\d+)/i,
        /[?&]illust_id=(\d+)/i,
        /^(\d{6,})$/
    ];

    for (const pattern of patterns) {

        const match = input.match(pattern);

        if (match) {
            return match[1];
        }
    }

    return null;
}


function kenaBlokir(tags) {

    if (!BLOCK_TAGS.length) {
        return null;
    }

    for (const t of (tags || [])) {

        const nilaiTag = t && typeof t === 'object'
            ? (t.tag || t.name || '')
            : t;
        const bersih = String(nilaiTag).trim().toLowerCase();

        if (BLOCK_TAGS.includes(bersih)) {
            return bersih;
        }
    }

    return null;
}

function artworkTags(detail) {
    return ((detail.tags && detail.tags.tags) || [])
        .map(tag => typeof tag === 'string' ? tag : tag.tag);
}

function artworkAllowed(detail) {
    if (!detail || ![0, 1, 2].includes(detail.illustType)) {
        return false;
    }

    if (detail.illustType === 2 && !SEND_VIDEO) {
        return false;
    }

    if (detail.xRestrict !== 0 && detail.xRestrict !== 1) {
        return false;
    }

    if (!allowR18 && detail.xRestrict !== 0) {
        return false;
    }

    return !kenaBlokir(artworkTags(detail));
}

function shuffle(items) {
    const shuffled = items.slice();

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

function extFromUrl(url) {

    const match = url
        .split('?')[0]
        .match(/\.(jpg|jpeg|png|gif|webp)$/i);

    return match
        ? '.' + match[1].toLowerCase()
        : '.jpg';
}



async function searchPixiv(keyword) {

    console.log('PIXIV SEARCH:', keyword);
    console.log(
        'PIXIV MODE:',
        COOKIE_HEADER && !cookieExpired
            ? 'LOGIN'
            : 'TANPA LOGIN',
        '| NSFW:',
        allowR18 ? 'AKTIF' : 'MATI'
    );

    const word = encodeURIComponent(keyword);

    const url =
        'https://www.pixiv.net/ajax/search/artworks/' +
        word +
        '?word=' + word +
        '&order=date_d' +
        '&mode=all' +
        '&p=1' +
        '&s_mode=s_tag' +
        '&type=all' +
        '&lang=ja';

    const body = await fetchJson(url);

    const data =
        (body && body.illustManga && body.illustManga.data) || [];

    const jumlahR18 = data.filter(
        item => item && item.xRestrict === 1
    ).length;

    console.log(
        'PIXIV SEARCH HASIL:',
        data.length,
        '| R-18:',
        jumlahR18,
        '| NSFW:',
        allowR18 ? 'AKTIF' : 'MATI'
    );

    
    if (
        COOKIE_HEADER &&
        !cookieExpired &&
        jumlahR18 === 0 &&
        !sudahPeringatkanR18
    ) {

        sudahPeringatkanR18 = true;

        console.warn(
            '[PIXIV] Catatan: search ini tidak menghasilkan R-18. ' +
            'Kalau tag lain juga selalu 0, baru cek setting ' +
            'tampilan R-18 (閲覧設定) di akun Pixiv. ' +
            'Tag yang memang bersih itu wajar 0.'
        );
    }

    return data;
}



function toPage(urls) {

    return {
        original: urls.original,
        regular: urls.regular,
        small: urls.small,
        thumb: urls.thumb
    };
}

async function getIllust(id) {

    console.log('PIXIV DETAIL:', id);

    const detail = await fetchJson(
        `https://www.pixiv.net/ajax/illust/${id}?lang=ja`
    );

    let pages = [];

    if (detail.pageCount > 1) {

        const pageData = await fetchJson(
            `https://www.pixiv.net/ajax/illust/${id}/pages?lang=ja`
        );

        pages = (pageData || []).map(
            item => toPage(item.urls)
        );
    }

    if (!pages.length) {
        pages = [toPage(detail.urls)];
    }

    return { detail, pages };
}

async function getUgoiraMeta(id) {
    return fetchJson(
        `https://www.pixiv.net/ajax/illust/${id}/ugoira_meta?lang=ja`
    );
}




async function downloadImage(url, outputPath) {

    const response = await fetch(url, {
        headers: buildHeaders(),
        signal: AbortSignal.timeout(120000)
    });

    if (!response.ok) {
        throw new Error(`Download HTTP ${response.status}`);
    }

    const buffer = Buffer.from(
        await response.arrayBuffer()
    );

    if (!buffer.length) {
        throw new Error('Pixiv mengirim file gambar kosong.');
    }

    fs.writeFileSync(outputPath, buffer);

    return {
        size: buffer.length,
        hash: crypto.createHash('sha256').update(buffer).digest('hex')
    };
}

function escapeConcatPath(filePath) {
    return filePath
        .replace(/\\/g, '/')
        .replace(/'/g, "'\\''");
}

async function downloadUgoiraVideo(illustId, tempDir) {
    if (!ffmpegPath) {
        throw new Error('ffmpeg-static tidak tersedia.');
    }

    const metadata = await getUgoiraMeta(illustId);
    const sourceUrl = metadata.originalSrc || metadata.src;

    if (!sourceUrl || !Array.isArray(metadata.frames) || !metadata.frames.length) {
        throw new Error('Metadata ugoira Pixiv tidak lengkap.');
    }

    const parsedSourceUrl = new URL(sourceUrl);
    if (
        parsedSourceUrl.protocol !== 'https:' ||
        !parsedSourceUrl.hostname.endsWith('.pximg.net')
    ) {
        throw new Error('URL video ugoira Pixiv tidak valid.');
    }

    const response = await fetch(parsedSourceUrl, {
        headers: buildHeaders(),
        signal: AbortSignal.timeout(120000)
    });

    if (!response.ok) {
        throw new Error(`Download ugoira HTTP ${response.status}`);
    }

    const zipPath = path.join(tempDir, `pixiv_${illustId}.zip`);
    const zipBuffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile(zipPath, zipBuffer);

    const archive = await unzipper.Open.file(zipPath);
    const framePaths = [];
    const concatLines = [];

    for (let i = 0; i < metadata.frames.length; i++) {
        const frame = metadata.frames[i];
        const frameName = String((frame && frame.file) || '');
        const extension = path.extname(frameName).toLowerCase();

        if (
            !frameName ||
            path.basename(frameName) !== frameName ||
            !['.jpg', '.jpeg', '.png'].includes(extension)
        ) {
            throw new Error(`Nama frame ugoira tidak valid: ${frameName}`);
        }

        const entry = archive.files.find(
            item => item.path === frameName && item.type === 'File'
        );

        if (!entry) {
            throw new Error(`Frame ugoira tidak ditemukan: ${frameName}`);
        }

        const framePath = path.join(
            tempDir,
            `frame_${String(i).padStart(6, '0')}${extension}`
        );
        await fs.promises.writeFile(framePath, await entry.buffer());
        framePaths.push(framePath);

        const delayMs = Number(frame.delay);
        const duration = Number.isFinite(delayMs) && delayMs > 0
            ? delayMs / 1000
            : 0.1;

        concatLines.push(
            `file '${escapeConcatPath(framePath)}'`,
            `duration ${duration}`
        );
    }

    const concatPath = path.join(tempDir, 'frames.txt');
    const videoPath = path.join(tempDir, `pixiv_${illustId}.mp4`);
    concatLines.push(`file '${escapeConcatPath(framePaths[framePaths.length - 1])}'`);
    await fs.promises.writeFile(concatPath, concatLines.join('\n'), 'utf8');

    await execFileAsync(ffmpegPath, [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', concatPath,
        '-vsync', 'vfr',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-an',
        videoPath
    ], {
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024
    });

    const videoStat = await fs.promises.stat(videoPath);
    if (!videoStat.size) {
        throw new Error('Video ugoira kosong setelah dikonversi.');
    }
    if (videoStat.size > MAX_VIDEO_BYTES) {
        throw new Error(
            `Ukuran video ${mb(videoStat.size)} melebihi ` +
            `PIXIV_MAX_VIDEO_MB (${MAX_VIDEO_MB} MB).`
        );
    }

    console.log(
        '[PIXIV] Ugoira dikonversi:',
        mb(videoStat.size),
        `(${framePaths.length} frame)`
    );

    return videoPath;
}


// ==================================================
// KIRIM GAMBAR KE WHATSAPP
//
// PENTING - JANGAN DIUBAH SEMBARANGAN:
//
//   message.reply(content, chatId, options)
//
// Argumen KEDUA adalah chatId, BUKAN caption!
// Kalau caption ditaruh di argumen kedua, whatsapp-web.js
// menganggapnya sebagai ID chat, gagal menemukan chat-nya,
// dan error yang muncul cuma "t" dari kode minified
// WhatsApp (sangat sulit dilacak).
//
// Caption HARUS lewat options.caption.
// Lihat: node_modules/whatsapp-web.js/src/Client.js:1462
// ==================================================

async function sendImage(message, imagePath, caption) {

    const media = MessageMedia.fromFilePath(imagePath);

    await message.reply(
        media,
        undefined,
        {
            caption: caption,
            sendMediaAsDocument: false
        }
    );
}

async function sendVideo(message, videoPath, caption) {
    const media = MessageMedia.fromFilePath(videoPath);

    await message.reply(
        media,
        undefined,
        {
            caption: caption,
            sendMediaAsDocument: false
        }
    );
}


// ==================================================
// TAHAN BANTING: KONEKSI WHATSAPP WEB PUTUS
// ==================================================

// Pola error yang menandakan halaman WhatsApp Web
// sudah tidak bisa dipakai lagi (ter-reload / mati).
const POLA_PUTUS = /detached|session closed|target closed|execution context was destroyed|protocol error|connection closed|page crashed/i;

function koneksiPutus(error) {

    const pesan = String((error && error.message) || error || '');

    return POLA_PUTUS.test(pesan);
}

// Kirim satu halaman. Kalau gagal karena koneksi putus,
// tunggu sebentar lalu coba SEKALI lagi.
//
// Mengembalikan { ok, pulih, fatal, error }:
//   ok    -> berhasil terkirim
//   pulih -> berhasil setelah dicoba ulang
//   fatal -> koneksi putus dan tidak pulih (STOP)
async function kirimDenganPulih(
    message,
    mediaPath,
    pageCaption,
    nomor,
    sendMedia = sendImage
) {

    try {

        await sendMedia(message, mediaPath, pageCaption);

        return { ok: true, pulih: false };

    } catch (error) {

        if (!koneksiPutus(error)) {
            return { ok: false, fatal: false, error: error };
        }

        console.warn(
            `PIXIV HALAMAN ${nomor}: koneksi WhatsApp Web terputus.` +
            ` Menunggu ${RECOVERY_MS} ms lalu coba sekali lagi...`
        );

        await delay(RECOVERY_MS);

        try {

            await sendMedia(message, mediaPath, pageCaption);

            return { ok: true, pulih: true };

        } catch (errorUlang) {

            return { ok: false, fatal: true, error: errorUlang };
        }
    }
}

// Kasih tahu user kalau proses dihentikan di tengah jalan.
// Dibungkus try/catch karena kalau koneksinya memang mati,
// pesan ini pun bisa ikut gagal.
async function kabariBerhenti(message, nomor, total) {

    try {

        await message.reply(
            '⚠️ Koneksi WhatsApp Web sempat terputus di tengah proses.\n\n' +
            `Berhenti di halaman ${nomor} dari ${total}.\n` +
            'Coba kirim ulang perintahnya beberapa saat lagi.'
        );

    } catch (error) {

        console.error(
            'PIXIV: gagal kirim pesan pemberitahuan:',
            error && error.message
        );
    }
}

// ==================================================
// HANDLER UTAMA
// ==================================================

async function handlePixiv(message, input, client) {

    let tempDir = null;
    let sentPages = 0;
    const sentMediaHashes = new Set();

    try {

        if (!input) {

            await message.reply(
                '❌ Masukkan kata kunci atau link Pixiv woy.\n\n' +
                'Contoh:\n' +
                '/pixiv kucing\n' +
                '/pixiv hatsune miku\n' +
                '/pixiv https://www.pixiv.net/artworks/123456'
            );

            return;
        }

        await message.reply('⏳ Nyari di Pixiv sabar...');

        const directId = extractIllustId(input);

        let illustId = directId;
        let illust = null;

        // ==================================================
        // MODE LINK
        // ==================================================

        if (directId) {

            console.log('PIXIV MODE: LINK', directId);

            illust = await getIllust(directId);

        }

        // ==================================================
        // MODE SEARCH
        // ==================================================

        else {

            const results = await searchPixiv(input);

            // Buang entri kosong, ugoira saat video dinonaktifkan, & R-18.
            //
            // Catatan: Pixiv suka menyelipkan 1 entri KOSONG
            // (tanpa 'id') di hasil search. Kalau entri itu lolos
            // dan terpilih acak, bot gagal dengan "id undefined".
            // Jadi cek '!item.id' harus SELALU jalan, terlepas
            // dari setting NSFW.
            const ids = new Set();
            const candidates = results.filter(item => {

                if (!item || !item.id || ids.has(String(item.id))) {
                    return false;
                }

                ids.add(String(item.id));

                if (item.illustType === 2 && !SEND_VIDEO) {
                    return false;
                }

                // R-18G (ero-guro / gore) SELALU dibuang,
                // walau NSFW sedang aktif. Konten gore beda
                // kelas dengan R-18 biasa.
                if (item.xRestrict === 2) {
                    return false;
                }

                if (item.xRestrict !== 0 && item.xRestrict !== 1) {
                    return false;
                }

                // Tag jorok (scat dll) SELALU dibuang,
                // karena sering tidak ditandai R-18G.
                if (kenaBlokir(item.tags)) {
                    return false;
                }

                if (!allowR18 && item.xRestrict !== 0) {
                    return false;
                }

                return true;
            });

            console.log(
                'PIXIV KANDIDAT AMAN:',
                candidates.length,
                'dari',
                results.length,
                '| aman + R-18 dibuang:',
                results.length - candidates.length
            );

            if (!candidates.length) {

                await message.reply(
                    '❌ Nggak ada hasil yang cocok ah males.\n' +
                    'Coba kata kunci lain, atau pakai tag Jepang kek.'
                );

                return;
            }

            const kandidatAman = candidates.filter(
                x => x.xRestrict === 0
            );

            const kandidatR18 = candidates.filter(
                x => x.xRestrict !== 0
            );

            let poolUtama;
            let poolCadangan = [];

            if (allowR18 && kandidatR18.length && kandidatAman.length) {

                const pilihR18 = Math.random() * 100 < R18_CHANCE;

                poolUtama = shuffle(pilihR18 ? kandidatR18 : kandidatAman);
                poolCadangan = shuffle(pilihR18 ? kandidatAman : kandidatR18);

                console.log(
                    `PIXIV UNDIAN: peluang R-18 ${R18_CHANCE}% ->`,
                    pilihR18 ? 'R-18' : 'AMAN',
                    `(aman ${kandidatAman.length}, R-18 ${kandidatR18.length}); ` +
                    'kandidat cadangan dicoba bila perlu'
                );

            } else {

                poolUtama = shuffle(
                    kandidatAman.length ? kandidatAman : kandidatR18
                );
            }

            const pool = poolUtama
                .concat(poolCadangan)
                .slice(0, MAX_CANDIDATES);
            let lastCandidateError = null;

            for (const candidate of pool) {
                try {
                    const candidateIllust = await getIllust(candidate.id);

                    if (!artworkAllowed(candidateIllust.detail)) {
                        console.warn(
                            '[PIXIV] Kandidat detail tidak lolos filter:',
                            candidate.id
                        );
                        continue;
                    }

                    illustId = candidate.id;
                    illust = candidateIllust;
                    console.log(
                        'PIXIV DIPILIH:',
                        candidate.id,
                        candidate.title
                    );
                    break;
                } catch (candidateError) {
                    lastCandidateError = candidateError;
                    console.error(
                        '[PIXIV] Kandidat gagal diambil, lanjut kandidat lain:',
                        candidate.id,
                        candidateError.message
                    );
                }
            }

            if (!illust) {
                if (lastCandidateError) {
                    throw new Error(
                        `Semua ${pool.length} kandidat Pixiv gagal diambil.`,
                        { cause: lastCandidateError }
                    );
                }

                await message.reply(
                    '❌ Hasil ditemukan, tetapi semuanya terblokir oleh ' +
                    'filter keamanan atau tidak bisa diproses.'
                );
                return;
            }
        }

        const detail = illust.detail;
        const pages = illust.pages;

        // ==================================================
        // VALIDASI
        // ==================================================

        if (detail.xRestrict === 2) {

            await message.reply(
                '🚫 Karya ini tidak pantas.\n' +
                'Konten ini dinyalakan tolong di gunakan dengan bijak bro.'
            );

            return;
        }

        const tagDiblokir = kenaBlokir(artworkTags(detail));
        if (tagDiblokir) {

            await message.reply(
                '🚫 Karya ini mengandung tag yang disaring' +
                ` (${tagDiblokir}).`
            );

            return;
        }

        if (!allowR18 && detail.xRestrict === 1) {
            await message.reply(
                '🔞 Karya ini R-18.\n' +
                'Ketik /nsfw on kalau memang mau ditampilkan.'
            );
            return;
        }

        if (!artworkAllowed(detail)) {
            await message.reply(
                '🚫 Karya ini tidak lolos filter keamanan Pixiv.'
            );
            return;
        }

        // ==================================================
        // TEMP FOLDER
        // ==================================================

        tempDir = await fs.promises.mkdtemp(
            path.join(os.tmpdir(), 'wa-bot-pixiv-')
        );

        const limit = MAX_PAGES;
        const selected = pages.slice(0, limit);
        const potong =
            pages.length > limit
                ? ` (dikirim ${limit})`
                : '';

        await message.reply(
            `🎨 ${detail.illustTitle}\n` +
            `👤 ${detail.userName}\n` +
            (detail.illustType === 2
                ? '🎞️ Video ugoira\n'
                : `🖼️ ${detail.pageCount} halaman${potong}\n`) +
            (allowR18
                ? `🔞 NSFW: AKTIF (peluang ${R18_CHANCE}%)\n`
                : '✅ NSFW: OFF\n') +
            '\n📥 Otw bro...'
        );

        const caption =
            `🎨 ${detail.illustTitle}\n` +
            `👤 ${detail.userName}\n` +
            `🔗 https://www.pixiv.net/artworks/${illustId}`;

        if (detail.illustType === 2) {
            const videoPath = await downloadUgoiraVideo(
                illustId,
                tempDir
            );
            const hasilKirim = await kirimDenganPulih(
                message,
                videoPath,
                caption,
                1,
                sendVideo
            );

            if (hasilKirim.fatal) {
                await kabariBerhenti(message, 1, 1);
                return;
            }
            if (!hasilKirim.ok) {
                throw hasilKirim.error;
            }

            console.log('PIXIV UGOIRA SENT');
            return;
        }

        // ==================================================
        // DOWNLOAD + KIRIM SEMUA HALAMAN
        // ==================================================

        let koneksiGagal = false;
        let skippedDuplicates = 0;

        for (let i = 0; i < selected.length; i++) {
            const page = selected[i];

            const firstUrl = page[QUALITY] || page.original;
            const variants = [...new Set([
                firstUrl,
                page.regular,
                page.small,
                page.thumb
            ].filter(Boolean))];
            let pageSent = false;
            let duplicateMedia = false;
            let lastSendError = null;
            const attemptedHashes = new Set();

            try {

                for (let variantIndex = 0; variantIndex < variants.length; variantIndex++) {
                    const variantUrl = variants[variantIndex];
                    const imagePath = path.join(
                        tempDir,
                        `pixiv_p${i}_v${variantIndex}` +
                        extFromUrl(variantUrl)
                    );

                    try {
                        const { size, hash } = await downloadImage(
                            variantUrl,
                            imagePath
                        );

                        if (sentMediaHashes.has(hash)) {
                            duplicateMedia = true;
                            safeUnlink(imagePath);
                            console.log(
                                `PIXIV HALAMAN ${i + 1} DUPLIKAT, dilewati`
                            );
                            break;
                        }

                        if (attemptedHashes.has(hash)) {
                            safeUnlink(imagePath);
                            continue;
                        }
                        attemptedHashes.add(hash);

                        if (size > MAX_SEND_BYTES && variantIndex < variants.length - 1) {
                            console.warn(
                                `PIXIV HALAMAN ${i + 1} ${mb(size)}; ` +
                                'mencoba varian gambar lebih kecil'
                            );
                            safeUnlink(imagePath);
                            continue;
                        }

                        console.log(
                            `PIXIV HALAMAN ${i + 1}/${selected.length} READY:`,
                            mb(size),
                            `(varian ${variantIndex + 1}/${variants.length})`
                        );

                        const pageCaption =
                            selected.length > 1
                                ? `${i + 1}/${selected.length}\n${caption}`
                                : caption;
                        const hasilKirim = await kirimDenganPulih(
                            message,
                            imagePath,
                            pageCaption,
                            i + 1
                        );

                        if (hasilKirim.ok) {
                            sentMediaHashes.add(hash);
                            sentPages++;
                            pageSent = true;
                            console.log(
                                `PIXIV HALAMAN ${i + 1} SENT` +
                                (hasilKirim.pulih ? ' (setelah pulih)' : '')
                            );
                            break;
                        }

                        lastSendError = hasilKirim.error;
                        safeUnlink(imagePath);

                        if (hasilKirim.fatal) {
                            koneksiGagal = true;
                            console.error(
                                `PIXIV DIHENTIKAN di halaman ${i + 1}` +
                                ` dari ${selected.length}: koneksi putus.`
                            );
                            await kabariBerhenti(
                                message,
                                i + 1,
                                selected.length
                            );
                            break;
                        }

                        console.error(
                            `PIXIV HALAMAN ${i + 1} GAGAL KIRIM; ` +
                            'mencoba varian berikutnya:',
                            lastSendError && lastSendError.message
                        );
                    } catch (variantError) {
                        lastSendError = variantError;
                        safeUnlink(imagePath);
                        console.error(
                            `PIXIV HALAMAN ${i + 1} VARIAN ${variantIndex + 1} GAGAL:`,
                            variantError.message
                        );
                    }

                    if (koneksiGagal) {
                        break;
                    }
                }
            }
            catch (pageError) {
                lastSendError = pageError;
                console.error(`PIXIV HALAMAN ${i + 1} GAGAL:`, pageError);
            }

            if (!pageSent && !duplicateMedia && lastSendError) {
                console.error(
                    `PIXIV HALAMAN ${i + 1} TIDAK TERKIRIM:`,
                    lastSendError.message
                );
            }
            if (duplicateMedia) {
                skippedDuplicates++;
            }

            // jeda biar WhatsApp Web nggak kebanjiran
            if (!koneksiGagal && i < selected.length - 1) {
                await delay(DELAY_MS);
            }

            if (koneksiGagal) {
                break;
            }
        }

        if (!sentPages) {
            throw new Error('Tidak ada halaman Pixiv yang berhasil dikirim.');
        }

        const failedPages =
            selected.length - sentPages - skippedDuplicates;
        if (failedPages > 0 && !koneksiGagal) {
            await message.reply(
                `⚠️ Berhasil mengirim ${sentPages} dari ` +
                `${selected.length} halaman Pixiv. ` +
                `${failedPages} halaman gagal setelah mencoba varian lain.`
            );
        }

    }

    catch (error) {

        console.error('PIXIV ERROR:', error);

        await message.reply(
            '❌ Gagal mengambil karya Pixiv.\n' +
            'Cek kata kunci atau lihat log PM2.'
        );

    }

    finally {

        if (tempDir) {
            try {
                await fs.promises.rm(tempDir, {
                    recursive: true,
                    force: true
                });
                console.log('PIXIV TEMP DIHAPUS:', path.basename(tempDir));
            } catch (cleanupError) {
                console.error('PIXIV CLEANUP ERROR:', cleanupError);
            }
        }
    }
}

module.exports = {
    handlePixiv,
    setR18,
    getR18,
    kenaBlokir
};
