const path = require("path");
const os = require("os");

process.env.ADMIN_PASSWORD = "local-test-password";
process.env.JWT_SECRET = "local-test-secret-that-is-at-least-thirty-two-characters";
process.env.DB_PATH = path.join(os.tmpdir(), `royal-table-day17-${Date.now()}.db`);
process.env.PORT = "5051";
process.env.GMAIL_USER = "";
process.env.GMAIL_APP_PASSWORD = "";

require("./server");

const base = "http://127.0.0.1:5051";

async function request(route, options = {}) {
    const response = await fetch(`${base}${route}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
        }
    });
    return { status: response.status, body: await response.json() };
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function run() {
    const adminLogin = await request("/admin/login", {
        method: "POST",
        body: JSON.stringify({ username: "admin", password: process.env.ADMIN_PASSWORD })
    });
    assert(adminLogin.status === 200 && adminLogin.body.token, "admin login failed");

    const unauthenticated = await request("/chef/dashboard");
    assert(unauthenticated.status === 401, "unauthenticated chef dashboard was not rejected");

    const created = await request("/staff", {
        method: "POST", token: adminLogin.body.token,
        body: JSON.stringify({ name: "Test Chef", username: "testchef", password: "secure-chef-password", role: "chef" })
    });
    assert(created.status === 201 && created.body.staff.role === "chef", "staff creation failed");

    const invalidLogin = await request("/staff/login", { method: "POST", body: JSON.stringify({ username: "testchef", password: "wrong-password" }) });
    assert(invalidLogin.status === 401, "invalid staff credentials were not rejected");

    const chefLogin = await request("/staff/login", { method: "POST", body: JSON.stringify({ username: "testchef", password: "secure-chef-password" }) });
    assert(chefLogin.status === 200 && chefLogin.body.token, "staff login failed");
    const chefToken = chefLogin.body.token;

    const forbidden = await request("/staff", { token: chefToken });
    assert([401, 403].includes(forbidden.status), "chef was allowed into admin staff management");

    const ingredient = await request("/ingredients", {
        method: "POST", token: chefToken,
        body: JSON.stringify({ name: "Test Tomatoes", category: "Produce", unit: "kg", currentQuantity: 2, minimumQuantity: 5 })
    });
    assert(ingredient.status === 201, "ingredient creation failed");

    const adjustment = await request(`/ingredients/${ingredient.body.ingredient.id}/adjustments`, {
        method: "POST", token: chefToken, body: JSON.stringify({ quantityChange: 3, reason: "Local delivery" })
    });
    assert(adjustment.body.ingredient.currentQuantity === 5, "inventory adjustment failed");

    const grocery = await request("/grocery", {
        method: "POST", token: chefToken,
        body: JSON.stringify({ name: "Cream", unit: "litres", requiredQuantity: 6, currentQuantity: 2, priority: "urgent" })
    });
    assert(grocery.status === 201, "grocery creation failed");

    const task = await request("/kitchen/tasks", {
        method: "POST", token: chefToken,
        body: JSON.stringify({ title: "Prep sauces", serviceDate: "2026-08-29" })
    });
    assert(task.status === 201, "kitchen task creation failed");

    const dashboard = await request("/chef/dashboard?date=2026-08-29", { token: chefToken });
    assert(dashboard.status === 200 && dashboard.body.dashboard.grocery.length === 1 && dashboard.body.dashboard.tasks.length === 1, "chef dashboard context failed");

    const briefing = await request("/ai/kitchen/briefing", { method: "POST", token: chefToken, body: JSON.stringify({ date: "2026-08-29" }) });
    assert(briefing.status === 200 && briefing.body.assistant.safeguards.includes("read-only recommendations"), "AI kitchen safeguards failed");

    const deactivated = await request(`/staff/${created.body.staff.id}`, {
        method: "PUT", token: adminLogin.body.token, body: JSON.stringify({ active: false })
    });
    assert(deactivated.status === 200, "staff deactivation failed");
    const inactiveLogin = await request("/staff/login", { method: "POST", body: JSON.stringify({ username: "testchef", password: "secure-chef-password" }) });
    assert(inactiveLogin.status === 401, "inactive staff login was not rejected");

    console.log("Day 17 local API smoke tests: PASS");
    process.exit(0);
}

setTimeout(() => run().catch(error => { console.error(error); process.exit(1); }), 200);
