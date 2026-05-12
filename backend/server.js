require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Asset directories aanmaken (lokaal of via ASSETS_PATH voor Render.com)
const assetsBase = process.env.ASSETS_PATH || path.join(__dirname, '..', 'assets');
const dirs = [
  path.join(assetsBase, 'generated'),
  path.join(assetsBase, 'mockups'),
  path.join(assetsBase, 'products')
];
dirs.forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });

const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174'];
if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '10mb' }));
app.use('/assets', express.static(assetsBase));

// Routes
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

app.use((err, req, res, next) => {
  console.error('[Server] Fout:', err.message);
  res.status(500).json({ error: 'Interne serverfout', details: err.message });
});

// Frontend serveren in productie (Render.com)
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'frontend', 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
}

app.listen(PORT, () => {
  const sim = [];
  if (!process.env.ANTHROPIC_API_KEY) sim.push('Claude');
  if (!process.env.OPENAI_API_KEY) sim.push('DALL-E');
  if (!process.env.SMARTMOCKUPS_API_KEY) sim.push('Mockups');
  if (!process.env.ETSY_CLIENT_ID) sim.push('Etsy');

  console.log(`\n🚀 Zvelo Agent backend: http://localhost:${PORT}`);
  console.log(`📊 Dashboard:          http://localhost:5173`);
  if (sim.length > 0) {
    console.log(`⚡ Simulatiemodus actief voor: ${sim.join(', ')}`);
  } else {
    console.log(`✅ Alle API keys geconfigureerd — live modus`);
  }

  // Scheduler starten
  require('./services/scheduler').startScheduler();
  console.log('');
});
