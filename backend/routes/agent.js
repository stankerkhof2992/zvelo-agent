const express = require('express');
const router = express.Router();
const { db, log } = require('../database');
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
router.get('/logs', (req, res) => {
  try {
    const { limit = 100, status } = req.query;
    let query = 'SELECT * FROM agent_logs';
    const params = [];

    if (status) { query += ' WHERE status = ?'; params.push(status); }
    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(parseInt(limit));

    const logs = db.prepare(query).all(...params);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/niche-analysis
router.get('/niche-analysis', (req, res) => {
  try {
    // Laatste analyse per niche
    const niches = db.prepare(`
      SELECT * FROM niche_analysis
      WHERE id IN (
        SELECT id FROM niche_analysis n2
        WHERE n2.niche = niche_analysis.niche
        ORDER BY analyzed_at DESC LIMIT 1
      )
      ORDER BY score DESC
    `).all();

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
router.get('/costs', (req, res) => {
  try {
    const totalCents = db.prepare('SELECT COALESCE(SUM(cost_cents), 0) as total FROM agent_logs').get().total;
    const byAction = db.prepare(`
      SELECT action, SUM(cost_cents) as total_cents, COUNT(*) as count
      FROM agent_logs
      WHERE cost_cents > 0
      GROUP BY action
      ORDER BY total_cents DESC
    `).all();

    const dailyCosts = db.prepare(`
      SELECT date(timestamp) as date, SUM(cost_cents) as total_cents
      FROM agent_logs
      WHERE cost_cents > 0
      GROUP BY date(timestamp)
      ORDER BY date DESC
      LIMIT 30
    `).all();

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
    const { week } = req.query;

    const since28 = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const weeklyRevenue = db.prepare(`
      SELECT substr(published_at, 1, 10) as date, SUM(revenue) as revenue, COUNT(*) as listings
      FROM concepts
      WHERE status = 'published'
        AND published_at >= ?
      GROUP BY substr(published_at, 1, 10)
      ORDER BY date ASC
    `).all(since28);

    const topListings = db.prepare(`
      SELECT id, title, views, revenue, published_at, etsy_listing_id
      FROM concepts
      WHERE status = 'published'
      ORDER BY views DESC
      LIMIT 10
    `).all();

    const salesData = {
      total_revenue: weeklyRevenue.reduce((s, r) => s + (r.revenue || 0), 0),
      total_views: db.prepare("SELECT COALESCE(SUM(views),0) as v FROM concepts WHERE status='published'").get().v,
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
