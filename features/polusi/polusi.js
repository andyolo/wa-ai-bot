const sharp = require('sharp');

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&apos;'
}[c]));

function kategori(aqi) {
    if (aqi <= 50) return ['SEHAT', '#00ff66'];
    if (aqi <= 100) return ['WASPADA', '#ffb804'];
    if (aqi <= 150) return ['TIDAK SEHAT*', '#ff7904'];
    if (aqi <= 200) return ['TIDAK SEHAT', '#ff0000bb'];
    if (aqi <= 300) return ['SANGAT TIDAK SEHAT', '#64217f'];
    return ['BERBAHAYA', '#52202a'];
}

async function json(url) {
    const r = await fetch(url, {
        signal: AbortSignal.timeout(15000)
    });
    if (!r.ok) throw new Error(`API HTTP ${r.status}`);
    return r.json();
}

async function cariLokasi(nama) {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.search = new URLSearchParams({
        name: nama, count: '10', language: 'id', format: 'json'
    });

    const data = await json(url);
    const hasil = (data.results || [])
        .filter(x => x.country_code === 'ID');

    if (!hasil.length) return null;

    const q = nama.toLowerCase();
    return hasil.find(x => x.name.toLowerCase() === q) || hasil[0];
}

async function ambilUdara(lokasi) {
    const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
    url.search = new URLSearchParams({
        latitude: String(lokasi.latitude),
        longitude: String(lokasi.longitude),
        current: 'us_aqi,pm2_5,pm10',
        timezone: 'auto'
    });

    const data = await json(url);
    const c = data.current;

    if (!c || !Number.isFinite(c.us_aqi)) return null;

    return {
        aqi: Math.round(c.us_aqi),
        pm25: c.pm2_5,
        pm10: c.pm10,
        waktu: c.time
    };
}

function buatSvg(nama, udara) {
    const [status, warna] = kategori(udara.aqi);
    const lingkaran = 2 * Math.PI * 100;
    const progres = Math.min(udara.aqi, 500) / 500 * lingkaran;

    const pm25 = Number.isFinite(udara.pm25)
        ? udara.pm25.toFixed(1) : 'N/A';
    const pm10 = Number.isFinite(udara.pm10)
        ? udara.pm10.toFixed(1) : 'N/A';

    return `<svg width="900" height="650" xmlns="http://www.w3.org/2000/svg">
    <rect width="900" height="650" rx="32" fill="#101010"/>
    <text x="50" y="65" fill="#ffffff" font-size="28" font-weight="bold">LRV AIRWATCH</text>
    <text x="50" y="105" fill="#aaaaaa" font-size="22">${esc(nama)}</text>
    <circle cx="450" cy="310" r="112" fill="none" stroke="#333333" stroke-width="15"/>
    <circle cx="450" cy="310" r="112" fill="none" stroke="${warna}"
      stroke-width="15" stroke-linecap="round"
      stroke-dasharray="${progres} ${lingkaran}"
      transform="rotate(-90 450 310)"/>
    <text x="450" y="300" fill="#ffffff" font-size="68"
      font-weight="bold" text-anchor="middle">${udara.aqi}</text>
    <text x="450" y="338" fill="#aaaaaa" font-size="21"
      text-anchor="middle">US AQI</text>
    <text x="450" y="465" fill="${warna}" font-size="28"
      font-weight="bold" text-anchor="middle">${status}</text>
    <text x="250" y="535" fill="#ffffff" font-size="23"
      text-anchor="middle">PM2.5: ${pm25} µg/m³</text>
    <text x="650" y="535" fill="#ffffff" font-size="23"
      text-anchor="middle">PM10: ${pm10} µg/m³</text>
    <text x="450" y="590" fill="#888888" font-size="17"
      text-anchor="middle">Data model Open-Meteo · ${esc(udara.waktu)}</text>
    <text x="450" y="620" fill="#888888" font-size="15"
      text-anchor="middle">*Kategori sensitif mulai AQI 101</text>
    </svg>`;
}

async function buatGambarPolusi(nama) {
    if (!nama || !nama.trim()) {
        throw new Error('Masukkan nama tempat.');
    }

    const lokasi = await cariLokasi(nama.trim());

    if (!lokasi) {
        throw new Error(
            `Lokasi "${nama}" tidak ditemukan.coba yang lain.`
        );
    }

    
    const kandidat = [lokasi];
    const wilayah = [lokasi.admin2, lokasi.admin1]
        .filter(Boolean);

    for (const namaWilayah of [...new Set(wilayah)]) {
        if (kandidat.length >= 3) break;
        try {
            const l = await cariLokasi(namaWilayah);
            if (l && !kandidat.some(
                k => k.latitude === l.latituwsde &&
                     k.longitude === l.longitude
            )) kandidat.push(l);
        } catch {}
    }

    let udara = null;
    let lokasiData = null;

    for (const l of kandidat) {
        try {
            udara = await ambilUdara(l);
            if (udara) {
                lokasiData = l;
                break;
            }
        } catch (e) {
            console.error('AirWatch API:', e.message);
        }
    }

    if (!udara) {
        throw new Error('Data kualitas udara tidak tersedia saat ini.');
    }

    const namaTampil = lokasiData.name +
        (lokasiData.admin1 ? ', ' + lokasiData.admin1 : '');

    const buffer = await sharp(Buffer.from(
        buatSvg(namaTampil, udara)
    )).png().toBuffer();

    return {
        buffer,
        caption:
            `LRV AIRWATCH\n` +
            `Lokasi data: ${namaTampil}\n` +
            `US AQI: ${udara.aqi} (${kategori(udara.aqi)[0]})\n` +
            `Waktu data: ${udara.waktu}\n` +
            `Sumber: LRV DEKC\n` +
            `Catatan: estimasi, bukan sensor langsung jir`
    };
}

module.exports = buatGambarPolusi;
