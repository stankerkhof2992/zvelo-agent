const express = require('express');
const router = express.Router();
const { db, generateId, now, log } = require('../database');
const etsyService = require('../services/etsyService');

// GET /api/concepts
router.get('/', (req, res) => {
  try {
    const { status, shop_id, niche } = req.query;
    let query = 'SELECT * FROM concepts WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      const statuses = status.split(',').map(s => s.trim());
      query += ` AND status IN (${statuses.map(() => '?').join(',')})`;
      params.push(...statuses);
    }
    if (shop_id) { query += ' AND shop_id = ?'; params.push(shop_id); }
    if (niche) { query += ' AND niche = ?'; params.push(niche); }

    query += ' ORDER BY created_at DESC';

    const concepts = db.prepare(query).all(...params);
    const parsed = concepts.map(c => ({
      ...c,
      tags: JSON.parse(c.tags || '[]'),
      mockup_paths: JSON.parse(c.mockup_paths || '[]'),
      etsy_payload: JSON.parse(c.etsy_payload || '{}')
    }));

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/concepts/:id
router.get('/:id', (req, res) => {
  try {
    const concept = db.prepare('SELECT * FROM concepts WHERE id = ?').get(req.params.id);
    if (!concept) return res.status(404).json({ error: 'Concept niet gevonden' });

    res.json({
      ...concept,
      tags: JSON.parse(concept.tags || '[]'),
      mockup_paths: JSON.parse(concept.mockup_paths || '[]'),
      etsy_payload: JSON.parse(concept.etsy_payload || '{}')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/concepts/:id
router.put('/:id', (req, res) => {
  try {
    const { title, description, tags, price, niche, why_this_sells } = req.body;
    const concept = db.prepare('SELECT * FROM concepts WHERE id = ?').get(req.params.id);
    if (!concept) return res.status(404).json({ error: 'Concept niet gevonden' });

    db.prepare(`
      UPDATE concepts SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        tags = COALESCE(?, tags),
        price = COALESCE(?, price),
        niche = COALESCE(?, niche),
        why_this_sells = COALESCE(?, why_this_sells)
      WHERE id = ?
    `).run(
      title || null,
      description || null,
      tags ? JSON.stringify(tags) : null,
      price || null,
      niche || null,
      why_this_sells || null,
      req.params.id
    );

    log(`Concept bewerkt: ${title || concept.title}`, 'info');
    const updated = db.prepare('SELECT * FROM concepts WHERE id = ?').get(req.params.id);
    res.json({ ...updated, tags: JSON.parse(updated.tags || '[]'), mockup_paths: JSON.parse(updated.mockup_paths || '[]') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/concepts/:id/approve
router.put('/:id/approve', (req, res) => {
  try {
    const concept = db.prepare('SELECT * FROM concepts WHERE id = ?').get(req.params.id);
    if (!concept) return res.status(404).json({ error: 'Concept niet gevonden' });

    db.prepare("UPDATE concepts SET status = 'approved', approved_at = ? WHERE id = ?").run(now(), req.params.id);

    log(`Concept goedgekeurd: ${concept.title}`, 'success');
    res.json({ success: true, message: 'Concept goedgekeurd en ingepland voor publicatie' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/concepts/:id/reject
router.put('/:id/reject', (req, res) => {
  try {
    const concept = db.prepare('SELECT * FROM concepts WHERE id = ?').get(req.params.id);
    if (!concept) return res.status(404).json({ error: 'Concept niet gevonden' });

    db.prepare("UPDATE concepts SET status = 'rejected' WHERE id = ?").run(req.params.id);
    log(`Concept afgewezen: ${concept.title}`, 'info');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/concepts/bulk/approve
router.put('/bulk/approve', (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Geen IDs opgegeven' });

    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`UPDATE concepts SET status='approved', approved_at=? WHERE id IN (${placeholders})`).run(now(), ...ids);
    log(`Bulk goedkeuring: ${ids.length} concepten`, 'success');
    res.json({ success: true, count: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/concepts/bulk/reject
router.put('/bulk/reject', (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Geen IDs opgegeven' });

    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`UPDATE concepts SET status='rejected' WHERE id IN (${placeholders})`).run(...ids);
    log(`Bulk afwijzing: ${ids.length} concepten`, 'info');
    res.json({ success: true, count: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/concepts/:id/publish
router.post('/:id/publish', async (req, res) => {
  try {
    const concept = db.prepare('SELECT * FROM concepts WHERE id = ?').get(req.params.id);
    if (!concept) return res.status(404).json({ error: 'Concept niet gevonden' });
    if (!['approved', 'ready_for_review'].includes(concept.status)) {
      return res.status(400).json({ error: 'Concept moet eerst goedgekeurd worden' });
    }

    const shop = concept.shop_id
      ? db.prepare('SELECT * FROM shops WHERE id = ?').get(concept.shop_id)
      : db.prepare('SELECT * FROM shops LIMIT 1').get();

    if (!shop) return res.status(400).json({ error: 'Geen Etsy shop gekoppeld. Voeg eerst een shop toe via de Shops pagina.' });

    log(`Publiceren gestart: ${concept.title}`, 'info');

    const result = await etsyService.publishListing(
      { ...concept, tags: JSON.parse(concept.tags || '[]') },
      shop
    );

    // Afbeeldingen uploaden (product + 3 mockups)
    const allImages = [concept.image_path, ...JSON.parse(concept.mockup_paths || '[]')].filter(Boolean);
    for (let i = 0; i < allImages.length; i++) {
      await etsyService.uploadListingImage(result.listing_id, allImages[i], shop, i + 1);
    }

    // PDF als downloadbaar product uploaden
    const pdfPublicPath = `/assets/products/${concept.id}.pdf`;
    await etsyService.uploadDigitalFile(result.listing_id, pdfPublicPath, shop);

    db.prepare(
      "UPDATE concepts SET status = 'published', published_at = ?, etsy_listing_id = ? WHERE id = ?"
    ).run(now(), result.listing_id, concept.id);

    db.prepare('UPDATE shops SET listings_count = listings_count + 1 WHERE id = ?').run(shop.id);

    log(`Gepubliceerd op Etsy: ${concept.title}`, 'success', `Listing ID: ${result.listing_id}`);
    res.json({ success: true, listing_id: result.listing_id, url: result.url });
  } catch (err) {
    log(`Publicatie mislukt: ${err.message}`, 'error');
    res.status(500).json({ error: err.message });
  }
});

// GET /api/concepts/stats/summary
router.get('/stats/summary', (req, res) => {
  try {
    const counts = db.prepare(`
      SELECT status, COUNT(*) as count FROM concepts GROUP BY status
    `).all();

    const summary = { pending: 0, ready_for_review: 0, approved: 0, published: 0, rejected: 0 };
    counts.forEach(row => { summary[row.status] = row.count; });

    const totalRevenue = db.prepare('SELECT COALESCE(SUM(revenue), 0) as total FROM concepts').get().total;
    const totalViews = db.prepare('SELECT COALESCE(SUM(views), 0) as total FROM concepts').get().total;

    res.json({ ...summary, total_revenue: totalRevenue, total_views: totalViews });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
