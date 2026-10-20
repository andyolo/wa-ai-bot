# LRV ４ちゃん

**A multifunctional WhatsApp bot built with Node.js.**

LRV BOT is a WhatsApp automation project designed to provide useful tools, entertainment, and AI-powered assistance in one place.

## 🗿 Features

- 🎮 **Games:** Number guessing, Rock Paper Scissors, and more.
- 🎵 **YouTube:** Search and play audio directly through WhatsApp.
- 📥 **Media Downloader:** TikTok, Instagram, Pinterest, and other supported platforms.
- 🎨 **Pixiv:** Search and send illustrations. NovelAI works are allowed,
  while gore and configured disturbing tags stay filtered independently of `/nsfw`.
- 🔞 **e621:** Search explicit-rated posts with `/r34 [tag]`; `/nsfw on` is
  required, and disturbing/AI-tag filters are applied.
- 🖼️ **Sticker Maker:** Convert images into stickers with `/s`; use `/s -f` to keep the full image, or send a video with `/s` for a 6-second animated sticker.
- 🎶 **AI Assistant:** AI-powered responses using Groq.
- 📌 **Utilities:** Date information, ping, and other useful commands.

## 🛠️ Tech Stack

- [Node.js](https://nodejs.org/)
- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)
- [Groq](https://groq.com/)
- [FFmpeg](https://ffmpeg.org/)
- [Sharp](https://sharp.pixelplumbing.com/)

## 📋 Requirements

- Node.js
- npm
- WhatsApp account
- API keys for features that require them

##  Installation

1. Clone this repository:

   ```bash
   git clone YOUR_REPOSITORY_URL
   ```

2. Open the project folder:

   ```bash
   cd wa-ai-bot
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Configure the required environment variables in a `.env` file.

   Pixiv ugoira can be converted and sent as MP4 by enabling:

   ```env
   PIXIV_SEND_VIDEO=true
   PIXIV_MAX_VIDEO_MB=16
   ```

   Set `PIXIV_SEND_VIDEO=false` to disable Pixiv video delivery. Ugoira
   conversion uses the included `ffmpeg-static` dependency.
   AI/NovelAI works are available without changing `/nsfw`; `/nsfw` only
   controls R-18 visibility, while R-18G and blocked tags remain filtered.

   e621 requests retry DNS through Cloudflare DNS-over-HTTPS when the
   network's DNS fails. The default User-Agent identifies this project;
   you can set `E621_USER_AGENT` to include your e621 username as requested
   by the API guidelines. You can set `RULE34_DOH_URL` to another trusted
   HTTPS DNS-over-HTTPS resolver. If the network also blocks that resolver,
   configure a trusted HTTP/HTTPS proxy for these requests:

   ```env
   RULE34_PROXY_URL=http://127.0.0.1:8080
   ```

   Replace the example with a proxy you control or trust. TLS certificate
   verification remains enabled; public/untrusted proxies are not recommended.

5. Start the bot:

   ```bash
   node index.js
   ```

## ⚠️ Disclaimer

This project is intended for educational and personal use. Use responsibly and comply with WhatsApp's terms of service.

## 👨‍💻 Developer

**LRV Squad**

*Gen 1 LRV BOT · 2023-2026*

---

<p align="center">
  Made with Node.js and a questionable amount of debugging.
</p>
