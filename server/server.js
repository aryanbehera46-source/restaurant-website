require("dotenv").config({
    path: require("path").resolve(__dirname, "../.env")
});

const express = require("express");
const Database = require("better-sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();

const PORT = Number(process.env.PORT) || 5000;

const configuredDBPath =
    String(
        process.env.DB_PATH || ""
    ).trim();

const DB_PATH =
    configuredDBPath
        ? (
            path.isAbsolute(configuredDBPath)
                ? configuredDBPath
                : path.resolve(__dirname, configuredDBPath)
        )
        : path.join(__dirname, "restaurant.db");

// ==================================================
// ADMIN SETTINGS
// ==================================================

const ADMIN_USERNAME =
    String(
        process.env.ADMIN_USERNAME || "admin"
    ).trim();

const ADMIN_PASSWORD =
    String(
        process.env.ADMIN_PASSWORD || ""
    );

const JWT_SECRET =
    String(
        process.env.JWT_SECRET || ""
    );

// ==================================================
// RESTAURANT SETTINGS
// ==================================================

const RESTAURANT_CAPACITY =
    Number(
        process.env.RESTAURANT_CAPACITY
    ) || 50;

// ==================================================
// EMAIL SETTINGS
// ==================================================

const GMAIL_USER =
    String(
        process.env.GMAIL_USER || ""
    ).trim();

const GMAIL_APP_PASSWORD =
    String(
        process.env.GMAIL_APP_PASSWORD || ""
    ).trim();

const RESERVATION_EMAIL =
    String(
        process.env.RESERVATION_EMAIL || ""
    ).trim();

// ==================================================
// BASIC ENVIRONMENT VALIDATION
// ==================================================

if (
    !ADMIN_PASSWORD ||
    JWT_SECRET.length < 32
) {

    console.error("");

    console.error(
        "ERROR: Missing or invalid admin environment variables."
    );

    console.error(
        "ADMIN_PASSWORD is required."
    );

    console.error(
        "JWT_SECRET must contain at least 32 characters."
    );

    console.error("");

    process.exit(1);
}

// ==================================================
// DATABASE
// ==================================================

console.log("DB_PATH:", DB_PATH);
console.log("DB directory:", path.dirname(DB_PATH));
console.log("Current working directory:", process.cwd());
console.log(
    "Database directory exists:",
    require("fs").existsSync(path.dirname(DB_PATH))
);

const db =
    new Database(
        DB_PATH
    );

db.pragma(
    "journal_mode = WAL"
);

db.pragma(
    "foreign_keys = ON"
);

// ==================================================
// DATABASE TABLES
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

        status TEXT NOT NULL DEFAULT 'New',

        billAmount REAL NOT NULL DEFAULT 0,

        createdAt TEXT NOT NULL
            DEFAULT CURRENT_TIMESTAMP,

        updatedAt TEXT NOT NULL
            DEFAULT CURRENT_TIMESTAMP
    );


    CREATE INDEX IF NOT EXISTS
        idx_reservations_date_time

    ON reservations(
        date,
        time
    );


    CREATE INDEX IF NOT EXISTS
        idx_reservations_status

    ON reservations(
        status
    );


    CREATE TABLE IF NOT EXISTS menu_items (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        name TEXT NOT NULL,

        category TEXT NOT NULL,

        description TEXT,

        price REAL NOT NULL DEFAULT 0,

        image TEXT,

        available INTEGER NOT NULL DEFAULT 1,

        createdAt TEXT NOT NULL
            DEFAULT CURRENT_TIMESTAMP,

        updatedAt TEXT NOT NULL
            DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS staff_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        passwordHash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'chef')),
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
        lastLoginAt TEXT,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        category TEXT NOT NULL,
        unit TEXT NOT NULL,
        currentQuantity REAL NOT NULL DEFAULT 0 CHECK(currentQuantity >= 0),
        minimumQuantity REAL NOT NULL DEFAULT 0 CHECK(minimumQuantity >= 0),
        supplier TEXT,
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ingredientId INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
        quantityChange REAL NOT NULL,
        reason TEXT NOT NULL,
        createdByStaffId INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS grocery_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ingredientId INTEGER REFERENCES ingredients(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        requiredQuantity REAL NOT NULL DEFAULT 0 CHECK(requiredQuantity >= 0),
        currentQuantity REAL NOT NULL DEFAULT 0 CHECK(currentQuantity >= 0),
        unit TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'urgent')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'purchased', 'received')),
        createdByStaffId INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS kitchen_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        details TEXT,
        serviceDate TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'complete')),
        createdByStaffId INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
        completedByStaffId INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS menu_ingredients (
        menuItemId INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
        ingredientId INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
        quantityPerServing REAL NOT NULL DEFAULT 0 CHECK(quantityPerServing >= 0),
        PRIMARY KEY(menuItemId, ingredientId)
    );

    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reservationId INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
        orderNumber INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'new', 'accepted', 'preparing', 'ready', 'served', 'cancelled')),
        notes TEXT,
        subtotal REAL NOT NULL DEFAULT 0 CHECK(subtotal >= 0),
        discountPercent REAL NOT NULL DEFAULT 0 CHECK(discountPercent BETWEEN 0 AND 100),
        taxRate REAL NOT NULL DEFAULT 0 CHECK(taxRate BETWEEN 0 AND 100),
        serviceChargeRate REAL NOT NULL DEFAULT 0 CHECK(serviceChargeRate BETWEEN 0 AND 100),
        amountPaid REAL NOT NULL DEFAULT 0 CHECK(amountPaid >= 0),
        paymentStatus TEXT NOT NULL DEFAULT 'unpaid' CHECK(paymentStatus IN ('unpaid', 'partially_paid', 'paid', 'refunded')),
        paymentMethod TEXT CHECK(paymentMethod IS NULL OR paymentMethod IN ('cash', 'card', 'upi', 'other')),
        paidAt TEXT,
        createdByStaffId INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(reservationId, orderNumber)
    );

    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orderId INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        menuItemId INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
        itemName TEXT NOT NULL,
        unitPrice REAL NOT NULL CHECK(unitPrice >= 0),
        quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 99),
        notes TEXT,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_staff_username ON staff_users(username);
    CREATE INDEX IF NOT EXISTS idx_ingredients_active ON ingredients(active);
    CREATE INDEX IF NOT EXISTS idx_grocery_status ON grocery_items(status);
    CREATE INDEX IF NOT EXISTS idx_kitchen_tasks_date ON kitchen_tasks(serviceDate);
    CREATE INDEX IF NOT EXISTS idx_orders_reservation ON orders(reservationId, orderNumber);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(orderId);

