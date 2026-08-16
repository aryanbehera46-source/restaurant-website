require("dotenv").config({
    path: require("path").resolve(__dirname, "../.env")
});

const express = require("express");
const db = require("./database");
const jwt = require("jsonwebtoken");

const app = express();

const PORT = process.env.PORT || 5001;

// --------------------------------------------------
// ADMIN LOGIN SETTINGS
// --------------------------------------------------

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;


// --------------------------------------------------
// CHECK ENVIRONMENT VARIABLES
// --------------------------------------------------

if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !JWT_SECRET) {
    console.error("ERROR: Missing required environment variables.");
    console.error("Check your .env file.");
    process.exit(1);
}


// --------------------------------------------------
// CORS
// --------------------------------------------------

app.use((req, res, next) => {

    res.header(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
    );

    res.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );

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
// ADMIN LOGIN
// --------------------------------------------------

app.post("/admin/login", (req, res) => {

    const {
        username,
        password
    } = req.body;


    // Check credentials

    if (
        username !== ADMIN_USERNAME ||
        password !== ADMIN_PASSWORD
    ) {

        return res.status(401).json({

            success: false,

            message: "Invalid username or password."

        });

    }


    // Create login token

    const token = jwt.sign(

        {
            username: username,
            role: "admin"
        },

        JWT_SECRET,

        {
            expiresIn: "8h"
        }

    );


    res.json({

        success: true,

        message: "Login successful.",

        token: token

    });

});


// --------------------------------------------------
// AUTHENTICATION MIDDLEWARE
// --------------------------------------------------

function authenticateAdmin(req, res, next) {

    const authHeader =
        req.headers.authorization;


    if (!authHeader) {

        return res.status(401).json({

            success: false,

            message: "Authentication required."

        });

    }


    const token =
        authHeader.startsWith("Bearer ")
            ? authHeader.split(" ")[1]
            : null;


    if (!token) {

        return res.status(401).json({

            success: false,

            message: "Invalid authentication token."

        });

    }


    try {

        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            );


        if (decoded.role !== "admin") {

            return res.status(403).json({

                success: false,

                message: "Admin access required."

            });

        }


        req.admin = decoded;

        next();


    } catch (error) {

        return res.status(401).json({

            success: false,

            message: "Invalid or expired login session."

        });

    }

}


// --------------------------------------------------
// CREATE RESERVATION
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

    if (
        !name ||
        !email ||
        !date ||
        !time ||
        !guests ||
        !phone
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Please fill in all required fields."

        });

    }


    // Basic email validation

    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    if (!emailPattern.test(email)) {

        return res.status(400).json({

            success: false,

            message:
                "Please enter a valid email address."

        });

    }


    // Phone validation

    const phonePattern =
        /^[0-9]{10}$/;


    if (!phonePattern.test(phone)) {

        return res.status(400).json({

            success: false,

            message:
                "Please enter a valid 10-digit phone number."

        });

    }


    // Check for duplicate reservation

    const duplicateReservation =
        db.prepare(`

            SELECT id

            FROM reservations

            WHERE date = ?

              AND time = ?

              AND (
                    email = ?
                    OR
                    phone = ?
                  )

              AND status != 'Cancelled'

            LIMIT 1

        `).get(
            date,
            time,
            email,
            phone
        );


    if (duplicateReservation) {

        return res.status(409).json({

            success: false,

            message:
                "You already have a reservation for this date and time."

        });

    }


    // Save reservation to database

    const insertReservation =
        db.prepare(`

            INSERT INTO reservations

            (
                name,
                email,
                date,
                time,
                guests,
                phone,
                specialRequest
            )

            VALUES (?, ?, ?, ?, ?, ?, ?)

        `);


    insertReservation.run(

        name,

        email,

        date,

        time,

        Number(guests),

        phone,

        specialRequest || null

    );


    // Log reservation

    console.log("");

    console.log(
        "========================================"
    );

    console.log(
        "NEW RESERVATION"
    );

    console.log(
        "========================================"
    );

    console.log(
        "Name:",
        name
    );

    console.log(
        "Email:",
        email
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
        "Phone:",
        phone
    );

    console.log(
        "Special Request:",
        specialRequest || "None"
    );

    console.log(
        "========================================"
    );

    console.log("");


    // Success response

    res.json({

        success: true,

        message:
            "Reservation received successfully!"

    });

});


// --------------------------------------------------
// GET ALL RESERVATIONS
// --------------------------------------------------
// PROTECTED: ADMIN ONLY
// --------------------------------------------------

app.get(
    "/reservations",
    authenticateAdmin,
    (req, res) => {

        try {

            const reservations =
                db

                    .prepare(
                        "SELECT * FROM reservations ORDER BY createdAt DESC"
                    )

                    .all();


            res.json({

                success: true,

                reservations

            });


        } catch (error) {

            console.error(
                "Error fetching reservations:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to fetch reservations."

            });

        }

    }
);


// --------------------------------------------------
// UPDATE RESERVATION STATUS
// --------------------------------------------------
// PROTECTED: ADMIN ONLY
// --------------------------------------------------

app.put(
    "/reservations/:id/status",
    authenticateAdmin,
    (req, res) => {

        try {

            const {
                status
            } = req.body;


            const {
                id
            } = req.params;


            const allowedStatuses = [

                "New",

                "Confirmed",

                "Cancelled",

                "Completed"

            ];


            if (
                !allowedStatuses.includes(status)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid status."

                });

            }


            const result =
                db

                    .prepare(
                        "UPDATE reservations SET status = ? WHERE id = ?"
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


            res.json({

                success: true,

                message:
                    "Reservation status updated successfully."

            });


        } catch (error) {

            console.error(
                "Error updating reservation status:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to update reservation status."

            });

        }

    }
);


// --------------------------------------------------
// DELETE RESERVATION
// --------------------------------------------------
// PROTECTED: ADMIN ONLY
// --------------------------------------------------

app.delete(
    "/reservations/:id",
    authenticateAdmin,
    (req, res) => {

        try {

            const {
                id
            } = req.params;


            const result =
                db

                    .prepare(
                        "DELETE FROM reservations WHERE id = ?"
                    )

                    .run(id);


            if (
                result.changes === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Reservation not found."

                });

            }


            res.json({

                success: true,

                message:
                    "Reservation deleted successfully."

            });


        } catch (error) {

            console.error(
                "Error deleting reservation:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to delete reservation."

            });

        }

    }
);


// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(
    PORT,
    () => {

        console.log("");

        console.log(
            "================================="
        );

        console.log(
            "RESTAURANT SERVER STARTED"
        );

        console.log(
            "================================="
        );

        console.log(
            `Server running on http://localhost:${PORT}`
        );

        console.log(
            "================================="
        );

        console.log("");

    }
);