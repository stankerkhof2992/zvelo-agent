const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, 'zvelo.db'));

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS concepts (
    id TEXT PRIMARY KEY,
    shop_id TEXT,
    niche TEXT NOT NULL,
    title TEXT,
    description TEXT,
    tags TEXT DEFAULT '[]',
    price REAL DEFAULT 4.99,
    status TEXT DEFAULT 'pending',
    created_at TEXT,
    approved_at TEXT,
    published_at TEXT,
    etsy_listing_id TEXT,
    dalle_prompt TEXT,
    image_path TEXT,
    mockup_paths TEXT DEFAULT '[]',
    etsy_payload TEXT DEFAULT '{}',
    views INTEGER DEFAULT 0,
    revenue REAL DEFAULT 0.0,
    why_this_sells TEXT
  );

  CREATE TABLE IF NOT EXISTS shops (
    id TEXT PRIMARY KEY,
    etsy_shop_id TEXT UNIQUE,
    name TEXT NOT NULL,
    niche TEXT DEFAULT 'Minimalist Wall Art Printables',
    etsy_access_token TEXT,
    etsy_refresh_token TEXT,
    etsy_token_expires_at TEXT,
    listings_count INTEGER DEFAULT 0,
    total_revenue REAL DEFAULT 0.0,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS niche_analysis (
    id TEXT PRIMARY KEY,
    niche TEXT NOT NULL,
    score REAL,
    trend TEXT,
    competition TEXT,
    avg_price REAL,
    analyzed_at TEXT,
    recommended INTEGER DEFAULT 0,
    details TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS agent_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT,
    action TEXT NOT NULL,
    status TEXT DEFAULT 'info',
    details TEXT,
    cost_cents INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

const generateId = () => uuidv4();

const now = () => new Date().toISOString().replace('T', ' ').split('.')[0];

const log = (action, status = 'info', details = '', costCents = 0) => {
  db.prepare(
    'INSERT INTO agent_logs (id, timestamp, action, status, details, cost_cents) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(generateId(), now(), action, status, String(details || ''), Number(costCents) || 0);
};

const getSetting = (key, defaultValue = null) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
};

const setSetting = (key, value) => {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
};

module.exports = { db, generateId, now, log, getSetting, setSetting };
