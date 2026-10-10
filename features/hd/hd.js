const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const ffmpegPath = require('ffmpeg-static');
const { MessageMedia } = require('whatsapp-web.js');

const execFileAsync = promisify(execFile);


// ==================================================
// /hd - PERBESAR & PERTAJAM GAMBAR
//
// JUJUR SOAL BATASANNYA:
//
// WhatsApp mengompres foto yang dikirim lewat chat
// biasa (kecilin ke ~1600px + JPEG). Jadi foto yang
// diterima bot sudah versi rusak.
//
// Fitur ini MEMPERBESAR dan MEMPERTAJAM, tapi TIDAK
// bisa mengembalikan detail yang sudah hilang.
//
// Supaya hasilnya maksimal, kirim fotonya sebagai
// DOKUMEN (bukan Galeri) - WhatsApp tidak mengompres
// dokumen, jadi bot menerima file aslinya utuh.
//
// Untuk AI upscale yang benar-benar menambah detail,
// perlu layanan/model terpisah (belum dipasang).
// ==================================================

// Berapa kali diperbesar
const SKALA =
    parseInt(process.env.HD_SCALE || '2', 10) || 2;

// Batas sisi terpanjang hasil (biar nggak jadi raksasa)
const MAX_PX =
    parseInt(process.env.HD_MAX_PX || '4096', 10) || 4096;

// Kualitas JPEG (1 = terbaik, 31 = terburuk)
const KUALITAS =
    parseInt(process.env.HD_QUALITY || '2', 10) || 2;

const MIME_DIDUKUNG = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
];


// ==================================================
// UTIL
// ==================================================

function safeUnlink(filePath) {

    try {

        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

    } catch (error) {

        console.error('HD UNLINK ERROR:', error && error.message);
    }
}

// Cek apakah API internal WhatsApp Web masih tersedia.
//
// whatsapp-web.js mengambil media masuk lewat nama-nama
// internal WhatsApp (WAWebCollections, WAWebDownloadManager).
// Kalau WhatsApp Web update dan nama itu berubah, unduhan
// media GAGAL TOTAL - tapi errornya cuma tampil sebagai "t"
// tanpa penjelasan. Fungsi ini bikin penyebabnya kelihatan.
async function cekInternalWa(client) {

    try {

        if (!client || !client.pupPage) {
            return 'klien WhatsApp belum siap';
        }

        return await client.pupPage.evaluate(() => {

            const hasil = {};

            try {
                hasil.collections = !!window.require('WAWebCollections');
            } catch (e) {
                hasil.collections = 'ERROR: ' + (e && e.message);
            }

            try {
                const dm = window.require('WAWebDownloadManager');
                hasil.downloadManager = !!(dm && dm.downloadManager);
            } catch (e) {
                hasil.downloadManager = 'ERROR: ' + (e && e.message);
            }

            return JSON.stringify(hasil);
        });

    } catch (error) {

        return 'gagal cek: ' + (error && error.message);
    }
}

// Bongkar status media langsung dari data WhatsApp Web.
//
// Ini yang paling menentukan: kalau mediaStage-nya
// bukan RESOLVED (misal REUPLOADING / ERROR / FETCHING),
// berarti WhatsApp sendiri belum berhasil mengambil
// medianya - dan itu tidak bisa dibenerin dari sisi bot.
async function cekStatusMedia(client, msgId) {

    try {

        if (!client || !client.pupPage) {
            return 'klien WhatsApp belum siap';
        }

        if (!msgId) {
            return 'id pesan tidak ada';
        }

        return await client.pupPage.evaluate(async (id) => {

            const out = {};

            try {

                const K = window.require('WAWebCollections');

                let msg = K.Msg.get(id);

                if (!msg) {
                    const hasil = await K.Msg.getMessagesById([id]);
                    msg = hasil && hasil.messages && hasil.messages[0];
                }

                out.ketemu = !!msg;

                if (!msg) return JSON.stringify(out);

                out.type = msg.type;
                out.mimetype = msg.mimetype;
                out.size = msg.size;
                out.directPath = msg.directPath ? 'ADA' : 'KOSONG';
                out.mediaKey = msg.mediaKey ? 'ADA' : 'KOSONG';
                out.mediaStage = msg.mediaData
                    ? msg.mediaData.mediaStage
                    : '(tanpa mediaData)';
                out.viewOnce = !!msg.isViewOnce;
                out.WWebJS = !!(
                    window.WWebJS &&
                    window.WWebJS.arrayBufferToBase64Async
                );

            } catch (e) {
                out.error = String(e && e.message);
            }

            return JSON.stringify(out);

        }, msgId);

    } catch (error) {

        return 'gagal cek: ' + (error && error.message);
    }
}

