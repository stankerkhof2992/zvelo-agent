require('dotenv').config();
const OpenAI = require('openai');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const isSimulation = !process.env.OPENAI_API_KEY;

let openai = null;
if (!isSimulation) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const ASSETS_DIR = path.join(__dirname, '..', '..', 'assets', 'generated');

function generatePlaceholderSvg(title = 'Product Preview', index = 0) {
  const colors = ['#F5E6D3', '#D4E6D3', '#D3D4E6', '#E6D3D4', '#E6E4D3'];
  const textColors = ['#8B5E3C', '#3C7A4A', '#3C4A7A', '#7A3C3C', '#6B6435'];
  const bg = colors[index % colors.length];
  const text = textColors[index % textColors.length];
  const shortTitle = title.substring(0, 30);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <rect width="800" height="800" fill="${bg}"/>
  <rect x="60" y="60" width="680" height="680" fill="none" stroke="${text}" stroke-width="2" stroke-dasharray="8,4"/>
  <text x="400" y="320" font-family="Georgia,serif" font-size="36" fill="${text}" text-anchor="middle" font-style="italic">Zvelo Digital Products</text>
  <line x1="200" y1="360" x2="600" y2="360" stroke="${text}" stroke-width="1"/>
  <text x="400" y="410" font-family="Arial,sans-serif" font-size="20" fill="${text}" text-anchor="middle">${shortTitle}</text>
  <text x="400" y="460" font-family="Arial,sans-serif" font-size="14" fill="${text}" text-anchor="middle" opacity="0.7">✦ Instant Download</text>
  <text x="400" y="720" font-family="Arial,sans-serif" font-size="12" fill="${text}" text-anchor="middle" opacity="0.5">Simulatiemodus — DALL-E niet actief</text>
</svg>`;
}

async function generateImage(prompt, conceptId, title = 'Product') {
  const filename = `${conceptId}.png`;
  const filepath = path.join(ASSETS_DIR, filename);
  const publicPath = `/assets/generated/${filename}`;

  if (isSimulation) {
    console.log('[DALL-E] Simulatiemodus: placeholder afbeelding aanmaken');
    const svgContent = generatePlaceholderSvg(title, 0);
    const svgPath = path.join(ASSETS_DIR, `${conceptId}.svg`);
    fs.writeFileSync(svgPath, svgContent, 'utf8');
    return {
      path: `/assets/generated/${conceptId}.svg`,
      costCents: 0,
      simulated: true
    };
  }

  console.log(`[DALL-E] Afbeelding genereren voor concept ${conceptId}`);

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: prompt,
    n: 1,
    size: '1024x1024',
    quality: 'hd',
    style: 'natural'
  });

  const imageUrl = response.data[0].url;

  const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  fs.writeFileSync(filepath, imageResponse.data);

  console.log(`[DALL-E] Afbeelding opgeslagen: ${filepath}`);

  return {
    path: publicPath,
    costCents: 8,
    simulated: false
  };
}

module.exports = { generateImage, isSimulation };
