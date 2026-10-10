async function botReact(message, emoji = '☁️') {
    try {
        if (message.fromMe) {
            return false;
        }

        // WhatsApp Web baru memakai $1,
        // sedangkan whatsapp-web.js masih mencari _serialized
        if (
            message.id &&
            !message.id._serialized &&
            message.id.$1
        ) {
            message.id._serialized =
                message.id.$1;
        }

        console.log(
            'REACTION ID:',
            message.id
        );

        await message.react(emoji);

        console.log(
            'REACTION BERHASIL:',
            emoji
        );

        return true;

    } catch (error) {
        console.error(
            'REACTION ERROR:',
            error
        );

        return false;
    }
}

module.exports = {
    botReact
};