`);

const orderColumns = new Set(db.prepare("PRAGMA table_info(orders)").all().map(column => column.name));
for (const [name, definition] of [
    ["discountPercent", "REAL NOT NULL DEFAULT 0 CHECK(discountPercent BETWEEN 0 AND 100)"],
    ["taxRate", "REAL NOT NULL DEFAULT 0 CHECK(taxRate BETWEEN 0 AND 100)"],
    ["serviceChargeRate", "REAL NOT NULL DEFAULT 0 CHECK(serviceChargeRate BETWEEN 0 AND 100)"],
    ["amountPaid", "REAL NOT NULL DEFAULT 0 CHECK(amountPaid >= 0)"]
]) {
    if (!orderColumns.has(name)) db.exec(`ALTER TABLE orders ADD COLUMN ${name} ${definition}`);
}

// ==================================================
// EXPRESS SETTINGS
// ==================================================

app.disable(
    "x-powered-by"
);

app.use(
    express.json({
        limit: "100kb"
    })
);

// ==================================================
// SECURITY HEADERS
// ==================================================

app.use(
    (req, res, next) => {

        res.setHeader(
            "X-Content-Type-Options",
            "nosniff"
        );

        res.setHeader(
            "X-Frame-Options",
            "DENY"
        );

        res.setHeader(
            "Referrer-Policy",
            "strict-origin-when-cross-origin"
        );

        res.setHeader(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=()"
        );

        next();

    }
);

// ==================================================
// CORS
// ==================================================

const configuredOrigins =
    String(
        process.env.CORS_ALLOWED_ORIGINS || "https://aryanbehera46-source.github.io"
    )
        .split(",")
        .map(
            origin =>
                origin.trim()
        )
        .filter(Boolean);


app.use(
    (req, res, next) => {

        const requestOrigin =
            req.headers.origin;


        if (
            requestOrigin
        ) {

            const allowed =
                configuredOrigins.includes(
                    requestOrigin
                );


            const localDevelopment =
                /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
                    .test(
                        requestOrigin
                    );


            if (
                allowed ||
                localDevelopment
            ) {

                res.setHeader(
                    "Access-Control-Allow-Origin",
                    requestOrigin
                );

                res.setHeader(
                    "Vary",
                    "Origin"
                );

            } else {

                return res.status(403).json({

                    success: false,

                    message:
                        "Origin is not allowed."

                });

            }

        }


        res.setHeader(
            "Access-Control-Allow-Methods",
            "GET, POST, PUT, DELETE, OPTIONS"
        );


        res.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization"
        );


        if (
            req.method === "OPTIONS"
        ) {

            return res.sendStatus(
                204
            );

        }


        next();

    }
);

// ==================================================
// RATE LIMITING
// ==================================================

const loginAttempts =
    new Map();

const reservationAttempts =
    new Map();


const LOGIN_WINDOW_MS =
    15 * 60 * 1000;

const LOGIN_MAX_ATTEMPTS =
    10;


const RESERVATION_WINDOW_MS =
    10 * 60 * 1000;

const RESERVATION_MAX_ATTEMPTS =
    5;


// ==================================================
// RATE LIMIT FUNCTION
// ==================================================

function rateLimited(
    map,
    key,
    maxAttempts,
    windowMs
) {

    const now =
        Date.now();


    const existing =
        map.get(key);


    if (
        !existing ||
        now - existing.started >= windowMs
    ) {

        map.set(
            key,
            {
                started: now,
                count: 1
            }
        );

        return false;

    }


    existing.count++;


    return (
        existing.count >
        maxAttempts
    );

}

// ==================================================
// STRING CLEANING
// ==================================================

function clean(
    value,
    maxLength
) {

    return String(
        value ?? ""
    )
        .trim()
        .slice(
            0,
            maxLength
        );

}

// ==================================================
// DATE VALIDATION
// ==================================================

function isValidDate(
    value
) {

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
            value
        )
    ) {

        return false;

    }


    const [
        year,
        month,
        day
    ] =
        value
            .split("-")
            .map(Number);


    const date =
        new Date(
            year,
            month - 1,
            day
        );


    return (

        date.getFullYear() === year &&

        date.getMonth() ===
            month - 1 &&

        date.getDate() === day

    );

}

// ==================================================
// TIME VALIDATION
// ==================================================

function isValidTime(
    value
) {

    return /^([01]\d|2[0-3]):[0-5]\d$/
        .test(
            value
        );

}

// ==================================================
// TODAY
// ==================================================

function todayString() {

    const date =
        new Date();


    return (

        `${date.getFullYear()}-` +

        `${String(
            date.getMonth() + 1
        ).padStart(2, "0")}-` +

        `${String(
            date.getDate()
        ).padStart(2, "0")}`

    );

}

// ==================================================
// ADMIN AUTHENTICATION
// ==================================================

function authenticateAdmin(
    req,
    res,
    next
) {

    try {

        const authHeader =
            req.headers.authorization || "";


        if (
            !authHeader.startsWith(
                "Bearer "
            )
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication required."

            });

        }


        const token =
            authHeader
                .slice(7)
                .trim();


        if (
            !token ||
            token.length > 5000
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid authentication token."

            });

        }


        const decoded =
            jwt.verify(
                token,
                JWT_SECRET,
                {
                    issuer:
                        "royal-table",

                    audience:
                        "royal-table-admin"
                }
            );


        if (
            decoded.role !==
            "admin"
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Admin access required."

            });

        }


        req.admin =
            decoded;


        next();

    } catch (error) {

        if (
            error.name ===
            "TokenExpiredError"
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Your admin session has expired. Please login again."

            });

        }


        return res.status(401).json({

            success: false,

            message:
                "Invalid or expired admin session."

        });

    }

}

// ==================================================
// STAFF AUTHENTICATION AND AUTHORIZATION
// ==================================================

function authenticateStaff(req, res, next) {
    try {
        const authHeader = req.headers.authorization || "";
        if (!authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const token = authHeader.slice(7).trim();
        const decoded = jwt.verify(token, JWT_SECRET, {
            issuer: "royal-table",
            audience: "royal-table-staff"
        });

        const staff = db.prepare(`
            SELECT id, name, username, role, active
            FROM staff_users WHERE id = ?
        `).get(decoded.staffId);

        if (!staff || !staff.active || staff.role !== decoded.role) {
            return res.status(401).json({ success: false, message: "Staff account is inactive or unavailable." });
        }

        req.staff = staff;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: error.name === "TokenExpiredError" ? "Your staff session has expired. Please login again." : "Invalid staff session."
        });
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.staff || !roles.includes(req.staff.role)) {
            return res.status(403).json({ success: false, message: "You do not have permission for this action." });
        }
        next();
    };
}

function staffOrAdmin(req, res, next) {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Authentication required." });
    }
    try {
        const token = authHeader.slice(7).trim();
        const decoded = jwt.verify(token, JWT_SECRET, { issuer: "royal-table" });
        if (decoded.aud === "royal-table-admin" && decoded.role === "admin") {
            req.staff = { id: null, username: decoded.username, role: "admin", active: 1 };
            return next();
        }
    } catch (_) {
        // Staff verification below returns the standard response.
    }
    return authenticateStaff(req, res, next);
}

function validQuantity(value) {
    return Number.isFinite(Number(value)) && Number(value) >= 0;
}

function orderWithItems(id) {
    const order = db.prepare(`
        SELECT o.*, r.name AS guestName, r.date, r.time, r.guests
        FROM orders o JOIN reservations r ON r.id = o.reservationId
        WHERE o.id = ?
    `).get(id);
    if (!order) return null;
    order.items = db.prepare("SELECT id, menuItemId, itemName, unitPrice, quantity, notes, ROUND(unitPrice * quantity, 2) AS lineTotal FROM order_items WHERE orderId = ? ORDER BY id").all(id);
    const bill = calculateOrderBill(order);
    const recordedAmount = money(Math.min(Number(order.amountPaid) || 0, bill.grandTotal));
    Object.assign(order, bill, {
        amountPaid: recordedAmount,
        remainingBalance: money(Math.max(0, bill.grandTotal - recordedAmount)),
        paymentStatus: order.paymentStatus === "refunded" ? "refunded" : recordedAmount === 0 ? "unpaid" : recordedAmount === bill.grandTotal ? "paid" : "partially_paid"
    });
    return order;
}

function money(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function calculateOrderBill(order) {
    const subtotal = money(order.subtotal);
    const discountAmount = money(subtotal * Number(order.discountPercent || 0) / 100);
    const taxableAmount = money(Math.max(0, subtotal - discountAmount));
    const taxAmount = money(taxableAmount * Number(order.taxRate || 0) / 100);
    const serviceChargeAmount = money(taxableAmount * Number(order.serviceChargeRate || 0) / 100);
    return { discountAmount, taxableAmount, taxAmount, serviceChargeAmount, grandTotal: money(taxableAmount + taxAmount + serviceChargeAmount) };
}

function validateOrderItems(items) {
    if (!Array.isArray(items) || items.length < 1 || items.length > 50) {
        return { error: "An order must contain between 1 and 50 items." };
    }
    const menuLookup = db.prepare("SELECT id, name, price, available FROM menu_items WHERE id = ?");
    const normalized = [];
    for (const raw of items) {
        const menuItemId = Number(raw?.menuItemId);
        const quantity = Number(raw?.quantity);
        const menuItem = Number.isInteger(menuItemId) ? menuLookup.get(menuItemId) : null;
        if (!menuItem || !menuItem.available) return { error: "Every item must reference an available menu item." };
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return { error: "Item quantities must be whole numbers between 1 and 99." };
        const price = Number(menuItem.price);
        if (!Number.isFinite(price) || price < 0) return { error: "A menu item has an invalid server price." };
        normalized.push({ menuItemId, itemName: menuItem.name, unitPrice: Math.round(price * 100) / 100, quantity, notes: clean(raw?.notes, 300) || null });
    }
    return { items: normalized, subtotal: Math.round(normalized.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) * 100) / 100 };
}

function syncReservationBill(reservationId) {
    const total = db.prepare("SELECT id FROM orders WHERE reservationId = ? AND status != 'cancelled'").all(reservationId).reduce((sum, row) => sum + orderWithItems(row.id).grandTotal, 0);
    db.prepare("UPDATE reservations SET billAmount = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(total, reservationId);
    return Number(total);
}

// ==================================================
// EMAIL CONFIGURATION
// ==================================================

function isEmailConfigured() {

    return Boolean(

        GMAIL_USER &&

        GMAIL_APP_PASSWORD &&

        RESERVATION_EMAIL

    );

}


const emailTransporter =
    isEmailConfigured()

        ? nodemailer.createTransport({

            service:
                "gmail",

            auth: {

                user:
                    GMAIL_USER,

                pass:
                    GMAIL_APP_PASSWORD

            }

        })

        : null;


// ==================================================
// RESERVATION EMAILS
// ==================================================

async function sendReservationEmails(
    reservation
) {

    if (
        !emailTransporter
    ) {

        console.warn(
            "Reservation emails skipped: Gmail is not configured."
        );

        return {

            restaurant: false,

            customer: false

        };

    }


    const {

        id,
        name,
        email,
        date,
        time,
        guests,
        phone,
        specialRequest

    } =
        reservation;


    const restaurantMail = {

        from:
            `"Royal Table Restaurant" <${GMAIL_USER}>`,

        to:
            RESERVATION_EMAIL,

        replyTo:
            email,

        subject:
            `New Reservation #${id} — ${name}`,

        html: `

            <div style="
                font-family:Arial,sans-serif;
                max-width:650px;
                margin:20px auto;
                padding:30px;
                border:1px solid #ddd;
                border-radius:12px;
            ">

                <h2>
                    🍽️ New Reservation
                </h2>

                <p>
                    <strong>
                        Reservation #${id}
                    </strong>
                </p>

                <hr>

                <p>
                    <strong>Name:</strong>
                    ${name}
                </p>

                <p>
                    <strong>Email:</strong>
                    ${email}
                </p>

                <p>
                    <strong>Phone:</strong>
                    ${phone}
                </p>

                <p>
                    <strong>Date:</strong>
                    ${date}
                </p>

                <p>
                    <strong>Time:</strong>
                    ${time}
                </p>

                <p>
                    <strong>Guests:</strong>
                    ${guests}
                </p>

                <p>
                    <strong>Special Request:</strong>
                    ${specialRequest || "None"}
                </p>

            </div>

        `

    };


    const customerMail = {

        from:
            `"Royal Table Restaurant" <${GMAIL_USER}>`,

        to:
            email,

        subject:
            `Reservation Received — Royal Table #${id}`,

        html: `

            <div style="
                font-family:Arial,sans-serif;
                max-width:650px;
                margin:20px auto;
                padding:30px;
                border:1px solid #ddd;
                border-radius:12px;
            ">

                <h2>
                    Thank you, ${name}! 🍽️
                </h2>

                <p>
                    We have received your
                    reservation request.
                </p>

                <hr>

                <p>
                    <strong>
                        Reservation #${id}
                    </strong>
                </p>

                <p>
                    <strong>Date:</strong>
                    ${date}
                </p>

                <p>
                    <strong>Time:</strong>
                    ${time}
                </p>

                <p>
                    <strong>Guests:</strong>
                    ${guests}
                </p>

                <p>
                    <strong>Phone:</strong>
                    ${phone}
                </p>

                <p>
                    <strong>
                        Special Request:
                    </strong>
                    ${specialRequest || "None"}
                </p>

                <hr>

                <p>
                    Our team will review your
                    reservation and confirm it shortly.
                </p>

                <p>
                    <strong>
                        Royal Table Restaurant
                    </strong>
                </p>

            </div>

        `

    };


    const results =
        await Promise.allSettled([

            emailTransporter.sendMail(
                restaurantMail
            ),

            emailTransporter.sendMail(
                customerMail
            )

        ]);


    return {

        restaurant:
            results[0].status ===
            "fulfilled",

        customer:
            results[1].status ===
            "fulfilled"

    };

}