// ==================================================
// CARA UNDUH CADANGAN
//
// downloadMedia() bawaan whatsapp-web.js menelan error
// aslinya, jadi yang kelihatan cuma satu huruf acak.
//
// Fungsi ini mengulang langkah yang sama TAPI dengan
// try/catch sendiri, jadi pesan error sebenarnya
// kelihatan. Sekalian memakai mockQpl yang tahan
// method apa pun - versi bawaan cuma menyediakan 2
// method, dan WhatsApp Web yang lebih baru bisa
// memanggil method lain (langsung error).
// ==================================================
async function unduhMediaSendiri(client, msgId) {

    if (!client || !client.pupPage || !msgId) {
        return { ok: false, error: 'klien atau id pesan tidak siap' };
    }

    return await client.pupPage.evaluate(async (id) => {

        const out = { langkah: [] };

        try {

            const K = window.require('WAWebCollections');

            let msg = K.Msg.get(id);

            if (!msg) {
                const hasil = await K.Msg.getMessagesById([id]);
                msg = hasil && hasil.messages && hasil.messages[0];
            }

            if (!msg) { out.error = 'pesan tidak ketemu di store'; return out; }

            out.mediaStage = msg.mediaData ? msg.mediaData.mediaStage : null;

            if (msg.mediaData && msg.mediaData.mediaStage !== 'RESOLVED') {
                out.langkah.push('resolve');
                await msg.downloadMedia({
                    downloadEvenIfExpensive: true,
                    rmrReason: 1,
                });
                out.mediaStageSetelahResolve = msg.mediaData.mediaStage;
            }

            out.langkah.push('decrypt');

            // mockQpl tahan method apa pun: properti apa saja
            // mengembalikan fungsi yang mengembalikan dirinya.
            const qpl = new Proxy({}, {
                get(t, p) {
                    if (p === 'then') return undefined;
                    return () => qpl;
                }
            });

            const dasar = {
                directPath: msg.directPath,
                encFilehash: msg.encFilehash,
                filehash: msg.filehash,
                mediaKey: msg.mediaKey,
                mediaKeyTimestamp: msg.mediaKeyTimestamp,
                signal: new AbortController().signal,
                downloadQpl: qpl,
            };

            // WhatsApp menolak unduhan kalau mimetype-nya tidak
            // dikenal:
            //   "Unexpected mimetype application/octet-stream
            //    for media type image"
            //
            // Padahal versi bawaan whatsapp-web.js TIDAK
            // mengirim mimetype sama sekali. Jadi kita coba
            // beberapa bentuk sekaligus, lalu laporkan mana
            // yang lolos.
            const varian = [
                { nama: 'bawaan: type saja', opsi: { type: msg.type } },
                { nama: 'type + mimetype', opsi: { type: msg.type, mimetype: msg.mimetype } },
                { nama: 'mimetype saja', opsi: { mimetype: msg.mimetype } },
                { nama: 'type = mimetype', opsi: { type: msg.mimetype } },
                { nama: 'tanpa type & mimetype', opsi: {} },
            ];

            const dm = window.require('WAWebDownloadManager').downloadManager;

            out.percobaan = [];

            for (const v of varian) {

                try {

                    const buf = await dm.downloadAndMaybeDecrypt(
                        Object.assign({}, dasar, v.opsi)
                    );

                    const data =
                        await window.WWebJS.arrayBufferToBase64Async(buf);

                    out.ok = true;
                    out.varianBerhasil = v.nama;
                    out.panjang = data ? data.length : 0;
                    out.mimetype = msg.mimetype;
                    out.filename = msg.filename;
                    out.size = msg.size;
                    out.data = data;

                    return out;

                } catch (e) {

                    out.percobaan.push({
                        varian: v.nama,
                        error: String((e && e.message) || e)
                    });
                }
            }

            out.error = 'semua varian gagal';
            return out;

        } catch (e) {

            out.error = String((e && e.message) || e);
            out.errorName = e && e.name;
            out.errorStack = e && e.stack
                ? String(e.stack).slice(0, 600)
                : null;

            return out;
        }

    }, msgId);
}

