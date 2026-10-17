
const https = require('https');

const IHSG_URL =
    'https://query1.finance.yahoo.com/v8/finance/chart/%5EJKSE?range=1mo&interval=1d';

function fetchIHSG() {
    return new Promise((resolve, reject) => {
        https.get(IHSG_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 15000
        }, (res) => {
            let body = '';

            res.setEncoding('utf8');
            res.on('data', chunk => body += chunk);

            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        throw new Error(`HTTP ${res.statusCode}`);
                    }

                    const json = JSON.parse(body);
                    const result = json.chart?.result?.[0];

                    if (!result) {
                        throw new Error('Datanya lagi gak ada jir');
                    }

                    const meta = result.meta;
                    const quotes = result.indicators?.quote?.[0];
                    const timestamps = result.timestamp || [];

                    const history = timestamps
                        .map((time, i) => ({
                            time,
                            close: quotes?.close?.[i]
                        }))
                        .filter(item =>
                            Number.isFinite(item.close)
                        );

                    if (history.length === 0) {
                        throw new Error('Riwayatnya IHSG kosong wak');
                    }

                    const latest = history[history.length - 1];
                    const previous = history.length > 1
                        ? history[history.length - 2]
                        : null;

                    const change = previous
                        ? latest.close - previous.close
                        : null;

                    const percent = previous
                        ? change / previous.close * 100
                        : null;

                    resolve({
                        name: meta.longName || 'IHSG',
                        price: latest.close,
                        change,
                        percent,
                        history,
                        timestamp: latest.time
                    });
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', reject).on('timeout', function () {
            this.destroy(new Error('Permintaan data IHSG habis'));
        });
    });
}

module.exports = { fetchIHSG };
