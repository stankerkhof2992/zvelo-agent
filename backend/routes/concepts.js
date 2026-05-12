const express = require('express');
const router = express.Router();
const { query, queryOne, run, generateId, now, log } = require('../database');
const etsyService = require('../services/etsyService');

// GET /api/concepts
router.get('/', async (req, res) => {
  try {
    const { status, shop_id, niche } = req.query;
    let sql = 'SELECT * FROM concepts WHERE 1=1';
    const params = [];
    let n = 0;

    if (status && status !== 'all') {
      const statuses = status.split(',').map(s => s.trim());
      sql += ` AND status IN (${statuses.map(() => `$${++n}`).join(',')})`;
      params.push(...statuses);
    }
    if (shop_id) { sql += ` AND shop_id = $${++n}`; params.push(shop_id); }
    if (niche) { sql += ` AND niche = $${++n}`; params.push(niche); }
    sql += ' ORDER BY created_at DESC';

    const concepts = await query(sql, params);
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

// GET /api/concepts/stats/summary
router.get('/stats/summary', async (req, res) => {
  try {
    const counts = await query('SELECT status, COUNT(*) as count FROM concepts GROUP BY status');
    const summary = { pending: 0, ready_for_review: 0, approved: 0, published: 0, rejected: 0 };
    counts.forEach(row => { summary[row.status] = Number(row.count); });

    const revenueRow = await queryOne('SELECT COALESCE(SUM(revenue), 0) as total FROM concepts');
    const viewsRow = await queryOne('SELECT COALESCE(SUM(views), 0) as total FROM concepts');

    res.json({
      ...summary,
      total_revenue: Number(revenueRow.total),
      total_views: Number(viewsRow.total)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/concepts/:id
router.get('/:id', async (req, res) => {
  try {
    const concept = await queryOne('SELECT * FROM concepts WHERE id = $1', [req.params.id]);
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
router.put('/:id', async (req, res) => {
  try {
    const { title, description, tags, price, niche, why_this_sells } = req.body;
    const concept = await queryOne('SELECT * FROM concepts WHERE id = $1', [req.params.id]);
    if (!concept) return res.status(404).json({ error: 'Concept niet gevonden' });

    await run(`
      UPDATE concepts SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        tags = COALESCE($3, tags),
        price = COALESCE($4, price),
        niche = COALESCE($5, niche),
        why_this_sells = COALESCE($6, why_this_sells)
      WHERE id = $7
    `, [
      title || null,
      description || null,
      tags ? JSON.stringify(tags) : null,
      price || null,
      niche || null,
      why_this_sells || null,
      req.params.id
    ]);

    log(`Concept bewerkt: ${title || concept.title}`, 'info');
    const updated = await queryOne('SELECT * FROM concepts WHERE id = $1', [req.params.id]);
    res.json({
      ...updated,
      tags: JSON.parse(updated.tags || '[]'),
      mockup_paths: JSON.parse(updated.mockup_paths || '[]')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/concepts/bulk/approve
router.put('/bulk/approve', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Geen IDs opgegeven' });

    const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
    await run(
      `UPDATE concepts SET status='approved', approved_at=$1 WHERE id IN (${placeholders})`,
      [now(), ...ids]
    );
    log(`Bulk goedkeuring: ${ids.length} concepten`, 'success');
    res.json({ success: true, count: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/concepts/bulk/reject
router.put('/bulk/reject', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Geen IDs opgegeven' });

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    await run(
      `UPDATE concepts SET status='rejected' WHERE id IN (${placeholders})`,
      [...ids]
    );
    log(`Bulk afwijzing: ${ids.length} concepten`, 'info');
    res.json({ success: true, count: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/concepts/:id/approve
router.put('/:id/approve', async (req, res) => {
  try {
    const concept = await queryOne('SELECT * FROM concepts WHERE id = $1', [req.params.id]);
    if (!concept) return res.status(404).json({ error: 'Concept niet gevonden' });

    await run("UPDATE concepts SET status = 'approved', approved_at = $1 WHERE id = $2", [now(), req.params.id]);
    log(`Concept goedgekeurd: ${concept.title}`, 'success');
    res.json({ success: true, message: 'Concept goedgekeurd en ingepland voor publicatie' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/concepts/:id/reject
router.put('/:id/reject', async (req, res) => {
  try {
    const concept = await queryOne('SELECT * FROM concepts WHERE id = $1', [req.params.id]);
    if (!concept) return res.status(404).json({ error: 'Concept niet gevonden' });

    await run("UPDATE concepts SET status = 'rejected' WHERE id = $1", [req.params.id]);
    log(`Concept afgewezen: ${concept.title}`, 'info');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/concepts/:id/publish
router.post('/:id/publish', async (req, res) => {
  try {
    const concept = await queryOne('SELECT * FROM concepts WHERE id = $1', [req.params.id]);
    if (!concept) return res.status(404).json({ error: 'Concept niet gevonden' });
    if (!['approved', 'ready_for_review'].includes(concept.status)) {
      return res.status(400).json({ error: 'Concept moet eerst goedgekeurd worden' });
    }

    const shop = concept.shop_id
      ? await queryOne('SELECT * FROM shops WHERE id = $1', [concept.shop_id])
      : await queryOne('SELECT * FROM shops LIMIT 1');

    if (!shop) return res.status(400).json({ error: 'Geen Etsy shop gekoppeld. Voeg eerst een shop toe via de Shops pagina.' });

    log(`Publiceren gestart: ${concept.title}`, 'info');

    const result = await etsyService.publishListing(
      { ...concept, tags: JSON.parse(concept.tags || '[]') },
      shop
    );

    const allImages = [concept.image_path, ...JSON.parse(concept.mockup_paths || '[]')].filter(Boolean);
    for (let i = 0; i < allImages.length; i++) {
      await etsyService.uploadListingImage(result.listing_id, allImages[i], shop, i + 1);
    }

    const pdfPublicPath = `/assets/products/${concept.id}.pdf`;
    await etsyService.uploadDigitalFile(result.listing_id, pdfPublicPath, shop);

    await run(
      "UPDATE concepts SET status = 'published', published_at = $1, etsy_listing_id = $2 WHERE id = $3",
      [now(), result.listing_id, concept.id]
    );
    await run('UPDATE shops SET listings_count = listings_count + 1 WHERE id = $1', [shop.id]);

    log(`Gepubliceerd op Etsy: ${concept.title}`, 'success', `Listing ID: ${result.listing_id}`);
    res.json({ success: true, listing_id: result.listing_id, url: result.url });
  } catch (err) {
    log(`Publicatie mislukt: ${err.message}`, 'error');
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
