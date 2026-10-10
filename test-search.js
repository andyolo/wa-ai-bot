require('dotenv').config();

async function main() {
    const query = 'lofi music';

    const params = new URLSearchParams({
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: '5',
        regionCode: 'ID',
        relevanceLanguage: 'id',
        key: process.env.YOUTUBE_API_KEY
    });

    const response = await fetch(
        'https://www.googleapis.com/youtube/v3/search?' + params
    );

    console.log('STATUS:', response.status);

    const data = await response.json();

    if (!response.ok) {
        console.log(JSON.stringify(data, null, 2));
        return;
    }

    for (const item of data.items) {
        console.log('\nTITLE:', item.snippet.title);
        console.log(
            'URL: https://www.youtube.com/watch?v=' +
            item.id.videoId
        );
    }
}

main().catch(console.error);