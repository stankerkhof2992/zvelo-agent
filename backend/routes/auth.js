const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const { queryOne, run, generateId, now, log } = require('../database');

function base64urlEncode(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function getFrontendBase(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  return `${proto}://${host}`;
}

// De signing-secret: geprefereerd SESSION_SECRET, anders ETSY_CLIENT_SECRET of CLIENT_ID als fallback
function getStateSecret() {
  return process.env.SESSION_SECRET ||
    process.env.ETSY_CLIENT_SECRET ||
    process.env.ETSY_CLIENT_ID ||
    'zvelo-dev-secret';
}

// Codeer alle OAuth-data in de state zelf (HMAC-gesigneerd) — geen database of geheugen nodig
function createSignedState(codeVerifier, shopName) {
  const secret = getStateSecret();
  const exp = Date.now() + 600000; // geldig 10 minuten
  const nonce = crypto.randomBytes(8).toString('hex');
  const payload = Buffer.from(JSON.stringify({ codeVerifier, shopName, nonce, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

// Verifieert de handtekening en geeft de data terug, of null bij ongeldig/verlopen
function verifySignedState(state) {
  try {
    const secret = getStateSecret();
    const dotIdx = state.lastIndexOf('.');
    if (dotIdx === -1) return null;
    const payload = state.slice(0, dotIdx);
    const sig = state.slice(dotIdx + 1);
    const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    const sigBuf = Buffer.from(sig, 'ascii');
    const expBuf = Buffer.from(expectedSig, 'ascii');
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
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
  const state = createSignedState(codeVerifier, shopName);

  const redirectUri = process.env.ETSY_REDIRECT_URI || 'https://zvelo-agent.onrender.com/auth/etsy/callback';

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

  console.log(`[OAuth] Start voor shop="${shopName}", redirectUri=${redirectUri}`);
  res.redirect(`https://www.etsy.com/oauth/connect?${params.toString()}`);
});

// GET /auth/etsy/callback
router.get('/etsy/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const base = getFrontendBase(req);

  console.log(`[OAuth] Callback: code=${code ? 'ja' : 'nee'}, state=${state ? 'ja' : 'nee'}, error=${error || 'geen'}`);

  if (error) {
    return res.send(`
      <html><body style="font-family:Arial;padding:40px;text-align:center;">
        <h2>❌ Etsy autorisatie geweigerd</h2>
        <p>Fout: ${error}</p>
        <p style="margin-top:24px;"><a href="${base}/shops" style="background:#f97316;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;">← Terug naar shops</a></p>
      </body></html>
    `);
  }

  if (!state) {
    return res.status(400).send(`
      <html><body style="font-family:Arial;padding:40px;text-align:center;">
        <h2>❌ State parameter ontbreekt</h2>
        <p>Etsy heeft geen state teruggestuurd. Probeer de koppeling opnieuw.</p>
        <p style="margin-top:24px;"><a href="${base}/shops" style="background:#f97316;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;">← Terug naar shops</a></p>
      </body></html>
    `);
  }

  const pending = verifySignedState(state);
  if (!pending) {
    console.warn('[OAuth] State verificatie mislukt — ongeldig of verlopen');
    return res.status(400).send(`
      <html><body style="font-family:Arial;padding:40px;text-align:center;">
        <h2>❌ Ongeldige of verlopen state</h2>
        <p>De koppeling is verlopen (max. 10 minuten) of de state is ongeldig.<br>Probeer opnieuw via het dashboard.</p>
        <p style="margin-top:24px;"><a href="${base}/shops" style="background:#f97316;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;">← Terug naar shops</a></p>
      </body></html>
    `);
  }

  const redirectUri = process.env.ETSY_REDIRECT_URI || 'https://zvelo-agent.onrender.com/auth/etsy/callback';

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
    console.log(`[OAuth] Succesvol: ${etsyShopName} (ID: ${etsyShopId})`);

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
    const detail = err.response?.data?.error_description || err.response?.data?.error || err.message;
    console.error(`[OAuth] Token exchange mislukt:`, err.response?.data || err.message);
    log(`Etsy OAuth fout: ${detail}`, 'error');
    res.status(500).send(`
      <html><body style="font-family:Arial;padding:40px;text-align:center;">
        <h2>❌ Koppeling mislukt</h2>
        <p>${detail}</p>
        <p style="margin-top:24px;"><a href="${base}/shops" style="background:#f97316;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;">← Terug naar shops</a></p>
      </body></html>
    `);
  }
});

module.exports = router;
