const API_URL = String(
    process.env.ROYAL_TABLE_API_URL ||
    "https://royal-table-api.onrender.com"
).replace(/\/$/, "");

const username = process.env.ROYAL_TABLE_ADMIN_USERNAME;
const password = process.env.ROYAL_TABLE_ADMIN_PASSWORD;

if (!username || !password) {
    console.error(
        "Missing ROYAL_TABLE_ADMIN_USERNAME or ROYAL_TABLE_ADMIN_PASSWORD."
    );
    console.error("");
    console.error("Set them first:");
    console.error(
        'export ROYAL_TABLE_ADMIN_USERNAME="your_username"'
    );
    console.error(
        'export ROYAL_TABLE_ADMIN_PASSWORD="your_password"'
    );
    process.exit(1);
}

const menu = [
    // STARTERS
    {
        name: "Crispy Corn",
        category: "Starters",
        description: "Crispy golden corn tossed with herbs and aromatic spices.",
        price: 280
    },
    {
        name: "Chicken Tikka",
        category: "Starters",
        description: "Tender chicken marinated in yogurt and aromatic spices, chargrilled to perfection.",
        price: 420
    },
    {
        name: "Malai Chicken Tikka",
        category: "Starters",
        description: "Creamy, mildly spiced chicken tikka with a delicate charred finish.",
        price: 450
    },
    {
        name: "Paneer Tikka",
        category: "Starters",
        description: "Chargrilled cottage cheese with peppers, onions and traditional tandoori spices.",
        price: 350
    },
    {
        name: "Hara Bhara Kebab",
        category: "Starters",
        description: "Golden vegetable and spinach kebabs with fragrant herbs and spices.",
        price: 320
    },
    {
        name: "Dahi Ke Kebab",
        category: "Starters",
        description: "Delicate yogurt kebabs with herbs, mild spices and a crisp golden crust.",
        price: 340
    },
    {
        name: "Tandoori Prawns",
        category: "Starters",
        description: "Juicy prawns marinated in aromatic spices and roasted in the tandoor.",
        price: 560
    },
    {
        name: "Mutton Seekh Kebab",
        category: "Starters",
        description: "Minced mutton seasoned with herbs and spices, skewered and chargrilled.",
        price: 520
    },

    // TANDOOR
    {
        name: "Tandoori Chicken",
        category: "Tandoor",
        description: "Classic chicken marinated in yogurt and spices, roasted in the clay tandoor.",
        price: 480
    },
    {
        name: "Afghani Chicken",
        category: "Tandoor",
        description: "Tender chicken marinated in cream, cheese and delicate aromatic spices.",
        price: 520
    },
    {
        name: "Tandoori Fish",
        category: "Tandoor",
        description: "Fresh fish fillet marinated with spices and roasted for a smoky finish.",
        price: 520
    },
    {
        name: "Paneer Malai Tikka",
        category: "Tandoor",
        description: "Soft paneer in a creamy marinade with subtle herbs and spices.",
        price: 390
    },
    {
        name: "Tandoori Mushroom",
        category: "Tandoor",
        description: "Whole mushrooms marinated in aromatic spices and roasted in the tandoor.",
        price: 330
    },

    // VEGETARIAN MAIN COURSE
    {
        name: "Paneer Butter Masala",
        category: "Main Course",
        description: "Soft paneer simmered in a rich tomato, butter and cream gravy.",
        price: 390
    },
    {
        name: "Kadai Paneer",
        category: "Main Course",
        description: "Paneer cooked with peppers, onions and aromatic kadai spices.",
        price: 380
    },
    {
        name: "Palak Paneer",
        category: "Main Course",
        description: "Cottage cheese cooked gently in a smooth spinach and spice gravy.",
        price: 370
    },
    {
        name: "Shahi Paneer",
        category: "Main Course",
        description: "Paneer in a luxurious creamy gravy finished with delicate aromatic spices.",
        price: 400
    },
    {
        name: "Dal Makhani",
        category: "Main Course",
        description: "Slow-cooked black lentils finished with butter and cream.",
        price: 320
    },
    {
        name: "Dal Tadka",
        category: "Main Course",
        description: "Yellow lentils tempered with garlic, cumin and aromatic Indian spices.",
        price: 280
    },
    {
        name: "Mix Vegetable Curry",
        category: "Main Course",
        description: "Seasonal vegetables simmered in a fragrant and lightly spiced curry.",
        price: 320
    },
    {
        name: "Mushroom Masala",
        category: "Main Course",
        description: "Tender mushrooms cooked in a rich onion and tomato masala.",
        price: 350
    },

    // NON-VEGETARIAN MAIN COURSE
    {
        name: "Butter Chicken",
        category: "Main Course",
        description: "Tender chicken in a rich buttery tomato gravy with gentle aromatic spices.",
        price: 450
    },
    {
        name: "Chicken Curry",
        category: "Main Course",
        description: "Homestyle chicken curry prepared with fragrant Indian spices.",
        price: 430
    },
    {
        name: "Chicken Tikka Masala",
        category: "Main Course",
        description: "Chargrilled chicken tikka simmered in a rich spiced tomato gravy.",
        price: 470
    },
    {
        name: "Kadai Chicken",
        category: "Main Course",
        description: "Tender chicken cooked with peppers, onions and freshly ground kadai spices.",
        price: 460
    },
    {
        name: "Chicken Rara",
        category: "Main Course",
        description: "Rich chicken preparation combining tender pieces with spiced minced chicken.",
        price: 490
    },
    {
        name: "Mutton Rogan Josh",
        category: "Main Course",
        description: "Slow-cooked mutton in a fragrant Kashmiri-style spiced gravy.",
        price: 560
    },
    {
        name: "Mutton Curry",
        category: "Main Course",
        description: "Tender mutton slow-cooked in a traditional onion and tomato gravy.",
        price: 540
    },
    {
        name: "Fish Curry",
        category: "Main Course",
        description: "Fresh fish cooked in a fragrant Indian curry with balanced spices.",
        price: 480
    },

    // RICE & BIRYANI
    {
        name: "Steamed Basmati Rice",
        category: "Rice",
        description: "Fragrant long-grain basmati rice, steamed to perfection.",
        price: 180
    },
    {
        name: "Jeera Rice",
        category: "Rice",
        description: "Fluffy basmati rice tempered with cumin and aromatic spices.",
        price: 220
    },
    {
        name: "Vegetable Biryani",
        category: "Rice",
        description: "Aromatic basmati rice layered with seasonal vegetables and fragrant spices.",
        price: 340
    },
    {
        name: "Chicken Biryani",
        category: "Rice",
        description: "Fragrant basmati rice layered with spiced chicken and aromatic herbs.",
        price: 450
    },
    {
        name: "Mutton Biryani",
        category: "Rice",
        description: "Slow-cooked mutton layered with fragrant basmati rice and traditional spices.",
        price: 540
    },
    {
        name: "Paneer Biryani",
        category: "Rice",
        description: "Basmati rice layered with seasoned paneer, herbs and aromatic spices.",
        price: 390
    },

    // BREADS
    {
        name: "Tandoori Roti",
        category: "Breads",
        description: "Traditional whole-wheat bread baked in the tandoor.",
        price: 60
    },
    {
        name: "Butter Naan",
        category: "Breads",
        description: "Soft tandoori naan finished with melted butter.",
        price: 90
    },
    {
        name: "Garlic Naan",
        category: "Breads",
        description: "Tandoori naan topped with fresh garlic and herbs.",
        price: 110
    },
    {
        name: "Cheese Naan",
        category: "Breads",
        description: "Soft naan filled with melted cheese and finished in the tandoor.",
        price: 160
    },
    {
        name: "Lachha Paratha",
        category: "Breads",
        description: "Flaky layered Indian bread cooked until crisp and golden.",
        price: 120
    },
    {
        name: "Stuffed Paneer Kulcha",
        category: "Breads",
        description: "Tandoor-baked kulcha generously stuffed with seasoned paneer.",
        price: 170
    },

    // DESSERTS
    {
        name: "Gulab Jamun",
        category: "Desserts",
        description: "Soft milk-solid dumplings served warm in fragrant sweet syrup.",
        price: 160
    },
    {
        name: "Rasmalai",
        category: "Desserts",
        description: "Soft cottage-cheese dumplings soaked in chilled saffron-infused milk.",
        price: 190
    },
    {
        name: "Chocolate Brownie",
        category: "Desserts",
        description: "Rich chocolate brownie served warm.",
        price: 220
    },
    {
        name: "Phirni",
        category: "Desserts",
        description: "Creamy ground-rice pudding delicately flavoured with cardamom and saffron.",
        price: 170
    },

    // BEVERAGES
    {
        name: "Fresh Lime Soda",
        category: "Beverages",
        description: "Refreshing lime soda with a balanced sweet and tangy finish.",
        price: 140
    },
    {
        name: "Masala Chai",
        category: "Beverages",
        description: "Indian tea infused with aromatic spices.",
        price: 110
    },
    {
        name: "Fresh Mango Lassi",
        category: "Beverages",
        description: "Creamy yogurt drink blended with ripe mango.",
        price: 180
    },
    {
        name: "Sweet Lassi",
        category: "Beverages",
        description: "Traditional chilled yogurt drink with a smooth, lightly sweet finish.",
        price: 160
    },
    {
        name: "Fresh Watermelon Cooler",
        category: "Beverages",
        description: "Refreshing watermelon drink with a bright and naturally sweet finish.",
        price: 180
    }
];