// ==================================================
// TEST ROUTE
// ==================================================

// ==================================================
// DAY 17: STAFF, KITCHEN, INVENTORY, AND GROCERY API
// ==================================================

const staffLoginAttempts = new Map();
const aiKitchenAttempts = new Map();

function publicStaff(staff) {
    const { passwordHash, ...safeStaff } = staff;
    return safeStaff;
}

app.post("/staff/login", async (req, res) => {
    const clientKey = String(req.ip || "unknown");
    if (rateLimited(staffLoginAttempts, clientKey, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS)) {
        return res.status(429).json({ success: false, message: "Too many login attempts. Please try again later." });
    }
    const username = clean(req.body?.username, 100);
    const password = String(req.body?.password || "");
    const portal = clean(req.body?.portal, 20).toLowerCase();
    const staff = db.prepare("SELECT * FROM staff_users WHERE username = ?").get(username);
    if (!staff || !staff.active || (portal === "chef" && staff.role !== "chef") || !(await bcrypt.compare(password, staff.passwordHash))) {
        return res.status(401).json({ success: false, message: "Invalid username or password." });
    }
    staffLoginAttempts.delete(clientKey);
    db.prepare("UPDATE staff_users SET lastLoginAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(staff.id);
    const token = jwt.sign({ staffId: staff.id, username: staff.username, role: staff.role }, JWT_SECRET, {
        expiresIn: "8h", issuer: "royal-table", audience: "royal-table-staff"
    });
    return res.json({ success: true, message: "Login successful.", token, staff: publicStaff({ ...staff, passwordHash: undefined }) });
});

app.get("/staff", authenticateAdmin, (req, res) => {
    const staff = db.prepare("SELECT id, name, username, role, active, lastLoginAt, createdAt, updatedAt FROM staff_users ORDER BY name").all();
    res.json({ success: true, staff });
});

app.post("/staff", authenticateAdmin, async (req, res) => {
    const name = clean(req.body?.name, 100);
    const username = clean(req.body?.username, 100);
    const password = String(req.body?.password || "");
    const role = clean(req.body?.role, 20);
    if (!name || !username || password.length < 8 || !["admin", "chef"].includes(role)) {
        return res.status(400).json({ success: false, message: "Name, unique username, valid role, and a password of at least 8 characters are required." });
    }
    try {
        const passwordHash = await bcrypt.hash(password, 12);
        const result = db.prepare("INSERT INTO staff_users (name, username, passwordHash, role) VALUES (?, ?, ?, ?)").run(name, username, passwordHash, role);
        const staff = db.prepare("SELECT id, name, username, role, active, lastLoginAt, createdAt, updatedAt FROM staff_users WHERE id = ?").get(result.lastInsertRowid);
        return res.status(201).json({ success: true, staff });
    } catch (error) {
        return res.status(error.message.includes("UNIQUE") ? 409 : 500).json({ success: false, message: error.message.includes("UNIQUE") ? "That username is already in use." : "Unable to create staff member." });
    }
});

app.put("/staff/:id", authenticateAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare("SELECT * FROM staff_users WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ success: false, message: "Staff member not found." });
    const name = req.body?.name === undefined ? existing.name : clean(req.body.name, 100);
    const username = req.body?.username === undefined ? existing.username : clean(req.body.username, 100);
    const role = req.body?.role === undefined ? existing.role : clean(req.body.role, 20);
    const active = req.body?.active === undefined ? existing.active : (req.body.active ? 1 : 0);
    if (!name || !username || !["admin", "chef"].includes(role)) return res.status(400).json({ success: false, message: "Valid name, username, and role are required." });
    if (req.body?.password !== undefined && String(req.body.password).length < 8) return res.status(400).json({ success: false, message: "New passwords must be at least 8 characters." });
    if (existing.role === "admin" && existing.active && !active && db.prepare("SELECT COUNT(*) AS count FROM staff_users WHERE role = 'admin' AND active = 1").get().count <= 1) return res.status(409).json({ success: false, message: "At least one active staff administrator is required." });
    try {
        const passwordHash = req.body?.password === undefined ? existing.passwordHash : await bcrypt.hash(String(req.body.password), 12);
        db.prepare("UPDATE staff_users SET name=?, username=?, passwordHash=?, role=?, active=?, updatedAt=CURRENT_TIMESTAMP WHERE id=?").run(name, username, passwordHash, role, active, id);
        const staff = db.prepare("SELECT id, name, username, role, active, lastLoginAt, createdAt, updatedAt FROM staff_users WHERE id = ?").get(id);
        return res.json({ success: true, staff });
    } catch (error) {
        return res.status(error.message.includes("UNIQUE") ? 409 : 500).json({ success: false, message: error.message.includes("UNIQUE") ? "That username is already in use." : "Unable to update staff member." });
    }
});

app.delete("/staff/:id", authenticateAdmin, (req, res) => {
    const staff = db.prepare("SELECT * FROM staff_users WHERE id = ?").get(Number(req.params.id));
    if (!staff) return res.status(404).json({ success: false, message: "Staff member not found." });
    if (staff.role === "admin" && staff.active && db.prepare("SELECT COUNT(*) AS count FROM staff_users WHERE role = 'admin' AND active = 1").get().count <= 1) return res.status(409).json({ success: false, message: "At least one active staff administrator is required." });
    db.prepare("UPDATE staff_users SET active = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(staff.id);
    res.json({ success: true, message: "Staff member decommissioned." });
});

app.get("/ingredients", staffOrAdmin, requireRole("admin", "chef"), (req, res) => {
    const ingredients = db.prepare("SELECT *, CASE WHEN currentQuantity <= minimumQuantity THEN 1 ELSE 0 END AS lowStock FROM ingredients WHERE active = 1 ORDER BY name").all();
    res.json({ success: true, ingredients });
});

app.post("/ingredients", staffOrAdmin, requireRole("admin", "chef"), (req, res) => {
    const name = clean(req.body?.name, 100), category = clean(req.body?.category, 60), unit = clean(req.body?.unit, 30);
    const currentQuantity = Number(req.body?.currentQuantity), minimumQuantity = Number(req.body?.minimumQuantity);
    if (!name || !category || !unit || !validQuantity(currentQuantity) || !validQuantity(minimumQuantity)) return res.status(400).json({ success: false, message: "Name, category, unit, and non-negative quantities are required." });
    try {
        const result = db.prepare("INSERT INTO ingredients (name, category, unit, currentQuantity, minimumQuantity, supplier) VALUES (?, ?, ?, ?, ?, ?)").run(name, category, unit, currentQuantity, minimumQuantity, clean(req.body?.supplier, 150) || null);
        res.status(201).json({ success: true, ingredient: db.prepare("SELECT * FROM ingredients WHERE id = ?").get(result.lastInsertRowid) });
    } catch (error) { res.status(error.message.includes("UNIQUE") ? 409 : 500).json({ success: false, message: error.message.includes("UNIQUE") ? "That ingredient already exists." : "Unable to create ingredient." }); }
});

app.put("/ingredients/:id", staffOrAdmin, requireRole("admin", "chef"), (req, res) => {
    const ingredient = db.prepare("SELECT * FROM ingredients WHERE id = ?").get(Number(req.params.id));
    if (!ingredient) return res.status(404).json({ success: false, message: "Ingredient not found." });
    const fields = { name: req.body?.name === undefined ? ingredient.name : clean(req.body.name, 100), category: req.body?.category === undefined ? ingredient.category : clean(req.body.category, 60), unit: req.body?.unit === undefined ? ingredient.unit : clean(req.body.unit, 30), currentQuantity: req.body?.currentQuantity === undefined ? ingredient.currentQuantity : Number(req.body.currentQuantity), minimumQuantity: req.body?.minimumQuantity === undefined ? ingredient.minimumQuantity : Number(req.body.minimumQuantity), supplier: req.body?.supplier === undefined ? ingredient.supplier : clean(req.body.supplier, 150) || null, active: req.body?.active === undefined ? ingredient.active : (req.body.active ? 1 : 0) };
    if (!fields.name || !fields.category || !fields.unit || !validQuantity(fields.currentQuantity) || !validQuantity(fields.minimumQuantity)) return res.status(400).json({ success: false, message: "Valid ingredient fields are required." });
    db.prepare("UPDATE ingredients SET name=?, category=?, unit=?, currentQuantity=?, minimumQuantity=?, supplier=?, active=?, updatedAt=CURRENT_TIMESTAMP WHERE id=?").run(fields.name, fields.category, fields.unit, fields.currentQuantity, fields.minimumQuantity, fields.supplier, fields.active, ingredient.id);
    res.json({ success: true, ingredient: db.prepare("SELECT * FROM ingredients WHERE id = ?").get(ingredient.id) });
});

app.post("/ingredients/:id/adjustments", staffOrAdmin, requireRole("admin", "chef"), (req, res) => {
    const ingredient = db.prepare("SELECT * FROM ingredients WHERE id = ? AND active = 1").get(Number(req.params.id));
    const quantityChange = Number(req.body?.quantityChange), reason = clean(req.body?.reason, 200);
    if (!ingredient) return res.status(404).json({ success: false, message: "Ingredient not found." });
    if (!Number.isFinite(quantityChange) || !quantityChange || !reason || ingredient.currentQuantity + quantityChange < 0) return res.status(400).json({ success: false, message: "Use a non-zero adjustment, reason, and do not reduce stock below zero." });
    const adjust = db.transaction(() => {
        db.prepare("UPDATE ingredients SET currentQuantity=currentQuantity+?, updatedAt=CURRENT_TIMESTAMP WHERE id=?").run(quantityChange, ingredient.id);
        db.prepare("INSERT INTO inventory_movements (ingredientId, quantityChange, reason, createdByStaffId) VALUES (?, ?, ?, ?)").run(ingredient.id, quantityChange, reason, req.staff.id);
    });
    adjust();
    res.json({ success: true, ingredient: db.prepare("SELECT * FROM ingredients WHERE id = ?").get(ingredient.id) });
});

app.get("/grocery", staffOrAdmin, requireRole("admin", "chef"), (req, res) => {
    const status = clean(req.query?.status, 20);
    const grocery = db.prepare(`SELECT g.*, MAX(g.requiredQuantity - g.currentQuantity, 0) AS shortfall FROM grocery_items g ${status ? "WHERE g.status = ?" : ""} ORDER BY CASE g.priority WHEN 'urgent' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, g.createdAt DESC`).all(...(status ? [status] : []));
    res.json({ success: true, grocery });
});

app.post("/grocery", staffOrAdmin, requireRole("admin", "chef"), (req, res) => {
    const name = clean(req.body?.name, 100), unit = clean(req.body?.unit, 30), priority = clean(req.body?.priority || "normal", 20);
    const requiredQuantity = Number(req.body?.requiredQuantity), currentQuantity = Number(req.body?.currentQuantity || 0), ingredientId = req.body?.ingredientId ? Number(req.body.ingredientId) : null;
    if (!name || !unit || !validQuantity(requiredQuantity) || !validQuantity(currentQuantity) || !["low", "normal", "urgent"].includes(priority)) return res.status(400).json({ success: false, message: "Valid grocery details are required." });
    const result = db.prepare("INSERT INTO grocery_items (ingredientId, name, requiredQuantity, currentQuantity, unit, priority, createdByStaffId) VALUES (?, ?, ?, ?, ?, ?, ?)").run(ingredientId, name, requiredQuantity, currentQuantity, unit, priority, req.staff.id);
    res.status(201).json({ success: true, groceryItem: db.prepare("SELECT * FROM grocery_items WHERE id = ?").get(result.lastInsertRowid) });
});

app.put("/grocery/:id", staffOrAdmin, requireRole("admin", "chef"), (req, res) => {
    const item = db.prepare("SELECT * FROM grocery_items WHERE id = ?").get(Number(req.params.id));
    if (!item) return res.status(404).json({ success: false, message: "Grocery item not found." });
    const requiredQuantity = req.body?.requiredQuantity === undefined ? item.requiredQuantity : Number(req.body.requiredQuantity), currentQuantity = req.body?.currentQuantity === undefined ? item.currentQuantity : Number(req.body.currentQuantity), priority = req.body?.priority === undefined ? item.priority : clean(req.body.priority, 20), status = req.body?.status === undefined ? item.status : clean(req.body.status, 20);
    if (!validQuantity(requiredQuantity) || !validQuantity(currentQuantity) || !["low", "normal", "urgent"].includes(priority) || !["pending", "purchased", "received"].includes(status)) return res.status(400).json({ success: false, message: "Valid grocery fields are required." });
    db.prepare("UPDATE grocery_items SET requiredQuantity=?, currentQuantity=?, priority=?, status=?, updatedAt=CURRENT_TIMESTAMP WHERE id=?").run(requiredQuantity, currentQuantity, priority, status, item.id);
    res.json({ success: true, groceryItem: db.prepare("SELECT * FROM grocery_items WHERE id = ?").get(item.id) });
});

app.delete("/grocery/:id", staffOrAdmin, requireRole("admin", "chef"), (req, res) => {
    const result = db.prepare("DELETE FROM grocery_items WHERE id = ?").run(Number(req.params.id));
    if (!result.changes) return res.status(404).json({ success: false, message: "Grocery item not found." });
    res.json({ success: true, message: "Grocery item removed." });
});

// ==================================================
// DAY 18: ITEMIZED ORDERS, KOTS, AND PAYMENTS
// ==================================================

app.get("/reservations/:id/orders", authenticateAdmin, (req, res) => {
    const reservationId = Number(req.params.id);
    if (!Number.isInteger(reservationId) || reservationId < 1) return res.status(400).json({ success: false, message: "Invalid reservation ID." });
    if (!db.prepare("SELECT id FROM reservations WHERE id = ?").get(reservationId)) return res.status(404).json({ success: false, message: "Reservation not found." });
    const orders = db.prepare("SELECT id FROM orders WHERE reservationId = ? ORDER BY orderNumber").all(reservationId).map(row => orderWithItems(row.id));
    const active = orders.filter(order => order.status !== "cancelled");
    const billTotal = money(active.reduce((sum, order) => sum + order.grandTotal, 0));
    const amountPaid = money(active.reduce((sum, order) => sum + order.amountPaid, 0));
    res.json({ success: true, orders, billTotal, amountPaid, remainingBalance: money(Math.max(0, billTotal - amountPaid)) });
});

app.post("/reservations/:id/orders", authenticateAdmin, (req, res) => {
    const reservationId = Number(req.params.id);
    const reservation = Number.isInteger(reservationId) ? db.prepare("SELECT id, status FROM reservations WHERE id = ?").get(reservationId) : null;
    if (!reservation) return res.status(404).json({ success: false, message: "Reservation not found." });
    if (reservation.status === "Cancelled") return res.status(409).json({ success: false, message: "Orders cannot be added to a cancelled reservation." });
    const checked = validateOrderItems(req.body?.items);
    if (checked.error) return res.status(400).json({ success: false, message: checked.error });
    const notes = clean(req.body?.notes, 1000) || null;
    let orderId;
    db.transaction(() => {
        const next = db.prepare("SELECT COALESCE(MAX(orderNumber), 0) + 1 AS next FROM orders WHERE reservationId = ?").get(reservationId).next;
        orderId = Number(db.prepare("INSERT INTO orders (reservationId, orderNumber, notes, subtotal) VALUES (?, ?, ?, ?)").run(reservationId, next, notes, checked.subtotal).lastInsertRowid);
        const insert = db.prepare("INSERT INTO order_items (orderId, menuItemId, itemName, unitPrice, quantity, notes) VALUES (?, ?, ?, ?, ?, ?)");
        for (const item of checked.items) insert.run(orderId, item.menuItemId, item.itemName, item.unitPrice, item.quantity, item.notes);
        syncReservationBill(reservationId);
    })();
    res.status(201).json({ success: true, order: orderWithItems(orderId) });
});

app.put("/orders/:id", authenticateAdmin, (req, res) => {
    const existing = orderWithItems(Number(req.params.id));
    if (!existing) return res.status(404).json({ success: false, message: "Order not found." });
    if (!["draft", "new"].includes(existing.status)) return res.status(409).json({ success: false, message: "Only draft or new KOTs can be edited." });
    const checked = validateOrderItems(req.body?.items);
    if (checked.error) return res.status(400).json({ success: false, message: checked.error });
    const revisedBill = calculateOrderBill({ ...existing, subtotal: checked.subtotal });
    if (existing.amountPaid > revisedBill.grandTotal) return res.status(409).json({ success: false, message: "Order changes cannot reduce the total below the amount already paid." });
    db.transaction(() => {
        db.prepare("UPDATE orders SET notes = ?, subtotal = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(clean(req.body?.notes, 1000) || null, checked.subtotal, existing.id);
        db.prepare("DELETE FROM order_items WHERE orderId = ?").run(existing.id);
        const insert = db.prepare("INSERT INTO order_items (orderId, menuItemId, itemName, unitPrice, quantity, notes) VALUES (?, ?, ?, ?, ?, ?)");
        for (const item of checked.items) insert.run(existing.id, item.menuItemId, item.itemName, item.unitPrice, item.quantity, item.notes);
        syncReservationBill(existing.reservationId);
    })();
    res.json({ success: true, order: orderWithItems(existing.id) });
});

app.post("/orders/:id/submit", authenticateAdmin, (req, res) => {
    const order = orderWithItems(Number(req.params.id));
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    if (order.status !== "draft") return res.status(409).json({ success: false, message: "Only a draft order can be sent to the kitchen." });
    db.prepare("UPDATE orders SET status = 'new', updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(order.id);
    res.json({ success: true, order: orderWithItems(order.id) });
});

app.delete("/orders/:id", authenticateAdmin, (req, res) => {
    const order = orderWithItems(Number(req.params.id));
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    if (order.status !== "draft") return res.status(409).json({ success: false, message: "Only draft orders can be deleted." });
    db.transaction(() => { db.prepare("DELETE FROM orders WHERE id = ?").run(order.id); syncReservationBill(order.reservationId); })();
    res.json({ success: true, message: "Draft order deleted." });
});

app.put("/orders/:id/payment", authenticateAdmin, (req, res) => {
    const order = orderWithItems(Number(req.params.id));
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    const paymentMethod = req.body?.paymentMethod == null ? null : clean(req.body.paymentMethod, 20);
    const amountPaid = money(req.body?.amountPaid);
    if (!Number.isFinite(Number(req.body?.amountPaid)) || amountPaid < 0 || amountPaid > order.grandTotal) return res.status(400).json({ success: false, message: "Amount paid must be between zero and the server-calculated grand total." });
    if (amountPaid > 0 && !["cash", "card", "upi", "other"].includes(paymentMethod)) return res.status(400).json({ success: false, message: "A valid payment method is required when recording payment." });
    if (paymentMethod !== null && !["cash", "card", "upi", "other"].includes(paymentMethod)) return res.status(400).json({ success: false, message: "Invalid payment method." });
    const paymentStatus = amountPaid === 0 ? "unpaid" : amountPaid === order.grandTotal ? "paid" : "partially_paid";
    const storedStatus = paymentStatus === "partially_paid" ? "unpaid" : paymentStatus;
    db.prepare("UPDATE orders SET amountPaid = ?, paymentStatus = ?, paymentMethod = ?, paidAt = CASE WHEN ? = 'paid' THEN COALESCE(paidAt, CURRENT_TIMESTAMP) ELSE NULL END, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(amountPaid, storedStatus, amountPaid > 0 ? paymentMethod : null, paymentStatus, order.id);
    res.json({ success: true, order: orderWithItems(order.id) });
});

app.put("/orders/:id/billing", authenticateAdmin, (req, res) => {
    const order = orderWithItems(Number(req.params.id));
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    const values = ["discountPercent", "taxRate", "serviceChargeRate"].map(field => Number(req.body?.[field]));
    if (values.some(value => !Number.isFinite(value) || value < 0 || value > 100)) return res.status(400).json({ success: false, message: "Discount, tax, and service charge must each be between 0 and 100 percent." });
    const preview = calculateOrderBill({ ...order, discountPercent: values[0], taxRate: values[1], serviceChargeRate: values[2] });
    if (order.amountPaid > preview.grandTotal) return res.status(409).json({ success: false, message: "Billing adjustments cannot reduce the total below the amount already paid." });
    const paymentStatus = order.amountPaid === 0 ? "unpaid" : order.amountPaid === preview.grandTotal ? "paid" : "partially_paid";
    const storedStatus = paymentStatus === "partially_paid" ? "unpaid" : paymentStatus;
    db.transaction(() => {
        db.prepare("UPDATE orders SET discountPercent=?, taxRate=?, serviceChargeRate=?, paymentStatus=?, paidAt=CASE WHEN ?='paid' THEN COALESCE(paidAt,CURRENT_TIMESTAMP) ELSE NULL END, updatedAt=CURRENT_TIMESTAMP WHERE id=?").run(...values, storedStatus, paymentStatus, order.id);
        syncReservationBill(order.reservationId);
    })();
    res.json({ success: true, order: orderWithItems(order.id) });
});

app.get("/kitchen/orders", staffOrAdmin, requireRole("admin", "chef"), (req, res) => {
    const date = clean(req.query?.date || todayString(), 10);
    if (!isValidDate(date)) return res.status(400).json({ success: false, message: "Use a valid date." });
    const orders = db.prepare("SELECT o.id FROM orders o JOIN reservations r ON r.id = o.reservationId WHERE r.date = ? AND o.status != 'draft' AND o.status != 'cancelled' ORDER BY r.time, o.createdAt").all(date).map(row => orderWithItems(row.id));
    res.json({ success: true, orders });
});

app.put("/kitchen/orders/:id/status", staffOrAdmin, requireRole("admin", "chef"), (req, res) => {
    const order = orderWithItems(Number(req.params.id));
    if (!order) return res.status(404).json({ success: false, message: "KOT not found." });
    const status = clean(req.body?.status, 20);
    const next = { new: "accepted", accepted: "preparing", preparing: "ready", ready: "served" };
    if (next[order.status] !== status) return res.status(409).json({ success: false, message: `KOT ${order.status} can only move to ${next[order.status] || "no further status"}.` });
    db.prepare("UPDATE orders SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(status, order.id);
    res.json({ success: true, order: orderWithItems(order.id) });
});

function kitchenBriefing(date) {
    const reservations = db.prepare(`SELECT id, time, guests, name, specialRequest, status FROM reservations WHERE date = ? AND LOWER(status) != 'cancelled' ORDER BY time`).all(date);
    const confirmed = reservations.filter(r => ["confirmed", "completed"].includes(String(r.status).toLowerCase()));
    const byTime = Object.values(reservations.reduce((acc, r) => { (acc[r.time] ||= { time: r.time, guests: 0, reservations: 0 }); acc[r.time].guests += Number(r.guests); acc[r.time].reservations++; return acc; }, {}));
    const lowStock = db.prepare("SELECT id, name, category, unit, currentQuantity, minimumQuantity FROM ingredients WHERE active=1 AND currentQuantity <= minimumQuantity ORDER BY name").all();
    const grocery = db.prepare("SELECT *, MAX(requiredQuantity-currentQuantity,0) AS shortfall FROM grocery_items WHERE status='pending' ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END").all();
    const tasks = db.prepare("SELECT * FROM kitchen_tasks WHERE serviceDate=? AND status='pending' ORDER BY createdAt").all(date);
    const kots = db.prepare("SELECT o.id, o.status, o.subtotal FROM orders o JOIN reservations r ON r.id=o.reservationId WHERE r.date=? AND o.status NOT IN ('draft','cancelled')").all(date);
    const kotStatusCounts = { new: 0, accepted: 0, preparing: 0, ready: 0, served: 0 };
    for (const kot of kots) if (Object.prototype.hasOwnProperty.call(kotStatusCounts, kot.status)) kotStatusCounts[kot.status]++;
    const dishQuantities = db.prepare(`
        SELECT oi.itemName AS name, SUM(oi.quantity) AS quantity
        FROM order_items oi
        JOIN orders o ON o.id=oi.orderId
        JOIN reservations r ON r.id=o.reservationId
        WHERE r.date=? AND o.status NOT IN ('draft','cancelled')
        GROUP BY oi.itemName ORDER BY quantity DESC, oi.itemName LIMIT 12
    `).all(date).map(row => ({ ...row, quantity: Number(row.quantity) }));
    return { date, reservations, confirmedGuests: confirmed.reduce((sum, r) => sum + Number(r.guests), 0), totalGuests: reservations.reduce((sum, r) => sum + Number(r.guests), 0), actualOrders: kots.length, reservationsWithOrders: Number(db.prepare("SELECT COUNT(DISTINCT o.reservationId) AS count FROM orders o JOIN reservations r ON r.id=o.reservationId WHERE r.date=? AND o.status NOT IN ('draft','cancelled')").get(date).count), byTime, lowStock, grocery, tasks, kots, kotStatusCounts, dishQuantities, activeMenuItems: db.prepare("SELECT id, name, category FROM menu_items WHERE available=1 ORDER BY category, name").all() };
}

function actualOrderAnalytics(date) {
    const orders = db.prepare(`SELECT o.id FROM orders o JOIN reservations r ON r.id=o.reservationId WHERE r.date=? AND o.status NOT IN ('draft','cancelled')`).all(date).map(row => orderWithItems(row.id));
    const paidRevenue = money(orders.reduce((sum, order) => sum + order.amountPaid, 0));
    const billedRevenue = money(orders.reduce((sum, order) => sum + order.grandTotal, 0));
    const topDishes = db.prepare(`SELECT oi.itemName AS name, SUM(oi.quantity) AS quantity, ROUND(SUM(oi.unitPrice * oi.quantity),2) AS sales FROM order_items oi JOIN orders o ON o.id=oi.orderId JOIN reservations r ON r.id=o.reservationId WHERE r.date=? AND o.status NOT IN ('draft','cancelled') GROUP BY oi.itemName ORDER BY quantity DESC, sales DESC LIMIT 5`).all(date);
    const topCategories = db.prepare(`SELECT COALESCE(m.category,'Uncategorized') AS category, SUM(oi.quantity) AS quantity FROM order_items oi JOIN orders o ON o.id=oi.orderId JOIN reservations r ON r.id=o.reservationId LEFT JOIN menu_items m ON m.id=oi.menuItemId WHERE r.date=? AND o.status NOT IN ('draft','cancelled') GROUP BY COALESCE(m.category,'Uncategorized') ORDER BY quantity DESC, category LIMIT 5`).all(date);
    return { date, ordersToday: orders.length, billedRevenue, paidRevenue, outstandingRevenue: money(Math.max(0, billedRevenue-paidRevenue)), averageOrderValue: money(orders.length ? billedRevenue/orders.length : 0), topDishes: topDishes.map(row => ({ ...row, quantity:Number(row.quantity), sales:Number(row.sales) })), topCategories: topCategories.map(row => ({ ...row, quantity:Number(row.quantity) })), topCategory: topCategories[0]?.category || null };
}

app.get("/analytics/orders", authenticateAdmin, (req, res) => {
    const date = clean(req.query?.date || todayString(), 10);
    if (!isValidDate(date)) return res.status(400).json({ success:false, message:"Use a valid date." });
    res.json({ success:true, analytics:actualOrderAnalytics(date) });
});

app.get("/chef/dashboard", staffOrAdmin, requireRole("admin", "chef"), (req, res) => {
    const date = isValidDate(clean(req.query?.date || todayString(), 10)) ? clean(req.query?.date || todayString(), 10) : todayString();
    res.json({ success: true, dashboard: kitchenBriefing(date) });
});

app.get("/chef/reservations", staffOrAdmin, requireRole("admin", "chef"), (req, res) => {
    const date = clean(req.query?.date || todayString(), 10);
    if (!isValidDate(date)) return res.status(400).json({ success: false, message: "Use a valid date." });
    res.json({ success: true, reservations: kitchenBriefing(date).reservations });
});

app.get("/chef/menu", staffOrAdmin, requireRole("admin", "chef"), (req, res) => res.json({ success: true, menu: db.prepare("SELECT id, name, category, description, price, available FROM menu_items WHERE available=1 ORDER BY category, name").all() }));

app.get("/kitchen/tasks", staffOrAdmin, requireRole("admin", "chef"), (req, res) => {
    const date = clean(req.query?.date || todayString(), 10); if (!isValidDate(date)) return res.status(400).json({ success: false, message: "Use a valid date." });
    res.json({ success: true, tasks: db.prepare("SELECT * FROM kitchen_tasks WHERE serviceDate=? ORDER BY status, createdAt").all(date) });
});

app.post("/kitchen/tasks", staffOrAdmin, requireRole("admin", "chef"), (req, res) => {
    const title = clean(req.body?.title, 200), details = clean(req.body?.details, 1000) || null, serviceDate = clean(req.body?.serviceDate || todayString(), 10);
    if (!title || !isValidDate(serviceDate)) return res.status(400).json({ success: false, message: "A task title and valid service date are required." });
    const result = db.prepare("INSERT INTO kitchen_tasks (title, details, serviceDate, createdByStaffId) VALUES (?, ?, ?, ?)").run(title, details, serviceDate, req.staff.id);
    res.status(201).json({ success: true, task: db.prepare("SELECT * FROM kitchen_tasks WHERE id=?").get(result.lastInsertRowid) });
});

app.put("/kitchen/tasks/:id", staffOrAdmin, requireRole("admin", "chef"), (req, res) => {
    const task = db.prepare("SELECT * FROM kitchen_tasks WHERE id=?").get(Number(req.params.id)); if (!task) return res.status(404).json({ success: false, message: "Kitchen task not found." });
    const status = clean(req.body?.status, 20); if (!["pending", "complete"].includes(status)) return res.status(400).json({ success: false, message: "Use pending or complete." });
    db.prepare("UPDATE kitchen_tasks SET status=?, completedByStaffId=?, updatedAt=CURRENT_TIMESTAMP WHERE id=?").run(status, status === "complete" ? req.staff.id : null, task.id);
    res.json({ success: true, task: db.prepare("SELECT * FROM kitchen_tasks WHERE id=?").get(task.id) });
});

app.post("/ai/kitchen/briefing", staffOrAdmin, requireRole("admin", "chef"), (req, res) => {
    const clientKey = String(req.staff.id || req.ip || "unknown");
    if (rateLimited(aiKitchenAttempts, clientKey, 30, 60 * 60 * 1000)) return res.status(429).json({ success: false, message: "Kitchen briefing limit reached. Try again later." });
    const date = clean(req.body?.date || todayString(), 10); if (!isValidDate(date)) return res.status(400).json({ success: false, message: "Use a valid date." });
    const context = kitchenBriefing(date);
    const busiest = context.byTime.sort((a, b) => b.guests - a.guests)[0];
    const recommendations = [
        `Plan for ${context.confirmedGuests} confirmed covers (${context.totalGuests} non-cancelled reservations).`,
        `${context.actualOrders} live KOT${context.actualOrders === 1 ? "" : "s"} received across ${context.reservationsWithOrders} reservation${context.reservationsWithOrders === 1 ? "" : "s"}; expected demand still includes ${Math.max(0, context.reservations.length-context.reservationsWithOrders)} reservation${Math.max(0, context.reservations.length-context.reservationsWithOrders) === 1 ? "" : "s"} without an order.`,
        `KOT queue: ${context.kotStatusCounts.new} new, ${context.kotStatusCounts.accepted} accepted, ${context.kotStatusCounts.preparing} preparing, ${context.kotStatusCounts.ready} ready, ${context.kotStatusCounts.served} served.`,
        context.dishQuantities.length ? `Leading actual dish quantities: ${context.dishQuantities.slice(0,5).map(item => `${item.quantity}x ${item.name}`).join(", ")}.` : "No actual dish quantities have been submitted yet.",
        busiest ? `Prepare for the busiest current service window at ${busiest.time} (${busiest.guests} guests).` : "No service windows are currently booked.",
        context.lowStock.length ? `${context.lowStock.length} ingredient${context.lowStock.length === 1 ? " is" : "s are"} at or below minimum stock.` : "No active ingredients are below their minimum stock.",
        context.grocery.length ? `${context.grocery.length} grocery item${context.grocery.length === 1 ? " requires" : "s require"} follow-up.` : "No pending grocery items require follow-up."
    ];
    res.json({ success: true, assistant: { role: "Royal Table kitchen operations assistant", permittedData: ["reservations", "actual orders", "KOT statuses", "dish quantities", "active menu", "ingredients", "inventory", "grocery", "kitchen tasks"], safeguards: ["server-side context only", "rate limited", "read-only recommendations", "no direct destructive actions"], context, recommendations } });
});

app.get(
    "/",
    (req, res) => {

        res.json({

            success: true,

            message:
                "Royal Table backend is running!",

            version:
                "customer-preorder-20260829"

        });

    }
);

// ==================================================
// ADMIN LOGIN
// ==================================================

app.post(
    "/admin/login",
    (req, res) => {

        const clientKey =
            String(
                req.ip ||
                "unknown"
            );


        if (
            rateLimited(
                loginAttempts,
                clientKey,
                LOGIN_MAX_ATTEMPTS,
                LOGIN_WINDOW_MS
            )
        ) {

            return res.status(429).json({

                success: false,

                message:
                    "Too many login attempts. Please try again later."

            });

        }


        const username =
            clean(
                req.body?.username,
                100
            );


        const password =
            String(
                req.body?.password || ""
            );


        if (
            username !==
                ADMIN_USERNAME ||

            password !==
                ADMIN_PASSWORD
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid username or password."

            });

        }


        loginAttempts.delete(
            clientKey
        );


        const token =
            jwt.sign(

                {

                    username,

                    role:
                        "admin"

                },

                JWT_SECRET,

                {

                    expiresIn:
                        "8h",

                    issuer:
                        "royal-table",

                    audience:
                        "royal-table-admin"

                }

            );


        return res.json({

            success: true,

            message:
                "Login successful.",

            token

        });

    }
);

// ==================================================
// CREATE RESERVATION
// ==================================================

app.post(
    "/reservations",
    async (req, res) => {

        try {

            const clientKey =
                String(
                    req.ip ||
                    "unknown"
                );


            if (
                rateLimited(
                    reservationAttempts,
                    clientKey,
                    RESERVATION_MAX_ATTEMPTS,
                    RESERVATION_WINDOW_MS
                )
            ) {

                return res.status(429).json({

                    success: false,

                    message:
                        "Too many reservation attempts. Please wait and try again."

                });

            }


            const name =
                clean(
                    req.body?.name,
                    100
                );


            const email =
                clean(
                    req.body?.email,
                    150
                ).toLowerCase();


            const date =
                clean(
                    req.body?.date,
                    10
                );


            const time =
                clean(
                    req.body?.time,
                    5
                );


            const phone =
                clean(
                    req.body?.phone,
                    20
                );


            const specialRequest =
                clean(
                    req.body?.specialRequest,
                    1000
                );


            const guests =
                Number(
                    req.body?.guests
                );

            const requestedItems =
                req.body?.items;

            let checkedPreorder =
                null;

            if (requestedItems !== undefined && requestedItems !== null) {

                if (!Array.isArray(requestedItems)) {

                    return res.status(400).json({
                        success: false,
                        message: "Reservation items must be an array."
                    });

                }

                if (requestedItems.length > 0) {

                    checkedPreorder = validateOrderItems(requestedItems);

                    if (checkedPreorder.error) {

                        return res.status(400).json({
                            success: false,
                            message: checkedPreorder.error
                        });

                    }

                }

            }


            // REQUIRED FIELDS

            if (
                !name ||
                !email ||
                !date ||
                !time ||
                !phone ||
                !Number.isInteger(
                    guests
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Please fill in all required fields."

                });

            }


            // NAME

            if (
                !/^[A-Za-zÀ-ÖØ-öø-ÿ.' -]{2,100}$/
                    .test(
                        name
                    )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Please enter a valid name."

                });

            }


            // EMAIL

            if (
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                    .test(
                        email
                    )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Please enter a valid email address."

                });

            }


            // PHONE

            if (
                !/^[0-9]{10}$/
                    .test(
                        phone
                    )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Please enter a valid 10-digit phone number."

                });

            }


            // GUESTS

            if (
                guests < 1 ||
                guests > 20
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Guests must be between 1 and 20."

                });

            }


            // DATE

            if (
                !isValidDate(
                    date
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Please provide a valid reservation date."

                });

            }


            if (
                date <
                todayString()
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Reservation date cannot be in the past."

                });

            }


            // TIME

            if (
                !isValidTime(
                    time
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Please provide a valid reservation time."

                });

            }


            // DUPLICATE CHECK

            const duplicate =
                db
                    .prepare(
                        `

                        SELECT id

                        FROM reservations

                        WHERE date = ?

                        AND time = ?

                        AND status != 'Cancelled'

                        AND (

                            LOWER(email)
                                = LOWER(?)

                            OR phone = ?

                        )

                        LIMIT 1

                        `
                    )
                    .get(

                        date,

                        time,

                        email,

                        phone

                    );


            if (
                duplicate
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "You already have a reservation for this date and time."

                });

            }


            // CAPACITY

            const capacityResult =
                db
                    .prepare(
                        `

                        SELECT

                            COALESCE(
                                SUM(guests),
                                0
                            ) AS booked

                        FROM reservations

                        WHERE date = ?

                        AND time = ?

                        AND status != 'Cancelled'

                        `
                    )
                    .get(

                        date,

                        time

                    );


            const booked =
                Number(
                    capacityResult?.booked ||
                    0
                );


            const remaining =
                Math.max(

                    0,

                    RESTAURANT_CAPACITY -
                    booked

                );


            if (
                guests >
                remaining
            ) {

                return res.status(409).json({

                    success: false,

                    message:

                        remaining > 0

                            ?

                            `This time slot has only ${remaining} guest spaces remaining.`

                            :

                            "This time slot is fully booked.",

                    capacity: {

                        total:
                            RESTAURANT_CAPACITY,

                        booked,

                        remaining

                    }

                });

            }


            // INSERT

            let id;
            let preorderOrderId = null;

            db.transaction(() => {

                const result = db.prepare(`
                    INSERT INTO reservations
                    (name, email, date, time, guests, phone, specialRequest)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(
                    name,
                    email,
                    date,
                    time,
                    guests,
                    phone,
                    specialRequest || null
                );

                id = Number(result.lastInsertRowid);

                if (checkedPreorder) {

                    preorderOrderId = Number(db.prepare(`
                        INSERT INTO orders
                        (reservationId, orderNumber, status, notes, subtotal)
                        VALUES (?, 1, 'draft', ?, ?)
                    `).run(
                        id,
                        "Customer pre-order — review before sending to kitchen.",
                        checkedPreorder.subtotal
                    ).lastInsertRowid);

                    const insertItem = db.prepare(`
                        INSERT INTO order_items
                        (orderId, menuItemId, itemName, unitPrice, quantity, notes)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `);

                    for (const item of checkedPreorder.items) {
                        insertItem.run(
                            preorderOrderId,
                            item.menuItemId,
                            item.itemName,
                            item.unitPrice,
                            item.quantity,
                            null
                        );
                    }

                    syncReservationBill(id);

                }

            })();


            const newBooked =
                booked +
                guests;


            const newRemaining =
                Math.max(

                    0,

                    RESTAURANT_CAPACITY -
                    newBooked

                );


            const reservation = {

                id,

                name,

                email,

                date,

                time,

                guests,

                phone,

                specialRequest,

                preorder: preorderOrderId
                    ? orderWithItems(preorderOrderId)
                    : null,

                bookedGuests:
                    newBooked,

                remainingCapacity:
                    newRemaining

            };


            console.log("");

            console.log(
                "================================="
            );

            console.log(
                "NEW RESERVATION"
            );

            console.log(
                "================================="
            );

            console.log(
                "ID:",
                id
            );

            console.log(
                "Name:",
                name
            );

            console.log(
                "Date:",
                date
            );

            console.log(
                "Time:",
                time
            );

            console.log(
                "Guests:",
                guests
            );

            console.log(
                "================================="
            );

            console.log("");


            // RESPOND FIRST

            res.status(201).json({

                success: true,

                message:
                    "Reservation received successfully!",

                reservationId:
                    id,

                capacity: {

                    total:
                        RESTAURANT_CAPACITY,

                    booked:
                        newBooked,

                    remaining:
                        newRemaining

                },

                emailNotifications:
                    isEmailConfigured()
                        ? "queued"
                        : "disabled"

            });


            // SEND EMAILS IN BACKGROUND

            sendReservationEmails(
                reservation
            )
                .then(
                    result => {

                        console.log(

                            `Email delivery for reservation #${id}:`,

                            result

                        );

                    }
                )
                .catch(
                    error => {

                        console.error(

                            `Reservation email error #${id}:`,

                            error.message

                        );

                    }
                );

        } catch (
            error
        ) {

            console.error(
                "Error creating reservation:",
                error
            );


            if (
                !res.headersSent
            ) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Failed to create reservation."

                });

            }

        }

    }
);

