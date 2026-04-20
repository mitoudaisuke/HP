const nav = document.querySelector(".nav");
const hamburger = document.querySelector(".hamburger");
const mobileMenu = document.querySelector(".mobile-menu");

const setMenuState = (open) => {
  if (!hamburger || !mobileMenu) return;

  hamburger.setAttribute("aria-expanded", open ? "true" : "false");
  mobileMenu.hidden = !open;
  mobileMenu.setAttribute("aria-hidden", open ? "false" : "true");
  document.body.classList.toggle("menu-open", open);

  const spans = hamburger.querySelectorAll("span");
  if (spans[0]) spans[0].style.transform = open ? "translateY(6px) rotate(45deg)" : "";
  if (spans[1]) spans[1].style.opacity = open ? "0" : "1";
  if (spans[2]) spans[2].style.transform = open ? "translateY(-6px) rotate(-45deg)" : "";
};

setMenuState(false);

window.addEventListener("scroll", () => {
  nav?.classList.toggle("scrolled", window.scrollY > 12);
});

hamburger?.addEventListener("click", () => {
  const isOpen = hamburger.getAttribute("aria-expanded") === "true";
  setMenuState(!isOpen);
});

mobileMenu?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => setMenuState(false));
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && hamburger?.getAttribute("aria-expanded") === "true") {
    setMenuState(false);
    hamburger.focus();
  }
});

const path = window.location.pathname;
const currentPage = path.endsWith("/") ? "index.html" : path.split("/").pop() || "index.html";

document.querySelectorAll(".nav-links a, .mobile-menu a").forEach((link) => {
  const href = link.getAttribute("href");
  if (!href) return;

  const target = href.split("/").pop();
  if (target === currentPage) {
    link.classList.add("active");
  }
});

const form = document.getElementById("contact-form");
form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submit = form.querySelector('button[type="submit"]');
  const success = document.getElementById("form-success");
  const error = document.getElementById("form-error");
  const defaultText = submit?.dataset.defaultText || submit?.textContent || "Send";
  const loadingText = submit?.dataset.loadingText || "Sending...";
  const errorText = form.dataset.errorText || "Something went wrong. Please try again.";
  const networkErrorText = form.dataset.networkErrorText || "Network error. Please try again.";

  if (submit) {
    submit.disabled = true;
    submit.textContent = loadingText;
  }

  if (success) success.style.display = "none";
  if (error) {
    error.style.display = "none";
    error.textContent = "";
  }

  try {
    const response = await fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const detail = data?.errors?.map((item) => item.message).join(" ");
      throw new Error(detail || errorText);
    }

    form.reset();
    if (success) success.style.display = "block";
  } catch (err) {
    if (error) {
      error.textContent = err instanceof Error ? err.message : networkErrorText;
      error.style.display = "block";
    }
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = defaultText;
    }
  }
});
