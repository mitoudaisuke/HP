// ── Nav scroll effect ──
const nav = document.querySelector('.nav');
window.addEventListener('scroll', () => {
  nav?.classList.toggle('scrolled', window.scrollY > 40);
});

// ── Mobile menu ──
const hamburger = document.querySelector('.hamburger');
const mobileMenu = document.querySelector('.mobile-menu');
hamburger?.addEventListener('click', () => {
  mobileMenu?.classList.toggle('open');
  const spans = hamburger.querySelectorAll('span');
  const isOpen = mobileMenu?.classList.contains('open');
  hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  if (spans[0]) spans[0].style.transform = isOpen ? 'rotate(45deg) translate(5px,5px)' : '';
  if (spans[1]) spans[1].style.opacity = isOpen ? '0' : '1';
  if (spans[2]) spans[2].style.transform = isOpen ? 'rotate(-45deg) translate(5px,-5px)' : '';
});
mobileMenu?.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    const spans = hamburger?.querySelectorAll('span');
    hamburger?.setAttribute('aria-expanded', 'false');
    if (spans) { spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; }); }
  });
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && mobileMenu?.classList.contains('open')) {
    mobileMenu.classList.remove('open');
    hamburger?.setAttribute('aria-expanded', 'false');
    const spans = hamburger?.querySelectorAll('span');
    if (spans) { spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; }); }
    hamburger?.focus();
  }
});

// ── Active nav link ──
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(a => {
  const href = a.getAttribute('href');
  if (href === currentPage || (currentPage === '' && href === 'index.html')) {
    a.classList.add('active');
  }
});

// ── Fade-up on scroll ──
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

// ── Contact form (Formspree) ──
const form = document.getElementById('contact-form');
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = form.querySelector('button[type="submit"]');
  const success = document.getElementById('form-success');
  const error = document.getElementById('form-error');
  const defaultText = btn?.dataset.defaultText || btn?.textContent || 'Send';
  if (success) { success.style.display = 'none'; }
  if (error) {
    error.style.display = 'none';
    error.textContent = '';
  }
  btn.textContent = 'Sending...';
  btn.disabled = true;
  try {
    const res = await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      form.reset();
      if (success) { success.style.display = 'block'; }
    } else {
      const data = await res.json().catch(() => null);
      const message = data?.errors?.map((item) => item.message).join(' ') || 'Something went wrong. Please try again.';
      if (error) {
        error.textContent = message;
        error.style.display = 'block';
      }
    }
  } catch {
    if (error) {
      error.textContent = 'Network error. Please try again.';
      error.style.display = 'block';
    }
  }
  btn.textContent = defaultText;
  btn.disabled = false;
});
