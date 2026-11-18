// ============================================================
//  ADEMUJIMI DANIEL – PORTFOLIO APP
//  Firebase: Auth (admin login) + Firestore (projects, messages)
//  Features: Admin panel, Projects CRUD, Contact form,
//            Lead auto-reply (Brevo), Counters, Scroll reveal
//  IDs in this file match index.html exactly.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, deleteDoc,
  getDocs, getDoc, serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// ── Firebase config ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBQuF6x2Fz2f09w084LaNQmPbD7qrRjIpA",
  authDomain: "webtek-portfolio.firebaseapp.com",
  projectId: "webtek-portfolio",
  storageBucket: "webtek-portfolio.firebasestorage.app",
  messagingSenderId: "72580997254",
  appId: "1:72580997254:web:a92fa454e6273155743107"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── Config (add your Brevo key when ready) ───────────────────
const CFG = {
  brevoKey:  'YOUR_BREVO_API_KEY',
  emailFrom: 'ademujimidaniel4@gmail.com',
  fromName:  'Ademujimi Daniel',
};

// ── Helpers ──────────────────────────────────────────────────
const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function esc(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(ts) {
  const d = ts && ts.toDate ? ts.toDate() : new Date(ts || Date.now());
  return d.toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' });
}

function toast(msg, type = 'success') {
  const t = $('toast');
  t.textContent = (type === 'success' ? '✅ ' : '❌ ') + msg;
  t.className = 'toast show';
  setTimeout(() => { t.className = 'toast'; }, 3500);
}

function shotUrl(url) {
  if (!url || url === '#') return '';
  return `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`;
}

// ── Visitor count (Firestore) ─────────────────────────────────
async function trackVisit() {
  try {
    const ref  = doc(db, 'meta', 'visits');
    const snap = await getDoc(ref);
    const cur  = snap.exists() ? (snap.data().count || 0) : 0;
    await setDoc(ref, { count: cur + 1, lastVisit: serverTimestamp() }, { merge: true });
  } catch (_) {}
}
trackVisit();

// ── Navbar ────────────────────────────────────────────────────
const navbar   = $('navbar');
const toggle   = $('burger');
const navLinks = $('nav-links');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

toggle.addEventListener('click', () => {
  toggle.classList.toggle('open');
  navLinks.classList.toggle('open');
});

$$('#nav-links a').forEach(a => {
  a.addEventListener('click', () => {
    toggle.classList.remove('open');
    navLinks.classList.remove('open');
  });
});

// Active nav highlight on scroll
const sections = $$('section[id]');
window.addEventListener('scroll', () => {
  let cur = '';
  sections.forEach(s => { if (window.scrollY >= s.offsetTop - 120) cur = s.id; });
  $$('#nav-links a[href^="#"]').forEach(a => {
    a.style.color = a.getAttribute('href') === `#${cur}` ? '#ffffff' : '';
  });
}, { passive: true });

// ── Counter animation (.count with data-to) ───────────────────
function animCount(elem) {
  const target = parseInt(elem.dataset.to, 10) || 0;
  let cur = 0;
  const step = Math.max(1, Math.ceil(target / 60));
  const t = setInterval(() => {
    cur = Math.min(cur + step, target);
    elem.textContent = cur;
    if (cur >= target) clearInterval(t);
  }, 25);
}

const heroStats = document.querySelector('.hero-stats');
if (heroStats) {
  const statsObs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      $$('.count').forEach(animCount);
      statsObs.disconnect();
    }
  }, { threshold: 0.3 });
  statsObs.observe(heroStats);
}

// ── Scroll reveal ─────────────────────────────────────────────
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); revealObs.unobserve(e.target); }
  });
}, { threshold: 0.12 });

function addReveal(sel, baseDelay = 0) {
  $$(sel).forEach((elem, i) => {
    elem.classList.add('reveal');
    elem.style.transitionDelay = `${baseDelay + i * 0.08}s`;
    revealObs.observe(elem);
  });
}
addReveal('.service-card');
addReveal('.review-card', 0.05);
addReveal('.info-item', 0.05);
addReveal('.about-photo-col');
addReveal('.about-text-col');

