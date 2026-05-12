require('dotenv').config();
const cron = require('node-cron');
const { db, generateId, now, log } = require('../database');
const claudeService = require('./claude');
const imageGenService = require('./imageGen');
const mockupsService = require('./mockups');
const pdfService = require('./pdf');
const { sendNotification } = require('./emailService');

let isRunning = false;

async function runPipeline(options = {}) {
  if (isRunning) {
    console.log('[Scheduler] Pipeline loopt al, overgeslagen');
    return { success: false, reason: 'Pipeline is al actief' };
  }

  isRunning = true;
  const results = [];

  try {
    console.log('\n🚀 [Zvelo Agent] Dagelijkse pipeline gestart...');
    log('Dagelijkse pipeline gestart', 'info', `Modus: ${claudeService.isSimulation ? 'simulatie' : 'live'}`);

    // ── Stap 1: Niche analyse ──────────────────────────────────────────────
    console.log('[1/6] Niche analyse uitvoeren...');
    log('Niche analyse gestart', 'info');
    const niches = await claudeService.analyzeNiches();
    const today = new Date().toISOString().split('T')[0];

    for (const niche of niches) {
      const existing = db.prepare(
        'SELECT id FROM niche_analysis WHERE niche = ? AND substr(analyzed_at, 1, 10) = ?'
      ).get(niche.niche, today);

      if (!existing) {
        db.prepare(
          'INSERT INTO niche_analysis (id, niche, score, trend, competition, avg_price, recommended, details, analyzed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
          generateId(), niche.niche, niche.score, niche.trend,
          niche.competition, niche.avg_price,
          niche.recommended ? 1 : 0,
          JSON.stringify(niche.details || {}), now()
        );
      }
    }

    log('Niche analyse voltooid', 'success', `${niches.length} niches geanalyseerd`);
    console.log(`[1/6] ✅ ${niches.length} niches geanalyseerd`);

    // Beste niche bepalen
    const topNiche = options.niche
      ? (niches.find(n => n.niche === options.niche) || niches[0])
      : niches.sort((a, b) => b.score - a.score)[0];

    const count = options.count || parseInt(process.env.AGENT_CONCEPTS_PER_DAY || '3');

    const shops = db.prepare('SELECT * FROM shops').all();
    const defaultShopId = shops.length > 0 ? shops[0].id : null;

    for (let i = 0; i < count; i++) {
      console.log(`\n──────────────────────────────────────────`);
      console.log(`[Concept ${i + 1}/${count}] Niche: ${topNiche.niche}`);

      // ── Stap 2: Concept genereren via Claude ───────────────────────────
      console.log('[2/6] Claude: titel, beschrijving, tags, prijs...');
      log(`Concept ${i + 1} genereren`, 'info', topNiche.niche);
      const concept = await claudeService.generateConcept(topNiche.niche);

      const conceptId = generateId();
      const createdAt = now();

      db.prepare(
        'INSERT INTO concepts (id, shop_id, niche, title, description, tags, price, dalle_prompt, why_this_sells, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        conceptId, defaultShopId, topNiche.niche,
        concept.title, concept.description,
        JSON.stringify(concept.tags),
        concept.price, concept.dalle_prompt,
        concept.why_this_sells, 'pending', createdAt
      );

      console.log(`[2/6] ✅ "${concept.title}"`);

      // ── Stap 3: Afbeelding via Pollinations.ai ─────────────────────────
      console.log('[3/6] Pollinations.ai: productafbeelding genereren...');
      log(`Afbeelding genereren: ${concept.title}`, 'info');

      const imageResult = await imageGenService.generateImage(conceptId, concept.title, topNiche.niche);
      db.prepare('UPDATE concepts SET image_path = ? WHERE id = ?').run(imageResult.path, conceptId);

      console.log(`[3/6] ✅ Afbeelding: ${imageResult.path}${imageResult.simulated ? ' (placeholder)' : ''}`);

      // ── Stap 4: Mockups met Sharp ──────────────────────────────────────
      console.log('[4/6] Sharp: 3 mockups aanmaken...');
      log(`Mockups aanmaken: ${concept.title}`, 'info');

      const mockupPaths = await mockupsService.createMockups(imageResult.path, conceptId, concept.title);
      db.prepare('UPDATE concepts SET mockup_paths = ? WHERE id = ?').run(JSON.stringify(mockupPaths), conceptId);

      console.log(`[4/6] ✅ ${mockupPaths.length} mockups aangemaakt`);

      // ── Stap 5: PDF aanmaken ───────────────────────────────────────────
      console.log('[5/6] pdfkit: print-ready PDF aanmaken...');
      log(`PDF aanmaken: ${concept.title}`, 'info');

      let pdfPath = null;
      try {
        pdfPath = await pdfService.createPDF(conceptId, imageResult.path, concept.title);
        console.log(`[5/6] ✅ PDF: ${pdfPath}`);
      } catch (pdfErr) {
        console.warn(`[5/6] PDF mislukt (niet kritiek): ${pdfErr.message}`);
      }

      // ── Stap 6: Status → ready_for_review ─────────────────────────────
      db.prepare(
        "UPDATE concepts SET status = 'ready_for_review' WHERE id = ?"
      ).run(conceptId);

      log(`Concept klaar voor review: ${concept.title}`, 'success');
      console.log(`[6/6] ✅ "${concept.title}" klaar voor review`);

      results.push({
        id: conceptId,
        title: concept.title,
        niche: topNiche.niche,
        price: concept.price,
        imagePath: imageResult.path,
        mockupPaths,
        pdfPath
      });
    }

    console.log(`──────────────────────────────────────────\n`);

    const msg = `${count} nieuwe concept(en) klaar voor review. Niche: ${topNiche.niche}`;
    await sendNotification('Nieuwe concepten klaar', msg);
    log('Dagelijkse pipeline voltooid', 'success', `${count} concepten gegenereerd`);
    console.log(`✅ [Zvelo Agent] Pipeline voltooid — ${count} concepten klaar voor review\n`);

    return { success: true, concepts: results, niche: topNiche.niche };
  } catch (err) {
    console.error('[Scheduler] Pipeline fout:', err.message);
    log('Pipeline fout', 'error', err.message);
    return { success: false, error: err.message };
  } finally {
    isRunning = false;
  }
}

function startScheduler() {
  const schedule = process.env.AGENT_CRON_SCHEDULE || '0 8 * * *';

  if (!cron.validate(schedule)) {
    console.error(`[Scheduler] Ongeldige cron expressie: ${schedule}`);
    return;
  }

  cron.schedule(schedule, () => {
    console.log(`[Scheduler] Dagelijkse job gestart (${schedule})`);
    runPipeline().catch(err => console.error('[Scheduler] Job fout:', err.message));
  }, { timezone: 'Europe/Amsterdam' });

  console.log(`[Scheduler] Dagelijkse agent gepland: ${schedule} (Amsterdam tijd)`);
}

module.exports = { startScheduler, runPipeline, isRunning: () => isRunning };
