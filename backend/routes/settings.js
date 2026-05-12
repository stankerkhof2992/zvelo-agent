const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getSetting, setSetting } = require('../database');

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
router.get('/', (req, res) => {
  try {
    const env = readEnvFile();
    const maskKey = (val) => val ? (val.substring(0, 6) + '••••••••' + val.substring(val.length - 4)) : '';

    res.json({
      keys: {
        ANTHROPIC_API_KEY: { configured: !!env.ANTHROPIC_API_KEY, masked: maskKey(env.ANTHROPIC_API_KEY) },
        OPENAI_API_KEY: { configured: !!env.OPENAI_API_KEY, masked: maskKey(env.OPENAI_API_KEY) },
        SMARTMOCKUPS_API_KEY: { configured: !!env.SMARTMOCKUPS_API_KEY, masked: maskKey(env.SMARTMOCKUPS_API_KEY) },
        ETSY_CLIENT_ID: { configured: !!env.ETSY_CLIENT_ID, masked: maskKey(env.ETSY_CLIENT_ID) },
        ETSY_CLIENT_SECRET: { configured: !!env.ETSY_CLIENT_SECRET, masked: maskKey(env.ETSY_CLIENT_SECRET) }
      },
      preferences: {
        AGENT_CRON_SCHEDULE: env.AGENT_CRON_SCHEDULE || '0 8 * * *',
        AGENT_CONCEPTS_PER_DAY: env.AGENT_CONCEPTS_PER_DAY || '3',
        DEFAULT_NICHE: env.DEFAULT_NICHE || 'Minimalist Wall Art Printables',
        EMAIL_ENABLED: env.EMAIL_ENABLED || 'false',
        EMAIL_TO: env.EMAIL_TO || '',
        BACKEND_URL: env.BACKEND_URL || 'http://localhost:3001'
      },
      simulation_mode: {
        claude: !process.env.ANTHROPIC_API_KEY,
        dalle: !process.env.OPENAI_API_KEY,
        mockups: !process.env.SMARTMOCKUPS_API_KEY,
        etsy: !process.env.ETSY_CLIENT_ID
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
router.get('/export', (req, res) => {
  try {
    const { db } = require('../database');
    const concepts = db.prepare('SELECT * FROM concepts').all();
    const shops = db.prepare('SELECT id, name, niche, listings_count, total_revenue, created_at FROM shops').all();
    const niches = db.prepare('SELECT * FROM niche_analysis ORDER BY analyzed_at DESC').all();

    res.setHeader('Content-Disposition', 'attachment; filename="zvelo-export.json"');
    res.setHeader('Content-Type', 'application/json');
    res.json({ exported_at: new Date().toISOString(), concepts, shops, niches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
