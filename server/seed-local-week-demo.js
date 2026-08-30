const path = require("path");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const dbPath = process.env.DB_PATH || path.join(__dirname, "restaurant.db");
const adminPassword = String(process.env.ADMIN_PASSWORD || "");
if (adminPassword.length < 8) throw new Error("ADMIN_PASSWORD must be configured before seeding the local Chef account.");

const resolvedDbPath = path.resolve(dbPath);
const productionDataRoot = `${path.resolve("/var/data")}${path.sep}`;
if (
    process.env.NODE_ENV === "production" ||
    process.env.RENDER ||
    resolvedDbPath.startsWith(productionDataRoot)
) {
    throw new Error("The weekly demo seed is local-only and cannot run against production data.");
}

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

const serviceDays = [
    ["2026-08-30", "18:00", "Aarav Mehta", 2, "Confirmed", "Anniversary tasting menu"],
    ["2026-08-31", "18:30", "Diya Kapoor", 4, "New", "Window table requested"],
    ["2026-09-01", "19:00", "Kabir Sharma", 3, "Confirmed", "One guest prefers mild spice"],
    ["2026-09-02", "19:30", "Mira Nair", 6, "Confirmed", "Birthday dessert presentation"],
    ["2026-09-03", "20:00", "Rohan Iyer", 5, "New", "Private family dinner"],
    ["2026-09-04", "20:30", "Sara Khanna", 8, "Confirmed", "Corporate host requires prompt service"],
    ["2026-09-05", "21:00", "Vihaan Rao", 4, "Completed", "Chef tasting feedback recorded"]
];
const orderStates = ["served", "ready", "preparing", "accepted", "new", "draft", "served"];
const paymentStates = ["paid", "partially_paid", "unpaid", "unpaid", "unpaid", "unpaid", "paid"];

const menuItems = db.prepare("SELECT id, name, price FROM menu_items WHERE available=1 ORDER BY id LIMIT 10").all();
if (menuItems.length < 3) throw new Error("At least three active menu items are required for the weekly demo.");

