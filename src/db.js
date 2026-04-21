const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { appConfig } = require("./config");

const dbDir = path.dirname(appConfig.sqlitePath);
fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(appConfig.sqlitePath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const findUserByEmailStmt = db.prepare(
  "SELECT id, email, password_hash FROM users WHERE email = ?"
);
const createUserStmt = db.prepare(
  "INSERT INTO users (email, password_hash) VALUES (?, ?)"
);
const listUsersStmt = db.prepare(
  "SELECT id, email, created_at FROM users ORDER BY created_at DESC"
);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function findUserByEmail(email) {
  return findUserByEmailStmt.get(normalizeEmail(email));
}

function createUser(email, passwordHash) {
  const result = createUserStmt.run(normalizeEmail(email), passwordHash);
  return result.lastInsertRowid;
}

function listUsers() {
  return listUsersStmt.all();
}

module.exports = {
  db,
  findUserByEmail,
  createUser,
  listUsers,
  normalizeEmail,
};

