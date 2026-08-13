const express = require("express");

const app = express();

const PORT = 5001;

// --------------------------------------------------
// CORS
// --------------------------------------------------

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});


// --------------------------------------------------
// JSON BODY PARSER
// --------------------------------------------------

app.use(express.json());


// --------------------------------------------------
// TEST ROUTE
// --------------------------------------------------

app.get("/", (req, res) => {
    res.json({
        message: "Restaurant backend is running!"
    });
});


// --------------------------------------------------
// RESERVATION ROUTE
// --------------------------------------------------

app.post("/reservations", (req, res) => {
    const {
        name,
        email,
        date,
        time,
        guests,
        phone,
        specialRequest
    } = req.body;

    // Validate required fields
    if (!name || !email || !date || !time || !guests || !phone) {
        return res.status(400).json({
            success: false,
            message: "Please fill in all required fields."
        });
    }

    // Basic email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
        return res.status(400).json({
            success: false,
            message: "Please enter a valid email address."
        });
    }

    // Phone validation
    const phonePattern = /^[0-9]{10}$/;

    if (!phonePattern.test(phone)) {
        return res.status(400).json({
            success: false,
            message: "Please enter a valid 10-digit phone number."
        });
    }

    // Log reservation
    console.log("");
    console.log("========================================");
    console.log("NEW RESERVATION");
    console.log("========================================");

    console.log("Name:", name);
    console.log("Email:", email);
    console.log("Date:", date);
    console.log("Time:", time);
    console.log("Guests:", guests);
    console.log("Phone:", phone);
    console.log("Special Request:", specialRequest || "None");

    console.log("========================================");
    console.log("");

    // Send success response
    res.json({
        success: true,
        message: "Reservation received successfully!"
    });
});


// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, () => {
    console.log("");
    console.log("=================================");
    console.log("RESTAURANT SERVER STARTED");
    console.log("=================================");
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("=================================");
    console.log("");
});