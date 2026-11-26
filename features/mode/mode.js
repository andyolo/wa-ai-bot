async function handleMode(message, args, botReply) {
    const mode = (args[0] || '').toLowerCase();

    if (mode !== 'villain') {
        await botReply(
            message,
            'Gunakan: >mode villain'
        );
        return;
    }

    const menu = `
╔══════════════════════════╗
       ☠ VILLAIN MODE
        LRV DARK SYSTEM
╚══════════════════════════╝

[01] PIXIV
     Art & Illustration

[02] NSFW
     Content Settings

[03] RULE34
     Feature Information

━━━━━━━━━━━━━━━━━━━━━━━━━━
       LRV BOT SYSTEM
`;

    await botReply(message, menu);
}

module.exports = { handleMode };