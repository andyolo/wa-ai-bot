require('dotenv').config();

async function main() {
    const url = 'https://www.youtube.com/watch?v=VIDEO_ID';

    const response = await fetch(
        'https://vidkraken.com/api/v2/download',
        {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + process.env.VIDKRAKEN_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: url,
                format: 'mp3'
            }) 
        }
    );

    console.log('STATUS:', response.status);
    console.log(await response.text());
}

main().catch(console.error);