(() => {
  "use strict";
  const menuButton = document.querySelector(".menu-toggle");
  const nav = document.querySelector("#primary-nav");
  if (menuButton && nav) {
    menuButton.addEventListener("click", () => {
      const expanded = menuButton.getAttribute("aria-expanded") === "true";
      menuButton.setAttribute("aria-expanded", String(!expanded));
      nav.classList.toggle("open", !expanded);
    });
    nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
      nav.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
    }));
  }

  const year = document.querySelector("#year");
  if (year) year.textContent = new Date().getFullYear();

  const form = document.querySelector("#enquiry-form");
  if (form) {
    form.addEventListener("submit", event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const name = String(data.get("name") || "").trim();
      const email = String(data.get("email") || "").trim();
      const topic = String(data.get("topic") || "").trim();
      const message = String(data.get("message") || "").trim();
      const subject = encodeURIComponent("Website enquiry — " + topic);
      // Keep the original Zoho support inbox configured in the existing website.
      const body = encodeURIComponent(
        "Name: " + name + "\nEmail: " + email + "\nTopic: " + topic +
        "\n\nMessage:\n" + message +
        "\n\nI understand this enquiry was prepared by the website and is being sent from my email application."
      );
      const feedback = document.querySelector("#form-feedback");
      if (feedback) feedback.textContent = "Your email application should open with a prepared message. Review it before sending.";
      window.location.href = "mailto:redeemedhackerpro@zohomail.com?subject=" + subject + "&body=" + body;
    });
  }
})();