// ==================================================
// CHECK CAPACITY
// ==================================================

app.get(
    "/reservations/capacity",
    (req, res) => {

        const date =
            clean(
                req.query.date,
                10
            );


        const time =
            clean(
                req.query.time,
                5
            );


        if (
            !isValidDate(date) ||
            !isValidTime(time)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Valid date and time are required."

            });

        }


        const result =
            db
                .prepare(
                    `

                    SELECT

                        COALESCE(
                            SUM(guests),
                            0
                        ) AS booked

                    FROM reservations

                    WHERE date = ?

                    AND time = ?

                    AND status != 'Cancelled'

                    `
                )
                .get(

                    date,

                    time

                );


        const booked =
            Number(
                result?.booked ||
                0
            );


        res.json({

            success: true,

            capacity: {

                total:
                    RESTAURANT_CAPACITY,

                booked,

                remaining:
                    Math.max(
                        0,
                        RESTAURANT_CAPACITY -
                        booked
                    )

            }

        });

    }
);

// ==================================================
// GET ALL RESERVATIONS
// ADMIN ONLY
// ==================================================

app.get(
    "/reservations",
    authenticateAdmin,
    (req, res) => {

        try {

            const reservations =
                db
                    .prepare(
                        `

                        SELECT *

                        FROM reservations

                        ORDER BY
                            date ASC,
                            time ASC,
                            createdAt DESC

                        `
                    )
                    .all();


            return res.json({

                success: true,

                reservations

            });

        } catch (
            error
        ) {

            console.error(
                "Error fetching reservations:",
                error.message
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to fetch reservations."

            });

        }

    }
);

