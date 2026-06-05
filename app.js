'use strict';

/* ════════════════════════════════════════════════════════════
   WEDDING SITE — app.js
   Sections:
     1. Config
     2. DOM refs / helpers
     3. Page navigation + transition
     4. Password gate
     5. Slideshow + dots
     6. Music autoplay with blocked-banner fallback
     7. Hamburger / mobile menu
     8. Frosted nav on scroll
     9. Reveal-on-scroll observer
    10. RSVP system (create / lookup / save) — Formspree + localStorage
    11. Pictures gallery + lightbox
════════════════════════════════════════════════════════════ */

/* ── 1 · CONFIG ──────────────────────────────────────── */
const CONFIG = Object.freeze({
  PASSWORD: 'jumpthebroom',
  SLIDE_MS: 7000,
  SLIDE_COUNT: 16,

  /* Google Apps Script web app URL — paste after deploying scripts/rsvp_sheet.gs.
     Each RSVP submission updates the Google Sheet and emails a full list to ayandsh2026@gmail.com.
     Leave blank to save locally only (no email sent). */
  GSHEET_ENDPOINT: 'https://script.google.com/macros/s/AKfycbxKFLr4bqN0Qh6ZhrYkOP2gT3u3q6O8befEsRvn3-87ehMWVDn-7ZEaVyy67q8UJRvxww/exec',

  /* Starting RSVP ID — auto-increments from here. */
  RSVP_START_NUMBER: 10,

  /* localStorage keys */
  LS_RSVP_NEXT: 'wedding.rsvp.nextId',
  LS_RSVP_PREFIX: 'wedding.rsvp.',

  /* Background playlist: first track plays on enter, second after it ends (loops). */
  MUSIC_PLAYLIST: [
    'Music/Ella%20Fitzgerald%2C%20Louis%20Armstrong%20-%20Cheek%20To%20Cheek%20%28Official%20Video%29%204.mp3',
    'Music/At%20Last.mp3',
    'Music/My%20Cherie%20Amour.mp3',
  ],

  /* Engagement shoot gallery — ordered by row */
  GALLERY_IMAGES: [
    /* Row 1 */
    { f: 'row-1-pic-1.jpg', o: 'landscape' },
    { f: 'row-1-pic-2.jpg', o: 'landscape' },
    { f: 'row-1-pic-3.jpg', o: 'landscape' },
    { f: 'row-1-pic-4.jpg', o: 'landscape' },
    /* Row 2 */
    { f: 'row-2-pic-1.jpg', o: 'landscape' },
    { f: 'row-2-pic-2.jpg', o: 'landscape' },
    { f: 'row-2-pic-3.jpg', o: 'landscape' },
    { f: 'row-2-pic-4.jpg', o: 'landscape' },
    /* Row 3 */
    { f: 'row-3-pic-1.jpg', o: 'landscape' },
    { f: 'row-3-pic-2.jpg', o: 'landscape' },
    /* Row 4 */
    { f: 'row-4-pic-1.jpg', o: 'landscape' },
    { f: 'row-4-pic-2.jpg', o: 'landscape' },
    /* Row 5 */
    { f: 'row-5-pic-1.jpg', o: 'landscape' },
    { f: 'row-5-pic-2.jpg', o: 'landscape' },
    { f: 'row-5-pic-3.jpg', o: 'landscape' },
    { f: 'row-5-pic-4.jpg', o: 'landscape' },
    /* Row 6 */
    { f: 'row-6-pic-1.jpg', o: 'landscape' },
    { f: 'row-6-pic-2.jpg', o: 'landscape' },
    { f: 'row-6-pic-3.jpg', o: 'landscape' },
    { f: 'row-6-pic-4.jpg', o: 'landscape' },
    /* Row 7 */
    { f: 'row-7-pic-1.jpg', o: 'landscape' },
    { f: 'row-7-2.jpg',     o: 'landscape' },
    { f: 'row-7-pic-3.jpg', o: 'landscape' },
    { f: 'row-7-pic-4.jpg', o: 'landscape' },
    /* Row 8 */
    { f: 'row-8-pic-1.jpg', o: 'landscape' },
    { f: 'row-8-pic-2.jpg', o: 'landscape' },
    { f: 'row-8-pic-3.jpg', o: 'landscape' },
    { f: 'row-8-pic-4.jpg', o: 'landscape' },
    /* Row 9 */
    { f: 'row-9-pic-1.jpg', o: 'landscape' },
    { f: 'row-9-pic-2.jpg', o: 'landscape' },
    { f: 'row-9-pic-3.jpg', o: 'landscape' },
    { f: 'row-9-pic-4.jpg', o: 'landscape' },
    /* Row 10 */
    { f: 'row-10-pic-1.jpg', o: 'landscape' },
    { f: 'row-10-pic-2.jpg', o: 'landscape' },
    { f: 'row-10-pic-3.jpg', o: 'landscape' },
    { f: 'row-10-pic-4.jpg', o: 'landscape' },
  ],
});

