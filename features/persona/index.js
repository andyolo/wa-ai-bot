const fs = require('node:fs');
const path = require('node:path');

const personalityPath = path.join(__dirname, 'personality.md');
const ollamaBaseUrl = (
    process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
).trim().replace(/\/+$/, '');
const ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
const ollamaTimeoutMs = Number.parseInt(
    process.env.OLLAMA_TIMEOUT_MS || '120000',
    10
);
const unavailableAnswer =
    'Maaf, aku belum bisa menjawab dengan benar. Coba tanyakan lagi dengan kalimat yang lebih spesifik, ya.';

console.log(`MILA PERSONA MODULE: ${ollamaModel} safe-output v3 loaded`);

if (!Number.isSafeInteger(ollamaTimeoutMs) || ollamaTimeoutMs < 1000) {
    throw new Error('OLLAMA_TIMEOUT_MS harus berupa angka minimal 1000 milidetik.');
}

const outputRules = [
    'Jawab selalu dalam bahasa Indonesia yang natural, termasuk jika pengguna menyapa dalam bahasa lain.',
    'Jawab singkat dan jelas, maksimal 1-3 kalimat kecuali pengguna meminta penjelasan rinci.',
    'Kirim hanya jawaban final untuk pengguna, bukan analisis atau pembahasan instruksi.',
    'Jangan menulis analisis, penalaran, instruksi, draft, atau komentar tentang cara menjawab.',
    'Mulai langsung dengan jawaban inti; jangan mengulang pertanyaan.',
    'Riwayat percakapan sebelum pesan terbaru adalah konteks aktif yang harus dipakai untuk memahami pertanyaan lanjutan dan informasi pengguna.',
    'Jika tidak yakin, katakan dengan jujur dan jangan mengarang.',
    'Gunakan slang dan emoji hanya jika terasa wajar.'
].join(' ');

function stripThinking(content) {
    return content
        .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
        .replace(/<\/think>/gi, '')
        .trim();
}

function containsReasoning(content) {
    return /\b(?:the user just said|the user used|we are starting a conversation|as per the (?:conversation|guidelines)|the core personality says|response guidelines|let me (?:think|check|see|keep)|i need to respond|i should respond|first,?\s+i need to|maybe something like|the answer should be|since (?:the )?user|pengguna baru saja mengatakan|sesuai instruksi persona|analisis internal|penalaran saya|langkah berpikir|pertama-tama saya harus|jawaban sebaiknya)\b/i
        .test(content);
}

async function requestAnswer(message, systemPrompt, history = []) {
    const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: ollamaModel,
            keep_alive: '10m',
            stream: false,
            messages: [
                { role: 'system', content: systemPrompt },
                ...history,
                { role: 'user', content: String(message) }
            ],
            options: {
                num_predict: 160,
                temperature: 0.3
            }
        }),
        signal: AbortSignal.timeout(ollamaTimeoutMs)
    });

    if (!response.ok) {
        throw new Error(`Ollama HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const answer = typeof data.message?.content === 'string'
        ? stripThinking(data.message.content)
        : '';

    if (!answer) {
        return unavailableAnswer;
    }

    if (containsReasoning(answer)) {
        return unavailableAnswer;
    }

    return answer;
}

async function chat(message, history = []) {
    const personality = fs.readFileSync(personalityPath, 'utf8');
    const previousMessages = Array.isArray(history)
        ? history
            .filter((entry) =>
                entry &&
                (entry.role === 'user' || entry.role === 'assistant') &&
                typeof entry.content === 'string'
            )
            .slice(-12)
        : [];
    const contextualMessage = previousMessages.length
        ? [
            'Konteks percakapan sebelumnya:',
            ...previousMessages.slice(-8).map((entry) => {
                const speaker = entry.role === 'assistant' ? 'Mila' : 'Pengguna';
                return `${speaker}: ${entry.content.slice(-500)}`;
            }),
            '',
            `Pesan terbaru pengguna: ${String(message)}`,
            'Jawab pesan terbaru dengan mempertimbangkan konteks di atas.'
        ].join('\n')
        : String(message);

    return requestAnswer(
        contextualMessage,
        `${personality}\n\nAturan output: ${outputRules}`,
        previousMessages
    );
}

module.exports = { chat };