// ==================================================
// ADMIN DASHBOARD
// ==================================================

app.get(
  "/admin/dashboard",
  (req, res) => {
        try {

            const today =
                todayString();


            const reservationStats =
                db
                    .prepare(
                        `

                        SELECT

                            COUNT(*)
                                AS total,

                            SUM(
                                CASE
                                    WHEN date = ?
                                    THEN 1
                                    ELSE 0
                                END
                            )
                                AS today,

                            SUM(
                                CASE
                                    WHEN date > ?
                                    AND status != 'Cancelled'
                                    THEN 1
                                    ELSE 0
                                END
                            )
                                AS upcoming,

                            SUM(
                                CASE
                                    WHEN date >= ?
                                    AND date < date(
                                        ?,
                                        '+7 days'
                                    )
                                    THEN 1
                                    ELSE 0
                                END
                            )
                                AS week,

                            SUM(
                                CASE
                                    WHEN substr(
                                        date,
                                        1,
                                        7
                                    )
                                    =
                                    substr(
                                        ?,
                                        1,
                                        7
                                    )
                                    THEN 1
                                    ELSE 0
                                END
                            )
                                AS month,

                            COALESCE(
                                SUM(
                                    CASE
                                        WHEN status != 'Cancelled'
                                        THEN guests
                                        ELSE 0
                                    END
                                ),
                                0
                            )
                                AS totalGuests,

                            COALESCE(
                                SUM(
                                    CASE
                                        WHEN date = ?
                                        AND status != 'Cancelled'
                                        THEN guests
                                        ELSE 0
                                    END
                                ),
                                0
                            )
                                AS todayGuests,

                            COALESCE(
                                SUM(
                                    CASE
                                        WHEN status != 'Cancelled'
                                        THEN billAmount
                                        ELSE 0
                                    END
                                ),
                                0
                            )
                                AS revenue,

                            COALESCE(
                                SUM(
                                    CASE
                                        WHEN date = ?
                                        AND status != 'Cancelled'
                                        THEN billAmount
                                        ELSE 0
                                    END
                                ),
                                0
                            )
                                AS todayRevenue

                        FROM reservations

                        `
                    )
                    .get(

                        today,

                        today,

                        today,

                        today,

                        today,

                        today,

                        today

                    );


            const statusRows =
                db
                    .prepare(
                        `

                        SELECT

                            status,

                            COUNT(*) AS count

                        FROM reservations

                        GROUP BY status

                        `
                    )
                    .all();


            const status = {

                New:
                    0,

                Confirmed:
                    0,

                Cancelled:
                    0,

                Completed:
                    0

            };


            for (
                const row of
                statusRows
            ) {

                if (
                    Object.prototype.hasOwnProperty
                        .call(
                            status,
                            row.status
                        )
                ) {

                    status[
                        row.status
                    ] =
                        Number(
                            row.count
                        );

                }

            }


            const average =
                db
                    .prepare(
                        `

                        SELECT

                            COALESCE(
                                AVG(
                                    NULLIF(
                                        billAmount,
                                        0
                                    )
                                ),
                                0
                            )
                            AS averageBill

                        FROM reservations

                        WHERE status != 'Cancelled'

                        `
                    )
                    .get();


            const recentReservations =
                db
                    .prepare(
                        `

                        SELECT *

                        FROM reservations

                        ORDER BY
                            createdAt DESC

                        LIMIT 10

                        `
                    )
                    .all();


            return res.json({

                success: true,

                dashboard: {

                    today,

                    reservations: {

                        total:
                            Number(
                                reservationStats.total ||
                                0
                            ),

                        today:
                            Number(
                                reservationStats.today ||
                                0
                            ),

                        upcoming:
                            Number(
                                reservationStats.upcoming ||
                                0
                            ),

                        week:
                            Number(
                                reservationStats.week ||
                                0
                            ),

                        month:
                            Number(
                                reservationStats.month ||
                                0
                            )

                    },

                    guests: {

                        total:
                            Number(
                                reservationStats.totalGuests ||
                                0
                            ),

                        today:
                            Number(
                                reservationStats.todayGuests ||
                                0
                            )

                    },

                    status,

                    revenue: {

                        total:
                            Number(
                                reservationStats.revenue ||
                                0
                            ),

                        today:
                            Number(
                                reservationStats.todayRevenue ||
                                0
                            ),

                        averageBill:
                            Number(
                                average.averageBill ||
                                0
                            )

                    },

                    recentReservations

                }

            });

        } catch (
            error
        ) {

            console.error(
                "Dashboard error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to load dashboard."

            });

        }

    }
);

