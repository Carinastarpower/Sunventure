import fs from "node:fs/promises";
import QRCode from "qrcode";

const url = process.argv[2];
if (!url) throw new Error("Usage: node helper/make-qr.mjs exp://...");

await QRCode.toFile("expo-qr.png", url, { width: 640, margin: 2 });
const dataUrl = await QRCode.toDataURL(url, { width: 640, margin: 2 });
await fs.writeFile(
  "expo-qr.html",
  `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sunventure Expo QR code</title><body style="font-family:system-ui;text-align:center;padding:24px"><h1>Scan to open Sunventure</h1><p>${url}</p><img src="${dataUrl}" alt="Sunventure Expo QR code" width="640" height="640"></body>`,
);
console.log("Saved expo-qr.png and expo-qr.html");
