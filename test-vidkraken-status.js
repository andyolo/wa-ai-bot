require('dotenv').config();

async function main() {
    const jobId = '43b07fcd-3953-44ff-a07b-52fc52b84c2b';

    const response = await fetch(
        'https://vidkraken.com/api/v2/info/' + jobId,
        {
            headers: {
                'Authorization': 'Bearer ' + process.env.VIDKRAKEN_API_KEY
            }
        }
    );

    console.log('STATUS:', response.status);
    console.log(await response.text());
}

main().catch(console.error);