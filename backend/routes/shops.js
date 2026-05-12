const express = require('express');
const router = express.Router();
const { db, generateId, now, log } = require('../database');
const etsyService = require('../services/etsyService');

// GET /api/shops
router.get('/', (req, res) => {
  try {
    const shops = db.prepare('SELECT * FROM shops ORDER BY created_at DESC').all();
    res.json(shops);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shops/:id
router.get('/:id', (req, res) => {
  try {
    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.id);
    if (!shop) return res.status(404).json({ error: 'Shop niet gevonden' });

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_concepts,
        SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status='pending' OR status='ready_for_review' THEN 1 ELSE 0 END) as pending,
        COALESCE(SUM(revenue), 0) as total_revenue,
        COALESCE(SUM(views), 0) as total_views
      FROM concepts WHERE shop_id = ?
    `).get(req.params.id);

    res.json({ ...shop, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shops — Handmatig een shop aanmaken (zonder OAuth)
router.post('/', (req, res) => {
  try {
    const { name, niche, etsy_shop_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Shopnaam is verplicht' });

    const id = generateId();
    db.prepare(
      'INSERT INTO shops (id, name, niche, etsy_shop_id, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, name, niche || 'Minimalist Wall Art Printables', etsy_shop_id || null, now());

    log(`Nieuwe shop aangemaakt: ${name}`, 'info');
    res.status(201).json(db.prepare('SELECT * FROM shops WHERE id = ?').get(id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/shops/:id
router.put('/:id', (req, res) => {
  try {
    const { name, niche } = req.body;
    db.prepare(`
      UPDATE shops SET
        name = COALESCE(?, name),
        niche = COALESCE(?, niche)
      WHERE id = ?
    `).run(name || null, niche || null, req.params.id);

    res.json(db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/shops/:id
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM shops WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shops/:id/listings — Live Etsy listings ophalen
router.get('/:id/listings', async (req, res) => {
  try {
    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.id);
    if (!shop) return res.status(404).json({ error: 'Shop niet gevonden' });

    const listings = await etsyService.getShopListings(shop);
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shops/:id/sync — Stats synchroniseren vanuit Etsy
router.post('/:id/sync', async (req, res) => {
  try {
    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.id);
    if (!shop) return res.status(404).json({ error: 'Shop niet gevonden' });

    const publishedConcepts = db.prepare(
      "SELECT * FROM concepts WHERE shop_id = ? AND status = 'published' AND etsy_listing_id IS NOT NULL"
    ).all(req.params.id);

    let updated = 0;
    for (const concept of publishedConcepts) {
      const stats = await etsyService.getListingStats(concept.etsy_listing_id, shop);
      db.prepare('UPDATE concepts SET views=?, revenue=? WHERE id=?').run(stats.views, stats.revenue, concept.id);
      updated++;
    }

    const totalRevenue = db.prepare(
      "SELECT COALESCE(SUM(revenue), 0) as total FROM concepts WHERE shop_id = ?"
    ).get(req.params.id).total;

    db.prepare('UPDATE shops SET total_revenue=?, listings_count=? WHERE id=?')
      .run(totalRevenue, publishedConcepts.length, req.params.id);

    log(`Stats gesynchroniseerd voor shop: ${shop.name}`, 'success', `${updated} listings bijgewerkt`);
    res.json({ success: true, updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
