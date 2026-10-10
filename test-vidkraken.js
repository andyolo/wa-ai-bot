require('dotenv').config();

async function main() {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

    const response = await fetch(
        'https://vidkraken.com/api/v2/info',
        {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + process.env.VIDKRAKEN_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: url
            })
        }
    );

    console.log('STATUS:', response.status);
    console.log(await response.text());
}

main().catch(console.error);