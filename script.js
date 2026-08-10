const reservationForm = document.querySelector(".reservation-form");

reservationForm.addEventListener("submit", function (event) {

    event.preventDefault();

    alert("Thank you! Your reservation request has been received.");

});