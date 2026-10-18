// ==================================================
// PENCARI LIRIK - sumber: lrclib.net
//
// Kenapa lrclib, bukan AI?
//   AI (Groq) mengarang lirik dari ingatan model:
//   sering ngawur, kepotong, atau menolak karena
//   hak cipta. lrclib itu DATABASE lirik asli.
//
// lrclib gratis, tanpa API key, dan menyediakan
// lirik biasa (plainLyrics) maupun bertimestamp
// (syncedLyrics).
//
// Dokumentasi: https://lrclib.net/docs
// ==================================================

const UA = 'wa-ai-bot/1.0 (bot WhatsApp pribadi)';
const API = 'https://lrclib.net/api/search?q=';

// Batas aman panjang pesan WhatsApp
const MAX_LIRIK = 50000;


// ==================================================
// BERSIHKAN JUDUL YOUTUBE
//
// Contoh:
//   "JVKE - golden hour (official music video) [PEM0Vs8jf1w]"
//   -> "JVKE - golden hour"
// ==================================================

// Hanya buang tanda kurung yang isinya kata kunci umum,
// supaya nama seperti (G)I-DLE tidak ikut rusak.
const KATA_KUNCI =
    /[\(\[]\s*(official|lyric|lyrics|audio|video|music|mv|m\/v|hd|hq|4k|8k|full|album|remaster|remastered|visualizer|topic|color|colour|coded|sub|subtitle|terjemahan|indo|karaoke|live|performance)[^\)\]]*[\)\]]/gi;

function bersihkanJudul(judul) {

    return String(judul || '')
        .replace(/\[[^\]]*\]/g, ' ')   // buang [....] (biasanya ID / info)
        .replace(KATA_KUNCI, ' ')
        .replace(/[|_]/g, ' ')
        .replace(/\s+-\s+topic\s*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}


// ==================================================
// CARI LIRIK
//
// Mengembalikan objek { artist, judul, album, lirik }
// atau null kalau tidak ketemu.
// ==================================================

async function cariLirik(judulYouTube) {

    const q = bersihkanJudul(judulYouTube);

    if (!q) {
        return null;
    }

    console.log('LIRIK CARI:', q);

    let response;

    for (let attempt = 0; attempt < 3; attempt++) {
        response = await fetch(
            API + encodeURIComponent(q),
            {
                headers: { 'User-Agent': UA },
                signal: AbortSignal.timeout(15000)
            }
        );

        if (response.ok || response.status < 500 || attempt === 2) {
            break;
        }

        await new Promise(resolve =>
            setTimeout(resolve, 1000 * (attempt + 1))
        );
    }

    if (!response.ok) {
        throw new Error('lrclib HTTP ' + response.status);
    }

    const data = await response.json();

    if (!Array.isArray(data) || !data.length) {
        console.log('LIRIK: tidak ada hasil untuk', q);
        return null;
    }

    
    const kata = q
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

    const kandidat = data
        .filter(x => x && (x.plainLyrics || x.syncedLyrics))
        .map(x => {

            const gabung = (
                String(x.artistName || '') + ' ' +
                String(x.trackName || '')
            ).toLowerCase();

            let skor = 0;

            for (const k of kata) {
                if (gabung.includes(k)) {
                    skor++;
                }
            }

            
            if (x.plainLyrics) {
                skor += 0.5;
            }

            return { x, skor };
        })
        .sort((a, b) => b.skor - a.skor);

    if (!kandidat.length) {
        console.log('LIRIK: hasil ada tapi tanpa lirik');
        return null;
    }

    const pilih = kandidat[0].x;

    let lirik = pilih.plainLyrics || '';

    
    if (!lirik && pilih.syncedLyrics) {
        lirik = pilih.syncedLyrics
            .replace(/^\[(?:\d{2}:)?\d{2}:\d{2}(?:[.:]\d+)?\]\s*/gm, '')
            .replace(/^\[[a-z]{2}:[^\]]*\]\s*$/gim, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    if (!lirik) {
        return null;
    }

    if (lirik.length > MAX_LIRIK) {
        lirik = lirik.slice(0, MAX_LIRIK) +
            '\n\n[...lirik dipotong karena kepanjangan]';
    }

    console.log(
        'LIRIK KETEMU:',
        pilih.artistName, '-', pilih.trackName,
        '|', lirik.length, 'karakter'
    );

    let album = pilih.albumName || '';

    const al = album.toLowerCase();
    const ar = String(pilih.artistName || '').toLowerCase();
    const jd = String(pilih.trackName || '').toLowerCase();

    if (
        al && (
            al === ar ||
            al === jd ||
            al.includes(jd) ||
            jd.includes(al)
        )
    ) {
        album = '';
    }

    return {
        artist: pilih.artistName || '',
        judul: pilih.trackName || '',
        album: album,
        lirik: lirik
    };
}


module.exports = {
    cariLirik,
    bersihkanJudul
};
