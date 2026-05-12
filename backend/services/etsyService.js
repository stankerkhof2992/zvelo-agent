require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { db } = require('../database');

const ETSY_API = 'https://openapi.etsy.com/v3';
const isSimulation = !process.env.ETSY_CLIENT_ID;

async function getValidToken(shop) {
  if (isSimulation) return 'sim_token';

  const now = new Date();
  const expiresAt = shop.etsy_token_expires_at ? new Date(shop.etsy_token_expires_at) : new Date(0);

  if (expiresAt > new Date(now.getTime() + 60000)) {
    return shop.etsy_access_token;
  }

  console.log(`[Etsy] Token verlopen voor shop ${shop.name}, vernieuwen...`);

  const response = await axios.post('https://api.etsy.com/v3/public/oauth/token', {
    grant_type: 'refresh_token',
    client_id: process.env.ETSY_CLIENT_ID,
    refresh_token: shop.etsy_refresh_token
  });

  const { access_token, refresh_token, expires_in } = response.data;
  const newExpiry = new Date(Date.now() + expires_in * 1000).toISOString();

  db.prepare(`
    UPDATE shops SET etsy_access_token=?, etsy_refresh_token=?, etsy_token_expires_at=? WHERE id=?
  `).run(access_token, refresh_token, newExpiry, shop.id);

  return access_token;
}

async function publishListing(concept, shop) {
  if (isSimulation) {
    console.log('[Etsy] Simulatiemodus: listing publiceren gesimuleerd');
    await new Promise(r => setTimeout(r, 500));
    return {
      listing_id: `SIM_${Date.now()}`,
      url: `https://www.etsy.com/listing/sim_${Date.now()}/zvelo-product`,
      status: 'active'
    };
  }

  const token = await getValidToken(shop);

  const tags = JSON.parse(concept.tags || '[]');
  const payload = {
    quantity: 999,
    title: concept.title,
    description: concept.description,
    price: concept.price,
    who_made: 'i_did',
    when_made: 'made_to_order',
    taxonomy_id: 2078,
    type: 'download',
    tags: tags,
    is_digital: true,
    should_auto_renew: true,
    state: 'active',
    shipping_profile_id: null
  };

  const response = await axios.post(
    `${ETSY_API}/application/shops/${shop.etsy_shop_id}/listings`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-api-key': process.env.ETSY_CLIENT_ID,
        'Content-Type': 'application/json'
      }
    }
  );

  const listing = response.data;
  return {
    listing_id: String(listing.listing_id),
    url: listing.url,
    status: listing.state
  };
}

async function uploadListingImage(listingId, imagePath, shop, rank = 1) {
  if (isSimulation) return true;

  const token = await getValidToken(shop);
  const absolutePath = path.join(__dirname, '..', '..', imagePath.replace(/^\//, ''));

  if (!fs.existsSync(absolutePath)) {
    console.error(`[Etsy] Afbeelding niet gevonden: ${absolutePath}`);
    return false;
  }

  const form = new FormData();
  form.append('image', fs.createReadStream(absolutePath));
  form.append('rank', rank);

  await axios.post(
    `${ETSY_API}/application/shops/${shop.etsy_shop_id}/listings/${listingId}/images`,
    form,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-api-key': process.env.ETSY_CLIENT_ID,
        ...form.getHeaders()
      }
    }
  );

  return true;
}

async function getShopListings(shop) {
  if (isSimulation) {
    return [
      { listing_id: 'SIM001', title: 'Botanical Print Set', price: { amount: 449, divisor: 100 }, state: 'active', url: '#', views: 142, num_favorers: 23 },
      { listing_id: 'SIM002', title: 'Daily Planner Insert', price: { amount: 299, divisor: 100 }, state: 'active', url: '#', views: 89, num_favorers: 11 },
      { listing_id: 'SIM003', title: 'Quote Print Boho', price: { amount: 349, divisor: 100 }, state: 'active', url: '#', views: 67, num_favorers: 8 }
    ];
  }

  const token = await getValidToken(shop);
  const response = await axios.get(
    `${ETSY_API}/application/shops/${shop.etsy_shop_id}/listings/active?limit=25`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-api-key': process.env.ETSY_CLIENT_ID
      }
    }
  );

  return response.data.results || [];
}

async function getListingStats(listingId, shop) {
  if (isSimulation) {
    return { views: Math.floor(Math.random() * 200), revenue: parseFloat((Math.random() * 50).toFixed(2)) };
  }

  try {
    const token = await getValidToken(shop);
    const response = await axios.get(
      `${ETSY_API}/application/listings/${listingId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-api-key': process.env.ETSY_CLIENT_ID
        }
      }
    );
    const listing = response.data;
    return { views: listing.views || 0, revenue: 0 };
  } catch {
    return { views: 0, revenue: 0 };
  }
}

async function ensureShopSection(shop, sectionTitle) {
  if (isSimulation) return 'SIM_SECTION_001';

  try {
    const token = await getValidToken(shop);

    const sectionsRes = await axios.get(
      `${ETSY_API}/application/shops/${shop.etsy_shop_id}/sections`,
      { headers: { Authorization: `Bearer ${token}`, 'x-api-key': process.env.ETSY_CLIENT_ID } }
    );

    const existing = (sectionsRes.data.results || []).find(s =>
      s.title.toLowerCase() === sectionTitle.toLowerCase()
    );
    if (existing) return existing.shop_section_id;

    const createRes = await axios.post(
      `${ETSY_API}/application/shops/${shop.etsy_shop_id}/sections`,
      { title: sectionTitle },
      { headers: { Authorization: `Bearer ${token}`, 'x-api-key': process.env.ETSY_CLIENT_ID, 'Content-Type': 'application/json' } }
    );

    return createRes.data.shop_section_id;
  } catch (err) {
    console.error('[Etsy] Sectie aanmaken mislukt:', err.message);
    return null;
  }
}

// Upload PDF als digitaal downloadbestand bij de listing
async function uploadDigitalFile(listingId, pdfPath, shop) {
  if (isSimulation) {
    console.log(`[Etsy] Simulatiemodus: PDF upload gesimuleerd (${pdfPath})`);
    return true;
  }

  if (!pdfPath) return false;

  const absolutePath = path.isAbsolute(pdfPath)
    ? pdfPath
    : path.join(__dirname, '..', '..', pdfPath.replace(/^\//, '').split('/').join(path.sep));

  if (!fs.existsSync(absolutePath)) {
    console.warn(`[Etsy] PDF niet gevonden: ${absolutePath}`);
    return false;
  }

  try {
    const token = await getValidToken(shop);
    const form = new FormData();
    form.append('file', fs.createReadStream(absolutePath));
    form.append('name', path.basename(absolutePath));
    form.append('rank', 1);

    await axios.post(
      `${ETSY_API}/application/shops/${shop.etsy_shop_id}/listings/${listingId}/files`,
      form,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-api-key': process.env.ETSY_CLIENT_ID,
          ...form.getHeaders()
        }
      }
    );

    console.log(`[Etsy] ✅ PDF upload gelukt voor listing ${listingId}`);
    return true;
  } catch (err) {
    console.error('[Etsy] PDF upload mislukt:', err.response?.data || err.message);
    return false;
  }
}

module.exports = {
  publishListing, uploadListingImage, uploadDigitalFile,
  getShopListings, getListingStats, ensureShopSection, isSimulation
};
