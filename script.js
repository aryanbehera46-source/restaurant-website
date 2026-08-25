document.addEventListener("DOMContentLoaded", function () {

    console.log("SCRIPT.JS LOADED");

    const API_URL = "http://localhost:5001";

    let allMenuItems = [];
    let activeCategory = "All";


    // ==================================================
    // START
    // ==================================================

    loadMenu();


    // ==================================================
    // LOAD MENU
    // ==================================================

    async function loadMenu() {

        console.log("LOADING MENU FROM SERVER...");

        try {

            const response = await fetch(
                `${API_URL}/menu`
            );

            if (!response.ok) {
                throw new Error(
                    "Failed to load menu. Server returned " +
                    response.status
                );
            }

            const result = await response.json();

            console.log("MENU RESPONSE:", result);

            if (!result.success) {
                throw new Error(
                    result.message ||
                    "Unable to load menu."
                );
            }

            allMenuItems =
                result.menu ||
                result.menuItems ||
                [];

            console.log(
                "MENU ITEMS:",
                allMenuItems
            );

            renderCategoryFilters(
                allMenuItems
            );

            renderFullMenu(
                allMenuItems,
                activeCategory
            );

            renderSignatureDishes(
                allMenuItems
            );

        } catch (error) {

            console.error(
                "MENU LOAD ERROR:",
                error
            );

            showMenuError();

        }

    }


    // ==================================================
    // CREATE DYNAMIC CATEGORY FILTERS
    // ==================================================

    function renderCategoryFilters(menuItems) {

        const menuList =
            document.querySelector(".menu-list");

        if (!menuList) {

            console.warn(
                "MENU LIST NOT FOUND"
            );

            return;

        }

        const existingFilter =
            document.querySelector(
                ".dynamic-menu-filters"
            );

        if (existingFilter) {
            existingFilter.remove();
        }

        const availableItems =
            menuItems.filter(
                item =>
                    Number(item.available) === 1
            );

        const categories = [
            ...new Set(
                availableItems
                    .map(
                        item =>
                            String(
                                item.category ||
                                "Other"
                            ).trim()
                    )
                    .filter(
                        category =>
                            category.length > 0
                    )
            )
        ];

        const filterContainer =
            document.createElement("div");

        filterContainer.className =
            "dynamic-menu-filters";

        const allButton =
            createCategoryButton(
                "All",
                activeCategory === "All"
            );

        filterContainer.appendChild(
            allButton
        );

        categories.forEach(category => {

            const button =
                createCategoryButton(
                    category,
                    activeCategory === category
                );

            filterContainer.appendChild(
                button
            );

        });

        menuList.parentNode.insertBefore(
            filterContainer,
            menuList
        );

    }


    // ==================================================
    // CATEGORY BUTTON
    // ==================================================

    function createCategoryButton(
        category,
        isActive
    ) {

        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            "menu-category-button";

        if (isActive) {

            button.classList.add("active");

        }

        button.textContent =
            category;

        button.addEventListener(
            "click",
            function () {

                activeCategory =
                    category;

                document
                    .querySelectorAll(
                        ".menu-category-button"
                    )
                    .forEach(item => {

                        item.classList.remove(
                            "active"
                        );

                    });

                button.classList.add(
                    "active"
                );

                renderFullMenu(
                    allMenuItems,
                    activeCategory
                );

            }
        );

        return button;

    }


    // ==================================================
    // RENDER FULL MENU
    // ==================================================

    function renderFullMenu(
        menuItems,
        category
    ) {

        const menuList =
            document.querySelector(
                ".menu-list"
            );

        if (!menuList) {
            return;
        }

        const availableItems =
            menuItems.filter(
                item =>
                    Number(item.available) === 1
            );

        let filteredItems;

        if (category === "All") {

            filteredItems =
                availableItems;

        } else {

            filteredItems =
                availableItems.filter(
                    item =>
                        String(
                            item.category ||
                            "Other"
                        ).trim() === category
                );

        }

        if (filteredItems.length === 0) {

            menuList.innerHTML = `

                <div class="menu-empty">

                    <p>
                        No dishes available in this category.
                    </p>

                </div>

            `;

            return;

        }

        const grouped = {};

        filteredItems.forEach(item => {

            const itemCategory =
                String(
                    item.category ||
                    "Other"
                ).trim();

            if (!grouped[itemCategory]) {
                grouped[itemCategory] = [];
            }

            grouped[itemCategory].push(item);

        });

        menuList.innerHTML = "";

        Object.entries(grouped)
            .forEach(
                ([itemCategory, items]) => {

                    const heading =
                        document.createElement(
                            "div"
                        );

                    heading.className =
                        "menu-category-heading";

                    heading.innerHTML = `

                        <h3>
                            ${escapeHtml(
                                itemCategory
                            )}
                        </h3>

                    `;

                    menuList.appendChild(
                        heading
                    );

                    items.forEach(item => {

                        const menuItem =
                            document.createElement(
                                "div"
                            );

                        menuItem.className =
                            "menu-item";

                        menuItem.innerHTML = `

                            <div>

                                <h3>
                                    ${escapeHtml(
                                        item.name
                                    )}
                                </h3>

                                <p>
                                    ${
                                        item.description
                                            ? escapeHtml(
                                                item.description
                                            )
                                            : ""
                                    }
                                </p>

                            </div>

                            <span>

                                ${formatCurrency(
                                    item.price
                                )}

                            </span>

                        `;

                        menuList.appendChild(
                            menuItem
                        );

                    });

                }
            );

    }


    // ==================================================
    // SIGNATURE DISHES
    // ==================================================

    function renderSignatureDishes(
        menuItems
    ) {

        const dishGrid =
            document.querySelector(
                ".dish-grid"
            );

        if (!dishGrid) {
            return;
        }

        const availableItems =
            menuItems.filter(
                item =>
                    Number(item.available) === 1
            );

        const signatureItems =
            availableItems.slice(0, 3);

        if (signatureItems.length === 0) {

            dishGrid.innerHTML = `

                <div class="menu-empty">

                    <p>
                        Signature dishes coming soon.
                    </p>

                </div>

            `;

            return;

        }

        dishGrid.innerHTML = "";

        signatureItems.forEach(item => {

            const card =
                document.createElement(
                    "article"
                );

            card.className =
                "dish-card";

            const image =
                item.image &&
                String(item.image).trim()
                    ? item.image
                    : "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1000&q=80";

            card.innerHTML = `

                <img
                    src="${escapeAttribute(
                        image
                    )}"
                    alt="${escapeAttribute(
                        item.name
                    )}"
                    loading="lazy"
                    onerror="
                        this.onerror=null;
                        this.src='https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1000&q=80';
                    "
                >

                <div class="dish-info">

                    <h3>
                        ${escapeHtml(
                            item.name
                        )}
                    </h3>

                    <p>
                        ${
                            item.description
                                ? escapeHtml(
                                    item.description
                                )
                                : "Freshly prepared by our kitchen."
                        }
                    </p>

                    <span>
                        ${formatCurrency(
                            item.price
                        )}
                    </span>

                </div>

            `;

            dishGrid.appendChild(
                card
            );

        });

    }


    // ==================================================
    // MENU ERROR
    // ==================================================

    function showMenuError() {

        const menuList =
            document.querySelector(
                ".menu-list"
            );

        if (menuList) {

            menuList.innerHTML = `

                <div class="menu-empty">

                    <p>
                        Unable to load the menu right now.
                    </p>

                </div>

            `;

        }

        const dishGrid =
            document.querySelector(
                ".dish-grid"
            );

        if (dishGrid) {

            dishGrid.innerHTML = `

                <div class="menu-empty">

                    <p>
                        Unable to load signature dishes.
                    </p>

                </div>

            `;

        }

    }


    // ==================================================
    // RESERVATION FORM
    // ==================================================

    const reservationForm =
        document.querySelector(
            ".reservation-form"
        );

    if (!reservationForm) {

        console.error(
            "RESERVATION FORM NOT FOUND"
        );

    } else {

        console.log(
            "RESERVATION FORM FOUND"
        );

        const dateInput =
            document.querySelector(
                "#date"
            );

        if (dateInput) {

            dateInput.min =
                getTodayDate();

        }

        reservationForm.addEventListener(
            "submit",
            async function(event) {

                event.preventDefault();

                console.log(
                    "RESERVATION BUTTON CLICKED"
                );

                const name =
                    document
                        .querySelector("#name")
                        ?.value
                        .trim() ||
                    "";

                const email =
                    document
                        .querySelector("#email")
                        ?.value
                        .trim() ||
                    "";

                const date =
                    document
                        .querySelector("#date")
                        ?.value ||
                    "";

                const time =
                    document
                        .querySelector("#time")
                        ?.value ||
                    "";

                const guests =
                    Number(
                        document
                            .querySelector("#guests")
                            ?.value ||
                        0
                    );

                const phone =
                    document
                        .querySelector("#phone")
                        ?.value
                        .trim() ||
                    "";

                const request =
                    document
                        .querySelector("#message")
                        ?.value
                        .trim() ||
                    "";

                if (!name) {

                    alert(
                        "Please enter your full name."
                    );

                    return;

                }

                const emailPattern =
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

                if (
                    !emailPattern.test(email)
                ) {

                    alert(
                        "Please enter a valid email address."
                    );

                    return;

                }

                if (!date) {

                    alert(
                        "Please select a date."
                    );

                    return;

                }

                const selectedDate =
                    new Date(
                        `${date}T00:00:00`
                    );

                const today =
                    new Date();

                today.setHours(
                    0,
                    0,
                    0,
                    0
                );

                if (
                    selectedDate < today
                ) {

                    alert(
                        "Please select today or a future date."
                    );

                    return;

                }

                if (!time) {

                    alert(
                        "Please select a time."
                    );

                    return;

                }

                if (
                    guests < 1 ||
                    guests > 20
                ) {

                    alert(
                        "Guests must be between 1 and 20."
                    );

                    return;

                }

                if (
                    !/^[0-9]{10}$/.test(phone)
                ) {

                    alert(
                        "Please enter a valid 10-digit phone number."
                    );

                    return;

                }

                const submitButton =
                    reservationForm.querySelector(
                        ".submit-button"
                    );

                const originalText =
                    submitButton
                        ? submitButton.textContent
                        : "";

                if (submitButton) {

                    submitButton.disabled =
                        true;

                    submitButton.textContent =
                        "Sending...";

                }

                try {

                    const response =
                        await fetch(
                            `${API_URL}/reservations`,
                            {
                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                body:
                                    JSON.stringify({

                                        name,
                                        email,
                                        date,
                                        time,
                                        guests,
                                        phone,

                                        specialRequest:
                                            request

                                    })
                            }
                        );

                    let result;

                    try {

                        result =
                            await response.json();

                    } catch {

                        result = {};

                    }

                    if (!response.ok) {

                        throw new Error(
                            result.message ||
                            "Reservation could not be completed."
                        );

                    }

                    if (result.success) {

                        // ==========================================
                        // SHOW RESERVATION CONFIRMATION
                        // INCLUDING RESERVATION ID
                        // ==========================================

                        showReservationConfirmation({

                            id:
                                result.reservationId,

                            name,
                            guests,
                            date,
                            time

                        });

                        reservationForm.reset();

                        if (dateInput) {

                            dateInput.min =
                                getTodayDate();

                        }

                    } else {

                        throw new Error(
                            result.message ||
                            "Reservation was not accepted."
                        );

                    }

                } catch (error) {

                    console.error(
                        "RESERVATION ERROR:",
                        error
                    );

                    alert(
                        error.message ||
                        "Could not connect to the reservation server."
                    );

                } finally {

                    if (submitButton) {

                        submitButton.disabled =
                            false;

                        submitButton.textContent =
                            originalText;

                    }

                }

            }
        );

    }


    // ==================================================
    // RESERVATION CONFIRMATION
    // ==================================================

    function showReservationConfirmation(
        reservation
    ) {

        const confirmName =
            document.querySelector(
                "#confirm-name"
            );

        const confirmGuests =
            document.querySelector(
                "#confirm-guests"
            );

        const confirmDate =
            document.querySelector(
                "#confirm-date"
            );

        const confirmTime =
            document.querySelector(
                "#confirm-time"
            );

        if (confirmName) {

            confirmName.textContent =
                reservation.name;

        }

        if (confirmGuests) {

            confirmGuests.textContent =
                reservation.guests;

        }

        if (confirmDate) {

            confirmDate.textContent =
                formatDisplayDate(
                    reservation.date
                );

        }

        if (confirmTime) {

            confirmTime.textContent =
                formatDisplayTime(
                    reservation.time
                );

        }


        // ==================================================
        // RESERVATION ID
        // ==================================================

        let confirmId =
            document.querySelector(
                "#confirm-id"
            );


        // If HTML does not already contain
        // the reservation ID element,
        // create it automatically.

        if (
            !confirmId &&
            reservation.id
        ) {

            const confirmation =
                document.querySelector(
                    "#confirmation"
                );

            if (confirmation) {

                confirmId =
                    document.createElement(
                        "div"
                    );

                confirmId.id =
                    "confirm-id";

                confirmId.style.marginTop =
                    "10px";

                confirmId.style.fontWeight =
                    "bold";

                confirmId.style.fontSize =
                    "15px";

                confirmation.appendChild(
                    confirmId
                );

            }

        }


        if (confirmId) {

            if (reservation.id) {

                confirmId.textContent =
                    `Reservation ID: ${reservation.id}`;

            } else {

                confirmId.textContent =
                    "";

            }

        }


        const confirmation =
            document.querySelector(
                "#confirmation"
            );

        if (confirmation) {

            confirmation.style.display =
                "flex";

        } else {

            alert(
                reservation.id
                    ? `Reservation received successfully!\n\nReservation ID: ${reservation.id}`
                    : "Reservation received successfully!"
            );

        }

    }


    // ==================================================
    // CLOSE CONFIRMATION
    // ==================================================

    const closeButton =
        document.querySelector(
            "#close-confirmation"
        );

    if (closeButton) {

        closeButton.addEventListener(
            "click",
            function () {

                const confirmation =
                    document.querySelector(
                        "#confirmation"
                    );

                if (confirmation) {

                    confirmation.style.display =
                        "none";

                }

            }
        );

    }


    // ==================================================
    // CLOSE CONFIRMATION - BACKGROUND
    // ==================================================

    const confirmation =
        document.querySelector(
            "#confirmation"
        );

    if (confirmation) {

        confirmation.addEventListener(
            "click",
            function(event) {

                if (
                    event.target ===
                    confirmation
                ) {

                    confirmation.style.display =
                        "none";

                }

            }
        );

    }


    // ==================================================
    // ESCAPE KEY
    // ==================================================

    document.addEventListener(
        "keydown",
        function(event) {

            if (
                event.key === "Escape"
            ) {

                const confirmation =
                    document.querySelector(
                        "#confirmation"
                    );

                if (confirmation) {

                    confirmation.style.display =
                        "none";

                }

            }

        }
    );


    // ==================================================
    // TODAY DATE
    // ==================================================

    function getTodayDate() {

        const today =
            new Date();

        const year =
            today.getFullYear();

        const month =
            String(
                today.getMonth() + 1
            ).padStart(
                2,
                "0"
            );

        const day =
            String(
                today.getDate()
            ).padStart(
                2,
                "0"
            );

        return (
            `${year}-${month}-${day}`
        );

    }


    // ==================================================
    // DISPLAY DATE
    // ==================================================

    function formatDisplayDate(
        date
    ) {

        if (!date) {
            return "";
        }

        const parts =
            date.split("-");

        if (
            parts.length !== 3
        ) {
            return date;
        }

        const formattedDate =
            new Date(

                Number(parts[0]),

                Number(parts[1]) - 1,

                Number(parts[2])

            );

        return formattedDate
            .toLocaleDateString(
                "en-IN",
                {

                    day: "numeric",

                    month: "long",

                    year: "numeric"

                }
            );

    }


    // ==================================================
    // DISPLAY TIME
    // ==================================================

    function formatDisplayTime(
        time
    ) {

        if (!time) {
            return "";
        }

        const parts =
            time.split(":");

        if (
            parts.length < 2
        ) {
            return time;
        }

        let hours =
            Number(parts[0]);

        const minutes =
            parts[1];

        const period =
            hours >= 12
                ? "PM"
                : "AM";

        hours =
            hours % 12;

        if (
            hours === 0
        ) {
            hours = 12;
        }

        return (
            `${hours}:${minutes} ${period}`
        );

    }


    // ==================================================
    // CURRENCY
    // ==================================================

    function formatCurrency(
        amount
    ) {

        return (
            "₹" +
            Number(
                amount || 0
            ).toLocaleString(
                "en-IN",
                {

                    minimumFractionDigits: 0,

                    maximumFractionDigits: 2

                }
            )
        );

    }


    // ==================================================
    // ESCAPE HTML
    // ==================================================

    function escapeHtml(
        value
    ) {

        return String(
            value ?? ""
        )

            .replace(
                /&/g,
                "&amp;"
            )

            .replace(
                /</g,
                "&lt;"
            )

            .replace(
                />/g,
                "&gt;"
            )

            .replace(
                /"/g,
                "&quot;"
            )

            .replace(
                /'/g,
                "&#039;"
            );

    }


    // ==================================================
    // ESCAPE ATTRIBUTE
    // ==================================================

    function escapeAttribute(
        value
    ) {

        return escapeHtml(
            value
        );

    }

});s