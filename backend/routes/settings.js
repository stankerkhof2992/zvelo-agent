const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '.env');

function readEnvFile() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const content = fs.readFileSync(ENV_PATH, 'utf8');
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    result[key] = value;
  }
  return result;
}

function writeEnvFile(vars) {
  const examplePath = path.join(__dirname, '..', '.env.example');
  let template = fs.existsSync(examplePath) ? fs.readFileSync(examplePath, 'utf8') : '';

  let content = template;
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`^(${key}=).*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `$1${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(ENV_PATH, content, 'utf8');
}

// GET /api/settings — Geef instellingen terug (keys gemaskeerd)
// Combineert .env bestand (lokaal) met process.env (Render / omgevingsvariabelen)
router.get('/', (req, res) => {
  try {
    const fileEnv = readEnvFile();
    // process.env heeft voorrang (Render-variabelen overschrijven .env)
    const get = (key) => process.env[key] || fileEnv[key] || '';
    const maskKey = (val) => val ? (val.substring(0, 6) + '••••••••' + val.substring(val.length - 4)) : '';

    res.json({
      keys: {
        ANTHROPIC_API_KEY: { configured: !!get('ANTHROPIC_API_KEY'), masked: maskKey(get('ANTHROPIC_API_KEY')) },
        OPENAI_API_KEY: { configured: !!get('OPENAI_API_KEY'), masked: maskKey(get('OPENAI_API_KEY')) },
        SMARTMOCKUPS_API_KEY: { configured: !!get('SMARTMOCKUPS_API_KEY'), masked: maskKey(get('SMARTMOCKUPS_API_KEY')) },
        ETSY_CLIENT_ID: { configured: !!get('ETSY_CLIENT_ID'), masked: maskKey(get('ETSY_CLIENT_ID')) },
        ETSY_CLIENT_SECRET: { configured: !!get('ETSY_CLIENT_SECRET'), masked: maskKey(get('ETSY_CLIENT_SECRET')) }
      },
      preferences: {
        AGENT_CRON_SCHEDULE: get('AGENT_CRON_SCHEDULE') || '0 8 * * *',
        AGENT_CONCEPTS_PER_DAY: get('AGENT_CONCEPTS_PER_DAY') || '3',
        DEFAULT_NICHE: get('DEFAULT_NICHE') || 'Minimalist Wall Art Printables',
        EMAIL_ENABLED: get('EMAIL_ENABLED') || 'false',
        EMAIL_TO: get('EMAIL_TO') || '',
        BACKEND_URL: get('BACKEND_URL') || 'http://localhost:3001'
      },
      simulation_mode: {
        claude: !get('ANTHROPIC_API_KEY'),
        dalle: !get('OPENAI_API_KEY'),
        mockups: !get('SMARTMOCKUPS_API_KEY'),
        etsy: !get('ETSY_CLIENT_ID')
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings — API keys en voorkeuren opslaan in .env
router.put('/', (req, res) => {
  try {
    const allowed = [
      'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'SMARTMOCKUPS_API_KEY',
      'ETSY_CLIENT_ID', 'ETSY_CLIENT_SECRET',
      'AGENT_CRON_SCHEDULE', 'AGENT_CONCEPTS_PER_DAY', 'DEFAULT_NICHE',
      'EMAIL_ENABLED', 'EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_TO',
      'BACKEND_URL'
    ];

    const toSave = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined && req.body[key] !== '') {
        toSave[key] = req.body[key];
        // Meteen toepassen op de lopende process.env
        process.env[key] = req.body[key];
      }
    }

    if (Object.keys(toSave).length > 0) {
      writeEnvFile(toSave);
    }

    res.json({ success: true, message: 'Instellingen opgeslagen. Herstart de server voor API key wijzigingen.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/export — Exporteer alle data als JSON
router.get('/export', async (req, res) => {
  try {
    const { query } = require('../database');
    const concepts = await query('SELECT * FROM concepts');
    const shops = await query('SELECT id, name, niche, listings_count, total_revenue, created_at FROM shops');
    const niches = await query('SELECT * FROM niche_analysis ORDER BY analyzed_at DESC');

    res.setHeader('Content-Disposition', 'attachment; filename="zvelo-export.json"');
    res.setHeader('Content-Type', 'application/json');
    res.json({ exported_at: new Date().toISOString(), concepts, shops, niches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
