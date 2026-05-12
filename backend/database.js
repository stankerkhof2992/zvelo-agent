const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDb() {
  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT,
      action TEXT NOT NULL,
      status TEXT DEFAULT 'info',
      details TEXT,
      cost_cents INTEGER DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
}

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function queryOne(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
}

async function run(sql, params = []) {
  await pool.query(sql, params);
}

const generateId = () => uuidv4();

const now = () => new Date().toISOString().replace('T', ' ').split('.')[0];

const log = (action, status = 'info', details = '', costCents = 0) => {
  pool.query(
    'INSERT INTO agent_logs (id, timestamp, action, status, details, cost_cents) VALUES ($1, $2, $3, $4, $5, $6)',
    [generateId(), now(), action, status, String(details || ''), Number(costCents) || 0]
  ).catch(err => console.error('[DB] Log fout:', err.message));
};

const getSetting = async (key, defaultValue = null) => {
  const result = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
  return result.rows[0] ? result.rows[0].value : defaultValue;
};

const setSetting = async (key, value) => {
  await pool.query(
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
    [key, String(value)]
  );
};

module.exports = { pool, query, queryOne, run, initDb, generateId, now, log, getSetting, setSetting };
