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

    console.log("");
    console.log("=================================");
    console.log("NEW RESERVATION");
    console.log("=================================");

    console.log("Name:", req.body.name);
    console.log("Email:", req.body.email);
    console.log("Date:", req.body.date);
    console.log("Time:", req.body.time);
    console.log("Guests:", req.body.guests);
    console.log("Phone:", req.body.phone);
    console.log("Special Request:", req.body.specialRequest);

    console.log("=================================");
    console.log("");


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