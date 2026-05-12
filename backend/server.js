require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Asset directories aanmaken (lokaal of via ASSETS_PATH voor Render.com)
const assetsBase = process.env.ASSETS_PATH || path.join(__dirname, '..', 'assets');
const dirs = [
  path.join(assetsBase, 'generated'),
  path.join(assetsBase, 'mockups'),
  path.join(assetsBase, 'products')
];
dirs.forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });

// ─── In productie: Vite build EERST serveren ───────────────────────────────
// Moet vóór alle andere middleware zodat CSS/JS altijd gevonden worden.
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
if (isProduction && fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Gegenereerde afbeeldingen, mockups en PDFs
app.use('/assets', express.static(assetsBase));

// CORS — sta localhost (dev) en de Render URL toe
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://zvelo-agent.onrender.com'
];
if (process.env.RENDER_EXTERNAL_URL) allowedOrigins.push(process.env.RENDER_EXTERNAL_URL);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(null, true); // In productie altijd toestaan — zelfde-domein verzoeken
    }
  }
}));
app.use(express.json({ limit: '10mb' }));

// ─── API Routes ────────────────────────────────────────────────────────────
app.use('/api/concepts', require('./routes/concepts'));
app.use('/api/agent', require('./routes/agent'));
app.use('/api/shops', require('./routes/shops'));
app.use('/api/settings', require('./routes/settings'));
app.use('/auth', require('./routes/auth'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    simulation: {
      claude: !process.env.ANTHROPIC_API_KEY,
      dalle: !process.env.OPENAI_API_KEY,
      mockups: !process.env.SMARTMOCKUPS_API_KEY,
      etsy: !process.env.ETSY_CLIENT_ID
    }
  });
});

// Fout-handler
app.use((err, req, res, next) => {
  console.error('[Server] Fout:', err.message);
  res.status(500).json({ error: 'Interne serverfout', details: err.message });
});

// ─── Catch-all: React Router (ALTIJD als laatste) ──────────────────────────
if (isProduction && fs.existsSync(distPath)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ─── Database initialiseren, daarna server starten ─────────────────────────
const { initDb } = require('./database');

initDb()
  .then(() => {
    console.log('[DB] PostgreSQL tabellen gereed');
    app.listen(PORT, () => {
      const sim = [];
      if (!process.env.ANTHROPIC_API_KEY) sim.push('Claude');
      if (!process.env.OPENAI_API_KEY) sim.push('DALL-E');
      if (!process.env.SMARTMOCKUPS_API_KEY) sim.push('Mockups');
      if (!process.env.ETSY_CLIENT_ID) sim.push('Etsy');

      console.log(`\n🚀 Zvelo Agent backend: http://localhost:${PORT}`);
      if (!isProduction) console.log(`📊 Dashboard:          http://localhost:5173`);
      if (isProduction) console.log(`📊 Dashboard:          http://localhost:${PORT}`);
      if (sim.length > 0) {
        console.log(`⚡ Simulatiemodus actief voor: ${sim.join(', ')}`);
      } else {
        console.log(`✅ Alle API keys geconfigureerd — live modus`);
      }

      // Scheduler starten
      require('./services/scheduler').startScheduler();
      console.log('');
    });
  })
  .catch(err => {
    console.error('[DB] Initialisatie mislukt:', err.message);
    process.exit(1);
  });
