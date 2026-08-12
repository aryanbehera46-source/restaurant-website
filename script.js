document.addEventListener("DOMContentLoaded", function () {

    console.log("SCRIPT.JS LOADED");

    // Find the reservation form
    const reservationForm =
        document.querySelector(".reservation-form") ||
        document.querySelector("form");

    if (!reservationForm) {
        console.error("RESERVATION FORM NOT FOUND");
        return;
    }

    console.log("RESERVATION FORM FOUND");


    reservationForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        console.log("RESERVATION BUTTON CLICKED");


        // Get fields
        const name =
            document.querySelector("#name")?.value.trim() || "";

        const email =
            document.querySelector("#email")?.value.trim() || "";

        const date =
            document.querySelector("#date")?.value || "";

        const time =
            document.querySelector("#time")?.value || "";

        const guests =
            Number(document.querySelector("#guests")?.value || 0);

        const phone =
            document.querySelector("#phone")?.value.trim() || "";

        const request =
            document.querySelector("#textarea")?.value.trim() ||
            document.querySelector("textarea")?.value.trim() ||
            "";


        console.log({
            name,
            email,
            date,
            time,
            guests,
            phone,
            request
        });


        // Validation
        if (!name) {
            alert("Please enter your full name.");
            return;
        }

        if (!email.includes("@") || !email.includes(".")) {
            alert("Please enter a valid email address.");
            return;
        }

        if (!date) {
            alert("Please select a date.");
            return;
        }

        if (!time) {
            alert("Please select a time.");
            return;
        }

        if (guests < 1 || guests > 20) {
            alert("Guests must be between 1 and 20.");
            return;
        }

        if (!/^[0-9]{10}$/.test(phone)) {
            alert("Please enter a valid 10-digit phone number.");
            return;
        }


        // Send to backend
        try {

            console.log("CONNECTING TO SERVER...");

            const response = await fetch(
                "http://localhost:5001/reservations",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        name: name,
                        email: email,
                        date: date,
                        time: time,
                        guests: guests,
                        phone: phone,
                        specialRequest: request
                    })
                }
            );


            console.log("SERVER RESPONSE RECEIVED");


            if (!response.ok) {
                throw new Error(
                    "Server error: " + response.status
                );
            }


            const result = await response.json();

            console.log("RESULT:", result);


            if (result.success) {

                // Confirmation details
                const confirmName =
                    document.querySelector("#confirm-name");

                const confirmGuests =
                    document.querySelector("#confirm-guests");

                const confirmDate =
                    document.querySelector("#confirm-date");

                const confirmTime =
                    document.querySelector("#confirm-time");


                if (confirmName)
                    confirmName.textContent = name;

                if (confirmGuests)
                    confirmGuests.textContent = guests;

                if (confirmDate)
                    confirmDate.textContent = date;

                if (confirmTime)
                    confirmTime.textContent = time;


                // Show confirmation
                const confirmation =
                    document.querySelector("#confirmation");

                if (confirmation) {
                    confirmation.style.display = "flex";
                } else {
                    alert(
                        "Reservation received successfully!"
                    );
                }


                // Clear form
                reservationForm.reset();

            } else {

                alert(
                    "Reservation was not accepted. Please try again."
                );

            }

        } catch (error) {

            console.error("FETCH ERROR:", error);

            alert(
                "Could not connect to the reservation server. " +
                "Please make sure the server is running."
            );

        }

    });


    // Close confirmation
    const closeButton =
        document.querySelector("#close-confirmation");

    if (closeButton) {

        closeButton.addEventListener("click", function () {

            const confirmation =
                document.querySelector("#confirmation");

            if (confirmation) {
                confirmation.style.display = "none";
            }

        });

    }

});