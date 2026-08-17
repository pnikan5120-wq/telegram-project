const Database = require("better-sqlite3");

const db = new Database("nebze-bazar.sqlite");

db.pragma("journal_mode=WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS quotes(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  ts TEXT NOT NULL,
  source TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quotes_asset_ts
ON quotes(asset, ts);

CREATE TABLE IF NOT EXISTS alerts(
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  target REAL NOT NULL,
  direction TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_sent_at TEXT
);
`);

const insert = db.prepare(`
  INSERT INTO quotes(asset, value, unit, ts, source)
  VALUES(?,?,?,?,?)
`);

function saveQuote(asset, q) {
  insert.run(
    asset,
    q.value,
    q.unit,
    q.timestamp,
    q.source
  );
}

function lastQuote(asset) {
  return db
    .prepare(`
      SELECT *
      FROM quotes
      WHERE asset = ?
      ORDER BY ts DESC
      LIMIT 1
    `)
    .get(asset);
}

function history(asset, limit = 200) {
  return db
    .prepare(`
      SELECT *
      FROM quotes
      WHERE asset = ?
      ORDER BY ts DESC
      LIMIT ?
    `)
    .all(asset, limit);
}

function addAlert(a) {
  db.prepare(`
    INSERT INTO alerts(
      id,
      user_id,
      asset,
      target,
      direction,
      created_at
    )
    VALUES(?,?,?,?,?,?)
  `).run(
    a.id,
    a.userId,
    a.asset,
    a.target,
    a.direction,
    a.createdAt
  );
}

function getActiveAlerts() {
  return db
    .prepare(`
      SELECT *
      FROM alerts
      WHERE active = 1
    `)
    .all();
}

module.exports = {
  saveQuote,
  lastQuote,
  history,
  addAlert,
  getActiveAlerts
};