const GALLERY_BASE_PATH = 'engagement-photoshoot/';
const PROPOSAL_GALLERY_BASE = 'proposalpics/The%20proposal/';

function galleryBase(item) {
  return item.proposal ? PROPOSAL_GALLERY_BASE : GALLERY_BASE_PATH;
}

/* ── 2 · DOM REFS / HELPERS ──────────────────────────── */
const veil       = document.getElementById('veil');
const nav        = document.getElementById('main-nav');
const mobileMenu = document.getElementById('mobile-menu');
const hamburger  = document.getElementById('hamburger');
const musicBtn   = document.getElementById('music-btn');
const audio      = document.getElementById('wedding-music');
const slideshow  = document.getElementById('slideshow');
const musicBanner = document.getElementById('music-banner');

let currentPage  = 'password';
let currentSlide = 0;
let slideTimer   = null;
let musicOn      = false;
/** Index into CONFIG.MUSIC_PLAYLIST — advances when each track finishes. */
let musicTrackIndex = 0;

function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
function page(id) { return document.getElementById('page-' + id); }

function musicPlaylistTracks() {
  const pl = CONFIG.MUSIC_PLAYLIST;
  return Array.isArray(pl) && pl.length ? pl : [];
}

function assignMusicTrack(index) {
  const tracks = musicPlaylistTracks();
  if (!audio || !tracks.length) return;
  const n = tracks.length;
  const i = ((index % n) + n) % n;
  musicTrackIndex = i;
  audio.pause();
  audio.src = tracks[i];
  audio.load();
}

/** Reset to track 1 (At Last); call when entering the site successfully. */
function restartMusicPlaylist() {
  if (!audio) return;
  audio.removeAttribute('loop');
  assignMusicTrack(0);
}

/* ── 3 · NAVIGATION ──────────────────────────────────── */
function goTo(name) {
  if (name === currentPage) return;

  veil.className = 'in';

  setTimeout(() => {
    page(currentPage)?.classList.remove('active');
    currentPage = name;
    const next = page(name);
    if (next) {
      next.classList.add('active');
      if (next.scrollTop !== undefined) next.scrollTop = 0;
    }

    if (name === 'password') {
      nav.classList.remove('show');
      nav.setAttribute('aria-hidden', 'true');
    } else {
      nav.classList.add('show');
      nav.removeAttribute('aria-hidden');
    }

    $$('.nav-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.page === name)
    );

    nav.classList.remove('frosted');
    checkFrost(0);

    veil.className = 'out';
  }, 380);
}

document.querySelectorAll('[data-page]').forEach(el => {
  el.addEventListener('click', evt => {
    if (el.tagName === 'A') evt.preventDefault();
    const p = el.dataset.page;
    if (p) {
      goTo(p);
      mobileMenu.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    }
  });
});

/* ── 4 · PASSWORD ────────────────────────────────────── */
const pwForm  = document.getElementById('pw-form');
const pwInput = document.getElementById('pw-input');
const pwError = document.getElementById('pw-error');

pwForm.addEventListener('submit', e => {
  e.preventDefault();
  if (pwInput.value === CONFIG.PASSWORD) {
    pwError.classList.remove('show');
    goTo('home');
    restartMusicPlaylist();
    /* Password submit IS a user gesture — ideal moment to start music. */
    tryStartMusic();
  } else {
    pwError.classList.add('show');
    pwInput.value = '';
    pwInput.classList.add('shake');
    pwInput.focus();
    setTimeout(() => pwInput.classList.remove('shake'), 450);
  }
});

/* ── 5 · SLIDESHOW ───────────────────────────────────── */
const slides = slideshow ? slideshow.querySelectorAll('.slide') : [];
const dots   = $$('.dot');

function gotoSlide(n) {
  if (!slides.length) return;
  slides[currentSlide].classList.remove('active');
  dots[currentSlide]?.classList.remove('active');
  currentSlide = ((n % CONFIG.SLIDE_COUNT) + CONFIG.SLIDE_COUNT) % CONFIG.SLIDE_COUNT;
  slides[currentSlide].classList.add('active');
  dots[currentSlide]?.classList.add('active');
}