async function request(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, options);

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    return { response, data };
}

async function main() {
    console.log("========================================");
    console.log("ROYAL TABLE — MENU IMPORT");
    console.log("========================================");
    console.log(`Prepared dishes: ${menu.length}`);
    console.log("");

    console.log(`Target API: ${API_URL}`);
    console.log("Logging into menu API...");

    const login = await request("/admin/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username,
            password
        })
    });

    if (!login.response.ok || !login.data.success) {
        console.error("Login failed.");
        console.error(login.data.message || `HTTP ${login.response.status}`);
        process.exit(1);
    }

    const token = login.data.token;

    if (!token) {
        console.error("Login succeeded but no token was returned.");
        process.exit(1);
    }

    console.log("✓ Authentication successful.");
    console.log("");

    console.log("Checking existing menu...");

    const existing = await request("/admin/menu", {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if (!existing.response.ok || !existing.data.success) {
        console.error("Could not read existing menu.");
        console.error(
            existing.data.message || `HTTP ${existing.response.status}`
        );
        process.exit(1);
    }

    const existingItems = Array.isArray(existing.data.menuItems)
        ? existing.data.menuItems
        : [];

    const existingNames = new Set(
        existingItems.map(item =>
            String(item.name || "").trim().toLowerCase()
        )
    );

    console.log(`Existing dishes: ${existingItems.length}`);
    console.log("");

    let added = 0;
    let skipped = 0;
    let failed = 0;

    for (const dish of menu) {
        const key = dish.name.trim().toLowerCase();

        if (existingNames.has(key)) {
            console.log(`SKIP    ${dish.name} — already exists`);
            skipped++;
            continue;
        }

        try {
            const result = await request("/menu", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...dish,
                    image: "",
                    available: true
                })
            });

            if (result.response.ok && result.data.success) {
                console.log(`ADDED   ${dish.name} — ₹${dish.price}`);
                added++;
                existingNames.add(key);
            } else {
                console.error(
                    `FAILED  ${dish.name} — ${
                        result.data.message || `HTTP ${result.response.status}`
                    }`
                );
                failed++;
            }
        } catch (error) {
            console.error(`FAILED  ${dish.name} — ${error.message}`);
            failed++;
        }
    }

    console.log("");
    console.log("========================================");
    console.log("IMPORT COMPLETE");
    console.log("========================================");
    console.log(`Added:   ${added}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed:  ${failed}`);
    console.log("");

    console.log("Verifying public menu...");

    const publicMenu = await request("/menu");

    if (publicMenu.response.ok && publicMenu.data.success) {
        const count = Array.isArray(publicMenu.data.menu)
            ? publicMenu.data.menu.length
            : 0;

        console.log(`✓ Public menu now contains ${count} available dishes.`);
    } else {
        console.error(
            `Could not verify public menu: ${
                publicMenu.data.message || `HTTP ${publicMenu.response.status}`
            }`
        );
        process.exit(1);
    }

    if (failed > 0) {
        process.exit(1);
    }
}

main().catch(error => {
    console.error("");
    console.error("Unexpected importer error:", error.message);
    process.exit(1);
});
