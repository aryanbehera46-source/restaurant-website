const Database = require("better-sqlite3");

const db = new Database("restaurant.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    guests INTEGER NOT NULL,
    phone TEXT NOT NULL,
    specialRequest TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
// ADD STATUS COLUMN IF IT DOES NOT EXIST
const columns = db.prepare("PRAGMA table_info(reservations)").all();

if (!columns.some(column => column.name === "status")) {
    db.exec(`
        ALTER TABLE reservations
        ADD COLUMN status TEXT NOT NULL DEFAULT 'New'
    `);
}
console.log("Database ready!");

module.exports = db;