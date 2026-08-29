const path = require("path");
const os = require("os");

process.env.ADMIN_PASSWORD = "local-test-password";
process.env.JWT_SECRET = "local-test-secret-that-is-at-least-thirty-two-characters";
process.env.DB_PATH = path.join(os.tmpdir(), `royal-table-day18-${Date.now()}.db`);
process.env.PORT = "5052";
require("./server");

const base = "http://127.0.0.1:5052";
async function request(route, options = {}) {
    const response = await fetch(base + route, { ...options, headers: { "Content-Type": "application/json", ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) } });
    return { status: response.status, body: await response.json() };
}
function assert(condition, message) { if (!condition) throw new Error(message); }

async function run() {
    const login = await request("/admin/login", { method: "POST", body: JSON.stringify({ username: "admin", password: process.env.ADMIN_PASSWORD }) });
    const admin = login.body.token;
    assert(login.status === 200 && admin, "admin login failed");

    const chefCreated = await request("/staff", { method: "POST", token: admin, body: JSON.stringify({ name: "Day 18 Chef", username: "day18chef", password: "secure-chef-password", role: "chef" }) });
    const chefLogin = await request("/staff/login", { method: "POST", body: JSON.stringify({ username: "day18chef", password: "secure-chef-password" }) });
    const chef = chefLogin.body.token;
    assert(chefCreated.status === 201 && chef, "safe chef setup/login failed");

    const menu = await request("/menu", { method: "POST", token: admin, body: JSON.stringify({ name: "Day 18 Test Curry", category: "Main", price: 425.5, available: true }) });
    const menuItemId = menu.body.menuItem.id;
    const reservation = await request("/reservations", { method: "POST", body: JSON.stringify({ name: "Day Eighteen Guest", email: "day18@example.com", date: "2026-09-01", time: "19:00", guests: 4, phone: "9876543210", specialRequest: "Window table" }) });
    const reservationId = reservation.body.reservationId;
    assert(reservation.status === 201 && reservationId, "reservation creation failed");

    assert((await request(`/reservations/${reservationId}/orders`)).status === 401, "unauthenticated orders were exposed");
    assert([401, 403].includes((await request(`/reservations/${reservationId}/orders`, { method: "POST", token: chef, body: JSON.stringify({ items: [{ menuItemId, quantity: 1 }] }) })).status), "chef created an admin order");
    assert((await request(`/reservations/${reservationId}/orders`, { method: "POST", token: admin, body: JSON.stringify({ items: [{ menuItemId, quantity: 0 }] }) })).status === 400, "invalid quantity accepted");

    const first = await request(`/reservations/${reservationId}/orders`, { method: "POST", token: admin, body: JSON.stringify({ items: [{ menuItemId, quantity: 2, unitPrice: 1, notes: "Less spicy" }], notes: "Course one" }) });
    assert(first.status === 201 && first.body.order.subtotal === 851, "server-authoritative subtotal failed");
    assert(first.body.order.items[0].unitPrice === 425.5, "client price overrode menu price");
    const second = await request(`/reservations/${reservationId}/orders`, { method: "POST", token: admin, body: JSON.stringify({ items: [{ menuItemId, quantity: 1 }] }) });
    assert(second.body.order.orderNumber === 2, "multiple orders per reservation failed");
    const edited = await request(`/orders/${second.body.order.id}`, { method: "PUT", token: admin, body: JSON.stringify({ items: [{ menuItemId, quantity: 2, notes: "Second course" }] }) });
    assert(edited.body.order.subtotal === 851 && edited.body.order.items[0].notes === "Second course", "order editing failed");
    assert((await request(`/reservations/${reservationId}/bill`, { method: "PUT", token: admin, body: JSON.stringify({ billAmount: 1 }) })).status === 409, "manual bill overrode itemized orders");

    const firstId = first.body.order.id;
    assert((await request(`/orders/${firstId}/submit`, { method: "POST", token: admin, body: "{}" })).body.order.status === "new", "KOT submission failed");
    assert((await request(`/kitchen/orders/${firstId}/status`, { method: "PUT", token: chef, body: JSON.stringify({ status: "ready" }) })).status === 409, "KOT status skip accepted");
    for (const status of ["accepted", "preparing", "ready", "served"]) {
        const moved = await request(`/kitchen/orders/${firstId}/status`, { method: "PUT", token: chef, body: JSON.stringify({ status }) });
        assert(moved.status === 200 && moved.body.order.status === status, `KOT ${status} failed`);
    }
    const kitchen = await request("/kitchen/orders?date=2026-09-01", { token: chef });
    assert(kitchen.status === 200 && kitchen.body.orders.length === 1, "Chef KOT listing failed");

    const adjusted = await request(`/orders/${firstId}/billing`, { method: "PUT", token: admin, body: JSON.stringify({ discountPercent: 10, taxRate: 5, serviceChargeRate: 10, grandTotal: 1 }) });
    assert(adjusted.status === 200 && adjusted.body.order.discountAmount === 85.1 && adjusted.body.order.grandTotal === 880.79, "server-calculated billing adjustments failed");
    assert((await request(`/orders/${firstId}/billing`, { method: "PUT", token: admin, body: JSON.stringify({ discountPercent: -1, taxRate: 5, serviceChargeRate: 10 }) })).status === 400, "invalid billing rate accepted");
    assert((await request(`/orders/${firstId}/payment`, { method: "PUT", token: admin, body: JSON.stringify({ amountPaid: 9999, paymentMethod: "upi" }) })).status === 400, "overpayment accepted");
    const partial = await request(`/orders/${firstId}/payment`, { method: "PUT", token: admin, body: JSON.stringify({ amountPaid: 400.25, paymentMethod: "upi", paymentStatus: "paid" }) });
    assert(partial.body.order.paymentStatus === "partially_paid" && partial.body.order.amountPaid === 400.25 && partial.body.order.remainingBalance === 480.54, "partial payment lifecycle failed");
    const paid = await request(`/orders/${firstId}/payment`, { method: "PUT", token: admin, body: JSON.stringify({ amountPaid: 880.79, paymentMethod: "upi" }) });
    assert(paid.body.order.paymentStatus === "paid" && paid.body.order.paymentMethod === "upi" && paid.body.order.paidAt, "full payment recording failed");
    const all = await request(`/reservations/${reservationId}/orders`, { token: admin });
    assert(all.body.orders.length === 2 && all.body.billTotal === 1731.79 && all.body.amountPaid === 880.79 && all.body.remainingBalance === 851, "itemized reservation totals failed");
    const reservations = await request("/reservations", { token: admin });
    assert(reservations.body.reservations.find(row => row.id === reservationId).billAmount === 1731.79, "legacy bill total sync failed");

    console.log("Day 18 order/KOT/payment API smoke tests: PASS");
    process.exit(0);
}
setTimeout(() => run().catch(error => { console.error(error); process.exit(1); }), 250);
