require('dotenv').config();
const cron = require('node-cron');
const { query, queryOne, run, generateId, now, log } = require('../database');
const claudeService = require('./claude');
const imageGenService = require('./imageGen');
const mockupsService = require('./mockups');
const pdfService = require('./pdf');
const { sendNotification } = require('./emailService');

let isRunning = false;
let lastError = null;
let lastRunTime = null;
let lastRunResult = null;

async function runPipeline(options = {}) {
  if (isRunning) {
    console.log('[Scheduler] Pipeline loopt al, overgeslagen');
    return { success: false, reason: 'Pipeline is al actief' };
  }

  isRunning = true;
  lastError = null;
  lastRunTime = new Date().toISOString();
  const results = [];

  try {
    // Detecteer simulation mode dynamisch zodat Settings-pagina wijzigingen direct werken
    const simulation = !process.env.ANTHROPIC_API_KEY;
    console.log(`\n🚀 [Zvelo Agent] Pipeline gestart (modus: ${simulation ? 'simulatie' : 'live'})...`);
    log('Dagelijkse pipeline gestart', 'info', `Modus: ${simulation ? 'simulatie' : 'live'}`);

    // ── Stap 1: Niche analyse ──────────────────────────────────────────────
    console.log('[1/6] Niche analyse uitvoeren...');
    const niches = await claudeService.analyzeNiches();
    const today = new Date().toISOString().split('T')[0];

    for (const niche of niches) {
      const existing = await queryOne(
        'SELECT id FROM niche_analysis WHERE niche = $1 AND LEFT(analyzed_at, 10) = $2',
        [niche.niche, today]
      );

      if (!existing) {
        await run(
          'INSERT INTO niche_analysis (id, niche, score, trend, competition, avg_price, recommended, details, analyzed_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [
            generateId(), niche.niche, niche.score, niche.trend,
            niche.competition, niche.avg_price,
            niche.recommended ? 1 : 0,
            JSON.stringify(niche.details || {}), now()
          ]
        );
      }
    }

    log('Niche analyse voltooid', 'success', `${niches.length} niches geanalyseerd`);
    console.log(`[1/6] ✅ ${niches.length} niches geanalyseerd`);

    const topNiche = options.niche
      ? (niches.find(n => n.niche === options.niche) || niches[0])
      : niches.sort((a, b) => b.score - a.score)[0];

    const count = options.count || parseInt(process.env.AGENT_CONCEPTS_PER_DAY || '3');
    const shops = await query('SELECT * FROM shops');
    const defaultShopId = shops.length > 0 ? shops[0].id : null;

    for (let i = 0; i < count; i++) {
      // Per-concept try/catch: één mislukking stopt de andere concepten niet
      try {
        console.log(`\n──────────────────────────────────────────`);
        console.log(`[Concept ${i + 1}/${count}] Niche: ${topNiche.niche}`);

        // ── Stap 2: Concept genereren via Claude ─────────────────────────
        console.log('[2/6] Claude: titel, beschrijving, tags, prijs...');
        log(`Concept ${i + 1} genereren`, 'info', topNiche.niche);
        const concept = await claudeService.generateConcept(topNiche.niche);

        const conceptId = generateId();
        await run(
          'INSERT INTO concepts (id, shop_id, niche, title, description, tags, price, dalle_prompt, why_this_sells, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
          [
            conceptId, defaultShopId, topNiche.niche,
            concept.title, concept.description,
            JSON.stringify(concept.tags),
            concept.price, concept.dalle_prompt || '',
            concept.why_this_sells || '', 'pending', now()
          ]
        );

        console.log(`[2/6] ✅ "${concept.title}"`);

        // ── Stap 3: Afbeelding via Pollinations.ai ───────────────────────
        console.log('[3/6] Pollinations.ai: productafbeelding genereren...');
        log(`Afbeelding genereren: ${concept.title}`, 'info');

        const imageResult = await imageGenService.generateImage(conceptId, concept.title, topNiche.niche);
        await run('UPDATE concepts SET image_path = $1 WHERE id = $2', [imageResult.path, conceptId]);
        console.log(`[3/6] ✅ Afbeelding: ${imageResult.path}${imageResult.simulated ? ' (placeholder)' : ''}`);

        // ── Stap 4: Mockups met Sharp ────────────────────────────────────
        console.log('[4/6] Sharp: 3 mockups aanmaken...');
        log(`Mockups aanmaken: ${concept.title}`, 'info');

        const mockupPaths = await mockupsService.createMockups(imageResult.path, conceptId, concept.title);
        await run('UPDATE concepts SET mockup_paths = $1 WHERE id = $2', [JSON.stringify(mockupPaths), conceptId]);
        console.log(`[4/6] ✅ ${mockupPaths.length} mockups aangemaakt`);

        // ── Stap 5: PDF aanmaken ─────────────────────────────────────────
        console.log('[5/6] pdfkit: print-ready PDF aanmaken...');
        log(`PDF aanmaken: ${concept.title}`, 'info');

        try {
          const pdfPath = await pdfService.createPDF(conceptId, imageResult.path, concept.title);
          if (pdfPath) console.log(`[5/6] ✅ PDF: ${pdfPath}`);
        } catch (pdfErr) {
          console.warn(`[5/6] ⚠️ PDF mislukt (niet kritiek): ${pdfErr.message}`);
        }

        // ── Stap 6: Status → ready_for_review ───────────────────────────
        await run("UPDATE concepts SET status = 'ready_for_review' WHERE id = $1", [conceptId]);
        log(`Concept klaar voor review: ${concept.title}`, 'success');
        console.log(`[6/6] ✅ "${concept.title}" klaar voor review`);

        results.push({ id: conceptId, title: concept.title, niche: topNiche.niche });
      } catch (conceptErr) {
        const msg = `Concept ${i + 1} mislukt: ${conceptErr.message}`;
        console.error(`[Concept ${i + 1}] ❌ ${conceptErr.message}`);
        log(msg, 'error', conceptErr.stack || conceptErr.message);
      }
    }

    console.log(`──────────────────────────────────────────\n`);

    if (results.length > 0) {
      const msg = `${results.length} nieuwe concept(en) klaar voor review. Niche: ${topNiche.niche}`;
      await sendNotification('Nieuwe concepten klaar', msg).catch(() => {});
      log('Pipeline voltooid', 'success', `${results.length} concepten gegenereerd`);
      console.log(`✅ [Zvelo Agent] Pipeline klaar — ${results.length}/${count} concepten`);
      lastRunResult = { success: true, count: results.length };
    } else {
      const msg = 'Alle concepten in de pipeline zijn mislukt';
      log(msg, 'error');
      lastError = msg;
      lastRunResult = { success: false, error: msg };
    }

    return { success: results.length > 0, concepts: results, niche: topNiche.niche };
  } catch (err) {
    const msg = err.message || 'Onbekende fout in pipeline';
    console.error('[Scheduler] Pipeline fout:', msg);
    log('Pipeline fout', 'error', msg);
    lastError = msg;
    lastRunResult = { success: false, error: msg };
    return { success: false, error: msg };
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

  try {
    cron.schedule(schedule, () => {
      console.log(`[Scheduler] Dagelijkse job gestart (${schedule})`);
      runPipeline().catch(err => console.error('[Scheduler] Job fout:', err.message));
    }, { timezone: 'Europe/Amsterdam' });
    console.log(`[Scheduler] Dagelijkse agent gepland: ${schedule} (Amsterdam tijd)`);
  } catch (cronErr) {
    // Timezone niet beschikbaar — val terug op UTC
    cron.schedule(schedule, () => {
      runPipeline().catch(err => console.error('[Scheduler] Job fout:', err.message));
    });
    console.log(`[Scheduler] Dagelijkse agent gepland: ${schedule} (UTC, timezone niet beschikbaar)`);
  }
}

module.exports = {
  startScheduler,
  runPipeline,
  isRunning: () => isRunning,
  getLastError: () => lastError,
  getLastRunTime: () => lastRunTime,
  getLastResult: () => lastRunResult
};
