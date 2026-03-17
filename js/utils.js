// ============================================================
// utils.js — Shared utility functions
// ============================================================

// ===== TOAST =====
export function showToast(msg, duration = 2800) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.innerHTML = '<span></span>';
    document.body.appendChild(t);
  }
  t.querySelector('span').textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateY(0)';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
  }, duration);
}

// ===== DATE FORMATTING =====
export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

export function formatTimestamp(ts) {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

// ===== TEXT PROCESSING (XSS safe) =====
export function processText(t) {
  if (!t) return '';
  const escaped = t
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  return escaped
    .replace(/#(\w+)/g, '<span class="hashtag">#$1</span>')
    .replace(/@(\w+)/g, '<span class="mention">@$1</span>');
}

// ===== SLUGIFY =====
export function slugify(text) {
  return (text || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60);
}

// ===== READING TIME =====
export function readingTime(title = '', desc = '') {
  return Math.max(1, Math.ceil((title.length + desc.length) / 200));
}

// ===== VERIFIED SOURCES =====
const VERIFIED = ['ndtv','times of india','hindustan times','the hindu','bbc','cnn',
  'reuters','ap','pti','ani','zee news','aaj tak','india today','economic times',
  'mint','bloomberg','wsj','guardian'];
export function isVerified(source) {
  return VERIFIED.some(v => (source || '').toLowerCase().includes(v));
}

// ===== CATEGORY COLOR =====
export function catColor(cat) {
  const map = {
    politics:'#ea4335', sports:'#34a853', technology:'#1a73e8', tech:'#1a73e8',
    entertainment:'#9334e6', business:'#f29900', health:'#e91e8c',
    science:'#00bcd4', environment:'#34a853', world:'#ff5722'
  };
  return map[(cat || '').toLowerCase()] || '#5f6368';
}

// ===== THEME =====
export function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') document.documentElement.classList.add('dark');
  const icon = document.getElementById('theme-icon');
  if (icon) icon.className = saved === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  const toggle = document.getElementById('dark-mode-toggle-switch');
  if (toggle) toggle.checked = saved === 'dark';
}

export function toggleDarkMode(val) {
  let isDark;
  if (typeof val === 'boolean') isDark = val;
  else isDark = !document.documentElement.classList.contains('dark');
  document.documentElement.classList.toggle('dark', isDark);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  const icon = document.getElementById('theme-icon');
  if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
  const toggle = document.getElementById('dark-mode-toggle-switch');
  if (toggle) toggle.checked = isDark;
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', isDark ? '#0f0f0f' : '#ffffff');
}

// ===== PAGE NAVIGATION =====
export function navigate(path) {
  window.location.href = path;
}

// ===== HIDE LOADING =====
export function hideLoading() {
  const el = document.getElementById('loading-overlay');
  if (!el) return;
  el.style.pointerEvents = 'none';
  el.classList.add('done');
  setTimeout(() => { el.style.display = 'none'; }, 600);
}

// ===== BOTTOM NAV ACTIVE =====
export function setActiveNav(id) {
  document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(id);
  if (btn) btn.classList.add('active');
}
