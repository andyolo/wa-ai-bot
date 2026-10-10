const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);


// ==================================================
// /ping - CEK LATENSI & KONDISI BOT
//
// Tidak pakai npm package tambahan. Semuanya pakai
// yang sudah ada:
//
//   1. ping.exe  -> program bawaan Windows, ICMP
//   2. Date.now() -> timer Node, ukur respon bot
//   3. process.*  -> uptime, memori, versi Node
//   4. client.info -> status koneksi WhatsApp
// ==================================================

const HOST_PING = '8.8.8.8';   // DNS Google, cepat & stabil


// ==================================================
// PING ICMP (pakai program 'ping' bawaan sistem)
// ==================================================

async function pingInternet(host = HOST_PING) {

    const windows = process.platform === 'win32';

    // Windows: ping -n 1 -w 3000 <host>
    // Linux  : ping -c 1 -W 3    <host>
    const args = windows
        ? ['-n', '1', '-w', '3000', host]
        : ['-c', '1', '-W', '3', host];

    const { stdout } = await execFileAsync('ping', args, {
        timeout: 8000,
        windowsHide: true
    });

    // Windows berbahasa Indonesia: "Waktu=21ms"
    // Windows berbahasa Inggris : "time=21ms"
    const cocok = stdout.match(
        /(?:time|waktu|tiempo|temps)\s*[=<]\s*([\d.,]+)\s*ms/i
    );

    if (cocok) {
        return parseFloat(cocok[1].replace(',', '.'));
    }

    // cadangan: ambil angka ms pertama yang ketemu
    const cadangan = stdout.match(/[=<]\s*([\d.,]+)\s*ms/i);

    return cadangan
        ? parseFloat(cadangan[1].replace(',', '.'))
        : null;
}


// ==================================================
// FORMAT
// ==================================================

function formatDurasi(detik) {

    detik = Math.floor(detik);

    const hari = Math.floor(detik / 86400);
    const jam = Math.floor((detik % 86400) / 3600);
    const menit = Math.floor((detik % 3600) / 60);
    const sisa = detik % 60;

    if (hari > 0) return `${hari} hari ${jam} jam`;
    if (jam > 0) return `${jam} jam ${menit} menit`;
    if (menit > 0) return `${menit} menit ${sisa} detik`;

    return `${sisa} detik`;
}

function formatMB(bytes) {
    return (bytes / 1048576).toFixed(1) + ' MB';
}


// ==================================================
// HANDLER
//
// Cara ukur "respon bot":
//   Pesan pertama dikirim dulu (placeholder), lalu
//   waktunya dicatat. Itu ROUND-TRIP NYATA lewat
//   WhatsApp Web, bukan cuma waktu proses Node.
//   Setelah itu pesannya DIBUAT ULANG (edit) pakai
//   angka yang sudah didapat.
// ==================================================

async function handlePing(message, client) {

    const mulai = Date.now();

    let terkirim = null;

    try {

        terkirim = await message.reply(
            ' Ahh jangan lihat aku >< !\n\n⏳ sabar ya...'
        );

    } catch (error) {

        console.error('PING GAGAL KIRIM:', error && error.message);
        return;
    }

    // round-trip nyata: perintah masuk -> balasan terkirim
    const responBot = Date.now() - mulai;

    // ==================================================
    // PING INTERNET
    // ==================================================

    let pingMs = null;

    try {
        pingMs = await pingInternet();
    } catch (error) {
        console.error('PING INTERNET GAGAL:', error && error.message);
    }

    // ==================================================
    // SUSUN BALASAN
    // ==================================================

    const baris = [
        ' Ahh jangan lihat aku >< !',
        '',
        `⏱️ Respon bot    : ${responBot} ms`,
        `🌐 Ping internet : ${
            pingMs === null ? 'gagal' : pingMs + ' ms'
        } (ICMP ke ${HOST_PING})`,
        `📶 WhatsApp      : ${
            client && client.info ? 'terhubung' : 'belum siap'
        }`,
        ` Bot jalan     : ${formatDurasi(process.uptime())}`,
        ` Memori        : ${formatMB(process.memoryUsage().rss)}`,
        ` Node          : ${process.version}`,
        ` Mesin         : ${process.platform} ${process.arch}`
    ];

    const teks = baris.join('\n');

    // ==================================================
    // GANTI PESAN PLACEHOLDER DENGAN HASILNYA
    // ==================================================

    if (terkirim && typeof terkirim.edit === 'function') {

        try {

            await terkirim.edit(teks);
            return;

        } catch (error) {

            console.error(
                'PING EDIT GAGAL:',
                error && error.message
            );
        }
    }

    // cadangan kalau edit tidak didukung / gagal
    await message.reply(teks);
}


// ==================================================
// EXPORT
// ==================================================

module.exports = {
    handlePing,
    pingInternet
};
