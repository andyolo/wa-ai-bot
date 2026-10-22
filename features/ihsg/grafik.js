
const sharp = require('sharp');

async function buatGambarIHSG(data) {
    const W = 900;
    const H = 560;

    const values = data.history.map(item => item.close);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const left = 65;
    const right = 850;
    const top = 210;
    const bottom = 430;

    const points = values.map((value, i) => {
        const x = left + (i / Math.max(values.length - 1, 1))
            * (right - left);

        const y = bottom - ((value - min) / range)
            * (bottom - top);

        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const naik = data.change === null || data.change >= 0;
    const warna = naik ? '#32d583' : '#ff647c';
    const format = n => n.toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const tanggal = new Date(data.timestamp * 1000)
        .toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: 'Asia/Jakarta'
        });

    const grid = [0, 1, 2, 3].map(i => {
        const y = top + i * (bottom - top) / 3;

        return `
            <line x1="${left}" y1="${y}" x2="${right}" y2="${y}"
                stroke="#293342" stroke-width="1"/>
        `;
    }).join('');

    const area = `
        ${left},${bottom}
        ${points.join(' ')}
        ${right},${bottom}
    `;

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <rect width="100%" height="100%" fill="#101722"/>

        <text x="50" y="58" fill="#ffffff"
            font-size="30" font-family="Arial" font-weight="bold">
            IHSG
        </text>
        <text x="50" y="88" fill="#9ba8ba"
            font-size="16" font-family="Arial">
            IDX Composite · Bursa Efek Indonesia
        </text>

        <text x="50" y="155" fill="#ffffff"
            font-size="46" font-family="Arial" font-weight="bold">
            ${format(data.price)}
        </text>

        <text x="52" y="187" fill="${warna}"
            font-size="19" font-family="Arial">
            ${data.change === null
                ? 'Perubahan belum tersedia'
                : `${naik ? '+' : ''}${format(data.change)} (${naik ? '+' : ''}${format(data.percent)}%)`}
        </text>

        ${grid}

        <polygon points="${area}"
            fill="${warna}" opacity="0.10"/>

        <polyline points="${points.join(' ')}"
            fill="none" stroke="${warna}" stroke-width="3"
            stroke-linecap="round" stroke-linejoin="round"/>

        <text x="${left}" y="463" fill="#9ba8ba"
            font-size="14" font-family="Arial">1 bulan terakhir</text>

        <line x1="50" y1="490" x2="850" y2="490"
            stroke="#293342"/>

        <text x="50" y="520" fill="#9ba8ba"
            font-size="14" font-family="Arial">
            Data terakhir: ${tanggal}
        </text>

        <text x="850" y="520" fill="#9ba8ba"
            font-size="14" text-anchor="end" font-family="Arial">
            LRV BOT
        </text>
    </svg>`;

    return sharp(Buffer.from(svg))
        .png()
        .toBuffer();
}

module.exports = { buatGambarIHSG };
