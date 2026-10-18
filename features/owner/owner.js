const path = require('path');
const fs = require('fs');


// ==================================================
// ANTI-SPAM + MENU OWNER
//
// Owner = nomor bot itu sendiri. Pesan yang dikirim
// dari akun bot punya penanda fromMe = true, jadi itu
// yang dipakai untuk mengenali owner.
//
// Daftar blokir DISIMPAN KE FILE, bukan cuma di memori,
// supaya tidak hilang setiap bot di-restart.
// ==================================================

// ==================================================
// KONFIGURASI
// ==================================================

const FILE_BLOKIR = path.join(
    __dirname, '..', '..', 'data', 'blokir.json'
);

// Anti-spam nyala/mati (bisa diubah lewat /owner)
let spamAktif =
    String(process.env.SPAM_AKTIF || 'true')
        .toLowerCase() !== 'false';

// Berapa pesan dalam jendela waktu sebelum dianggap spam
const SPAM_BATAS =
    parseInt(process.env.SPAM_BATAS || '8', 10) || 8;

// Panjang jendela waktu (milidetik)
const SPAM_JENDELA =
    parseInt(process.env.SPAM_JENDELA || '10000', 10) || 10000;

// Berapa kali diperingatkan sebelum diblokir
const SPAM_TOLERANSI =
    parseInt(process.env.SPAM_TOLERANSI || '2', 10) || 2;

// Cuma PERINTAH (yang diawali "/") yang dihitung?
//
// Default: YA.
//
// Alasannya: bot ini ada di grup yang ramai. Kalau
// obrolan biasa ikut dihitung, orang ngobrol santai
// bisa dituduh spam dan malah kena blokir.
// Yang perlu dibatasi itu pemakaian FITUR berlebihan.
//
// Set SPAM_HANYA_PERINTAH=false di .env kalau mau
// semua pesan dihitung lagi.
const SPAM_HANYA_PERINTAH =
    String(process.env.SPAM_HANYA_PERINTAH || 'true')
        .toLowerCase() !== 'false';


// ==================================================
// DATA
// ==================================================

// kunci pengguna yang diblokir
const daftarBlokir = new Set();

// kunci pengguna yang DIBEBASKAN dari cek spam
// (misal sesepuh / orang kepercayaan)
const daftarVip = new Set();

// kunci pengguna yang dianggap OWNER.
//
// Pesan dari akun bot sendiri (fromMe) SELALU owner.
// Daftar ini untuk nomor LAIN yang kamu beri akses -
// misal nomor pribadimu kalau bot jalan di nomor lain.
const daftarOwner = new Set();