function startSlideTimer() {
  clearInterval(slideTimer);
  slideTimer = setInterval(() => gotoSlide(currentSlide + 1), CONFIG.SLIDE_MS);
}

if (slides.length) {
  startSlideTimer();
  dots.forEach(d => {
    d.addEventListener('click', () => {
      gotoSlide(parseInt(d.dataset.slide, 10));
      startSlideTimer();
    });
  });
}

/* ── 6 · MUSIC: AUTOPLAY + BANNER FALLBACK ───────────── */
function setMusicState(on) {
  musicOn = on;
  if (musicBtn) {
    musicBtn.classList.toggle('playing', on);
    musicBtn.classList.toggle('muted', !on);
    musicBtn.setAttribute('aria-label', on ? 'Mute wedding music' : 'Play wedding music');
    musicBtn.setAttribute('title', on ? 'Mute music' : 'Play music');
  }
}

async function tryStartMusic() {
  if (!audio) return;
  audio.volume = 0.22;
  try {
    await audio.play();
    setMusicState(true);
    hideMusicBanner();
  } catch {
    /* Autoplay blocked — show banner. */
    setMusicState(false);
    showMusicBanner();
  }
}

function toggleMusic() {
  if (!audio) return;
  if (musicOn) {
    audio.pause();
    setMusicState(false);
  } else {
    audio.volume = 0.22;
    audio.play().then(() => {
      setMusicState(true);
      hideMusicBanner();
    }).catch(() => {
      /* Some browsers still block; surface the banner. */
      showMusicBanner();
    });
  }
}

function showMusicBanner() {
  if (!musicBanner) return;
  musicBanner.hidden = false;
}
function hideMusicBanner() {
  if (!musicBanner) return;
  musicBanner.hidden = true;
}

if (audio) {
  restartMusicPlaylist();
  audio.addEventListener('ended', () => {
    const tracks = musicPlaylistTracks();
    if (!tracks.length || !musicOn) return;
    assignMusicTrack(musicTrackIndex + 1);
    audio.volume = 0.22;
    audio.play().catch(() => {
      setMusicState(false);
      showMusicBanner();
    });
  });
}

musicBtn?.addEventListener('click', toggleMusic);

document.getElementById('music-banner-btn')?.addEventListener('click', () => {
  toggleMusic();
});
document.getElementById('music-banner-close')?.addEventListener('click', hideMusicBanner);

/* If music is blocked, the very next user click anywhere starts it. */
function bindGlobalUnlock() {
  const unlock = () => {
    if (!musicOn) tryStartMusic();
    document.removeEventListener('click', unlock);
    document.removeEventListener('keydown', unlock);
    document.removeEventListener('touchstart', unlock);
  };
  document.addEventListener('click', unlock, { once: false });
  document.addEventListener('keydown', unlock, { once: false });
  document.addEventListener('touchstart', unlock, { once: false });
}
bindGlobalUnlock();

/* ── 7 · HAMBURGER / MOBILE MENU ─────────────────────── */
hamburger?.addEventListener('click', () => {
  const open = mobileMenu.classList.toggle('open');
  hamburger.classList.toggle('open', open);
  hamburger.setAttribute('aria-expanded', String(open));
  mobileMenu.setAttribute('aria-hidden', String(!open));
});

