const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
if (menuToggle && navLinks) {
  menuToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }));
}
document.getElementById('year').textContent = new Date().getFullYear();

// Website enquiries are prepared for the support inbox in Zoho Mail.
// This mailto form opens the visitor's email app; it does not send or store messages itself.
const CONTACT_EMAIL = 'redeemedhackerpro@zohomail.com';
const form = document.getElementById('contactForm');
if (form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const topic = String(data.get('topic') || '').trim();
    const message = String(data.get('message') || '').trim();
    const status = document.getElementById('formMessage');
    if (!name || !email || !topic || !message) {
      status.textContent = 'Please complete all required fields.';
      return;
    }
    const subject = encodeURIComponent('Website enquiry: ' + topic);
    const body = encodeURIComponent('Name: ' + name + '\nReply email: ' + email + '\nTopic: ' + topic + '\n\nMessage:\n' + message + '\n\nPlease do not send or request private keys, seed phrases, passwords, or authentication codes.');
    window.location.href = 'mailto:' + CONTACT_EMAIL + '?subject=' + subject + '&body=' + body;
    status.textContent = 'Your email app should open with the enquiry prepared. Review it before sending.';
  });
}
