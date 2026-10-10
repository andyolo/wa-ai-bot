const fs = require("fs");

const file = process.env.TEMP + "\\pinterest_rendered.html";
const h = fs.readFileSync(file, "utf8");

// Ambil URL i.pinimg.com yang berhenti di ekstensi gambar
const matches = h.match(
    /https?:\/\/i\.pinimg\.com\/[^"'\\\s)]+?\.(?:jpg|jpeg|png|webp)/gi
) || [];

// Buang duplikat URL
const unique = [...new Set(matches)];

// Ambil hanya gambar original
const originals = unique.filter(url =>
    url.includes("/originals/")
);

console.log("SEMUA URL:", unique.length);
console.log("ORIGINAL:", originals.length);
console.log("");

originals.forEach((url, i) => {
    console.log(`${i + 1}. ${url}`);
});