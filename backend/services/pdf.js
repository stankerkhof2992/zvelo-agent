const fs = require('fs');
const path = require('path');

let PDFDocument;
try { PDFDocument = require('pdfkit'); } catch { PDFDocument = null; }

let sharp;
try { sharp = require('sharp'); } catch { sharp = null; }

const PRODUCTS_DIR = process.env.ASSETS_PATH
  ? path.join(process.env.ASSETS_PATH, 'products')
  : path.join(__dirname, '..', '..', 'assets', 'products');
if (!fs.existsSync(PRODUCTS_DIR)) fs.mkdirSync(PRODUCTS_DIR, { recursive: true });

async function prepareImageForPdf(imagePath) {
  const ext = path.extname(imagePath).toLowerCase();

  // SVG niet direct te gebruiken in pdfkit — converteren naar PNG
  if (ext === '.svg' && sharp) {
    const pngPath = imagePath.replace('.svg', '_pdf_tmp.png');
    await sharp(imagePath).resize(2480, 2480).png().toFile(pngPath);
    return pngPath;
  }

  // PNG/JPG direct bruikbaar
  return imagePath;
}

async function createPDF(conceptId, imagePath, title = 'Digital Product') {
  if (!PDFDocument) {
    console.warn('[PDF] pdfkit niet beschikbaar, PDF generatie overgeslagen');
    return null;
  }

  const outputPath = path.join(PRODUCTS_DIR, `${conceptId}.pdf`);
  const publicPath = `/assets/products/${conceptId}.pdf`;

  // Afbeelding pad omzetten naar absoluut en eventueel converteren
  const absoluteImagePath = path.isAbsolute(imagePath)
    ? imagePath
    : path.join(__dirname, '..', '..', imagePath.replace(/^\//, '').split('/').join(path.sep));

  if (!fs.existsSync(absoluteImagePath)) {
    console.warn(`[PDF] Afbeelding niet gevonden: ${absoluteImagePath}`);
    return null;
  }

  let pdfImagePath;
  try {
    pdfImagePath = await prepareImageForPdf(absoluteImagePath);
  } catch {
    pdfImagePath = absoluteImagePath;
  }

  return new Promise((resolve, reject) => {
    try {
      // A4 afmetingen in punten (72 punten per inch)
      // A4 = 210mm x 297mm = 595.28 x 841.89 pt
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        info: {
          Title: title,
          Author: 'Zvelo Digital Products',
          Subject: 'Printable digital product',
          Keywords: 'printable, digital, download, art',
          Creator: 'Zvelo Agent'
        }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const pageW = doc.page.width;   // 595.28
      const pageH = doc.page.height;  // 841.89

      // Witte achtergrond
      doc.rect(0, 0, pageW, pageH).fill('#ffffff');

      // Afbeelding gecentreerd met 1cm marge (28.35 pt per cm)
      const margin = 28.35;
      const available = Math.min(pageW - margin * 2, pageH - margin * 2);
      const x = (pageW - available) / 2;
      const y = (pageH - available) / 2;

      doc.image(pdfImagePath, x, y, {
        width: available,
        height: available,
        fit: [available, available],
        align: 'center',
        valign: 'center'
      });

      doc.end();

      stream.on('finish', () => {
        // Tijdelijk PNG bestand opruimen
        if (pdfImagePath !== absoluteImagePath && fs.existsSync(pdfImagePath)) {
          fs.unlink(pdfImagePath, () => {});
        }
        console.log(`[PDF] ✅ Print-ready PDF aangemaakt: ${outputPath}`);
        resolve(publicPath);
      });

      stream.on('error', (err) => {
        console.error('[PDF] Stream fout:', err.message);
        reject(err);
      });
    } catch (err) {
      console.error('[PDF] Aanmaken mislukt:', err.message);
      reject(err);
    }
  });
}

function pdfExists(conceptId) {
  const pdfPath = path.join(PRODUCTS_DIR, `${conceptId}.pdf`);
  return fs.existsSync(pdfPath);
}

module.exports = { createPDF, pdfExists };