// ── Projects (public view) ─────────────────────────────────────
const EMOJI = { ecommerce: '🛒', business: '🌐', automation: '⚡' };
let allProjects = [];

function getSamples() {
  return [
    { id:'s1', title:'GadgetHub NG', category:'ecommerce', desc:'Full e-commerce store with Paystack payment, admin dashboard, and order management.', url:'#', tech:['HTML','CSS','JS','Firebase','Paystack'], img:'' },
    { id:'s2', title:'Techdive Innovations', category:'business', desc:'Tech training company website with Firebase backend, admin panel, and contact form.', url:'#', tech:['HTML','CSS','JS','Firebase'], img:'' },
    { id:'s3', title:'Lead Capture System', category:'automation', desc:'Smart lead form with auto email follow-up so no enquiry is ever missed.', url:'#', tech:['JS','Brevo','Firebase'], img:'' },
  ];
}

async function loadProjects() {
  const loading = $('proj-loading');
  const grid    = $('proj-grid');
  loading.style.display = 'flex';
  grid.innerHTML = '';

  try {
    const q    = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    allProjects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (_) {
    // Firestore not ready yet, so show samples and the page is not empty
    allProjects = getSamples();
  }

  loading.style.display = 'none';
  const active = document.querySelector('.filter-btn.active, .filter-tab.active');
  renderProjects(active ? active.dataset.f : 'all');
}

function renderProjects(filter) {
  const grid  = $('proj-grid');
  const empty = $('proj-empty');
  const list  = filter === 'all' ? allProjects : allProjects.filter(p => p.category === filter);
  grid.innerHTML = '';
  empty.style.display = list.length ? 'none' : 'block';

  list.forEach(p => {
    const src  = p.img || shotUrl(p.url);
    const card = document.createElement('div');
    card.className = 'proj-card reveal';
    card.innerHTML = `
      <div class="proj-thumb">
        ${src
          ? `<img src="${esc(src)}" alt="${esc(p.title)} preview" loading="lazy"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
             <span class="proj-thumb-emoji" style="display:none">${EMOJI[p.category] || '💻'}</span>`
          : `<span class="proj-thumb-emoji">${EMOJI[p.category] || '💻'}</span>`}
        <span class="proj-cat-badge">${esc(p.category)}</span>
      </div>
      <div class="proj-body">
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.desc)}</p>
        <div class="proj-techs">${(p.tech || []).map(t => `<span>${esc(t)}</span>`).join('')}</div>
      </div>`;
    card.addEventListener('click', () => openProjectModal(p));
    grid.appendChild(card);
    revealObs.observe(card);
  });
}

// Filter buttons (works with class filter-btn or filter-tab)
$$('.filter-btn, .filter-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.filter-btn, .filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderProjects(btn.dataset.f);
  });
});