document.addEventListener('click', e => {
  if (!nav.contains(e.target)) {
    mobileMenu.classList.remove('open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  }
});

/* ── 8 · FROSTED NAV ON SCROLL ───────────────────────── */
function checkFrost(scrollY) {
  nav.classList.toggle('frosted', scrollY > 55);
}
$$('.page.scrollable').forEach(p => {
  p.addEventListener('scroll', () => {
    if (p.id === 'page-' + currentPage) checkFrost(p.scrollTop);
  }, { passive: true });
});

/* ── 9 · INTERSECTION REVEAL ─────────────────────────── */
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

$$('.reveal').forEach(el => observer.observe(el));

/* ── KEYBOARD ────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    mobileMenu.classList.remove('open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    if (lightbox && !lightbox.hidden) closeLightbox();
  }
  if (e.key === 'Enter' && document.activeElement === pwInput) {
    pwForm.dispatchEvent(new Event('submit', { cancelable: true }));
  }
  if (lightbox && !lightbox.hidden) {
    if (e.key === 'ArrowRight') showLightbox(lbIndex + 1);
    if (e.key === 'ArrowLeft')  showLightbox(lbIndex - 1);
  }
});

/* ════════════════════════════════════════════════════════════
   10 · RSVP SYSTEM
   Storage shape per guest (localStorage key: wedding.rsvp.guest.<normalized_name>):
     {
       guest_name, first_name, last_name, email,
       arrival_datetime, arrival_airline, arrival_flight,
       departure_datetime, departure_airline, departure_flight,
       dinner, dietary_restrictions,
       emergency_name, emergency_phone,
       created_at, updated_at,
       submitted_to_formspree: bool
     }
════════════════════════════════════════════════════════════ */

const GUEST_LIST = [
  'Santana','Amaziah','Rose','Sam','Winston','Brooke','Juanita','Quinyonia',
  'Loko','Lee','Eposi','Melia','Ian','Sarah','Alicia','Beverly','Claire',
  'Danuta','Latrice','Ashley','Deidra','Randall','Calvin','Calvin plus one',
  'Sherice','Kyle','Miranda','Chi','Chi wife','Claudia','Shayla','Lea',
  'Julene','DJ','Natalie','Samantha','Yma','Yma plus one','Alexa','Brandi',
  'Lovett','Lovett plus one','Sarai','Sarai plus one','Samiya','Sergio',
  'Justice','Jenni','Davin','Morganne','Alaina','Marjorie','Larry','Sharon',
  'Bola','Oulani','Randolph','Shena','Kasheena'
];

function findGuest(input) {
  const q = input.trim().toLowerCase();
  return GUEST_LIST.find(n => n.toLowerCase() === q) || null;
}

function guestKey(guestName) {
  return CONFIG.LS_RSVP_PREFIX + 'guest.' + guestName.toLowerCase().replace(/\s+/g, '_');
}

function saveGuestRsvp(record) {
  record.updated_at = new Date().toISOString();
  localStorage.setItem(guestKey(record.guest_name), JSON.stringify(record));
}

function loadGuestRsvp(guestName) {
  const raw = localStorage.getItem(guestKey(guestName));
  return raw ? JSON.parse(raw) : null;
}

function setError(formKey, msg) {
  const el = document.querySelector(`[data-error-for="${formKey}"]`);
  if (el) el.textContent = msg || '';
}

const rsvpTabs        = $$('.rsvp-tab');
const rsvpPanelNew    = document.getElementById('rsvp-panel-new');
const rsvpPanelEdit   = document.getElementById('rsvp-panel-edit');
const rsvpNewForm     = document.getElementById('rsvp-new-form');
const rsvpLookupForm  = document.getElementById('rsvp-lookup-form');
const rsvpDetailsForm = document.getElementById('rsvp-details-form');
const rsvpDetailsWrap = document.getElementById('rsvp-details-wrap');
const rsvpDetailsName = document.getElementById('rsvp-details-name');
const rsvpSuccess     = document.getElementById('rsvp-success');

function rsvpSetTab(name) {
  rsvpTabs.forEach(t => {
    const active = t.dataset.rsvpTab === name;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', String(active));
  });
  rsvpPanelNew.classList.toggle('active', name === 'new');
  rsvpPanelEdit.classList.toggle('active', name === 'edit');
}
rsvpTabs.forEach(t => t.addEventListener('click', () => rsvpSetTab(t.dataset.rsvpTab)));

/* Step 1: New RSVP — verify name against guest list ─── */
rsvpNewForm?.addEventListener('submit', evt => {
  evt.preventDefault();
  setError('rsvp-new', '');
  const input = (new FormData(rsvpNewForm).get('first_name') || '').toString().trim();
  if (!input) { setError('rsvp-new', 'Please enter your first name.'); return; }
  const guestName = findGuest(input);
  if (!guestName) {
    setError('rsvp-new', 'Your name was not found on the guest list. Please check the spelling or contact us.');
    return;
  }
  let record = loadGuestRsvp(guestName);
  if (!record) {
    record = { guest_name: guestName, first_name: guestName.split(' ')[0], last_name: '', created_at: new Date().toISOString() };
    saveGuestRsvp(record);
  }
  rsvpNewForm.reset();
  loadRsvpIntoForm(record);
});

/* Step 2: Update RSVP — look up by first name ────────── */
rsvpLookupForm?.addEventListener('submit', evt => {
  evt.preventDefault();
  setError('rsvp-lookup', '');
  const input = (new FormData(rsvpLookupForm).get('first_name') || '').toString().trim();
  if (!input) { setError('rsvp-lookup', 'Please enter your first name.'); return; }
  const guestName = findGuest(input);
  if (!guestName) {
    setError('rsvp-lookup', 'Your name was not found on the guest list. Please check the spelling or contact us.');
    return;
  }
  const record = loadGuestRsvp(guestName);
  if (!record) {
    setError('rsvp-lookup', 'No RSVP found for that name yet. Please use the "New RSVP" tab to get started.');
    return;
  }
  rsvpLookupForm.reset();
  loadRsvpIntoForm(record);
});

/* Load a record into the details form ───────────────── */
function loadRsvpIntoForm(record) {
  // Hide the name-entry UI once we move to the full form
  document.querySelector('.rsvp-tabs').style.display = 'none';
  rsvpPanelNew.style.display  = 'none';
  rsvpPanelEdit.style.display = 'none';

  rsvpDetailsWrap.hidden = false;
  rsvpDetailsName.textContent = record.guest_name;
  rsvpSuccess.hidden = true;

  const setVal = (name, value) => {
    const el = rsvpDetailsForm.elements.namedItem(name);
    if (!el) return;
    if (el.type === 'radio' || el instanceof RadioNodeList) {
      rsvpDetailsForm.querySelectorAll(`input[name="${name}"]`).forEach(i => { i.checked = i.value === value; });
    } else {
      el.value = value || '';
    }
  };

  setVal('guest_name',           record.guest_name);
  setVal('first_name',           record.first_name);
  setVal('last_name',            record.last_name);
  setVal('email',                record.email);
  setVal('dinner',               record.dinner);
  setVal('dietary_restrictions', record.dietary_restrictions);
  setVal('emergency_name',       record.emergency_name);
  setVal('emergency_phone',      record.emergency_phone);
  setVal('arrival_datetime',     record.arrival_datetime);
  setVal('arrival_flight',       record.arrival_flight);
  setVal('arrival_airline',      record.arrival_airline);
  setVal('departure_datetime',   record.departure_datetime);
  setVal('departure_flight',     record.departure_flight);
  setVal('departure_airline',    record.departure_airline);

  rsvpDetailsWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* Save details (localStorage + optional Formspree) ──── */
rsvpDetailsForm?.addEventListener('submit', async evt => {
  evt.preventDefault();
  setError('rsvp-details', '');
  rsvpSuccess.hidden = true;

  const fd = new FormData(rsvpDetailsForm);
  const guestName = fd.get('guest_name');
  const existing  = loadGuestRsvp(guestName) || {};

  const record = {
    ...existing,
    guest_name:           guestName,
    first_name:           fd.get('first_name') || '',
    last_name:            fd.get('last_name')  || '',
    email:                fd.get('email')       || '',
    dinner:               fd.get('dinner')      || '',
    dietary_restrictions: fd.get('dietary_restrictions') || '',
    emergency_name:       fd.get('emergency_name')  || '',
    emergency_phone:      fd.get('emergency_phone') || '',
    arrival_datetime:     fd.get('arrival_datetime')  || '',
    arrival_flight:       fd.get('arrival_flight')    || '',
    arrival_airline:      fd.get('arrival_airline')   || '',
    departure_datetime:   fd.get('departure_datetime') || '',
    departure_flight:     fd.get('departure_flight')   || '',
    departure_airline:    fd.get('departure_airline')  || '',
    submitted_to_formspree: existing.submitted_to_formspree || false,
  };

  saveGuestRsvp(record);

  if (CONFIG.GSHEET_ENDPOINT) {
    try {
      // no-cors lets the request reach GAS without the browser blocking the cross-origin response
      await fetch(CONFIG.GSHEET_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(record),
      });
      record.submitted_to_formspree = true;
      saveGuestRsvp(record);
    } catch {
      setError('rsvp-details', 'Saved locally, but the email notification failed. Please try again or contact us.');
      return;
    }
  }

  rsvpSuccess.hidden = false;
  rsvpSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

/* ════════════════════════════════════════════════════════════
   11 · PICTURES GALLERY + LIGHTBOX
════════════════════════════════════════════════════════════ */
const galleryGrid = document.getElementById('gallery-grid');
const lightbox    = document.getElementById('lightbox');
const lbImage     = document.getElementById('lb-image');
const lbClose     = document.getElementById('lb-close');
const lbPrev      = document.getElementById('lb-prev');
const lbNext      = document.getElementById('lb-next');
let lbIndex = 0;

function buildGallery() {
  if (!galleryGrid) return;
  const frag = document.createDocumentFragment();
  const motionVariants = 8;
  CONFIG.GALLERY_IMAGES.forEach((item, idx) => {
    const cell = document.createElement('button');
    cell.className = `g-cell ${item.o === 'portrait' ? 'portrait' : 'landscape'}`;
    if (item.t) cell.classList.add('tall');
    if (item.w) cell.classList.add('wide');
    cell.type = 'button';
    cell.dataset.index = String(idx);
    cell.setAttribute('aria-label', `Open photo ${idx + 1} of ${CONFIG.GALLERY_IMAGES.length}`);

    const motion = document.createElement('span');
    motion.className = `g-cell-motion g-cell-motion--${idx % motionVariants}`;
    motion.setAttribute('aria-hidden', 'true');

    const img = document.createElement('img');
    img.src = galleryBase(item) + item.f;
    img.alt = `Engagement photo ${idx + 1}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    motion.appendChild(img);
    cell.appendChild(motion);

    cell.addEventListener('click', () => showLightbox(idx));
    frag.appendChild(cell);
  });
  galleryGrid.appendChild(frag);
}

function showLightbox(index) {
  if (!lightbox || !CONFIG.GALLERY_IMAGES.length) return;
  const total = CONFIG.GALLERY_IMAGES.length;
  lbIndex = ((index % total) + total) % total;
  const item = CONFIG.GALLERY_IMAGES[lbIndex];
  lbImage.src = galleryBase(item) + item.f;
  lbImage.alt = `Engagement photo ${lbIndex + 1} of ${total}`;
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  if (!lightbox) return;
  lightbox.hidden = true;
  lbImage.src = '';
  document.body.style.overflow = '';
}
lbClose?.addEventListener('click', closeLightbox);
lbPrev?.addEventListener('click', () => showLightbox(lbIndex - 1));
lbNext?.addEventListener('click', () => showLightbox(lbIndex + 1));
lightbox?.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

buildGallery();

/* ── WEDDING COUNTDOWN ───────────────────────────────── */
(function () {
  const target = new Date('2026-10-02T00:00:00');
  const els = {
    d: document.getElementById('cd-days'),
    h: document.getElementById('cd-hours'),
    m: document.getElementById('cd-mins'),
    s: document.getElementById('cd-secs'),
  };
  if (!els.d) return;

  function pad(n) { return String(n).padStart(2, '0'); }

  function tick() {
    const diff = target - Date.now();
    if (diff <= 0) {
      els.d.textContent = els.h.textContent = els.m.textContent = els.s.textContent = '00';
      return;
    }
    const days  = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins  = Math.floor((diff % 3600000)  / 60000);
    const secs  = Math.floor((diff % 60000)    / 1000);
    els.d.textContent = pad(days);
    els.h.textContent = pad(hours);
    els.m.textContent = pad(mins);
    els.s.textContent = pad(secs);
  }

  tick();
  setInterval(tick, 1000);
}());

/* ── PAYMENT MODAL ───────────────────────────────────── */
(function () {
  var modal      = document.getElementById('payment-modal');
  var closeBtn   = document.getElementById('pay-modal-close');
  var doneBtn    = document.getElementById('pay-done-btn');
  var confirmBtn = document.getElementById('pay-confirm-btn');
  var step1      = document.getElementById('pay-step-1');
  var step2      = document.getElementById('pay-step-2');
  if (!modal) return;

  function openModal(btn) {
    var title   = btn.dataset.title  || '';
    var price   = btn.dataset.price  || '';
    var type    = btn.dataset.type   || 'open';
    var spots   = btn.dataset.spots  || '';
    var goal    = btn.dataset.goal   || '';

    document.getElementById('pay-modal-exp-name').textContent = title;

    var detailParts = [];
    if (price)  detailParts.push('$' + price + ' per person');
    if (spots)  detailParts.push(spots + ' spot' + (spots > 1 ? 's' : '') + ' available');
    if (goal)   detailParts.push('Contribution goal: $' + goal);
    document.getElementById('pay-modal-exp-detail').textContent = detailParts.join(' · ');

    /* build amount options */
    var optionsEl   = document.getElementById('pay-amount-options');
    var customWrap  = document.getElementById('pay-custom-wrap');
    var customInput = document.getElementById('pay-custom-input');
    optionsEl.innerHTML = '';
    customWrap.hidden = true;
    customInput.value = '';

    if (type === 'fixed' && price) {
      /* show fixed price button(s) */
      var amts = [price];
      if (spots && parseInt(spots) === 2) amts = [price, parseInt(price) * 2];
      if (spots && parseInt(spots) === 4) amts = [price, parseInt(price) * 2, parseInt(price) * 4];
      amts.forEach(function (a) {
        var b = document.createElement('button');
        b.className = 'pay-amt-btn';
        b.textContent = a === price
          ? '$' + a + ' (1 spot)'
          : '$' + a + ' (' + Math.round(a / price) + ' spots)';
        b.addEventListener('click', function () {
          optionsEl.querySelectorAll('.pay-amt-btn').forEach(function(x){ x.classList.remove('selected'); });
          b.classList.add('selected');
        });
        optionsEl.appendChild(b);
      });
      /* select first by default */
      var first = optionsEl.querySelector('.pay-amt-btn');
      if (first) first.classList.add('selected');
    } else {
      /* open / any amount */
      customWrap.hidden = false;
    }

    /* memo text */
    document.getElementById('pay-memo-text').textContent = '"' + title + '"';

    /* show modal */
    step1.hidden = false;
    step2.hidden = true;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  /* wire purchase buttons */
  document.querySelectorAll('.exp-purchase-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { openModal(btn); });
  });

  /* close */
  closeBtn.addEventListener('click', closeModal);
  doneBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });

  /* confirm → show thank-you */
  confirmBtn.addEventListener('click', function () {
    step1.hidden = true;
    step2.hidden = false;
  });
}());

/* ── TRAVEL ESSENTIALS SHELF ─────────────────────────── */
(function () {
  var track   = document.getElementById('essentials-track');
  var prevBtn = document.querySelector('.ess-prev');
  var nextBtn = document.querySelector('.ess-next');
  if (!track || !prevBtn || !nextBtn) return;

  var SCROLL_AMT = 580; /* px per arrow click (~3 cards) */

  prevBtn.addEventListener('click', function () {
    track.scrollBy({ left: -SCROLL_AMT, behavior: 'smooth' });
  });
  nextBtn.addEventListener('click', function () {
    track.scrollBy({ left: SCROLL_AMT, behavior: 'smooth' });
  });

  /* click image → enlarge 30 % + show text; click again → restore */
  track.addEventListener('click', function (e) {
    var img = e.target.closest('.ess-img-wrap img');
    if (!img) return;
    var item = img.closest('.ess-item');
    var isActive = item.classList.contains('active');
    /* collapse everything first */
    track.querySelectorAll('.ess-item.active').forEach(function (el) {
      el.classList.remove('active');
      el.querySelector('.ess-img-wrap img').classList.remove('enlarged');
    });
    /* toggle the clicked one */
    if (!isActive) {
      item.classList.add('active');
      img.classList.add('enlarged');
    }
  });
}());

/* ── FAN CAROUSEL ────────────────────────────────────── */
(function () {

  function initFan(carousel) {
    var stage   = carousel.querySelector('.fan-stage');
    var dotsEl  = carousel.querySelector('.fan-dots');
    var prevBtn = carousel.querySelector('.fan-prev');
    var nextBtn = carousel.querySelector('.fan-next');
    if (!stage || !prevBtn || !nextBtn) return;

    var slides = Array.from(stage.querySelectorAll('.fan-slide'));
    if (slides.length === 0) return;

    var cur = 0;

    /* ── layout constants ── */
    var SLIDE_W   = 220;   /* px — matches CSS .fan-slide width  */
    var SPACING   = 210;   /* px between slide centres           */
    var DROP      = 55;    /* px slide drops per step from centre */
    var SCALE_STEP = 0.18; /* scale reduction per step           */
    var MAX_VISIBLE = 2;   /* slides shown each side of centre   */

    function render() {
      slides.forEach(function (slide, i) {
        var offset  = i - cur;
        var abs     = Math.abs(offset);
        var visible = abs <= MAX_VISIBLE;

        slide.style.opacity       = visible ? (abs === 0 ? '1' : abs === 1 ? '0.82' : '0.58') : '0';
        slide.style.pointerEvents = (abs === 0) ? 'auto' : 'none';
        slide.style.zIndex        = visible ? String(MAX_VISIBLE + 1 - abs) : '0';

        if (!visible) return;

        var tx    = offset * SPACING;          /* horizontal offset in px   */
        var ty    = abs * DROP;                /* drop down from centre     */
        var sc    = 1 - abs * SCALE_STEP;     /* shrink away from centre   */

        /* centre the slide: -50% of its own width, then shift by tx */
        slide.style.transform =
          'translateX(calc(-50% + ' + tx + 'px)) ' +
          'translateY(' + ty + 'px) ' +
          'scale(' + sc + ')';
      });

      /* update dots */
      Array.from(dotsEl.querySelectorAll('.fan-dot')).forEach(function (d, i) {
        d.classList.toggle('active', i === cur);
      });
    }

    /* ── build dots ── */
    slides.forEach(function (_, i) {
      var dot = document.createElement('button');
      dot.className = 'fan-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'Slide ' + (i + 1));
      dot.addEventListener('click', function () { go(i); });
      dotsEl.appendChild(dot);
    });

    function go(idx) {
      cur = (idx + slides.length) % slides.length;
      render();
    }

    prevBtn.addEventListener('click', function () { go(cur - 1); });
    nextBtn.addEventListener('click', function () { go(cur + 1); });

    /* swipe */
    var startX = 0;
    stage.addEventListener('touchstart', function (e) {
      startX = e.touches[0].clientX;
    }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1));
    }, { passive: true });

    /* click side images to jump to them */
    slides.forEach(function (slide, i) {
      slide.addEventListener('click', function () {
        if (i !== cur) go(i);
      });
    });

    render();
  }

  document.querySelectorAll('.fan-carousel').forEach(initFan);
}());

/* ── 12 · PAYMENT MODAL ──────────────────────────────── */
(function () {
  var modal      = document.getElementById('payment-modal');
  var step1      = document.getElementById('pay-step-1');
  var step2      = document.getElementById('pay-step-2');
  var titleEl    = document.getElementById('pay-modal-exp-name');
  var detailEl   = document.getElementById('pay-modal-exp-detail');
  var amtOptions = document.getElementById('pay-amount-options');
  var customWrap = document.getElementById('pay-custom-wrap');
  var customIn   = document.getElementById('pay-custom-input');
  var paypalLink = document.getElementById('pay-paypal-val');
  var venmoLink  = document.getElementById('pay-venmo-val');
  var memoText   = document.getElementById('pay-memo-text');
  var copyBtn    = document.getElementById('pay-zelle-copy');

  function updateLinks(amount, title) {
    var note = encodeURIComponent(title);
    if (amount) {
      paypalLink.href = 'https://paypal.me/simplysantana/' + amount;
      venmoLink.href  = 'https://venmo.com/santanah?txn=pay&amount=' + amount + '&note=' + note;
    } else {
      paypalLink.href = 'https://paypal.me/simplysantana';
      venmoLink.href  = 'https://venmo.com/santanah';
    }
  }

  function openModal(btn) {
    var title  = btn.dataset.title;
    var price  = btn.dataset.price;
    var type   = btn.dataset.type;
    var detail = btn.closest('.exp-body').querySelector('.exp-detail').textContent;

    titleEl.textContent  = title;
    detailEl.textContent = detail;
    memoText.textContent = '"' + title + '"';

    // Amount options
    amtOptions.innerHTML = '';
    customWrap.hidden = true;

    if (type === 'fixed' && price) {
      var perPerson = document.createElement('button');
      perPerson.className = 'pay-amt-btn selected';
      perPerson.textContent = '$' + price + ' per person';
      perPerson.type = 'button';
      amtOptions.appendChild(perPerson);

      var customBtn = document.createElement('button');
      customBtn.className = 'pay-amt-btn';
      customBtn.textContent = 'Custom amount';
      customBtn.type = 'button';
      customBtn.addEventListener('click', function () {
        document.querySelectorAll('.pay-amt-btn').forEach(function (b) { b.classList.remove('selected'); });
        customBtn.classList.add('selected');
        customWrap.hidden = false;
        customIn.value = '';
        updateLinks('', title);
        customIn.focus();
      });
      perPerson.addEventListener('click', function () {
        document.querySelectorAll('.pay-amt-btn').forEach(function (b) { b.classList.remove('selected'); });
        perPerson.classList.add('selected');
        customWrap.hidden = true;
        updateLinks(price, title);
      });
      amtOptions.appendChild(customBtn);

      // Live-update links as custom amount is typed
      customIn.addEventListener('input', function () {
        updateLinks(customIn.value || '', title);
      });

      // Pre-fill PayPal/Venmo links with fixed price
      updateLinks(price, title);
    } else {
      // Open contribution — show custom input only
      customWrap.hidden = false;
      customIn.value = '';
      updateLinks('', title);
      customIn.addEventListener('input', function () {
        updateLinks(customIn.value || '', title);
      });
    }

    step1.hidden = false;
    step2.hidden = true;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  // Wire purchase buttons
  document.querySelectorAll('.exp-purchase-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { openModal(btn); });
  });

  // Close triggers
  document.getElementById('pay-modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  // Confirm → thank you step
  document.getElementById('pay-confirm-btn').addEventListener('click', function () {
    step1.hidden = true;
    step2.hidden = false;
  });

  // Done
  document.getElementById('pay-done-btn').addEventListener('click', closeModal);

  // Zelle copy
  copyBtn.addEventListener('click', function () {
    navigator.clipboard.writeText(copyBtn.dataset.copy).then(function () {
      copyBtn.textContent = 'Copied!';
      setTimeout(function () { copyBtn.textContent = 'Copy Email'; }, 2000);
    });
  });
}());
