const express = require('express');
const router = express.Router();
const { query, queryOne, log } = require('../database');
const scheduler = require('../services/scheduler');
const claudeService = require('../services/claude');

// POST /api/agent/run — Handmatig de agent starten
router.post('/run', async (req, res) => {
  try {
    if (scheduler.isRunning()) {
      return res.status(409).json({ error: 'Agent is al actief, wacht tot de huidige run klaar is' });
    }

    const { niche, count } = req.body;
    const options = {};
    if (niche) options.niche = niche;
    if (count && count > 0 && count <= 10) options.count = parseInt(count);

    res.json({ success: true, message: 'Agent gestart, concepten worden gegenereerd...' });

    scheduler.runPipeline(options).then(result => {
      log(`Handmatige agent run voltooid: ${result.success ? 'succes' : 'fout'}`, result.success ? 'success' : 'error');
    }).catch(err => {
      log(`Handmatige agent run fout: ${err.message}`, 'error');
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/status
router.get('/status', (req, res) => {
  res.json({
    running: scheduler.isRunning(),
    simulation: !process.env.ANTHROPIC_API_KEY,
    schedule: process.env.AGENT_CRON_SCHEDULE || '0 8 * * *',
    lastError: scheduler.getLastError ? scheduler.getLastError() : null,
    lastRunTime: scheduler.getLastRunTime ? scheduler.getLastRunTime() : null,
    lastResult: scheduler.getLastResult ? scheduler.getLastResult() : null
  });
});

// GET /api/agent/logs
router.get('/logs', async (req, res) => {
  try {
    const { limit = 100, status } = req.query;
    let sql = 'SELECT * FROM agent_logs';
    const params = [];
    let n = 0;

    if (status) { sql += ` WHERE status = $${++n}`; params.push(status); }
    sql += ` ORDER BY timestamp DESC LIMIT $${++n}`;
    params.push(parseInt(limit));

    const logs = await query(sql, params);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/niche-analysis
router.get('/niche-analysis', async (req, res) => {
  try {
    const niches = await query(`
      SELECT * FROM (
        SELECT DISTINCT ON (niche) * FROM niche_analysis ORDER BY niche, analyzed_at DESC
      ) t ORDER BY score DESC
    `);

    const parsed = niches.map(n => ({
      ...n,
      details: JSON.parse(n.details || '{}'),
      recommended: n.recommended === 1
    }));

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/costs
router.get('/costs', async (req, res) => {
  try {
    const totalRow = await queryOne('SELECT COALESCE(SUM(cost_cents), 0) as total FROM agent_logs');
    const byAction = await query(`
      SELECT action, SUM(cost_cents) as total_cents, COUNT(*) as count
      FROM agent_logs
      WHERE cost_cents > 0
      GROUP BY action
      ORDER BY total_cents DESC
    `);

    const dailyCosts = await query(`
      SELECT LEFT(timestamp, 10) as date, SUM(cost_cents) as total_cents
      FROM agent_logs
      WHERE cost_cents > 0
      GROUP BY LEFT(timestamp, 10)
      ORDER BY date DESC
      LIMIT 30
    `);

    const totalCents = Number(totalRow.total);

    res.json({
      total_cents: totalCents,
      total_euros: (totalCents / 100).toFixed(2),
      by_action: byAction,
      daily: dailyCosts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/niches — Lijst van beschikbare niches
router.get('/niches', (req, res) => {
  const niches = [
    'Minimalist Wall Art Printables',
    'Digital Planner Inserts',
    'Social Media Templates',
    'Wedding Invitation Suites',
    'Budget Tracker Spreadsheets',
    'Quote Prints & Typography',
    'Kids Room Decor Printables',
    'Resume & CV Templates',
    'Recipe Cards Printables',
    'Logo Design Templates',
    'Watercolor Art Printables',
    'Affirmation Cards Printable',
    'Birthday Invitation Templates',
    'Habit Tracker Printables',
    'Study Guides & Worksheets'
  ];
  res.json(niches);
});

// GET /api/reports/weekly
router.get('/reports/weekly', async (req, res) => {
  try {
    const since28 = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const weeklyRevenue = await query(`
      SELECT LEFT(published_at, 10) as date, SUM(revenue) as revenue, COUNT(*) as listings
      FROM concepts
      WHERE status = 'published'
        AND published_at >= $1
      GROUP BY LEFT(published_at, 10)
      ORDER BY date ASC
    `, [since28]);

    const topListings = await query(`
      SELECT id, title, views, revenue, published_at, etsy_listing_id
      FROM concepts
      WHERE status = 'published'
      ORDER BY views DESC
      LIMIT 10
    `);

    const viewsRow = await queryOne("SELECT COALESCE(SUM(views), 0) as v FROM concepts WHERE status='published'");

    const salesData = {
      total_revenue: weeklyRevenue.reduce((s, r) => s + Number(r.revenue || 0), 0),
      total_views: Number(viewsRow.v),
      top_listings: topListings,
      weekly_revenue: weeklyRevenue
    };

    const recommendations = await claudeService.generateWeeklyRecommendations(salesData);
    res.json({ ...salesData, recommendations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