// ==================================================
// UPDATE RESERVATION STATUS
// ==================================================

app.put(
    "/reservations/:id/status",
    authenticateAdmin,
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const status =
                clean(
                    req.body?.status,
                    20
                );


            const allowedStatuses = [

                "New",

                "Confirmed",

                "Cancelled",

                "Completed"

            ];


            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid reservation ID."

                });

            }


            if (
                !allowedStatuses.includes(
                    status
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid reservation status."

                });

            }


            const result =
                db
                    .prepare(
                        `

                        UPDATE reservations

                        SET

                            status = ?,

                            updatedAt =
                                CURRENT_TIMESTAMP

                        WHERE id = ?

                        `
                    )
                    .run(

                        status,

                        id

                    );


            if (
                result.changes === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Reservation not found."

                });

            }


            return res.json({

                success: true,

                message:
                    "Reservation status updated successfully."

            });

        } catch (
            error
        ) {

            console.error(
                "Status update error:",
                error.message
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to update reservation status."

            });

        }

    }
);

// ==================================================
// UPDATE BILL
// ==================================================

app.put(
    "/reservations/:id/bill",
    authenticateAdmin,
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const amount =
                Number(
                    req.body?.billAmount
                );


            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid reservation ID."

                });

            }


            if (
                !Number.isFinite(amount) ||
                amount < 0 ||
                amount > 100000000
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Bill amount must be between 0 and 100000000."

                });

            }


            const roundedAmount =
                Math.round(
                    amount * 100
                ) / 100;

            const itemizedOrders = db.prepare("SELECT COUNT(*) AS count FROM orders WHERE reservationId = ?").get(id).count;
            if (itemizedOrders > 0) {
                return res.status(409).json({
                    success: false,
                    message: "This reservation has itemized orders. Its bill is calculated from server-priced order items."
                });
            }


            const result =
                db
                    .prepare(
                        `

                        UPDATE reservations

                        SET

                            billAmount = ?,

                            updatedAt =
                                CURRENT_TIMESTAMP

                        WHERE id = ?

                        `
                    )
                    .run(

                        roundedAmount,

                        id

                    );


            if (
                result.changes === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Reservation not found."

                });

            }


            return res.json({

                success: true,

                message:
                    "Bill amount updated successfully.",

                billAmount:
                    roundedAmount

            });

        } catch (
            error
        ) {

            console.error(
                "Bill update error:",
                error.message
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to update bill amount."

            });

        }

    }
);

