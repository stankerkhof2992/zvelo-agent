const fs = require('fs');
const path = require('path');

let sharp;
try { sharp = require('sharp'); } catch { sharp = null; }

const MOCKUPS_DIR = process.env.ASSETS_PATH
  ? path.join(process.env.ASSETS_PATH, 'mockups')
  : path.join(__dirname, '..', '..', 'assets', 'mockups');

// Zorg dat mockups directory bestaat
if (!fs.existsSync(MOCKUPS_DIR)) fs.mkdirSync(MOCKUPS_DIR, { recursive: true });

async function resizeProduct(imagePath, size, whiteBg = true) {
  if (!sharp) throw new Error('Sharp niet beschikbaar');
  return sharp(imagePath)
    .resize(size, size, {
      fit: 'contain',
      background: whiteBg
        ? { r: 255, g: 255, b: 255, alpha: 1 }
        : { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toBuffer();
}

async function makeShadow(size, blur, alpha) {
  return sharp({
    create: {
      width: size + 80,
      height: size + 80,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha }
    }
  })
    .blur(blur)
    .png()
    .toBuffer();
}

// Template 1: Ingelijst aan wuur (3000x2000, warm wit, donker kader, schaduw)
async function createWallMockup(productImagePath, outputPath) {
  const W = 3000, H = 2000;
  const PRODUCT = 900;
  const FRAME = 28;
  const SHADOW_BLUR = 35;
  const SHADOW_ALPHA = 85;
  const SHADOW_OFFSET = 22;

  const productBuf = await resizeProduct(productImagePath, PRODUCT);
  const shadowBuf = await makeShadow(PRODUCT + FRAME * 2, SHADOW_BLUR, SHADOW_ALPHA);

  const cx = Math.floor((W - PRODUCT) / 2);
  const cy = Math.floor((H - PRODUCT) / 2);

  await sharp({
    create: { width: W, height: H, channels: 3, background: { r: 247, g: 244, b: 239 } }
  })
    .composite([
      { input: shadowBuf, left: cx - FRAME + SHADOW_OFFSET, top: cy - FRAME + SHADOW_OFFSET },
      {
        input: {
          create: {
            width: PRODUCT + FRAME * 2,
            height: PRODUCT + FRAME * 2,
            channels: 3,
            background: { r: 38, g: 35, b: 32 }
          }
        },
        left: cx - FRAME,
        top: cy - FRAME
      },
      { input: productBuf, left: cx, top: cy }
    ])
    .jpeg({ quality: 92 })
    .toFile(outputPath);
}

// Template 2: Op bureau (3000x2000, warm grijs, rechtsboven, witte rand)
async function createDeskMockup(productImagePath, outputPath) {
  const W = 3000, H = 2000;
  const PRODUCT = 680;
  const FRAME = 14;
  const SHADOW_BLUR = 22;
  const SHADOW_ALPHA = 60;
  const SHADOW_OFFSET = 14;

  const productBuf = await resizeProduct(productImagePath, PRODUCT);
  const shadowBuf = await makeShadow(PRODUCT + FRAME * 2, SHADOW_BLUR, SHADOW_ALPHA);

  // Rechtsboven geplaatst
  const px = W - PRODUCT - FRAME - 260;
  const py = 180;

  await sharp({
    create: { width: W, height: H, channels: 3, background: { r: 232, g: 228, b: 222 } }
  })
    .composite([
      { input: shadowBuf, left: px - FRAME + SHADOW_OFFSET, top: py - FRAME + SHADOW_OFFSET },
      {
        input: {
          create: {
            width: PRODUCT + FRAME * 2,
            height: PRODUCT + FRAME * 2,
            channels: 3,
            background: { r: 255, g: 255, b: 255 }
          }
        },
        left: px - FRAME,
        top: py - FRAME
      },
      { input: productBuf, left: px, top: py }
    ])
    .jpeg({ quality: 92 })
    .toFile(outputPath);
}

// Template 3: Close-up detail (1200x1200, witte achtergrond)
async function createCloseupMockup(productImagePath, outputPath) {
  await sharp(productImagePath)
    .resize(1200, 1200, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 95 })
    .toFile(outputPath);
}

async function createMockups(imagePath, conceptId, title = 'Product') {
  if (!sharp) {
    console.warn('[Mockups] Sharp niet beschikbaar, mockup generatie overgeslagen');
    return [];
  }

  const absoluteImagePath = path.isAbsolute(imagePath)
    ? imagePath
    : path.join(__dirname, '..', '..', imagePath.replace(/^\//, '').split('/').join(path.sep));

  if (!fs.existsSync(absoluteImagePath)) {
    console.error(`[Mockups] Bronafbeelding niet gevonden: ${absoluteImagePath}`);
    return [];
  }

  const results = [];
  const steps = [
    { fn: createWallMockup, label: 'wand', suffix: '1' },
    { fn: createDeskMockup, label: 'bureau', suffix: '2' },
    { fn: createCloseupMockup, label: 'close-up', suffix: '3' }
  ];

  for (const step of steps) {
    const filename = `${conceptId}_mockup_${step.suffix}.jpg`;
    const outputPath = path.join(MOCKUPS_DIR, filename);
    try {
      await step.fn(absoluteImagePath, outputPath);
      results.push(`/assets/mockups/${filename}`);
      console.log(`[Mockups] ✅ ${step.label} mockup aangemaakt`);
    } catch (err) {
      console.error(`[Mockups] Fout bij ${step.label} mockup:`, err.message);
    }
  }

  return results;
}

module.exports = { createMockups };
