
const sharp = require('sharp');

const esc = value => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
}[character]));

const angka = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const tanggal = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta'
});

function buatSvg(data) {
    if (!data || !Number.isFinite(data.price) || !Array.isArray(data.history)) {
        throw new Error('Data IHSG tidak valid bro.');
    }

    const history = data.history.filter(item =>
        Number.isFinite(item.time) && Number.isFinite(item.close)
    );

    if (!history.length) {
        throw new Error('Riwayat IHSG gak ada bro.');
    }

    const W = 1000;
    const H = 650;
    const left = 90;
    const right = 940;
    const top = 310;
    const bottom = 510;

    const values = history.map(item => item.close);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.12, max * 0.001);
    const low = min - padding;
    const high = max + padding;
    const range = high - low || 1;

    const points = history.map((item, i) => ({
        x: left + i / Math.max(history.length - 1, 1) * (right - left),
        y: bottom - (item.close - low) / range * (bottom - top),
        item
    }));

    const line = points.map((p, i) =>
        `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`
    ).join(' ');

    const area = `${line} L${right},${bottom} L${left},${bottom} Z`;

    const change = Number.isFinite(data.change) ? data.change : null;
    const percent = Number.isFinite(data.percent) ? data.percent : null;

    const color = change === null
        ? '#60a5fa'
        : change > 0 ? '#34d399'
        : change < 0 ? '#fb7185' : '#60a5fa';

    const signed = n => `${n > 0 ? '+' : ''}${angka.format(n)}`;

    const changeText = change === null
        ? 'Perubahan harian tidak tersedia'
        : `${signed(change)}${percent === null ? '' : ` (${signed(percent)}%)`}`;

    const latest = history[history.length - 1];

    const labels = [...new Set([
        0,
        Math.floor((history.length - 1) / 2),
        history.length - 1
    ])].map(i => {
        const p = points[i];
        return `<text x="${p.x}" y="550" fill="#94a3b8"
            font-size="17" text-anchor="middle">${esc(
                tanggal.format(new Date(p.item.time * 1000))
            )}</text>`;
    }).join('');

    const grid = [0, 1, 2, 3].map(i => {
        const y = top + i * (bottom - top) / 3;
        const value = high - i * range / 3;

        return `
            <line x1="${left}" y1="${y}" x2="${right}" y2="${y}"
                stroke="#263449" stroke-width="1"/>
            <text x="76" y="${y + 5}" fill="#8190a5"
                font-size="15" text-anchor="end">${angka.format(value)}</text>
        `;
    }).join('');

    return `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#111c2e"/>
          <stop offset="100%" stop-color="#0b1220"/>
        </linearGradient>
        <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity=".28"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>

      <rect width="${W}" height="${H}" rx="30" fill="url(#bg)"/>

      <rect x="50" y="40" width="7" height="48" rx="3.5"
          fill="${color}"/>

      <text x="76" y="65" fill="#f8fafc"
          font-size="29" font-weight="700" font-family="Arial">
          IHSG
      </text>
      <text x="76" y="94" fill="#8493a8"
          font-size="16" font-family="Arial">
          IDX Composite · Bursa Efek Indonesia
      </text>

      <text x="60" y="190" fill="#f8fafc"
          font-size="59" font-weight="700" font-family="Arial">
          ${angka.format(data.price)}
      </text>

      <rect x="60" y="210" width="auto" height="35" rx="9"
          fill="${color}" fill-opacity=".12"/>

      <text x="72" y="234" fill="${color}"
          font-size="20" font-weight="600" font-family="Arial">
          ${esc(changeText)}
      </text>

      <text x="940" y="232" fill="#8493a8"
          font-size="16" text-anchor="end" font-family="Arial">
          1 BULAN TERAKHIR
      </text>

      ${grid}

      <path d="${area}" fill="url(#fill)"/>
      <path d="${line}" fill="none" stroke="${color}"
          stroke-width="4" stroke-linecap="round"
          stroke-linejoin="round"/>

      <circle cx="${points[points.length - 1].x}"
          cy="${points[points.length - 1].y}" r="6"
          fill="${color}"/>

      <circle cx="${points[points.length - 1].x}"
          cy="${points[points.length - 1].y}" r="12"
          fill="${color}" fill-opacity=".15"/>

      ${labels}

      <line x1="60" y1="585" x2="940" y2="585"
          stroke="#263449"/>

      <text x="60" y="615" fill="#8493a8"
          font-size="15" font-family="Arial">
          Data terakhir: ${esc(tanggal.format(new Date(latest.time * 1000)))}
      </text>

      <text x="940" y="615" fill="#64748b"
          font-size="15" text-anchor="end" font-family="Arial">
          LRV BOT · YAHOO FINANCE
      </text>
    </svg>`;
}

async function buatGambarIHSG(data) {
    return sharp(Buffer.from(buatSvg(data)))
        .png()
        .toBuffer();
}

module.exports = { buatGambarIHSG };
