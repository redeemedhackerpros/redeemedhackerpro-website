
(() => {
  "use strict";

  // Google Form for Redeemed Hacker Pro client enquiries
  const ENQUIRY_FORM_URL =
    "https://docs.google.com/forms/d/e/1FAIpQLSf1D1OU0ruyt_fryCF6kbecJG6_2llC8LgeuUm8p6et6rE-Tw/viewform";

  // Mobile navigation
  const menuButton = document.querySelector(".menu-toggle");
  const nav = document.querySelector("#primary-nav");

  if (menuButton && nav) {
    menuButton.addEventListener("click", () => {
      const expanded =
        menuButton.getAttribute("aria-expanded") === "true";

      menuButton.setAttribute("aria-expanded", String(!expanded));
      nav.classList.toggle("open", !expanded);
    });

    nav.querySelectorAll("a").forEach(link =>
      link.addEventListener("click", () => {
        nav.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
      })
    );
  }

  // Automatic copyright year
  const year = document.querySelector("#year");

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  // Connect all website contact links to the Google Form
  document.querySelectorAll('a[href*="#contact"]').forEach(link => {
    link.href = ENQUIRY_FORM_URL;
    link.removeAttribute("target");
  });

  // Redirect the existing enquiry form to Google Forms
  const form = document.querySelector("#enquiry-form");

  if (form) {
    form.addEventListener("submit", event => {
      event.preventDefault();

      // Open the official client enquiry form
      window.location.href = ENQUIRY_FORM_URL;
    });
  }

})();