// ==================================================
// DELETE RESERVATION
// ==================================================

app.delete(
    "/reservations/:id",
    authenticateAdmin,
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid reservation ID."

                });

            }


            const result =
                db
                    .prepare(
                        `

                        DELETE FROM reservations

                        WHERE id = ?

                        `
                    )
                    .run(
                        id
                    );


            if (
                result.changes === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Reservation not found."

                });

            }


            return res.json({

                success: true,

                message:
                    "Reservation deleted successfully."

            });

        } catch (
            error
        ) {

            console.error(
                "Delete reservation error:",
                error.message
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to delete reservation."

            });

        }

    }
);

// ==================================================
// PUBLIC MENU
// ==================================================

app.get(
    "/menu",
    (req, res) => {

        try {

            const menu =
                db
                    .prepare(
                        `

                        SELECT *

                        FROM menu_items

                        WHERE available = 1

                        ORDER BY
                            category ASC,
                            name ASC

                        `
                    )
                    .all();


            return res.json({

                success: true,

                menu

            });

        } catch (
            error
        ) {

            console.error(
                "Public menu error:",
                error.message
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to fetch menu."

            });

        }

    }
);

// ==================================================
// ADMIN MENU
// ==================================================

app.get(
    "/admin/menu",
    authenticateAdmin,
    (req, res) => {

        try {

            const menuItems =
                db
                    .prepare(
                        `

                        SELECT *

                        FROM menu_items

                        ORDER BY
                            category ASC,
                            name ASC

                        `
                    )
                    .all();


            return res.json({

                success: true,

                menuItems

            });

        } catch (
            error
        ) {

            console.error(
                "Admin menu error:",
                error.message
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to fetch menu."

            });

        }

    }
);

