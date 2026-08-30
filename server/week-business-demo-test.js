const path = require("path");
const os = require("os");

process.env.ADMIN_PASSWORD = "local-week-demo-password";
process.env.JWT_SECRET = "local-week-demo-secret-that-is-at-least-thirty-two-characters";
process.env.DB_PATH = path.join(os.tmpdir(), `royal-table-week-demo-${Date.now()}.db`);
process.env.PORT = process.env.PORT || "5054";
process.env.GMAIL_USER = "";
process.env.GMAIL_APP_PASSWORD = "";
process.env.RESERVATION_MAX_ATTEMPTS = "20";
require("./server");

const base = `http://127.0.0.1:${process.env.PORT}`;
const dates = ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"];
const guests = [2, 4, 3, 6, 5, 8, 4];
const times = ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"];
const guestNames = ["Aarav Mehta", "Diya Kapoor", "Kabir Sharma", "Mira Nair", "Rohan Iyer", "Sara Khanna", "Vihaan Rao"];

async function request(route, options = {}) {
    const response = await fetch(base + route, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
        }
    });
    return { status: response.status, body: await response.json() };
}

function ok(value, message) {
    if (!value) throw new Error(message);
}

async function run() {
    const login = await request("/admin/login", { method: "POST", body: JSON.stringify({ username: "admin", password: process.env.ADMIN_PASSWORD }) });
    const admin = login.body.token;
    ok(login.status === 200 && admin, "week demo admin login failed");

    const chefCreated = await request("/staff", { method: "POST", token: admin, body: JSON.stringify({ name: "Weekly Demo Chef", username: "WeeklyChef", password: "weekly-chef-password", role: "chef" }) });
    ok(chefCreated.status === 201 && chefCreated.body.staff.username === "weeklychef", "chef username normalization failed");
    const chefLogin = await request("/staff/login", { method: "POST", body: JSON.stringify({ username: "WEEKLYCHEF", password: "weekly-chef-password", portal: "chef" }) });
    const chef = chefLogin.body.token;
    ok(chefLogin.status === 200 && chef, "case-insensitive Chef login failed");

    const menuPayloads = [
        { name: "Weekly Tandoori Chicken", category: "Tandoor", price: 520 },
        { name: "Weekly Butter Chicken", category: "Main Course", price: 460 },
        { name: "Weekly Garlic Naan", category: "Breads", price: 95 }
    ];
    const menuIds = [];
    for (const payload of menuPayloads) {
        const result = await request("/menu", { method: "POST", token: admin, body: JSON.stringify({ ...payload, available: true }) });
        ok(result.status === 201, `menu setup failed for ${payload.name}`);
        menuIds.push(result.body.menuItem.id);
    }

    const ingredients = [
        { name: "Weekly Chicken", category: "Protein", unit: "kg", currentQuantity: 8, minimumQuantity: 10 },
        { name: "Weekly Tomatoes", category: "Produce", unit: "kg", currentQuantity: 18, minimumQuantity: 8 },
        { name: "Weekly Cream", category: "Dairy", unit: "litres", currentQuantity: 3, minimumQuantity: 6 }
    ];
    for (const ingredient of ingredients) {
        ok((await request("/ingredients", { method: "POST", token: chef, body: JSON.stringify(ingredient) })).status === 201, "weekly inventory setup failed");
    }
    ok((await request("/grocery", { method: "POST", token: chef, body: JSON.stringify({ name: "Weekly Chicken Delivery", unit: "kg", requiredQuantity: 12, currentQuantity: 8, priority: "urgent" }) })).status === 201, "weekly grocery setup failed");

    const reservationIds = [];
    const orderIds = [];
    for (let index = 0; index < dates.length; index += 1) {
        const reservation = await request("/reservations", {
            method: "POST",
            body: JSON.stringify({
                name: guestNames[index],
                email: `week-demo-${index + 1}@example.com`,
                date: dates[index],
                time: times[index],
                guests: guests[index],
                phone: `98765432${String(index + 10).slice(-2)}`,
                specialRequest: index % 2 ? "Anniversary table" : "Chef tasting preference",
                items: [
                    { menuItemId: menuIds[index % menuIds.length], quantity: 1 + (index % 3) },
                    { menuItemId: menuIds[2], quantity: 2 }
                ]
            })
        });
        ok(reservation.status === 201, `reservation failed for day ${index + 1}: ${reservation.body.message || reservation.status}`);
        reservationIds.push(reservation.body.reservationId);
        const orders = await request(`/reservations/${reservation.body.reservationId}/orders`, { token: admin });
        ok(orders.body.orders.length === 1 && orders.body.orders[0].status === "draft", `customer pre-order missing for day ${index + 1}`);
        orderIds.push(orders.body.orders[0].id);
        await request(`/reservations/${reservation.body.reservationId}/status`, { method: "PUT", token: admin, body: JSON.stringify({ status: "Confirmed" }) });
        await request("/kitchen/tasks", { method: "POST", token: chef, body: JSON.stringify({ title: `Prepare service mise en place ${index + 1}`, serviceDate: dates[index] }) });
    }

    const progressions = [
        ["accepted", "preparing", "ready", "served"],
        ["accepted", "preparing", "ready"],
        ["accepted", "preparing"],
        ["accepted"],
        [],
        null,
        null
    ];
    for (let index = 0; index < progressions.length; index += 1) {
        if (progressions[index] === null) continue;
        const submitted = await request(`/orders/${orderIds[index]}/submit`, { method: "POST", token: admin, body: "{}" });
        ok(submitted.status === 200, `KOT submission failed for day ${index + 1}`);
        for (const status of progressions[index]) {
            ok((await request(`/kitchen/orders/${orderIds[index]}/status`, { method: "PUT", token: chef, body: JSON.stringify({ status }) })).status === 200, `KOT ${status} failed for day ${index + 1}`);
        }
    }

    const firstOrder = (await request(`/reservations/${reservationIds[0]}/orders`, { token: admin })).body.orders[0];
    ok((await request(`/orders/${firstOrder.id}/billing`, { method: "PUT", token: admin, body: JSON.stringify({ discountPercent: 5, taxRate: 5, serviceChargeRate: 10 }) })).status === 200, "weekly billing adjustment failed");
    const billedFirst = (await request(`/reservations/${reservationIds[0]}/orders`, { token: admin })).body.orders[0];
    ok((await request(`/orders/${billedFirst.id}/payment`, { method: "PUT", token: admin, body: JSON.stringify({ amountPaid: billedFirst.grandTotal, paymentMethod: "upi" }) })).status === 200, "weekly full payment failed");
    const secondOrder = (await request(`/reservations/${reservationIds[1]}/orders`, { token: admin })).body.orders[0];
    ok((await request(`/orders/${secondOrder.id}/payment`, { method: "PUT", token: admin, body: JSON.stringify({ amountPaid: Math.floor(secondOrder.grandTotal / 2), paymentMethod: "card" }) })).status === 200, "weekly partial payment failed");

    const ledger = await request("/orders", { token: admin });
    const reservations = await request("/reservations", { token: admin });
    ok(ledger.status === 200 && ledger.body.orders.length === 7, "seven-day order ledger failed");
    ok(reservations.body.reservations.length === 7 && reservations.body.reservations.every(item => item.orderCount === 1), "reservation order summaries failed");
    for (const date of dates) {
        const dashboard = await request(`/chef/dashboard?date=${date}`, { token: chef });
        ok(dashboard.status === 200 && dashboard.body.dashboard.reservations.length === 1, `Chef monitor failed for ${date}`);
        const briefing = await request("/ai/kitchen/briefing", { method: "POST", token: chef, body: JSON.stringify({ date }) });
        ok(briefing.status === 200 && briefing.body.assistant.recommendations.length > 0, `AI briefing failed for ${date}`);
    }

    const summary = {
        days: 7,
        reservations: reservations.body.reservations.length,
        orders: ledger.body.orders.length,
        orderStatuses: ledger.body.orders.reduce((counts, order) => ({ ...counts, [order.status]: (counts[order.status] || 0) + 1 }), {}),
        paymentStatuses: ledger.body.orders.reduce((counts, order) => ({ ...counts, [order.paymentStatus]: (counts[order.paymentStatus] || 0) + 1 }), {}),
        ingredients: ingredients.length,
        groceryItems: 1,
        kitchenTasks: 7,
        chefLogin: "active-case-insensitive-pass",
        productionPollution: 0
    };
    console.log("Seven-day isolated restaurant business demo: PASS");
    console.log(JSON.stringify(summary, null, 2));
    if (process.env.WEEK_DEMO_KEEP_ALIVE !== "1") process.exit(0);
}

setTimeout(() => run().catch(error => { console.error(error); process.exit(1); }), 300);
