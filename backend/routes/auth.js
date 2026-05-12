const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const { queryOne, run, generateId, now, log } = require('../database');

const pendingStates = new Map();

function base64urlEncode(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Leidt de frontend-URL af uit het request zodat links werken op zowel localhost als Render
function getFrontendBase(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  return `${proto}://${host}`;
}

// GET /auth/etsy?shop_name=Zvelo
router.get('/etsy', (req, res) => {
  if (!process.env.ETSY_CLIENT_ID) {
    const base = getFrontendBase(req);
    return res.status(400).send(`
      <html><body style="font-family:Arial;padding:40px;text-align:center;">
        <h2>⚠️ ETSY_CLIENT_ID niet ingesteld</h2>
        <p>Voeg <strong>ETSY_CLIENT_ID</strong> toe als Environment Variable in het Render Dashboard en herstart de service.</p>
        <p style="margin-top:24px;"><a href="${base}/settings" style="background:#f97316;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;">← Naar instellingen</a></p>
      </body></html>
    `);
  }

  const shopName = req.query.shop_name || 'Mijn Shop';

  const codeVerifier = base64urlEncode(crypto.randomBytes(64));
  const codeChallenge = base64urlEncode(
    crypto.createHash('sha256').update(codeVerifier).digest()
  );
  const state = base64urlEncode(crypto.randomBytes(16));

  pendingStates.set(state, { codeVerifier, shopName, createdAt: Date.now() });

  for (const [key, val] of pendingStates.entries()) {
    if (Date.now() - val.createdAt > 600000) pendingStates.delete(key);
  }

  const redirectUri = process.env.ETSY_REDIRECT_URI || `${getFrontendBase(req).replace(/:\d+$/, ':3001')}/auth/etsy/callback`;

  const scopes = 'listings_r listings_w listings_d shops_r';
  const params = new URLSearchParams({
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes,
    client_id: process.env.ETSY_CLIENT_ID,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });

  res.redirect(`https://www.etsy.com/oauth/connect?${params.toString()}`);
});

// GET /auth/etsy/callback
router.get('/etsy/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const base = getFrontendBase(req);

  if (error) {
    return res.send(`
      <html><body style="font-family:Arial;padding:40px;text-align:center;">
        <h2>❌ Etsy autorisatie geweigerd</h2>
        <p>Fout: ${error}</p>
        <p style="margin-top:24px;"><a href="${base}/shops" style="background:#f97316;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;">← Terug naar shops</a></p>
      </body></html>
    `);
  }

  const pending = pendingStates.get(state);
  if (!pending) {
    return res.status(400).send(`
      <html><body style="font-family:Arial;padding:40px;text-align:center;">
        <h2>❌ Ongeldige of verlopen state</h2>
        <p>Probeer opnieuw via het dashboard.</p>
        <p style="margin-top:24px;"><a href="${base}/shops" style="background:#f97316;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;">← Terug naar shops</a></p>
      </body></html>
    `);
  }

  pendingStates.delete(state);

  const redirectUri = process.env.ETSY_REDIRECT_URI || `${base.replace(/:\d+$/, ':3001')}/auth/etsy/callback`;

  try {
    const tokenResponse = await axios.post(
      'https://api.etsy.com/v3/public/oauth/token',
      {
        grant_type: 'authorization_code',
        client_id: process.env.ETSY_CLIENT_ID,
        redirect_uri: redirectUri,
        code,
        code_verifier: pending.codeVerifier
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    const shopResponse = await axios.get('https://openapi.etsy.com/v3/application/users/me/shops', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'x-api-key': process.env.ETSY_CLIENT_ID
      }
    });

    const etsyShop = shopResponse.data;
    const etsyShopId = String(etsyShop.shop_id);
    const etsyShopName = etsyShop.shop_name || pending.shopName;

    const existingShop = await queryOne('SELECT * FROM shops WHERE etsy_shop_id = $1', [etsyShopId]);

    if (existingShop) {
      await run(`
        UPDATE shops SET
          name = $1,
          etsy_access_token = $2,
          etsy_refresh_token = $3,
          etsy_token_expires_at = $4
        WHERE etsy_shop_id = $5
      `, [etsyShopName, access_token, refresh_token, expiresAt, etsyShopId]);
    } else {
      await run(
        'INSERT INTO shops (id, etsy_shop_id, name, etsy_access_token, etsy_refresh_token, etsy_token_expires_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [generateId(), etsyShopId, etsyShopName, access_token, refresh_token, expiresAt, now()]
      );
    }

    log(`Etsy OAuth voltooid voor shop: ${etsyShopName}`, 'success');

    res.send(`
      <html><body style="font-family:Arial;padding:40px;text-align:center;background:#f9f9f9;">
        <div style="background:white;max-width:500px;margin:0 auto;padding:40px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
          <div style="font-size:48px;margin-bottom:16px;">✅</div>
          <h2 style="color:#18181b;">Shop gekoppeld!</h2>
          <p style="color:#666;"><strong>${etsyShopName}</strong> is succesvol gekoppeld aan Zvelo.</p>
          <p style="margin-top:24px;">
            <a href="${base}/shops" style="background:#f97316;color:white;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:600;">
              Naar dashboard →
            </a>
          </p>
        </div>
      </body></html>
    `);
  } catch (err) {
    log(`Etsy OAuth fout: ${err.message}`, 'error');
    res.status(500).send(`
      <html><body style="font-family:Arial;padding:40px;text-align:center;">
        <h2>❌ Koppeling mislukt</h2>
        <p>${err.response?.data?.error_description || err.message}</p>
        <p style="margin-top:24px;"><a href="${base}/shops" style="background:#f97316;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;">← Terug naar shops</a></p>
      </body></html>
    `);
  }
});

module.exports = router;