// ==================================================
// PASTIKAN ID PESANNYA ADA
//
// downloadMedia() mengambil media lewat ID pesan
// (this.id._serialized). Kalau ID-nya kosong, WhatsApp
// mencari pesan ber-ID "undefined", gagal, dan error-nya
// cuma tampil sebagai satu huruf acak (t / r).
//
// Format ID WhatsApp:
//   fromMe_remote_namaId_participant
// contoh:
//   false_123@g.us_ABC123_456@lid
//
// Di beberapa kondisi _serialized tidak terisi, jadi kita
// bangun ulang dari bagian-bagiannya.
// ==================================================
function pastikanIdPesan(pesan) {

    if (!pesan || !pesan.id) {
        console.error('HD: pesan tidak punya id sama sekali');
        return null;
    }

    const id = pesan.id;

    // Bentuk 1: id-nya sudah berupa string
    if (typeof id === 'string') {
        console.warn('HD: id berupa string, dibungkus jadi objek');
        pesan.id = { _serialized: id };
        return id;
    }

    // Bentuk 2: sudah lengkap
    if (id._serialized) {
        return id._serialized;
    }

    // Bentuk 3: bangun ulang dari bagian-bagiannya
    if (id.remote && id.id) {

        const gabung =
            `${id.fromMe}_${id.remote}_${id.id}` +
            (id.participant ? '_' + id.participant : '');

        // tempelkan supaya downloadMedia() bisa memakainya
        id._serialized = gabung;

        console.warn('HD: _serialized kosong, dibangun ulang ->', gabung);

        return gabung;
    }

    // Bentuk 4: tidak dikenali - laporkan isinya
    console.error(
        'HD: tidak bisa membangun id pesan. Isinya:',
        JSON.stringify(id)
    );

    return null;
}

