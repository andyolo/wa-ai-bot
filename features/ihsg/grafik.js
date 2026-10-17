const sharp = require('sharp');

const esc = (value) => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
}[character]));

const angka = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2
});

const tanggal = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Jakarta'
});

function buatSvg(data) {
    if (!data || !Number.isFinite(data.price) || !Array.isArray(data.history)) {
        throw new Error('Data IHSG tidak valid bro.');
    }

    const history = data.history.filter(item =>
        Number.isFinite(item.time) && Number.isFinite(item.close)
    );

    if (history.length === 0) {
        throw new Error('Riwayat IHSG tidak tersedia.');
    }

    const width = 900;
    const height = 600;
    const left = 80;
    const right = 840;
    const top = 230;
    const bottom = 465;
    const values = history.map(item => item.close);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const padding = Math.max((maximum - minimum) * 0.12, maximum * 0.001);
    const rangeMin = minimum - padding;
    const rangeMax = maximum + padding;
    const range = rangeMax - rangeMin;
    const points = history.map((item, index) => ({
        x: left + index / Math.max(history.length - 1, 1) * (right - left),
        y: bottom - (item.close - rangeMin) / range * (bottom - top),
        item
    }));
    const line = points.map((point, index) =>
        `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`
    ).join(' ');
    const area = `${line} L${right},${bottom} L${left},${bottom} Z`;
    const color = data.change > 0
        ? '#00ff5e'
        : data.change < 0 ? '#ff0000' : '#60a5fa';
    const change = Number.isFinite(data.change) ? data.change : null;
    const percent = Number.isFinite(data.percent) ? data.percent : null;
    const signed = value => `${value > 0 ? '+' : ''}${angka.format(value)}`;
    const changeText = change === null
        ? 'Perubahan harian tidak tersedia'
        : `${signed(change)}${percent === null ? '' : ` (${signed(percent)}%)`}`;
    const latest = history[history.length - 1];
    const labelIndices = [...new Set([
        0,
        Math.floor((history.length - 1) / 2),
        history.length - 1
    ])];
    const dateLabels = labelIndices.map(index => {
        const point = points[index];
        const label = esc(tanggal.format(new Date(point.item.time * 1000)));
        return `<text x="${point.x}" y="505" fill="#94a3b8" font-size="16" text-anchor="middle">${label}</text>`;
    }).join('');

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".32"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" rx="28" fill="#101827"/>
    <text x="60" y="64" fill="#f8fafc" font-size="25" font-weight="bold">IHSG</text>
    <text x="60" y="96" fill="#94a3b8" font-size="17">${esc(data.name || 'Indeks Harga Saham Gabungan')}</text>
    <text x="60" y="160" fill="#f8fafc" font-size="44" font-weight="bold">${angka.format(data.price)}</text>
    <text x="62" y="192" fill="${color}" font-size="19">${esc(changeText)}</text>
    <text x="${right}" y="192" fill="#94a3b8" font-size="15" text-anchor="end">${esc(tanggal.format(new Date(latest.time * 1000)))}</text>
    <line x1="${left}" y1="${top}" x2="${right}" y2="${top}" stroke="#263449"/>
    <line x1="${left}" y1="${(top + bottom) / 2}" x2="${right}" y2="${(top + bottom) / 2}" stroke="#263449"/>
    <line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="#263449"/>
    <text x="68" y="${top + 5}" fill="#94a3b8" font-size="14" text-anchor="end">${angka.format(rangeMax)}</text>
    <text x="68" y="${(top + bottom) / 2 + 5}" fill="#94a3b8" font-size="14" text-anchor="end">${angka.format((rangeMin + rangeMax) / 2)}</text>
    <text x="68" y="${bottom + 5}" fill="#94a3b8" font-size="14" text-anchor="end">${angka.format(rangeMin)}</text>
    <path d="${area}" fill="url(#area)"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${points[points.length - 1].x}" cy="${points[points.length - 1].y}" r="6" fill="${color}"/>
    ${dateLabels}
    <text x="${right}" y="565" fill="#64748b" font-size="14" text-anchor="end">Sumber: Yahoo Finance</text>
    </svg>`;
}

async function buatGambarIHSG(data) {
    return sharp(Buffer.from(buatSvg(data)))
        .png()
        .toBuffer();
}

module.exports = { buatGambarIHSG };
