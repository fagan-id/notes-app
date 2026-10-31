// Renders public/favicon.svg into the PNG icons the PWA manifest needs.
// Run once with `node scripts/render-icons.js`; the PNGs are committed.
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const svg = await readFile(new URL("../public/favicon.svg", import.meta.url), "utf8");
const svgUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
const outDir = new URL("../public/icons/", import.meta.url);
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
try {
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`
      <style>
        html, body { margin: 0; width: 100%; height: 100%; background: #fff; }
        body { display: grid; place-items: center; }
        img { width: 70%; height: 70%; object-fit: contain; }
      </style>
      <img src="${svgUrl}" alt="">
    `);
    await page.locator("img").evaluate((img) => img.decode());
    await page.screenshot({ path: fileURLToPath(new URL(`pwa-${size}.png`, outDir)) });
    await page.close();
    console.log(`wrote public/icons/pwa-${size}.png`);
  }
} finally {
  await browser.close();
}