// Ubah ukuran file jadi teks yang enak dibaca.
// Contoh: 55706 -> "54 KB", 2411724 -> "2.3 MB"
function formatUkuran(bytes) {

    if (!bytes || bytes < 0) return "0 KB";

    if (bytes >= 1048576) {
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    return Math.round(bytes / 1024) + ' KB';
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Bersihkan nama file asli biar aman dipakai
function bersihkanNama(nama) {

    if (!nama) return '';

    return String(nama)
        .replace(/\.[^.]+$/, '')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 60)
        .replace(/^_+|_+$/g, '');
}


// ==================================================
// HANDLER
// ==================================================

async function handleHd(message, client) {

    let inputPath = null;
    let outputPath = null;

    try {

        // ==================================================
        // 1. CARI SUMBER GAMBARNYA
        //
        // Bisa dari pesan ini sendiri (foto + caption /hd),
        // atau dari pesan yang dibalas.
        // ==================================================

        console.log(
            'HD DEBUG: type =', message.type,
            '| hasMedia =', message.hasMedia,
            '| quoted =', message.hasQuotedMsg
        );

        let sumber = null;

        if (message.hasMedia && message.type !== 'sticker') {

            sumber = message;

        } else if (message.hasQuotedMsg) {

            const quoted = await message.getQuotedMessage();

            if (quoted && quoted.hasMedia && quoted.type !== 'sticker') {
                sumber = quoted;
            }
        }

        if (!sumber) {

            // Singkat saja - kalau panjang malah ramai di grup.
            await message.reply('📸 Mana fotonya?');

            return;
        }

        // ==================================================
        // 2. UNDUH GAMBARNYA (coba sampai 2 kali)
        //
        // downloadMedia() hanya "gagal diam-diam" kalau
        // servernya balas 404. Selain itu error-nya dilempar
        // dari dalam halaman WhatsApp, dan yang kelihatan di
        // log cuma "t" - tidak informatif sama sekali.
        // ==================================================

        // Perbaiki dulu ID pesannya kalau perlu - tanpa ini,
        // downloadMedia() pasti gagal.
        pastikanIdPesan(sumber);

        let media = null;
        let galatUnduh = null;

        // Cukup SEKALI. Cara bawaan ini memang selalu gagal
        // di sini (whatsapp-web.js tidak mengirim mimetype),
        // jadi mengulanginya cuma bikin lambat 2,5 detik.
        for (let coba = 1; coba <= 1 && !media; coba++) {

            try {

                const hasil = await sumber.downloadMedia();

                if (hasil) {
                    media = hasil;
                    break;
                }

                console.warn(
                    `HD: unduhan kosong (percobaan ${coba}) -` +
                    ' media mungkin sudah kedaluwarsa di server.'
                );

            } catch (unduhError) {

                galatUnduh = unduhError;

                console.error(
                    `HD GAGAL UNDUH (percobaan ${coba}):`,
                    '[name]', unduhError && unduhError.name,
                    '[message]', unduhError && unduhError.message,
                    '[stack]', unduhError && unduhError.stack
                );
            }

            if (coba === 1) {
                await delay(2500);
            }
        }

        // ==================================================
        // CADANGAN: unduh sendiri
        // ==================================================
        if (!media) {

            console.warn('HD: cara bawaan gagal, coba unduh manual...');

            const idPesan =
                sumber && sumber.id && sumber.id._serialized;

            const manual = await unduhMediaSendiri(client, idPesan);

            if (manual && manual.ok && manual.data) {

                media = new MessageMedia(
                    manual.mimetype || 'image/jpeg',
                    manual.data,
                    manual.filename || null,
                    manual.size || null
                );

                console.log('HD: UNDUH MANUAL BERHASIL ->', manual.panjang, 'karakter base64');
                console.log('HD: varian opsi yang lolos ->', manual.varianBerhasil);

            } else {

                console.error('HD: UNDUH MANUAL GAGAL ->', JSON.stringify({
                    error: manual && manual.error,
                    errorName: manual && manual.errorName,
                    mediaStage: manual && manual.mediaStage,
                    langkah: manual && manual.langkah,
                    percobaan: manual && manual.percobaan,
                    errorStack: manual && manual.errorStack
                }));
            }
        }

        if (!media) {

            await message.reply(
                '❌ Gagal ambil fotonya. Coba kirim ulang ya.'
            );

            if (galatUnduh) {
                console.error('HD: penyebab terakhir:', galatUnduh.message);
            }

            // Kalau API internalnya hilang, /hd memang tidak
            // akan pernah bisa jalan sampai whatsapp-web.js
            // diperbarui. Jadi penting untuk kelihatan di log.
            console.error('HD: cek API internal WhatsApp Web ->', await cekInternalWa(client));
            console.error('HD: status media ->', await cekStatusMedia(
                client,
                sumber && sumber.id && sumber.id._serialized
            ));

            console.error(
                'HD: isi id pesan ->',
                JSON.stringify(sumber && sumber.id)
            );

            return;
        }

        const mime = String(media.mimetype || '').toLowerCase();

        if (!MIME_DIDUKUNG.includes(mime)) {

            await message.reply(
                '❌ Formatnya belum didukung. Kirim JPG, PNG, ' +
                'atau WebP.'
            );

            return;
        }

        // SENGAJA TIDAK ada pesan "sedang memproses".
        // Reaksinya sudah dikirim otomatis oleh index.js
        // (botReact) begitu perintahnya masuk, jadi chat
        // tidak perlu dipenuhi pesan teks. Langsung
        // kirim hasilnya saja.

        console.log(
            'HD: memproses tanpa pesan tunggu (hanya reaksi)'
        );

        // ==================================================
        // 3. TULIS KE FILE SEMENTARA
        // ==================================================

        const tempDir = path.join(os.tmpdir(), 'wa-bot-hd');

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const stamp = Date.now();

        const extMasuk =
            mime.includes('png') ? '.png' :
            mime.includes('webp') ? '.webp' : '.jpg';

        inputPath = path.join(
            tempDir,
            `hd_${stamp}_masuk${extMasuk}`
        );

        fs.writeFileSync(
            inputPath,
            Buffer.from(media.data, 'base64')
        );

        // ==================================================
        // 4. TENTUKAN FORMAT KELUARAN
        //
        // PNG / WebP -> tetap PNG supaya transparansi tidak
        //   hilang (kalau dijadikan JPEG, area transparan
        //   jadi hitam).
        // JPEG -> JPEG kualitas tinggi.
        // ==================================================

        const keluarPng =
            extMasuk === '.png' || extMasuk === '.webp';

        const extKeluar = keluarPng ? '.png' : '.jpg';

        const namaDasar =
            bersihkanNama(media.filename) || `gambar_${stamp}`;

        outputPath = path.join(
            tempDir,
            `HD_${namaDasar}${extKeluar}`
        );

        // ==================================================
        // 5. UPSCALE PAKAI FFMPEG
        //
        // scale  : perbesar SKALA kali, Lanczos (tajam),
        //          dibatasi MAX_PX, dimensi dibuat genap
        // unsharp: pertajam sedikit biar nggak keliatan buram
        // ==================================================

        const filter =
            `scale=w='min(iw*${SKALA},${MAX_PX})'` +
            `:h='min(ih*${SKALA},${MAX_PX})'` +
            ':force_original_aspect_ratio=decrease' +
            ':force_divisible_by=2,' +
            'unsharp=5:5:0.8:5:5:0.0';

        const args = [
            '-y',
            '-i', inputPath,
            '-vf', filter
        ];

        if (!keluarPng) {
            args.push('-q:v', String(KUALITAS));
        }

        args.push(outputPath);

        console.log(
            'HD PROSES:',
            mime,
            '| skala', SKALA + 'x',
            '| keluaran', extKeluar
        );

        await execFileAsync(ffmpegPath, args, {
            timeout: 120000,
            windowsHide: true
        });

        if (
            !fs.existsSync(outputPath) ||
            fs.statSync(outputPath).size === 0
        ) {
            throw new Error('Hasil upscale kosong');
        }

        const ukuranMasuk = fs.statSync(inputPath).size;
        const ukuranKeluar = fs.statSync(outputPath).size;

        console.log(
            'HD SELESAI:',
            (ukuranMasuk / 1024).toFixed(0) + ' KB ->',
            (ukuranKeluar / 1024).toFixed(0) + ' KB'
        );

        // ==================================================
        // 6. KIRIM SEBAGAI DOKUMEN
        //
        // Kalau dikirim sebagai foto biasa, WhatsApp akan
        // mengompres ulang dan hasil upscale-nya jadi sia-sia.
        // ==================================================

        const hasil = MessageMedia.fromFilePath(outputPath);

        // ==================================================
        // KIRIM SEBAGAI FOTO (mode HD)
        //
        // sendMediaAsHd bikin WhatsApp memakai mode HD-nya:
        // fotonya tampil LANGSUNG di chat (bukan lampiran
        // file), tapi tetap tidak dikompres sekeras mode
        // biasa.
        //
        // Mau dikirim sebagai dokumen (resolusi paling utuh,
        // tapi jadi lampiran file)? Set di .env:
        //   HD_AS_DOKUMEN=true
        // ==================================================

        const sebagaiDokumen =
            String(process.env.HD_AS_DOKUMEN || 'false')
                .toLowerCase() === 'true';

        await message.reply(
            hasil,
            undefined,
            {
                sendMediaAsDocument: sebagaiDokumen,
                sendMediaAsHd: !sebagaiDokumen,
                // Ukuran file sebelum -> sesudah,
                // contoh: "54 KB > 217 KB"
                caption:
                    `${formatUkuran(ukuranMasuk)} > ` +
                    `${formatUkuran(ukuranKeluar)}`
            }
        );

        console.log('HD TERKIRIM');

    }

    catch (error) {

        console.error(
            'HD ERROR:',
            '[name]', error && error.name,
            '[message]', error && error.message,
            '[stack]', error && error.stack
        );

        try {

            await message.reply(
                '❌ Gagal diproses. Coba foto lain.'
            );

        } catch (balasError) {

            console.error(
                'HD GAGAL KIRIM PESAN ERROR:',
                balasError && balasError.message
            );
        }
    }

    finally {

        safeUnlink(inputPath);
        safeUnlink(outputPath);

        console.log('HD FILE SEMENTARA DIBERSIHKAN');
    }
}


// ==================================================
// EXPORT
// ==================================================

module.exports = {
    handleHd,
    bersihkanNama
};
