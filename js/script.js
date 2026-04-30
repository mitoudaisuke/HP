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
  if (spans[0]) spans[0].style.transform = isOpen ? 'rotate(45deg) translate(5px,5px)' : '';
  if (spans[1]) spans[1].style.opacity = isOpen ? '0' : '1';
  if (spans[2]) spans[2].style.transform = isOpen ? 'rotate(-45deg) translate(5px,-5px)' : '';
});
mobileMenu?.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    const spans = hamburger?.querySelectorAll('span');
    if (spans) { spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; }); }
  });
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
      alert('Something went wrong. Please try again.');
    }
  } catch {
    alert('Network error. Please try again.');
  }
  btn.textContent = 'Send Message';
  btn.disabled = false;
});

// ── NIRFI release metadata ──
const setText = (selector, text) => {
  if (!text) return;
  document.querySelectorAll(selector).forEach(el => {
    el.textContent = text;
  });
};

const platformLabel = (platformKey) => {
  const labels = {
    'darwin-arm64': 'macOS',
    'win32-x64': 'Windows'
  };
  return labels[platformKey] || platformKey;
};

const formatPlatformVersionList = (platforms, fallbackVersion) => {
  if (!platforms.length) return fallbackVersion || '';
  return platforms
    .map(([platformKey, asset]) => `${platformLabel(platformKey)} ${asset.version}`)
    .join(' / ');
};

const formatPlatformReleaseTagList = (platforms, fallbackReleaseTag) => {
  const tags = platforms
    .map(([, asset]) => asset.releaseTag)
    .filter(Boolean);

  if (tags.length > 0 && new Set(tags).size === 1) {
    return tags[0];
  }

  return platforms
    .map(([platformKey, asset]) => `${platformLabel(platformKey)}: ${asset.releaseTag || fallbackReleaseTag}`)
    .join(' / ');
};

const formatReleaseHeading = (platforms, fallbackVersion) => {
  const versions = platforms
    .map(([, asset]) => asset.version)
    .filter(Boolean);

  if (versions.length > 0 && new Set(versions).size === 1) {
    return `NIRFI ${versions[0]}`;
  }

  return fallbackVersion ? 'NIRFI platform releases' : 'NIRFI releases';
};

const formatSize = (asset) => {
  if (asset.assetSizeDisplay) return asset.assetSizeDisplay;
  if (Number.isFinite(asset.assetSizeBytes)) {
    return `${(asset.assetSizeBytes / 1024 / 1024).toFixed(1)} MiB`;
  }
  return '';
};

const loadNirfiReleaseMetadata = async () => {
  if (!document.querySelector('[data-nirfi-latest-version]')) return;

  try {
    const res = await fetch('latest.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const metadata = await res.json();
    const platforms = Object.entries(metadata.platforms || {})
      .filter(([, asset]) => asset && asset.supported !== false && asset.fileName);

    setText('[data-nirfi-latest-version]', formatPlatformVersionList(platforms, metadata.latestVersion));
    setText('[data-nirfi-release-title]', metadata.releaseTitle);
    setText('[data-nirfi-release-tag]', formatPlatformReleaseTagList(platforms, metadata.releaseTag));
    setText('[data-nirfi-release-heading]', formatReleaseHeading(platforms, metadata.latestVersion));

    if (platforms.length) {
      setText('[data-nirfi-asset-list]', platforms.map(([, asset]) => asset.fileName).join('; '));
      setText('[data-nirfi-file-size-list]', platforms
        .map(([platformKey, asset]) => `${platformLabel(platformKey)}: ${formatSize(asset)}`)
        .filter(item => !item.endsWith(': '))
        .join(' / '));
      setText('[data-nirfi-file-size-detail]', platforms
        .map(([, asset]) => `${asset.fileName}: ${formatSize(asset)}`)
        .filter(item => !item.endsWith(': '))
        .join('; '));
    }

    document.querySelectorAll('[data-nirfi-download]').forEach(link => {
      const platform = metadata.platforms?.[link.dataset.nirfiDownload];
      if (!platform) return;
      const url = platform.downloadUrl || platform.directAssetUrl;
      if (url) link.href = url;
      if (platform.fileName) link.textContent = `Download ${platform.fileName}`;
    });

    const releasePageUrl = platforms
      .map(([, asset]) => asset.releasePageUrl)
      .find(Boolean) || metadata.repositories?.release;
    document.querySelectorAll('[data-nirfi-release-link]').forEach(link => {
      if (releasePageUrl) link.href = releasePageUrl;
    });
  } catch {
    // Keep the static fallback content if release metadata is unavailable.
  }
};

loadNirfiReleaseMetadata();