// Project detail modal
function openProjectModal(p) {
  const src = p.img || shotUrl(p.url);
  $('proj-detail').innerHTML = `
    <div class="proj-thumb" style="border-radius:12px;margin-bottom:1.4rem;height:200px;">
      ${src
        ? `<img src="${esc(src)}" alt="${esc(p.title)}" style="width:100%;height:100%;object-fit:cover;object-position:top"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
           <span style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:3rem">${EMOJI[p.category] || '💻'}</span>`
        : `<span style="font-size:3rem">${EMOJI[p.category] || '💻'}</span>`}
    </div>
    <h2>${esc(p.title)}</h2>
    <p style="color:var(--text2);line-height:1.75;font-size:.9rem;margin:.5rem 0 1.2rem">${esc(p.desc)}</p>
    <div class="proj-techs" style="margin-bottom:1.4rem">${(p.tech || []).map(t => `<span>${esc(t)}</span>`).join('')}</div>
    ${p.url && p.url !== '#'
      ? `<a href="${esc(p.url)}" target="_blank" rel="noopener" class="btn-primary">View Live Site →</a>`
      : `<span style="color:var(--text3);font-size:.88rem">Live link coming soon</span>`}`;
  $('proj-overlay').classList.add('open');
}

$('proj-close').addEventListener('click', () => $('proj-overlay').classList.remove('open'));
$('proj-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});

// ── Contact form + lead auto-reply ───────────────────────────
const contactForm = $('contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', async e => {
    e.preventDefault();
    const name    = $('name').value.trim();
    const email   = $('email').value.trim();
    const service = $('f-service').value;
    const message = $('message').value.trim();
    const honey   = contactForm.querySelector('[name="hp"]').value;
    const btn     = $('form-submit');
    const status  = $('form-status');

    // Honeypot check (bot protection)
    if (honey) return;

    // Clear errors
    [['name','err-name'],['email','err-email'],['message','err-msg']].forEach(([f, errId]) => {
      $(errId).textContent = '';
      $(f).style.borderColor = '';
    });

    let err = false;
    if (!name || name.length < 2) { $('err-name').textContent = 'Please enter your full name.'; $('name').style.borderColor = '#dc2626'; err = true; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $('err-email').textContent = 'Please enter a valid email.'; $('email').style.borderColor = '#dc2626'; err = true; }
    if (!message || message.length < 10) { $('err-msg').textContent = 'Please write at least 10 characters.'; $('message').style.borderColor = '#dc2626'; err = true; }
    if (err) return;

    btn.disabled = true;
    btn.textContent = 'Sending…';

    // Save to Firestore
    try {
      await addDoc(collection(db, 'messages'), { name, email, service, message, createdAt: serverTimestamp(), read: false });
    } catch (_) {}

    // Send auto-reply via Brevo
    await sendBrevo({
      toEmail: email, toName: name,
      subject: `Got your message, ${name.split(' ')[0]}!`,
      html: buildReplyEmail(name, service, message)
    });

    status.className = 'form-status ok';
    status.textContent = `✅ Message sent! Check your email (${email}) for confirmation.`;
    contactForm.reset();
    btn.disabled = false;
    btn.textContent = 'Send Message';
    toast("Message sent! I'll reply within 24 hours.");
  });
}

function buildReplyEmail(name, service, msg) {
  const n  = name.split(' ')[0];
  const sv = { ecommerce:'E-commerce Website', business:'Business Website', automation:'Lead Automation', other:'Custom Project' };
  return `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto">
    <div style="background:#1a2744;padding:2rem;text-align:center;border-radius:14px 14px 0 0">
      <h1 style="color:#fff;margin:0;font-size:1.5rem">Got your message!</h1>
    </div>
    <div style="background:#fff;padding:2rem;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 14px 14px">
      <p>Hi <strong>${esc(n)}</strong>,</p>
      <p>Thanks for reaching out. I received your message and will reply <strong>within 24 hours</strong>.</p>
      ${service ? `<p>You're interested in: <strong>${esc(sv[service] || service)}</strong></p>` : ''}
      <div style="background:#eef1f7;border-left:4px solid #1a2744;padding:1rem 1.2rem;border-radius:0 8px 8px 0;margin:1.5rem 0">
        <p style="margin:0;font-size:.9rem;color:#555"><em>"${esc(msg.slice(0,200))}${msg.length > 200 ? '…' : ''}"</em></p>
      </div>
      <p>Talk soon,<br/><strong>Ademujimi Daniel</strong><br/><span style="color:#1a2744">Web Developer</span></p>
    </div>
  </div>`;
}

async function sendBrevo({ toEmail, toName, subject, html }) {
  if (!CFG.brevoKey || CFG.brevoKey === 'YOUR_BREVO_API_KEY') return;
  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'accept': 'application/json', 'api-key': CFG.brevoKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { name: CFG.fromName, email: CFG.emailFrom },
        to: [{ email: toEmail, name: toName }],
        subject, htmlContent: html
      })
    });
  } catch (_) {}
}

//admin
const adminOverlay = $('admin-overlay');
const trigger      = $('admin-trigger');
let tapCount = 0, tapTimer;

trigger.addEventListener('click', e => {
  e.preventDefault();
  tapCount++;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => { tapCount = 0; }, 1800);
  if (tapCount >= 5) { tapCount = 0; adminOverlay.classList.add('open'); }
});

$('admin-close').addEventListener('click', () => adminOverlay.classList.remove('open'));
adminOverlay.addEventListener('click', e => { if (e.target === adminOverlay) adminOverlay.classList.remove('open'); });

// ── Firebase Auth state ───────────────────────────────────────
onAuthStateChanged(auth, user => {
  $('view-login').style.display = user ? 'none'  : 'block';
  $('view-dash').style.display  = user ? 'block' : 'none';
  if (user) loadDashboard();
});

// Login
$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = $('login-err');
  const btn   = $('login-btn');
  btn.disabled = true;
  btn.textContent = 'Logging in…';
  errEl.style.display = 'none';
  try {
    await signInWithEmailAndPassword(auth, $('a-email').value.trim(), $('a-pass').value);
  } catch (_) {
    errEl.textContent = '❌ Wrong email or password.';
    errEl.className   = 'form-status fail';
    errEl.style.display = 'block';
  }
  btn.disabled = false;
  btn.textContent = 'Login';
});

// Logout
$('logout-btn').addEventListener('click', () => signOut(auth).then(() => toast('Logged out.')));

// Dashboard tabs
$$('.dtab').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.dtab').forEach(b => b.classList.remove('active'));
    $$('.dpane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(`pane-${btn.dataset.t}`).classList.add('active');
  });
});

async function loadDashboard() {
  try {
    const snap = await getDoc(doc(db, 'meta', 'visits'));
    $('ov-visits').textContent = snap.exists() ? (snap.data().count || 0) : 0;
  } catch (_) { $('ov-visits').textContent = '—'; }

  try { $('ov-msgs').textContent  = (await getDocs(collection(db, 'messages'))).size; } catch (_) {}
  try { $('ov-projs').textContent = (await getDocs(collection(db, 'projects'))).size; } catch (_) {}

  renderAdminProjects();
  renderAdminMessages();
}

// ── Admin: generate screenshot preview ────────────────────────
$('gen-preview').addEventListener('click', () => {
  const url    = $('pf-url').value.trim();
  const status = $('preview-status');

  if (!url.startsWith('http')) {
    status.textContent = '⚠️ Enter a valid live URL first.';
    status.className = 'preview-status fail';
    return;
  }
  status.textContent = 'Generating…';
  status.className = 'preview-status';

  const src = shotUrl(url);
  const img = new Image();
  img.onload = () => {
    $('pf-img').value = src;
    $('preview-thumb').src = src;
    $('preview-thumb-wrap').style.display = 'block';
    status.textContent = '✅ Preview ready!';
    status.className = 'preview-status ok';
  };
  img.onerror = () => {
    status.textContent = '❌ Could not generate. Paste an image URL instead.';
    status.className = 'preview-status fail';
  };
  img.src = src;
});

$('pf-img').addEventListener('input', () => {
  const v = $('pf-img').value.trim();
  if (v.startsWith('http')) {
    $('preview-thumb').src = v;
    $('preview-thumb-wrap').style.display = 'block';
  } else {
    $('preview-thumb-wrap').style.display = 'none';
  }
});

// ── Admin: Projects ────────────────────────────────────────────
function resetProjForm() {
  $('proj-form').reset();
  $('pf-id').value = '';
  $('preview-thumb-wrap').style.display = 'none';
  $('preview-status').textContent = '';
  $('preview-status').className = 'preview-status';
}

$('show-proj-form').addEventListener('click', () => {
  resetProjForm();
  $('proj-form-area').style.display = 'block';
});

$('pf-cancel').addEventListener('click', () => {
  $('proj-form-area').style.display = 'none';
  resetProjForm();
});

$('proj-form').addEventListener('submit', async e => {
  e.preventDefault();
  const id   = $('pf-id').value;
  const data = {
    title:    $('pf-title').value.trim(),
    category: $('pf-cat').value,
    desc:     $('pf-desc').value.trim(),
    url:      $('pf-url').value.trim(),
    img:      $('pf-img').value.trim(),
    tech:     $('pf-tech').value.split(',').map(t => t.trim()).filter(Boolean),
  };

  if (!data.title || !data.desc || !data.url) { toast('Fill all required fields.', 'error'); return; }

  const btn = $('pf-save');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    if (id) {
      await setDoc(doc(db, 'projects', id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
      toast('Project updated!');
    } else {
      await addDoc(collection(db, 'projects'), { ...data, createdAt: serverTimestamp() });
      toast('Project added!');
    }
    $('proj-form-area').style.display = 'none';
    resetProjForm();
    renderAdminProjects();
    loadProjects();
    loadDashboard();
  } catch (_) { toast('Error saving. Check your Firestore rules.', 'error'); }

  btn.disabled = false;
  btn.textContent = 'Save Project';
});

async function renderAdminProjects() {
  const list = $('admin-proj-list');
  list.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  try {
    const snap = await getDocs(query(collection(db, 'projects'), orderBy('createdAt', 'desc')));
    if (!snap.size) {
      list.innerHTML = '<p style="color:var(--text3);font-size:.88rem;padding:1rem 0">No projects yet. Click "Add Project" to start.</p>';
      return;
    }
    list.innerHTML = '';
    snap.forEach(d => {
      const p   = { id: d.id, ...d.data() };
      const div = document.createElement('div');
      div.className = 'a-proj';
      div.innerHTML = `
        <div style="flex:1;min-width:0">
          <h4>${esc(p.title)}</h4>
          <p>${esc(p.category)} · ${esc((p.desc || '').slice(0,80))}…</p>
          <p style="margin-top:.25rem"><a href="${esc(p.url)}" target="_blank" style="color:var(--navy);font-size:.78rem">${esc(p.url)}</a></p>
        </div>
        <div class="a-proj-btns">
          <button class="btn-edit">Edit</button>
          <button class="btn-del">Delete</button>
        </div>`;
      div.querySelector('.btn-edit').addEventListener('click', () => editProject(p));
      div.querySelector('.btn-del').addEventListener('click', () => deleteProject(p.id));
      list.appendChild(div);
    });
  } catch (_) { list.innerHTML = '<p style="color:#dc2626;font-size:.85rem">Could not load projects.</p>'; }
}

function editProject(p) {
  $('pf-id').value    = p.id;
  $('pf-title').value = p.title || '';
  $('pf-cat').value   = p.category || 'ecommerce';
  $('pf-desc').value  = p.desc || '';
  $('pf-url').value   = p.url || '';
  $('pf-img').value   = p.img || '';
  $('pf-tech').value  = (p.tech || []).join(', ');
  $('preview-status').textContent = '';
  if (p.img) {
    $('preview-thumb').src = p.img;
    $('preview-thumb-wrap').style.display = 'block';
  } else {
    $('preview-thumb-wrap').style.display = 'none';
  }
  $('proj-form-area').style.display = 'block';
  $('proj-form-area').scrollIntoView({ behavior: 'smooth' });
}

async function deleteProject(id) {
  if (!confirm('Delete this project? This cannot be undone.')) return;
  try {
    await deleteDoc(doc(db, 'projects', id));
    toast('Project deleted.');
    renderAdminProjects();
    loadProjects();
    loadDashboard();
  } catch (_) { toast('Error deleting project.', 'error'); }
}

// ── Admin: Messages ────────────────────────────────────────────
async function renderAdminMessages() {
  const list = $('admin-msg-list');
  list.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  try {
    const snap = await getDocs(query(collection(db, 'messages'), orderBy('createdAt', 'desc')));
    if (!snap.size) {
      list.innerHTML = '<p style="color:var(--text3);font-size:.88rem;padding:1rem 0">No messages yet.</p>';
      return;
    }
    list.innerHTML = '';
    snap.forEach(d => {
      const m   = { id: d.id, ...d.data() };
      const div = document.createElement('div');
      div.className = 'a-msg';
      div.innerHTML = `
        <div class="a-msg-top">
          <strong>${esc(m.name)}</strong>
          <span>${esc(m.email)}</span>
          <span>${fmtDate(m.createdAt)}</span>
          ${m.service ? `<span class="svc-pill">${esc(m.service)}</span>` : ''}
        </div>
        <p>${esc(m.message)}</p>
        <a href="mailto:${esc(m.email)}?subject=Re: Your Project Enquiry" class="btn-edit"
           style="text-decoration:none;display:inline-block;margin-top:.4rem">Reply via Email</a>`;
      list.appendChild(div);
    });
  } catch (_) { list.innerHTML = '<p style="color:#dc2626;font-size:.85rem">Could not load messages.</p>'; }
}

// ── Footer year ───────────────────────────────────────────────
$('yr').textContent = new Date().getFullYear();

// ── Init ──────────────────────────────────────────────────────
loadProjects();
