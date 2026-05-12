const express = require('express');
const router = express.Router();
const { query, queryOne, run, generateId, now, log } = require('../database');
const etsyService = require('../services/etsyService');

// GET /api/shops
router.get('/', async (req, res) => {
  try {
    const shops = await query('SELECT * FROM shops ORDER BY created_at DESC');
    res.json(shops);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shops/:id
router.get('/:id', async (req, res) => {
  try {
    const shop = await queryOne('SELECT * FROM shops WHERE id = $1', [req.params.id]);
    if (!shop) return res.status(404).json({ error: 'Shop niet gevonden' });

    const stats = await queryOne(`
      SELECT
        COUNT(*) as total_concepts,
        SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status='pending' OR status='ready_for_review' THEN 1 ELSE 0 END) as pending,
        COALESCE(SUM(revenue), 0) as total_revenue,
        COALESCE(SUM(views), 0) as total_views
      FROM concepts WHERE shop_id = $1
    `, [req.params.id]);

    res.json({ ...shop, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shops — Handmatig een shop aanmaken (zonder OAuth)
router.post('/', async (req, res) => {
  try {
    const { name, niche, etsy_shop_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Shopnaam is verplicht' });

    const id = generateId();
    await run(
      'INSERT INTO shops (id, name, niche, etsy_shop_id, created_at) VALUES ($1, $2, $3, $4, $5)',
      [id, name, niche || 'Minimalist Wall Art Printables', etsy_shop_id || null, now()]
    );

    log(`Nieuwe shop aangemaakt: ${name}`, 'info');
    const shop = await queryOne('SELECT * FROM shops WHERE id = $1', [id]);
    res.status(201).json(shop);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/shops/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, niche } = req.body;
    await run(`
      UPDATE shops SET
        name = COALESCE($1, name),
        niche = COALESCE($2, niche)
      WHERE id = $3
    `, [name || null, niche || null, req.params.id]);

    const shop = await queryOne('SELECT * FROM shops WHERE id = $1', [req.params.id]);
    res.json(shop);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/shops/:id
router.delete('/:id', async (req, res) => {
  try {
    await run('DELETE FROM shops WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shops/:id/listings — Live Etsy listings ophalen
router.get('/:id/listings', async (req, res) => {
  try {
    const shop = await queryOne('SELECT * FROM shops WHERE id = $1', [req.params.id]);
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
    const shop = await queryOne('SELECT * FROM shops WHERE id = $1', [req.params.id]);
    if (!shop) return res.status(404).json({ error: 'Shop niet gevonden' });

    const publishedConcepts = await query(
      "SELECT * FROM concepts WHERE shop_id = $1 AND status = 'published' AND etsy_listing_id IS NOT NULL",
      [req.params.id]
    );

    let updated = 0;
    for (const concept of publishedConcepts) {
      const stats = await etsyService.getListingStats(concept.etsy_listing_id, shop);
      await run('UPDATE concepts SET views=$1, revenue=$2 WHERE id=$3', [stats.views, stats.revenue, concept.id]);
      updated++;
    }

    const totalRow = await queryOne(
      "SELECT COALESCE(SUM(revenue), 0) as total FROM concepts WHERE shop_id = $1",
      [req.params.id]
    );
    await run('UPDATE shops SET total_revenue=$1, listings_count=$2 WHERE id=$3', [
      Number(totalRow.total), publishedConcepts.length, req.params.id
    ]);

    log(`Stats gesynchroniseerd voor shop: ${shop.name}`, 'success', `${updated} listings bijgewerkt`);
    res.json({ success: true, updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
