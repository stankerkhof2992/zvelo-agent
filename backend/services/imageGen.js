const axios = require('axios');
const fs = require('fs');
const path = require('path');

let sharp;
try { sharp = require('sharp'); } catch { sharp = null; }

const GENERATED_DIR = process.env.ASSETS_PATH
  ? path.join(process.env.ASSETS_PATH, 'generated')
  : path.join(__dirname, '..', '..', 'assets', 'generated');

function buildPrompt(title, niche) {
  const base = (title || niche || 'minimalist design').substring(0, 80);
  return `Minimalist ${base}, flat design, clean white background, botanical line art style, high resolution, print ready, no text, simple elegant shapes, Scandinavian aesthetic`;
}

async function createPlaceholderPng(outputPath, title) {
  if (!sharp) {
    const svgPath = outputPath.replace('.png', '.svg');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200">
      <rect width="1200" height="1200" fill="#F0EDE6"/>
      <rect x="80" y="80" width="1040" height="1040" fill="none" stroke="#D4C8B8" stroke-width="4" stroke-dasharray="20,10"/>
      <text x="600" y="540" font-family="Georgia,serif" font-size="72" fill="#B8A898" text-anchor="middle">Zvelo</text>
      <text x="600" y="640" font-family="Arial,sans-serif" font-size="40" fill="#C4B8A8" text-anchor="middle">Digital Products</text>
      <text x="600" y="720" font-family="Arial,sans-serif" font-size="28" fill="#CCC0B0" text-anchor="middle">Afbeelding niet beschikbaar</text>
    </svg>`;
    fs.writeFileSync(svgPath, svg, 'utf8');
    return svgPath;
  }

  const svgBuffer = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="3000">
    <rect width="3000" height="3000" fill="#F0EDE6"/>
    <rect x="120" y="120" width="2760" height="2760" fill="none" stroke="#D4C8B8" stroke-width="8" stroke-dasharray="40,20"/>
    <text x="1500" y="1380" font-family="Georgia,serif" font-size="240" fill="#B8A898" text-anchor="middle">Zvelo</text>
    <text x="1500" y="1620" font-family="Arial,sans-serif" font-size="120" fill="#C4B8A8" text-anchor="middle">Digital Products</text>
    <text x="1500" y="1820" font-family="Arial,sans-serif" font-size="80" fill="#CCC0B0" text-anchor="middle">Genereren mislukt — placeholder</text>
  </svg>`);

  await sharp(svgBuffer).resize(3000, 3000).png().toFile(outputPath);
  return outputPath;
}

async function generateImage(conceptId, title, niche) {
  const outputPath = path.join(GENERATED_DIR, `${conceptId}.png`);
  const publicPath = `/assets/generated/${conceptId}.png`;
  const prompt = buildPrompt(title, niche);
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=3000&height=3000&nologo=true&seed=${Date.now()}`;

  console.log(`[ImageGen] Pollinations.ai aanroepen voor: "${title?.substring(0, 40)}..."`);

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 90000,
      maxRedirects: 10,
      headers: { 'User-Agent': 'ZveloAgent/1.0' }
    });

    fs.writeFileSync(outputPath, Buffer.from(response.data));
    console.log(`[ImageGen] ✅ Afbeelding opgeslagen: ${outputPath}`);
    return { path: publicPath, simulated: false };
  } catch (err) {
    console.warn(`[ImageGen] Pollinations.ai niet bereikbaar: ${err.message}. Placeholder aanmaken.`);
    const fallbackPath = await createPlaceholderPng(outputPath, title);
    const ext = path.extname(fallbackPath);
    return {
      path: `/assets/generated/${conceptId}${ext}`,
      simulated: true
    };
  }
}

module.exports = { generateImage, buildPrompt };