const seed = db.transaction(() => {
    const passwordHash = bcrypt.hashSync(adminPassword, 12);
    const existingChef = db.prepare("SELECT id FROM staff_users WHERE LOWER(username)='chef'").get();
    let chefId;
    if (existingChef) {
        chefId = existingChef.id;
        db.prepare("UPDATE staff_users SET name='Royal Table Demo Chef', passwordHash=?, role='chef', active=1, updatedAt=CURRENT_TIMESTAMP WHERE id=?").run(passwordHash, chefId);
    } else {
        chefId = Number(db.prepare("INSERT INTO staff_users (name,username,passwordHash,role,active) VALUES ('Royal Table Demo Chef','chef',?,'chef',1)").run(passwordHash).lastInsertRowid);
    }

    db.prepare("DELETE FROM kitchen_tasks WHERE title LIKE 'Weekly service:%'").run();
    db.prepare("DELETE FROM grocery_items WHERE name LIKE 'Weekly demo:%'").run();
    db.prepare("DELETE FROM ingredients WHERE name LIKE 'Weekly demo:%'").run();

    const ingredientRows = [
        ["Weekly demo: Tandoori chicken", "Protein", "kg", 8, 12, "Royal Foods"],
        ["Weekly demo: Tomatoes", "Produce", "kg", 18, 8, "Fresh Market"],
        ["Weekly demo: Cream", "Dairy", "litres", 3, 6, "City Dairy"],
        ["Weekly demo: Basmati rice", "Dry goods", "kg", 22, 10, "Grain House"]
    ];
    const insertIngredient = db.prepare("INSERT INTO ingredients (name,category,unit,currentQuantity,minimumQuantity,supplier) VALUES (?,?,?,?,?,?)");
    const ingredientIds = ingredientRows.map(row => Number(insertIngredient.run(...row).lastInsertRowid));
    db.prepare("INSERT INTO grocery_items (ingredientId,name,requiredQuantity,currentQuantity,unit,priority,status,createdByStaffId) VALUES (?,?,?,?,?,'urgent','pending',?)")
        .run(ingredientIds[0], "Weekly demo: Chicken replenishment", 16, 8, "kg", chefId);
    db.prepare("INSERT INTO grocery_items (ingredientId,name,requiredQuantity,currentQuantity,unit,priority,status,createdByStaffId) VALUES (?,?,?,?,?,'normal','pending',?)")
        .run(ingredientIds[2], "Weekly demo: Fresh cream delivery", 8, 3, "litres", chefId);

    const insertReservation = db.prepare("INSERT INTO reservations (name,email,date,time,guests,phone,specialRequest,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)");
    const updateReservation = db.prepare("UPDATE reservations SET name=?,date=?,time=?,guests=?,phone=?,specialRequest=?,status=?,createdAt=?,updatedAt=? WHERE id=?");
    const findReservation = db.prepare("SELECT id FROM reservations WHERE email=?");
    const clearOrders = db.prepare("DELETE FROM orders WHERE reservationId=?");
    const insertOrder = db.prepare("INSERT INTO orders (reservationId,orderNumber,status,notes,subtotal,discountPercent,taxRate,serviceChargeRate,amountPaid,paymentStatus,paymentMethod,paidAt,createdByStaffId,createdAt,updatedAt) VALUES (?,1,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    const insertOrderItem = db.prepare("INSERT INTO order_items (orderId,menuItemId,itemName,unitPrice,quantity,notes) VALUES (?,?,?,?,?,?)");
    const insertTask = db.prepare("INSERT INTO kitchen_tasks (title,details,serviceDate,status,createdByStaffId) VALUES (?,?,?,?,?)");

    serviceDays.forEach((day, index) => {
        const [date,time,name,guests,status,request] = day;
        const email = `weekly-service-${index + 1}@royaltable.demo`;
        const phone = `90000000${String(index + 11).slice(-2)}`;
        const createdAt = `2026-08-${String(30-index).padStart(2,"0")} ${String(9+index).padStart(2,"0")}:00:00`;
        const existing = findReservation.get(email);
        let reservationId;
        if (existing) {
            reservationId = existing.id;
            updateReservation.run(name,date,time,guests,phone,request,status,createdAt,createdAt,reservationId);
            clearOrders.run(reservationId);
        } else {
            reservationId = Number(insertReservation.run(name,email,date,time,guests,phone,request,status,createdAt,createdAt).lastInsertRowid);
        }

        const first = menuItems[index % menuItems.length];
        const second = menuItems[(index + 3) % menuItems.length];
        const firstQty = 1 + (index % 3);
        const secondQty = 2;
        const subtotal = Number((first.price * firstQty + second.price * secondQty).toFixed(2));
        const discount = index === 0 ? 5 : 0;
        const tax = 5;
        const service = 10;
        const grandTotal = Number(((subtotal * (1-discount/100)) * (1+(tax+service)/100)).toFixed(2));
        const paymentStatus = paymentStates[index];
        const amountPaid = paymentStatus === "paid" ? grandTotal : paymentStatus === "partially_paid" ? Number((grandTotal/2).toFixed(2)) : 0;
        const method = paymentStatus === "paid" ? "upi" : paymentStatus === "partially_paid" ? "card" : null;
        const orderId = Number(insertOrder.run(reservationId,orderStates[index],"Customer pre-order — weekly operations demo.",subtotal,discount,tax,service,amountPaid,paymentStatus,method,amountPaid ? createdAt : null,chefId,createdAt,createdAt).lastInsertRowid);
        insertOrderItem.run(orderId,first.id,first.name,first.price,firstQty,"Weekly demo course");
        insertOrderItem.run(orderId,second.id,second.name,second.price,secondQty,null);
        db.prepare("UPDATE reservations SET billAmount=? WHERE id=?").run(grandTotal,reservationId);
        insertTask.run(`Weekly service: ${name}`,request,date,index < 2 ? "complete" : "pending",chefId);
    });
});

seed();
console.log(JSON.stringify({
    database: dbPath,
    chefAccount: "active",
    chefUsername: "chef",
    chefPassword: "same-as-current-admin-password",
    reservations: serviceDays.length,
    orders: serviceDays.length,
    ingredients: 4,
    groceryItems: 2,
    kitchenTasks: serviceDays.length,
    emailSent: 0
}, null, 2));
db.close();