// ==================================================
// CREATE MENU ITEM
// ==================================================

app.post(
    "/menu",
    authenticateAdmin,
    (req, res) => {

        try {

            const name =
                clean(
                    req.body?.name,
                    150
                );


            const category =
                clean(
                    req.body?.category,
                    80
                );


            const description =
                clean(
                    req.body?.description,
                    500
                );


            const image =
                clean(
                    req.body?.image,
                    1000
                );


            const price =
                Number(
                    req.body?.price
                );


            const available =
                req.body?.available === false
                    ? 0
                    : 1;


            if (
                !name ||
                !category
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Dish name and category are required."

                });

            }


            if (
                !Number.isFinite(price) ||
                price < 0 ||
                price > 10000000
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Price must be a valid number."

                });

            }


            if (
                image &&
                !/^https?:\/\/.+/i.test(
                    image
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Image must be an HTTP or HTTPS URL."

                });

            }


            const roundedPrice =
                Math.round(
                    price * 100
                ) / 100;


            const result =
                db
                    .prepare(
                        `

                        INSERT INTO menu_items

                        (

                            name,

                            category,

                            description,

                            price,

                            image,

                            available

                        )

                        VALUES (?, ?, ?, ?, ?, ?)

                        `
                    )
                    .run(

                        name,

                        category,

                        description ||
                            null,

                        roundedPrice,

                        image ||
                            null,

                        available

                    );


            const menuItem =
                db
                    .prepare(
                        `

                        SELECT *

                        FROM menu_items

                        WHERE id = ?

                        `
                    )
                    .get(
                        result.lastInsertRowid
                    );


            return res.status(201).json({

                success: true,

                message:
                    "Menu item added successfully.",

                menuItem

            });

        } catch (
            error
        ) {

            console.error(
                "Create menu error:",
                error.message
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to add menu item."

            });

        }

    }
);

// ==================================================
// UPDATE MENU ITEM
// ==================================================

app.put(
    "/menu/:id",
    authenticateAdmin,
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const name =
                clean(
                    req.body?.name,
                    150
                );


            const category =
                clean(
                    req.body?.category,
                    80
                );


            const description =
                clean(
                    req.body?.description,
                    500
                );


            const image =
                clean(
                    req.body?.image,
                    1000
                );


            const price =
                Number(
                    req.body?.price
                );


            const available =
                req.body?.available === false
                    ? 0
                    : 1;


            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid menu item ID."

                });

            }


            if (
                !name ||
                !category
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Dish name and category are required."

                });

            }


            if (
                !Number.isFinite(price) ||
                price < 0 ||
                price > 10000000
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Price must be a valid number."

                });

            }


            if (
                image &&
                !/^https?:\/\/.+/i.test(
                    image
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Image must be an HTTP or HTTPS URL."

                });

            }


            const roundedPrice =
                Math.round(
                    price * 100
                ) / 100;


            const result =
                db
                    .prepare(
                        `

                        UPDATE menu_items

                        SET

                            name = ?,

                            category = ?,

                            description = ?,

                            price = ?,

                            image = ?,

                            available = ?,

                            updatedAt =
                                CURRENT_TIMESTAMP

                        WHERE id = ?

                        `
                    )
                    .run(

                        name,

                        category,

                        description ||
                            null,

                        roundedPrice,

                        image ||
                            null,

                        available,

                        id

                    );


            if (
                result.changes === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Menu item not found."

                });

            }


            const menuItem =
                db
                    .prepare(
                        `

                        SELECT *

                        FROM menu_items

                        WHERE id = ?

                        `
                    )
                    .get(
                        id
                    );


            return res.json({

                success: true,

                message:
                    "Menu item updated successfully.",

                menuItem

            });

        } catch (
            error
        ) {

            console.error(
                "Update menu error:",
                error.message
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to update menu item."

            });

        }

    }
);

// ==================================================
// UPDATE MENU AVAILABILITY
// ==================================================

app.put(
    "/menu/:id/availability",
    authenticateAdmin,
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const available =
                req.body?.available;


            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid menu item ID."

                });

            }


            if (
                typeof available !==
                "boolean"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Available must be true or false."

                });

            }


            const result =
                db
                    .prepare(
                        `

                        UPDATE menu_items

                        SET

                            available = ?,

                            updatedAt =
                                CURRENT_TIMESTAMP

                        WHERE id = ?

                        `
                    )
                    .run(

                        available
                            ? 1
                            : 0,

                        id

                    );


            if (
                result.changes === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Menu item not found."

                });

            }


            return res.json({

                success: true,

                message:

                    available

                        ?

                        "Menu item marked as available."

                        :

                        "Menu item marked as unavailable."

            });

        } catch (
            error
        ) {

            console.error(
                "Availability update error:",
                error.message
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to update menu availability."

            });

        }

    }
);

// ==================================================
// DELETE MENU ITEM
// ==================================================

app.delete(
    "/menu/:id",
    authenticateAdmin,
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid menu item ID."

                });

            }


            const result =
                db
                    .prepare(
                        `

                        DELETE FROM menu_items

                        WHERE id = ?

                        `
                    )
                    .run(
                        id
                    );


            if (
                result.changes === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Menu item not found."

                });

            }


            return res.json({

                success: true,

                message:
                    "Menu item deleted successfully."

            });

        } catch (
            error
        ) {

            console.error(
                "Delete menu error:",
                error.message
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to delete menu item."

            });

        }

    }
);

// ==================================================
// 404 HANDLER
// ==================================================

app.use(
    (req, res) => {

        return res.status(404).json({

            success: false,

            message:
                "API endpoint not found."

        });

    }
);

// ==================================================
// GLOBAL ERROR HANDLER
// ==================================================

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "Unhandled server error:",
            error
        );


        if (
            res.headersSent
        ) {

            return next(
                error
            );

        }


        return res.status(500).json({

            success: false,

            message:
                "Internal server error."

        });

    }
);

// ==================================================
// PROCESS ERROR HANDLERS
// ==================================================

process.on(
    "uncaughtException",
    error => {

        console.error(
            "UNCAUGHT EXCEPTION:",
            error
        );

    }
);


process.on(
    "unhandledRejection",
    error => {

        console.error(
            "UNHANDLED PROMISE REJECTION:",
            error
        );

    }
);

// ==================================================
// START SERVER
// ==================================================

const server =
    app.listen(
        PORT,
        () => {

            console.log("");

            console.log(
                "========================================"
            );

            console.log(
                "ROYAL TABLE RESTAURANT SERVER"
            );

            console.log(
                "========================================"
            );

            console.log(
                `Server running on http://localhost:${PORT}`
            );

            console.log(
                `Database: ${DB_PATH}`
            );

            console.log(
                `Reservation capacity: ${RESTAURANT_CAPACITY} guests per time slot`
            );

            console.log(
                `Reservation email: ${
                    isEmailConfigured()
                        ? "Configured"
                        : "Disabled"
                }`
            );

            console.log(
                "Admin authentication: JWT"
            );

            console.log(
                "========================================"
            );

            console.log("");

        }
    );

// ==================================================
// GRACEFUL SHUTDOWN
// ==================================================

function gracefulShutdown(
    signal
) {

    console.log("");

    console.log(
        `${signal} received. Shutting down server...`
    );


    server.close(
        () => {

            try {

                db.close();

            } catch (
                error
            ) {

                console.error(
                    "Database close error:",
                    error.message
                );

            }


            console.log(
                "Server shut down successfully."
            );


            process.exit(0);

        }
    );


    setTimeout(
        () => {

            console.error(
                "Forced shutdown."
            );

            process.exit(1);

        },
        10000
    ).unref();

}


process.on(
    "SIGINT",
    () => {

        gracefulShutdown(
            "SIGINT"
        );

    }
);


process.on(
    "SIGTERM",
    () => {

        gracefulShutdown(
            "SIGTERM"
        );

    }
);