// Nomor owner dari .env (pisahkan dengan koma)
const OWNER_DARI_ENV = String(process.env.OWNER_NOMOR || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

// kunci pengguna -> { waktu: [timestamp], peringatan: n }
const catatanSpam = new Map();


// ==================================================
// SIMPAN / MUAT DAFTAR BLOKIR
// ==================================================

function muatBlokir() {

    try {

        if (!fs.existsSync(FILE_BLOKIR)) {
            console.log('OWNER: belum ada daftar blokir, mulai kosong');
            return;
        }

        let teks = fs.readFileSync(FILE_BLOKIR, 'utf8');

        // Buang BOM kalau ada.
        // File yang pernah diedit pakai Notepad (atau ditulis
        // PowerShell tertentu) suka diawali karakter tak
        // kelihatan ini, dan JSON.parse menolaknya.
        if (teks.charCodeAt(0) === 0xFEFF) {
            teks = teks.slice(1);
            console.warn('OWNER: BOM terdeteksi di file blokir, dibuang.');
        }

        const isi = JSON.parse(teks);

        if (Array.isArray(isi.blokir)) {
            isi.blokir.forEach(k => daftarBlokir.add(k));
        }

        if (Array.isArray(isi.vip)) {
            isi.vip.forEach(k => daftarVip.add(k));
        }

        if (Array.isArray(isi.owner)) {
            isi.owner.forEach(k => daftarOwner.add(k));
        }

        // nomor owner dari .env ikut dimasukkan
        for (const n of OWNER_DARI_ENV) {
            const angka = normalisasiNomor(n);
            if (angka.length >= 8) daftarOwner.add(angka);
        }

        if (typeof isi.spamAktif === 'boolean') {
            spamAktif = isi.spamAktif;
        }

        console.log(
            'OWNER: dimuat ->',
            daftarBlokir.size,
            'diblokir |',
            daftarVip.size,
            'vip | anti-spam:',
            spamAktif ? 'AKTIF' : 'MATI'
        );

    } catch (error) {

        console.error('OWNER: gagal muat daftar blokir:', error && error.message);
    }
}

function simpanBlokir() {

    try {

        const dir = path.dirname(FILE_BLOKIR);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(
            FILE_BLOKIR,
            JSON.stringify(
                {
                    blokir: [...daftarBlokir],
                    vip: [...daftarVip],
                    owner: [...daftarOwner],
                    spamAktif: spamAktif
                },
                null,
                2
            ),
            'utf8'
        );

        return true;

    } catch (error) {

        console.error('OWNER: gagal simpan daftar blokir:', error && error.message);
        return false;
    }
}


// ==================================================
// KUNCI PENGGUNA
//
// Sengaja TIDAK memakai chat, supaya satu orang yang
// diblokir tetap diblokir walau pindah grup.
// ==================================================

function kunciPengguna(message) {
    return message.author || message.from;
}

function tampilkanKunci(kunci) {
    // ambil bagian sebelum '@' biar enak dibaca
    const depan = String(kunci).split('@')[0];
    const belakang = String(kunci).split('@')[1] || '';
    return depan + (belakang ? '@' + belakang : '');
}


// ==================================================
// CEK SPAM
//
// Mengembalikan true kalau pesannya harus DIABAIKAN.
// ==================================================

async function cekSpam(message) {

    // Pesan dari akun bot sendiri JANGAN dihitung.
    // Kalau tidak dikecualikan, bot akan menuduh dirinya
    // sendiri spam gara-gara balasannya sendiri.
    if (message.fromMe) {
        return false;
    }

    const kunci = kunciPengguna(message);

    // sudah diblokir -> abaikan diam-diam
    if (daftarBlokir.has(kunci)) {

        console.log('SPAM: pesan dari pengguna diblokir diabaikan ->', kunci);
        return true;
    }

    // orang kepercayaan (VIP) dibebaskan dari cek spam
    if (apakahVip(kunci)) {
        return false;
    }

    if (!spamAktif) {
        return false;
    }

    // ==================================================
    // CUMA PERINTAH YANG DIHITUNG
    //
    // Obrolan biasa dilewatkan begitu saja - tidak
    // dihitung, tidak diperingatkan, tidak diblokir.
    //
    // Ini berlaku SETELAH cek daftar blokir, jadi
    // pengguna yang memang sudah diblokir tetap
    // diabaikan walau cuma ngobrol.
    // ==================================================
    if (SPAM_HANYA_PERINTAH) {

        const adalahPerintah = String(message.body || '')
            .trim()
            .startsWith('/');

        if (!adalahPerintah) {
            return false;
        }
    }

    const sekarang = Date.now();

    const data = catatanSpam.get(kunci) || {
        waktu: [],
        peringatan: 0
    };

    // buang timestamp yang sudah keluar dari jendela waktu
    data.waktu = data.waktu.filter(
        t => sekarang - t < SPAM_JENDELA
    );

    data.waktu.push(sekarang);

    // masih wajar
    if (data.waktu.length <= SPAM_BATAS) {
        catatanSpam.set(kunci, data);
        return false;
    }

    // ==================================================
    // KENA SPAM
    // ==================================================

    data.waktu = [];
    data.peringatan++;

    console.log(
        'SPAM TERDETEKSI:',
        kunci,
        '| peringatan ke-', data.peringatan,
        'dari', SPAM_TOLERANSI
    );

    // sudah kehabisan toleransi -> blokir
    if (data.peringatan > SPAM_TOLERANSI) {

        daftarBlokir.add(kunci);
        simpanBlokir();
        catatanSpam.delete(kunci);

        console.log('SPAM: DIBLOKIR ->', kunci);

        try {

            await message.reply(
                '🚫 Kamu diblokir karena spam.\n' +
                'Sadari kesalahanmu,hubungi owner.'
            );

        } catch (error) {

            console.error('SPAM: gagal kirim pesan blokir:', error && error.message);
        }

        return true;
    }

    catatanSpam.set(kunci, data);

    try {

        await message.reply(
            '⚠️ Jangan spam ya.\n' +
            `Peringatan ${data.peringatan} dari ${SPAM_TOLERANSI}.`
        );

    } catch (error) {

        console.error('SPAM: gagal kirim peringatan:', error && error.message);
    }

    return true;
}


// ==================================================
// NORMALISASI NOMOR
//
// Nomor HP sering ditulis dengan spasi, tanda hubung,
// atau tanda plus:
//   +62 851-8945-5320
// sedangkan WhatsApp menyimpannya sebagai:
//   6285189455320@c.us
//
// Jadi kita bandingkan ANGKA-nya saja.
// ==================================================
function normalisasiNomor(teks) {
    return String(teks || '').replace(/\D/g, '');
}

// Orang Indonesia biasanya menulis nomor dengan awalan 0,
// sedangkan WhatsApp menyimpannya dengan awalan 62:
//
//   0851-8945-5320   (yang diketik)
//   6285189455320    (yang disimpan WhatsApp)
//
// Fungsi ini membuat semua bentuk yang mungkin, supaya
// dua-duanya tetap cocok.
function varianNomor(teks) {

    const t = normalisasiNomor(teks);

    if (!t) return [];

    const kumpulan = new Set([t]);

    if (t.startsWith('0')) {
        kumpulan.add('62' + t.slice(1));
        kumpulan.add(t.slice(1));
    }

    if (t.startsWith('62')) {
        kumpulan.add('0' + t.slice(2));
        kumpulan.add(t.slice(2));
    }

    if (t.startsWith('8')) {
        kumpulan.add('0' + t);
        kumpulan.add('62' + t);
    }

    return [...kumpulan];
}

// Cari entri di daftar yang cocok dengan target.
// Mengembalikan array kunci yang cocok.
function cocokDenganDaftar(daftar, target) {

    const varian = varianNomor(target);

    if (!varian.length) return [];

    const kena = [];

    for (const kunci of daftar) {

        const kd = normalisasiNomor(kunci);

        if (!kd) continue;

        for (const v of varian) {

            if (kd === v) { kena.push(kunci); break; }

            // cocok sebagian, tapi minimal 8 angka biar
            // tidak salah cocok dengan nomor lain
            if (v.length >= 8 && kd.includes(v)) { kena.push(kunci); break; }
            if (kd.length >= 8 && v.includes(kd)) { kena.push(kunci); break; }
        }
    }

    return kena;
}

// Apakah pengguna ini termasuk VIP?
function apakahVip(kunci) {

    if (!daftarVip.size) return false;

    return cocokDenganDaftar(daftarVip, kunci).length > 0;
}

// ==================================================
// OWNER
// ==================================================

// Ambil pengirim pesan yang dibalas TANPA memanggil
// halaman WhatsApp.
//
// getQuotedMessage() bawaan whatsapp-web.js memakai API
// internal (WAWebQuotedMsgModelUtils) yang bisa gagal dan
// melempar error tak terbaca (cuma huruf "r").
//
// Padahal data mentahnya sudah tersimpan di message._data
// sejak awal, jadi kita baca dari situ saja.
function authorDibalas(message) {

    const q = message && message._data && message._data.quotedMsg;

    if (!q) return null;

    
    const calon = [
        q.author,
        q.participant,
        q.id && q.id.participant,
        q.from,
        q.id && q.id.remote
    ];

    for (const c of calon) {

        if (!c) continue;

        const teks = String(c);

        // Jangan pernah menganggap GRUP sebagai orang,
        // dan jangan pakai status/broadcast.
        if (teks.endsWith('@g.us')) continue;
        if (teks.includes('@broadcast')) continue;
        if (teks.includes('@newsletter')) continue;

        return c;
    }

    return null;
}

function apakahOwner(message) {

    // pesan dari akun bot sendiri SELALU owner
    if (message.fromMe === true) {
        return true;
    }

    // nomor yang sengaja didaftarkan sebagai owner
    if (daftarOwner.size) {
        const kunci = kunciPengguna(message);
        if (cocokDenganDaftar(daftarOwner, kunci).length > 0) {
            return true;
        }
    }

    return false;
}



async function handleOwner(message, perintah, args) {


    if (!apakahOwner(message)) {

        console.log('OWNER: akses ditolak untuk', kunciPengguna(message));

        await message.reply('❌ Command ini khusus owner bro.');

        return;
    }


    if (perintah === 'owner') {

        const aksi = (args[0] || '').toLowerCase();
        const target = args.slice(1).join(' ').trim();

        // ---------- tambah owner ----------
        if (aksi === 'tambah' || aksi === 'add') {

            let kunci = target;

            if (!kunci && message.hasQuotedMsg) {

                kunci = authorDibalas(message);

                if (!kunci) {

                    try {

                        const quoted = await message.getQuotedMessage();

                        if (quoted) {
                            kunci = quoted.author || quoted.from;
                        }

                    } catch (error) {

                        console.error(
                            'OWNER: gagal baca pesan yang dibalas:',
                            error && error.message
                        );
                    }
                }
            }

            const angka = normalisasiNomor(kunci);

            if (angka.length < 8) {

                await message.reply(
                    '❌ Nggak tau siapa yang mau dijadikan owner.\n\n' +
                    'Cara paling akurat: BALAS pesan orangnya, ' +
                    'lalu ketik /owner tambah\n\n' +
                    'Atau tulis nomornya: /owner tambah 6281234567890'
                );

                return;
            }

            daftarOwner.add(angka);
            simpanBlokir();

            console.log('OWNER: nomor owner ditambah ->', angka);

            await message.reply(
                `👑 Nomor ini sekarang jadi owner: ${angka}`
            );

            return;
        }

        // ---------- hapus owner ----------
        if (aksi === 'hapus' || aksi === 'remove') {

            const kena = cocokDenganDaftar(daftarOwner, target);

            for (const k of kena) daftarOwner.delete(k);

            if (kena.length) simpanBlokir();

            await message.reply(
                kena.length
                    ? `✅ ${kena.length} nomor dicabut dari owner.`
                    : `❌ Tidak ada yang cocok dengan "${target}".`
            );

            return;
        }

        // ---------- menu ----------

        const daftarNomorOwner = daftarOwner.size
            ? [...daftarOwner].map((k, i) => `${i + 1}. ${k}`).join('\n')
            : '(belum ada nomor tambahan)';

        await message.reply(
            ' MENU OWNER JANGAN SENTUH BRO\n' +
            '\n' +
            '/blokir\n' +
            '/buka\n' +
            '/buka all\n' +
            '/vip LRV\n' +
            '/vip Accepted\n' +
            '/vip Kick\n' +
            '/spam on\n' +
            '/spam off\n' +
            '/owner tambah <nomor>\n' +
            '/owner hapus <nomor>\n' +
            '\n' +
            `Status anti-spam: ${spamAktif ? 'AKTIF' : 'MATI'}\n` +
            `Diblokir: ${daftarBlokir.size} orang\n` +
            `VIP: ${daftarVip.size} orang\n` +
            `\nNomor owner tambahan:\n${daftarNomorOwner}`
        );

        return;
    }

    

    if (perintah === 'blokir') {

        if (!daftarBlokir.size) {

            await message.reply(
                '✅ Daftar kosong bro.\n' +
                `Status anti-spam: ${spamAktif ? 'AKTIF' : 'MATI'}`
            );

            return;
        }

        const daftar = [...daftarBlokir]
            .map((k, i) => `${i + 1}. ${tampilkanKunci(k)}`)
            .join('\n');

        await message.reply(
            `🚫 DAFTAR BLOKIR (${daftarBlokir.size})\n\n` +
            daftar +
            '\n\nBuka dengan: /buka <nomor>'
        );

        return;
    }

    // ==================================================
    // /buka -> buka blokir
    // ==================================================

    if (perintah === 'buka') {

        // Gabung SEMUA kata, sama seperti /vip - nomor HP
        // sering ditulis dengan spasi / tanda hubung.
        const target = args.join(' ').trim();

        if (!target) {

            await message.reply(
                'Tulis nomor yang mau dibuka.\n' +
                'Contoh: /buka 6281234567890\n' +
                'Atau: /buka all'
            );

            return;
        }

        if (target.toLowerCase() === 'all' ||
            target.toLowerCase() === 'semua') {

            const jumlah = daftarBlokir.size;

            daftarBlokir.clear();
            simpanBlokir();

            await message.reply(
                `✅ Semua blokir dibuka (${jumlah} orang).`
            );

            return;
        }

        let dibuka = 0;

        for (const kunci of cocokDenganDaftar(daftarBlokir, target)) {
            daftarBlokir.delete(kunci);
            dibuka++;
        }

        if (dibuka > 0) {
            simpanBlokir();
        }

        await message.reply(
            dibuka > 0
                ? `✅ ${dibuka} orang dibuka blokirnya.`
                : `❌ Tidak ada yang cocok dengan "${target}".\n` +
                  'Cek daftarnya pakai /blokir'
        );

        return;
    }

    // ==================================================
    // /vip -> orang yang dibebaskan dari cek spam
    // ==================================================

    if (perintah === 'vip') {

        const aksi = (args[0] || '').toLowerCase();

        // Gabung SEMUA kata setelah "tambah" / "hapus".
        // Nomor HP sering ditulis dengan spasi:
        //   /vip tambah +62 851-8945-5320
        const target = args.slice(1).join(' ').trim();

        // ---------- lihat daftar ----------
        // "lrv" = nama lain buat lihat daftar yang sama
        if (!aksi || aksi === 'lrv') {

            if (!daftarVip.size) {

                await message.reply(
                    '✅ Daftar VIP kosong.\n\n' +
                    'Cara nambah: BALAS pesan orangnya, ' +
                    'lalu ketik /vip tambah'
                );

                return;
            }

            const daftar = [...daftarVip]
                .map((k, i) => `${i + 1}. ${tampilkanKunci(k)}`)
                .join('\n');

            await message.reply(
                `⭐ DAFTAR VIP (${daftarVip.size})\n\n` +
                daftar +
                '\n\nMereka dibebaskan dari cek spam.'
            );

            return;
        }

        // ---------- tambah ----------
        //
        // Bisa pakai kata kunci, ATAU langsung nomornya:
        //
        //   /vip 0851-8945-5320
        //
        // Jadi nggak perlu nulis "tambah" / "accepted" lagi.
        const gabungArg = args.join(' ').trim();

        const angkaSaja = gabungArg.replace(/\D/g, '');

        const sepertiNomor =
            gabungArg.length > 0 &&
            /^[\d+\-\s().]+$/.test(gabungArg) &&
            angkaSaja.length >= 8;

        if (
            aksi === 'tambah' ||
            aksi === 'add' ||
            aksi === 'accepted' ||
            aksi === 'accept' ||
            sepertiNomor
        ) {

            // kalau yang diketik memang nomor, pakai utuh
            let kunci = sepertiNomor ? gabungArg : target;

            // kalau nomornya nggak ditulis, ambil dari
            // pesan yang dibalas
            if (!kunci && message.hasQuotedMsg) {

                // cara cepat: baca data mentahnya
                kunci = authorDibalas(message);

                // cadangan: cara bawaan, tapi dibungkus
                // try/catch karena bisa melempar error
                // tak terbaca dan bikin perintah gagal total
                if (!kunci) {

                    try {

                        const quoted = await message.getQuotedMessage();

                        if (quoted) {
                            kunci = quoted.author || quoted.from;
                        }

                    } catch (error) {

                        console.error(
                            'OWNER: gagal baca pesan yang dibalas:',
                            error && error.message
                        );

                        console.error(
                            'OWNER: isi quotedMsg ->',
                            JSON.stringify(
                                message._data && message._data.quotedMsg
                            )
                        );
                    }
                }
            }

            if (!kunci) {

                await message.reply(
                    '❌ Nggak tau siapa yang mau dijadikan VIP.\n\n' +
                    'Tulis nomornya: /vip 0851-8945-5320\n' +
                    'Atau BALAS pesan orangnya, lalu ketik /vip'
                );

                return;
            }

            // simpan angkanya saja biar rapi dan mudah
            // dicocokkan dengan format WhatsApp apa pun
            const simpan = normalisasiNomor(kunci);

            if (simpan.length < 8) {

                await message.reply(
                    '❌ Nomornya kelihatan kurang lengkap: ' +
                    `${kunci}\n\n` +
                    'Contoh yang benar: /vip 0851-8945-5320'
                );

                return;
            }

            daftarVip.add(simpan);
            simpanBlokir();

            console.log('OWNER: VIP ditambah ->', simpan, '| dari:', kunci);

            await message.reply(
                `⭐ Masuk VIP: ${simpan}`
            );

            return;
        }

        // ---------- hapus ----------
        // "kick" = nama lain buat keluarkan
        if (
            aksi === 'hapus' ||
            aksi === 'remove' ||
            aksi === 'del' ||
            aksi === 'kick'
        ) {

            if (!target) {

                await message.reply(
                    'Tulis nomornya. Contoh: /vip hapus 628123456\n' +
                    'Atau lihat daftarnya dulu: /vip'
                );

                return;
            }

            let dihapus = 0;

            for (const k of cocokDenganDaftar(daftarVip, target)) {
                daftarVip.delete(k);
                dihapus++;
            }

            if (dihapus) {
                simpanBlokir();
            }

            await message.reply(
                dihapus > 0
                    ? `✅ ${dihapus} orang dikeluarkan dari VIP.`
                    : `❌ Tidak ada yang cocok dengan "${target}".`
            );

            return;
        }

        await message.reply(
            'Cara pakai:\n' +
            '/vip lrv            - lihat daftar\n' +
            '/vip 0851-8945-5320 - tambah nomor\n' +
            '/vip                - balas pesan orangnya\n' +
            '/vip kick <nomor>   - keluarkan\n' +
            '\n' +
            '(kata tambah/hapus/accepted juga masih jalan)'
        );

        return;
    }

    // ==================================================
    // /spam on|off
    // ==================================================

    if (perintah === 'spam') {

        const aksi = (args[0] || '').toLowerCase();

        if (aksi !== 'on' && aksi !== 'off') {

            await message.reply(
                'Cara pakai:\n' +
                '/spam on   - nyalakan anti-spam\n' +
                '/spam off  - matikan anti-spam\n\n' +
                `Sekarang: ${spamAktif ? 'AKTIF' : 'MATI'}`
            );

            return;
        }

        spamAktif = aksi === 'on';
        simpanBlokir();

        console.log('OWNER: anti-spam diubah jadi', spamAktif);

        await message.reply(
            spamAktif
                ? '✅ Anti-spam DIAKTIFKAN.'
                : '⏸️ Anti-spam DIMATIKAN.'
        );

        return;
    }
}


// ==================================================
// MUAT SAAT MODUL DIPANGGIL
// ==================================================

muatBlokir();


// ==================================================
// EXPORT
// ==================================================

module.exports = {
    cekSpam,
    handleOwner,
    apakahOwner,
    kunciPengguna,
    daftarBlokir,
    daftarVip,
    daftarOwner,
    // untuk keperluan tes
    _internal: { simpanBlokir, muatBlokir, FILE_BLOKIR }
};
