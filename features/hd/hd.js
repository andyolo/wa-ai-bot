const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const ffmpegPath = require('ffmpeg-static');
const { MessageMedia } = require('whatsapp-web.js');
const { getQuotedMessage } = require('../quoted-message');

const execFileAsync = promisify(execFile);

const SKALA =
    parseInt(process.env.HD_SCALE || '2', 10) || 2;


const MAX_PX =
    parseInt(process.env.HD_MAX_PX || '4096', 10) || 4096;


const KUALITAS =
    parseInt(process.env.HD_QUALITY || '2', 10) || 2;

const MIME_DIDUKUNG = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
];


function safeUnlink(filePath) {

    try {

        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

    } catch (error) {

        console.error('HD UNLINK ERROR:', error && error.message);
    }
}

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

function pastikanIdPesan(pesan) {

    if (!pesan || !pesan.id) {
        console.error('HD: pesan tidak punya id sama sekali');
        return null;
    }

    const id = pesan.id;

   
    if (typeof id === 'string') {
        console.warn('HD: id berupa string, dibungkus jadi objek');
        pesan.id = { _serialized: id };
        return id;
    }

    
    if (id._serialized) {
        return id._serialized;
    }

    if (id.remote && id.id) {

        const gabung =
            `${id.fromMe}_${id.remote}_${id.id}` +
            (id.participant ? '_' + id.participant : '');

        id._serialized = gabung;

        console.warn('HD: _serialized kosong, dibangun ulang ->', gabung);

        return gabung;
    }

   
    console.error(
        'HD: tidak bisa membangun id pesan. Isinya:',
        JSON.stringify(id)
    );

    return null;
}

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


async function handleHd(message, client) {

    let inputPath = null;
    let outputPath = null;

    try {


        console.log(
            'HD DEBUG: type =', message.type,
            '| hasMedia =', message.hasMedia,
            '| quoted =', message.hasQuotedMsg
        );

        let sumber = null;

        if (message.hasMedia && message.type !== 'sticker') {

            sumber = message;

        } else if (message.hasQuotedMsg) {

            const quoted = await getQuotedMessage(message);

            if (quoted && quoted.hasMedia && quoted.type !== 'sticker') {
                sumber = quoted;
            }
        }

        if (!sumber) {

            
            await message.reply('📸 Mana fotonya?');

            return;
        }

        pastikanIdPesan(sumber);

        let media = null;
        let galatUnduh = null;

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


        console.log(
            'HD: memproses tanpa pesan tunggu (hanya reaksi)'
        );

        
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


        const keluarPng =
            extMasuk === '.png' || extMasuk === '.webp';

        const extKeluar = keluarPng ? '.png' : '.jpg';

        const namaDasar =
            bersihkanNama(media.filename) || `gambar_${stamp}`;

        outputPath = path.join(
            tempDir,
            `HD_${namaDasar}${extKeluar}`
        );

       
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

        
        const hasil = MessageMedia.fromFilePath(outputPath);

       

        const sebagaiDokumen =
            String(process.env.HD_AS_DOKUMEN || 'false')
                .toLowerCase() === 'true';

        await message.reply(
            hasil,
            undefined,
            {
                sendMediaAsDocument: sebagaiDokumen,
                sendMediaAsHd: !sebagaiDokumen,
                
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


module.exports = {
    handleHd,
    bersihkanNama
};
