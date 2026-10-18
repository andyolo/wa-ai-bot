const path = require('path');
const fs = require('fs');
const os = require('os');
const puppeteer = require('puppeteer');

const { MessageMedia } = require('whatsapp-web.js');



async function downloadFile(url, outputPath) {

    console.log(
        'PINTEREST DOWNLOAD URL:',
        url
    );

    const cleanUrl = url
        .replace(/\\u002F/g, '/')
        .replace(/\\\//g, '/')
        .replace(/&amp;/g, '&')
        .trim();

    const response = await fetch(cleanUrl, {
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36',

            'Referer':
                'https://www.pinterest.com/',

            'Accept':
                'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
    });

    if (!response.ok) {

        console.log(
            'PINTEREST DOWNLOAD STATUS:',
            response.status
        );

        throw new Error(
            `HTTP ${response.status}`
        );
    }

    const buffer =
        Buffer.from(
            await response.arrayBuffer()
        );

    fs.writeFileSync(
        outputPath,
        buffer
    );
}


// ==================================================
// SEARCH PINTEREST
// ==================================================

async function searchPinterest(keyword) {

    console.log(
        'PINTEREST SEARCH:',
        keyword
    );

    const browser = await puppeteer.launch({
        headless: true,

        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });

    try {

        const page =
            await browser.newPage();

        const searchUrl =
            'https://www.pinterest.com/search/pins/?q=' +
            encodeURIComponent(keyword);

        await page.goto(
            searchUrl,
            {
                waitUntil: 'networkidle2',
                timeout: 60000
            }
        );

        await new Promise(
            resolve => setTimeout(resolve, 5000)
        );


        // ==================================================
        // SCROLL
        // ==================================================

        await page.evaluate(() => {

            window.scrollBy(
                0,
                window.innerHeight * 3
            );

        });

        await new Promise(
            resolve => setTimeout(resolve, 3000)
        );


        // ==================================================
        // AMBIL URL GAMBAR
        // ==================================================

        const images =
            await page.evaluate(() => {

                const urls = [];

                document
                    .querySelectorAll('img')
                    .forEach(img => {

                        // src utama
                        const src =
                            img.getAttribute('src');

                        if (
                            src &&
                            src.includes('i.pinimg.com')
                        ) {

                            urls.push(src);

                        }


                        const srcset =
                            img.getAttribute('srcset');

                        if (srcset) {

                            srcset
                                .split(',')
                                .forEach(item => {

                                    const url =
                                        item
                                            .trim()
                                            .split(/\s+/)[0];

                                    if (
                                        url &&
                                        url.includes('i.pinimg.com')
                                    ) {

                                        urls.push(url);

                                    }

                                });

                        }

                    });


                return [
                    ...new Set(urls)
                ];

            });


        console.log(
            'PINTEREST SEARCH IMAGES:',
            images.length
        );


        console.log(
            'PINTEREST IMAGE CANDIDATES:',
            images.slice(0, 10)
        );


        if (!images.length) {

            throw new Error(
                'Gambar Pinterest tidak ditemukan'
            );

        }



        const validImages =
            images.filter(url =>
                /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(url)
            );


        console.log(
            'PINTEREST VALID IMAGES:',
            validImages.length
        );


        if (!validImages.length) {

            throw new Error(
                'URL gambar Pinterest tidak valid'
            );

        }

        const highQualityImages =
            validImages.filter(url => {

                return !/\/(60x60|75x75|140x|170x|236x|280x|290x|300x|474x)\//i.test(url);

            });


        console.log(
            'PINTEREST HIGH QUALITY:',
            highQualityImages.length
        );


        const pool =
            highQualityImages.length
                ? highQualityImages
                : validImages;



        pool.sort((a, b) => {

            const score = url => {

                if (
                    /\/originals\//i.test(url)
                ) {
                    return 100;
                }

                if (
                    /\/736x\//i.test(url)
                ) {
                    return 90;
                }

                if (
                    /\/564x\//i.test(url)
                ) {
                    return 80;
                }

                if (
                    /\/474x\//i.test(url)
                ) {
                    return 70;
                }

                if (
                    /\/400x\//i.test(url)
                ) {
                    return 60;
                }

                return 10;

            };

            return score(b) - score(a);

        });


        const selectedImages =
            pool.slice(
                0,
                Math.min(pool.length, 20)
            );


        const randomIndex =
            Math.floor(
                Math.random() *
                selectedImages.length
            );


        const selected =
            selectedImages[randomIndex];


        console.log(
            'PINTEREST SELECTED IMAGE:',
            selected
        );


        return selected;

    }

    finally {

        await browser.close();

    }

}


async function getPinterestPinImage(url) {

    console.log(
        'PINTEREST PIN URL:',
        url
    );

    const response =
        await fetch(
            url,
            {
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36'
                }
            }
        );


    if (!response.ok) {

        throw new Error(
            `Pinterest HTTP ${response.status}`
        );

    }


    const html =
        await response.text();


    let match =
        html.match(
            /<meta[^>]+(?:name|property)="og:image"[^>]+content="([^"]+)"/i
        );


    if (!match) {

        match =
            html.match(
                /<meta[^>]+content="([^"]+)"[^>]+(?:name|property)="og:image"/i
            );

    }


    if (!match) {

        throw new Error(
            'og:image tidak ditemukan'
        );

    }


    return match[1]
        .replace(/&amp;/g, '&');

}


async function handlePinterest(
    message,
    input,
    client
) {

    let imagePath = null;


    try {

        if (!input) {

            await message.reply(
                '❌ Masukkan link atau kata kunci.\n\n' +
                'Contoh:\n' +
                '/pin kucing\n' +
                '/pin minecraft house'
            );

            return;

        }


        await message.reply(
            '⏳ Mencari Pinterest...'
        );


        let imageUrl;



        if (
            input.startsWith('http://') ||
            input.startsWith('https://')
        ) {

            console.log(
                'PINTEREST MODE: LINK'
            );


            imageUrl =
                await getPinterestPinImage(
                    input
                );

        }

        else {

            console.log(
                'PINTEREST MODE: SEARCH'
            );


            imageUrl =
                await searchPinterest(
                    input
                );

        }


        console.log(
            'PINTEREST IMAGE URL:',
            imageUrl
        );



        const tempDir =
            path.join(
                os.tmpdir(),
                'wa-bot-pinterest'
            );


        if (
            !fs.existsSync(tempDir)
        ) {

            fs.mkdirSync(
                tempDir,
                {
                    recursive: true
                }
            );

        }


        imagePath =
            path.join(
                tempDir,
                `pinterest_${Date.now()}.jpg`
            );


        await downloadFile(
            imageUrl,
            imagePath
        );


        console.log(
            'PINTEREST IMAGE READY'
        );



        const media =
            MessageMedia.fromFilePath(
                imagePath
            );


        await message.reply(
            media,
            undefined,
            {
                sendMediaAsDocument: false
            }
        );


        console.log(
            'PINTEREST IMAGE SENT'
        );

    }


    catch (error) {

        console.error(
            'PINTEREST ERROR:',
            error
        );


        await message.reply(
            '❌ Gagal mengambil gambar Pinterest.'
        );

    }


    finally {

        if (
            imagePath &&
            fs.existsSync(imagePath)
        ) {

            try {

                fs.unlinkSync(
                    imagePath
                );


                console.log(
                    'PINTEREST IMAGE DELETED'
                );

            }

            catch (error) {

                console.error(
                    'PINTEREST CLEANUP ERROR:',
                    error
                );

            }

        }

    }

}


module.exports = {
    handlePinterest
};