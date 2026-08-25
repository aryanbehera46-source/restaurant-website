const Database = require("better-sqlite3");

const db = new Database("restaurant.db");


// ==================================================
// RESERVATIONS TABLE
// ==================================================

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

        billAmount REAL NOT NULL DEFAULT 0,

        status TEXT NOT NULL DEFAULT 'New',

        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP

    )
`);


// ==================================================
// DATABASE MIGRATION
// Make sure older reservations have required columns
// ==================================================

const reservationColumns =
    db.prepare(
        "PRAGMA table_info(reservations)"
    ).all();


// --------------------------------------------------
// STATUS
// --------------------------------------------------

if (
    !reservationColumns.some(
        column => column.name === "status"
    )
) {

    db.exec(`
        ALTER TABLE reservations
        ADD COLUMN status TEXT NOT NULL DEFAULT 'New'
    `);

}


// --------------------------------------------------
// BILL AMOUNT
// --------------------------------------------------

if (
    !reservationColumns.some(
        column => column.name === "billAmount"
    )
) {

    db.exec(`
        ALTER TABLE reservations
        ADD COLUMN billAmount REAL NOT NULL DEFAULT 0
    `);

}


// ==================================================
// MENU TABLE
// ==================================================

db.exec(`
    CREATE TABLE IF NOT EXISTS menu_items (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        name TEXT NOT NULL,

        category TEXT NOT NULL,

        description TEXT,

        price REAL NOT NULL DEFAULT 0,

        image TEXT,

        available INTEGER NOT NULL DEFAULT 1,

        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,

        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP

    )
`);


// ==================================================
// MENU INDEXES
// ==================================================

db.exec(`
    CREATE INDEX IF NOT EXISTS
    idx_menu_category
    ON menu_items(category)
`);

db.exec(`
    CREATE INDEX IF NOT EXISTS
    idx_menu_available
    ON menu_items(available)
`);


// ==================================================
// DATABASE READY
// ==================================================

console.log("Database ready!");

console.log("Tables available:");

console.log("✓ reservations");

console.log("✓ menu_items");


// ==================================================
// EXPORT DATABASE
// ==================================================

module.exports = db;