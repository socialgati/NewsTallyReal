// NewsTally — News: Fetch, Process, Render, Carousel

// ===== NEWS DATA FETCHING (OPTIMIZED WITH SHEETS REST API) =====
async function fetchNews() {
  const now = Date.now();
  if (newsCache && (now - newsCacheTime) < CACHE_DURATION) {
    processNewsData(newsCache);
    hideLoading();
    return;
  }
  try {
    // Primary: Sheets REST API v4 with API Key (fastest)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${SHEETS_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('API error ' + res.status);
    const json = await res.json();
    if (!json.values || json.values.length < 2) throw new Error('No data');
    // Column mapping: [0]=id, [1]=headline, [2]=source, [3]=date, [4]=description, [5]=url, [6]=category, [7]=image
    const rows = json.values.slice(1);
    const data = rows.map((r, i) => ({
      id: r[0] || String(i),
      headline: r[1] || '',
      source: r[2] || 'NewsTally',
      date: r[3] || '',
      description: r[4] || '',
      url: r[5] || '#',
      category: r[6] || 'General',
      image: (r[7] && r[7].startsWith('http')) ? r[7] : `https://placehold.co/800x450/1a1a25/f0ede8?text=${encodeURIComponent(r[6]||'News')}`
    })).filter(r => r.headline);
    newsCache = data;
    newsCacheTime = now;
    processNewsData(data);
  } catch (err) {
    console.warn('Primary fetch failed, trying fallback...', err);
    try {
      // Fallback: GVIZ API (works if sheet is public, no key needed)
      const gUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;
      const r2 = await fetch(gUrl);
      const text = await r2.text();
      const j2 = JSON.parse(text.substring(47).slice(0, -2));
      const v = (row, idx) => row.c[idx] ? (row.c[idx].v !== null ? String(row.c[idx].v) : '') : '';
      const data2 = j2.table.rows.map((row, i) => ({
        id: v(row,0) || String(i),
        headline: v(row,1),
        source: v(row,2) || 'NewsTally',
        date: v(row,3),
        description: v(row,4),
        url: v(row,5) || '#',
        category: v(row,6) || 'General',
        image: (v(row,7) && v(row,7).startsWith('http')) ? v(row,7) : `https://placehold.co/800x450/1a1a25/f0ede8?text=${encodeURIComponent(v(row,6)||'News')}`
      })).filter(r => r.headline);
      newsCache = data2;
      newsCacheTime = Date.now();
      processNewsData(data2);
    } catch(err2) {
      console.error('Both fetch methods failed:', err2);
      showToast('News load nahi hui. Sheet public karein.');
      document.getElementById('news-grid').innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--muted)"><i class="fas fa-wifi-slash" style="font-size:36px;margin-bottom:16px;display:block;opacity:0.4"></i><p style="font-weight:700;font-size:16px;margin-bottom:6px">News load nahi hui</p><p style="font-size:13px">Google Sheet public karein: Share → Anyone with link → Viewer</p></div>`;
      hideLoading();
    }
  }
}

function processNewsData(data) {
  // Reverse so latest (last row in sheet) appears first
  const reversed = [...data].reverse();
  allNewsData = reversed.map((row, i) => ({
    id: row.id || String(i),
    title: row.headline || row.title || '',
    description: row.description || row.desc || '',
    image: row.image || '',
    category: row.category || 'General',
    source: row.source || 'NewsTally',
    date: row.date || '',
    url: row.url || '#',
    featured: i < 8
  }));
  
  filteredNews = [...allNewsData];
  
  // Build categories
  const cats = ['All', ...new Set(allNewsData.map(n => n.category).filter(Boolean))];
  buildCategoryFilter(cats);
  
  // Build carousel from featured
  buildCarousel(allNewsData.filter(n => n.featured).slice(0, 8));
  
  // Render first page
  displayedCount = 0;
  renderNewsGrid(true);
  hideLoading();
  // Init ticker with loaded news
  setTimeout(initTicker, 300);
  // Restore reactions
  setTimeout(restoreReactions, 500);
}

function buildCategoryFilter(cats) {
  const bar = document.getElementById('category-filter-bar');
  bar.innerHTML = cats.map(c => 
    `<button class="cat-btn${c==='All'?' active':''}" onclick="filterByCategory('${c}',this)">${c}</button>`
  ).join('');
}

function renderNewsGrid(reset = false) {
  const grid = document.getElementById('news-grid');
  const batch = filteredNews.slice(displayedCount, displayedCount + PAGE_SIZE);
  
  if (reset) grid.innerHTML = '';
  
  if (batch.length === 0 && reset) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--muted)"><i class="fas fa-newspaper" style="font-size:32px;margin-bottom:12px;display:block"></i><p>No articles in this category</p></div>`;
    return;
  }
  
  batch.forEach((item, idx) => {
    const isFirst = reset && idx === 0;
    const card = document.createElement('article');
    card.className = 'news-card fade-up';
    card.style.animationDelay = `${idx * 0.05}s`;
    card.onclick = () => openNewsDetail(item);
    const readMins = Math.max(1, Math.ceil(((item.title||'').length + (item.description||'').length) / 200));
    const isSaved = savedNewsIds.has(item.id);
    card.innerHTML = `
      <div class="news-card-img-wrapper">
        <img src="${item.image || 'https://placehold.co/800x450/1a1a25/f0ede8?text=NewsTally'}" 
             alt="${item.title}"
             loading="lazy"
             onload="this.classList.add('loaded')"
             onerror="this.src='https://placehold.co/800x450/1a1a25/f0ede8?text='+encodeURIComponent('${item.category}')">
        <span class="news-card-badge">${item.category}</span>
      </div>
      <div class="news-card-body">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <div class="news-card-category">${item.category}</div>
          <span class="read-time-badge"><i class="far fa-clock" style="font-size:10px"></i>${readMins} min</span>
        </div>
        <h3 class="news-card-title">${item.title}</h3>
        ${item.description ? `<p style="font-size:13px;color:var(--muted);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${item.description}</p>` : ''}
        <div class="news-card-meta">
          <span class="news-card-source${getCatColorClass(item.category)}">${item.source}${isVerifiedSource(item.source)?'<span class="verified-badge"><i class="fas fa-circle-check"></i></span>':''}</span>
          <span class="live-time" data-ts="${item.date}">${formatDate(item.date)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px" onclick="event.stopPropagation()">
          <div class="star-rating" id="stars-${item.id}">${renderStars(item.id)}</div>
          <span id="rating-label-${item.id}" style="font-size:11px;color:#9aa0a6">${getRatingLabel(item.id)}</span>
        </div>
      </div>
      <div class="news-card-actions" onclick="event.stopPropagation()">
        <button class="nc-action-btn ${isSaved?'saved':''}" id="save-news-${item.id}" onclick="toggleSaveNews('${item.id}',this)">
          <i class="${isSaved?'fas':'far'} fa-bookmark"></i> ${isSaved?'Saved':'Save'}
        </button>
        <button class="nc-action-btn" id="repost-news-btn-${item.id}" onclick="quickRepostNews(${JSON.stringify(item).replace(/'/g,'&apos;')},this)">
          <i class="fas fa-retweet"></i> Repost
        </button>
        <button class="nc-action-btn" onclick="event.stopPropagation();openShareCard(${JSON.stringify(item).replace(/'/g,'&apos;')})">
          <i class="fas fa-share-alt"></i> Share
        </button>
      </div>`;
    grid.appendChild(card);
  });
  
  displayedCount += batch.length;
  
  const loadMoreBtn = document.getElementById('load-more-btn');
  if (displayedCount >= filteredNews.length) {
    loadMoreBtn.style.display = 'none';
  } else {
    loadMoreBtn.style.display = 'inline-flex';
    loadMoreBtn.classList.remove('loading');
    loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Load More';
  }
  
  document.getElementById('category-label').textContent = 
    `${currentFilter} (${filteredNews.length})`;
}

window.loadMoreNews = () => {
  const btn = document.getElementById('load-more-btn');
  btn.classList.add('loading');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  setTimeout(() => renderNewsGrid(false), 300);
};

window.filterByCategory = (cat, btn) => {
  currentFilter = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filteredNews = cat === 'All' ? [...allNewsData] : allNewsData.filter(n => n.category === cat);
  displayedCount = 0;
  renderNewsGrid(true);
};

// ===== CAROUSEL =====
function buildCarousel(items) {
  if (items.length === 0) return;
  carouselItems = items;
  
  const track = document.getElementById('carousel-track');
  const dots = document.getElementById('carousel-dots');
  
  track.innerHTML = items.map((item, i) => `
    <div class="carousel-slide" onclick="openNewsDetail(${JSON.stringify(item).replace(/"/g,'&quot;')})">
      <img src="${item.image || 'https://placehold.co/1200x500/0d0d12/f0ede8?text=NewsTally'}" 
           alt="${item.title}" loading="${i===0?'eager':'lazy'}"
           onerror="this.src='https://placehold.co/1200x500/0d0d12/f0ede8?text=NewsTally'">
      <div class="carousel-overlay"></div>
      <div class="carousel-content">
        <span class="carousel-category">${item.category}</span>
        <h2 class="carousel-title">${item.title}</h2>
        <div class="carousel-meta">
          <span><i class="fas fa-globe" style="margin-right:4px"></i>${item.source}</span>
          <span>${formatDate(item.date)}</span>
        </div>
      </div>
    </div>`).join('');
  
  dots.innerHTML = items.map((_, i) => 
    `<div class="carousel-dot${i===0?' active':''}" onclick="goToSlide(${i})"></div>`
  ).join('');
  
  startCarouselTimer();
}

function startCarouselTimer() {
  clearInterval(carouselTimer);
  carouselTimer = setInterval(() => moveCarousel(1), 4500);
}

window.moveCarousel = (dir) => {
  carouselIndex = (carouselIndex + dir + carouselItems.length) % carouselItems.length;
  goToSlide(carouselIndex);
};

window.goToSlide = (idx) => {
  carouselIndex = idx;
  const track = document.getElementById('carousel-track');
  const slideWidth = track.querySelector('.carousel-slide')?.offsetWidth || track.offsetWidth;
  track.scrollTo({ left: idx * slideWidth, behavior: 'smooth' });
  document.querySelectorAll('.carousel-dot').forEach((d,i) => d.classList.toggle('active', i===idx));
  startCarouselTimer();
};

// ===== NEWS DETAIL =====
let currentNewsItem = null;

function slugify(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60);
}

window.openNewsDetail = (item) => {
  if (typeof item === 'string') item = JSON.parse(item);
  currentNewsItem = item;

  // ---- UPDATE URL to /news/slug ----
  const slug = slugify(item.title);
  const newsUrl = `/news/${slug}?id=${encodeURIComponent(item.id)}&cat=${encodeURIComponent(item.category||'')}`;
  window.history.pushState({ page: 'news-detail-page', newsId: item.id }, '', newsUrl);
  _pageStack.push('news-detail-page');

  // Update title & meta
  document.title = `${item.title} — NewsTally`;
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = `https://newstally.online${newsUrl}`;

  // Update header category
  const catEl = document.getElementById('news-detail-cat');
  if (catEl) catEl.textContent = item.category || '';

  const contentEl = document.getElementById('news-detail-content');
  const readMins = Math.max(1, Math.ceil(((item.title||'').length + (item.description||'').length) / 200));
  const isSaved = savedNewsIds.has(item.id);

  contentEl.innerHTML = `
    <!-- HERO IMAGE -->
    ${item.image ? `
    <div style="width:100%;aspect-ratio:16/9;overflow:hidden;background:#f1f3f4;position:relative">
      <img src="${item.image}" alt="${item.title}" 
           style="width:100%;height:100%;object-fit:cover;display:block"
           onerror="this.parentElement.style.display='none'">
    </div>` : ''}

    <!-- CONTENT -->
    <div style="padding:20px 16px 8px">

      <!-- Category + Meta row -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
        <span style="background:#e8f0fe;color:#1a73e8;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:4px 12px;border-radius:99px">${item.category}</span>
        <span style="font-size:12px;color:#9aa0a6;display:flex;align-items:center;gap:4px"><i class="far fa-clock" style="font-size:10px"></i>${readMins} min read</span>
      </div>

      <!-- Title -->
      <h1 style="font-size:clamp(20px,4vw,26px);font-weight:500;line-height:1.4;color:#202124;margin-bottom:16px;letter-spacing:-0.2px">${item.title}</h1>

      <!-- Source + Date bar -->
      <div style="display:flex;align-items:center;gap:0;margin-bottom:20px;padding:12px 14px;background:#f8f9fa;border-radius:10px;border-left:3px solid #1a73e8">
        <div>
          <div style="font-size:13px;font-weight:600;color:#202124">${item.source || 'NewsTally'}</div>
          <div style="font-size:11px;color:#9aa0a6;margin-top:1px">${formatDate(item.date)}</div>
        </div>
        <div style="margin-left:auto;display:flex;gap:8px">
          <button class="nc-action-btn ${isSaved?'saved':''}" id="detail-save-btn" onclick="toggleSaveNews('${item.id}',this)" style="font-size:12px">
            <i class="${isSaved?'fas':'far'} fa-bookmark"></i> ${isSaved?'Saved':'Save'}
          </button>
          <button class="nc-action-btn" onclick="currentNewsItem&&openShareCard(currentNewsItem)" style="font-size:12px">
            <i class="fas fa-share-alt"></i> Share
          </button>
        </div>
      </div>

      <!-- Description / Article body -->
      ${item.description ? `
      <div style="font-size:15px;line-height:1.8;color:#3c4043;margin-bottom:24px">
        ${item.description.split('. ').map((sentence, i) => 
          sentence.trim() ? `<p style="margin-bottom:${i < item.description.split('. ').length - 1 ? '14px' : '0'}">${sentence.trim()}${sentence.trim().endsWith('.') ? '' : '.'}</p>` : ''
        ).join('')}
      </div>` : `
      <div style="padding:30px;text-align:center;background:#f8f9fa;border-radius:12px;margin-bottom:24px">
        <i class="fas fa-newspaper" style="font-size:32px;color:#dadce0;display:block;margin-bottom:10px"></i>
        <p style="color:#9aa0a6;font-size:14px">Full article content not available in feed.<br>Check the source for complete story.</p>
      </div>`}

      <!-- Tags -->
      ${item.category ? `
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px">
        <span style="font-size:12px;color:#5f6368;font-weight:500">Tags:</span>
        <span onclick="filterByCategory('${item.category}', document.querySelector('.cat-btn'))" 
              style="font-size:12px;color:#1a73e8;background:#e8f0fe;padding:3px 10px;border-radius:99px;cursor:pointer;font-weight:500">#${item.category}</span>
        ${item.source ? `<span style="font-size:12px;color:#5f6368;background:#f1f3f4;padding:3px 10px;border-radius:99px">${item.source}</span>` : ''}
      </div>` : ''}
    </div>`;

  // Load suggestions
  loadNewsSuggestions(item);

  // Update SEO structured data for this article
  updateStructuredData(item);
  // Open the page layer (WITHOUT pushing another history entry — we already did above)
  const detailEl = document.getElementById('news-detail-page');
  if (detailEl) {
    detailEl.classList.add('open');
    detailEl.scrollTop = 0;
  }
};

window.shareCurrentNews = () => {
  if (!currentNewsItem) return;
  shareNewsItem(currentNewsItem.title, location.href);
};

function loadNewsSuggestions(currentItem) {
  const suggList = document.getElementById('news-suggestions-list');
  if (!suggList) return;

  // Find related articles: same category first, then others
  const related = allNewsData
    .filter(n => n.id !== currentItem.id)
    .sort((a, b) => {
      const aScore = (a.category === currentItem.category ? 3 : 0) +
                     (a.source === currentItem.source ? 1 : 0);
      const bScore = (b.category === currentItem.category ? 3 : 0) +
                     (b.source === currentItem.source ? 1 : 0);
      return bScore - aScore;
    })
    .slice(0, 6);

  if (related.length === 0) {
    suggList.innerHTML = '<p style="color:#9aa0a6;font-size:13px;text-align:center;padding:16px 0">No related articles found</p>';
    return;
  }

  suggList.innerHTML = related.map(item => `
    <div onclick="openNewsDetail(${JSON.stringify(item).replace(/"/g,'&quot;')})" 
         style="display:flex;gap:12px;padding:12px;background:#fff;border:1px solid #e8eaed;border-radius:14px;cursor:pointer;transition:all 0.18s;active:background:#f8f9fa"
         onmouseover="this.style.background='#f8f9fa';this.style.borderColor='#c5d5f5'"
         onmouseout="this.style.background='#fff';this.style.borderColor='#e8eaed'">
      <div style="width:72px;height:72px;border-radius:10px;overflow:hidden;flex-shrink:0;background:#f1f3f4">
        <img src="${item.image || 'https://placehold.co/72x72/e8f0fe/1a73e8?text=N'}" 
             style="width:100%;height:100%;object-fit:cover"
             onerror="this.src='https://placehold.co/72x72/e8f0fe/1a73e8?text=N'">
      </div>
      <div style="flex:1;min-width:0">
        <span style="font-size:10px;font-weight:700;color:#1a73e8;text-transform:uppercase;letter-spacing:0.05em">${item.category}</span>
        <p style="font-size:13px;font-weight:500;color:#202124;line-height:1.45;margin:3px 0 5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${item.title}</p>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:11px;color:#9aa0a6">${item.source}</span>
          <span style="font-size:10px;color:#dadce0">•</span>
          <span style="font-size:11px;color:#9aa0a6">${formatDate(item.date)}</span>
        </div>
      </div>
    </div>`).join('');
}

// ===== AUTH =====
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  const signInBtn = document.getElementById('sign-in-btn');
  const userActions = document.getElementById('user-actions');
  const fabCreate = document.getElementById('fab-create');
  const createBtnMobile = document.getElementById('sg-create-btn');

  if (user) {
    signInBtn.style.display = 'none';
    userActions.style.display = 'flex';
    fabCreate.style.display = 'flex';
    document.getElementById('sg-create-btn').style.display = 'block';
    // Hide guest banner, show quick post bar
    const guestBanner = document.getElementById('guest-banner');
    if (guestBanner) guestBanner.style.display = 'none';
    const qp = document.getElementById('sg-quick-post');
    if (qp) qp.style.display = 'flex';
    const sgCreate = document.getElementById('sg-create-btn');
    if (sgCreate) sgCreate.style.display = 'flex';

    const uRef = doc(db, 'users', user.uid);
    const uSnap = await getDoc(uRef).catch(() => null);

    if (!uSnap || !uSnap.exists()) {
      // New Google sign-in user — create Firestore doc
      const uname = (user.email||'').split('@')[0].replace(/[^a-z0-9_]/gi,'').toLowerCase();
      const photo = user.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user.displayName||'U')}`;
      await setDoc(uRef, {
        displayName: user.displayName || 'User',
        photoURL: photo,
        email: user.email || '',
        username: uname,
        followersCount: 0, followingCount: 0,
        followers: [], following: [], bookmarks: [], savedPosts: []
      }).catch(e => console.warn('setDoc error:', e));
    } else if (user.providerData.some(p => p.providerId === 'google.com')) {
      await setDoc(uRef, {
        displayName: user.displayName,
        photoURL: user.photoURL,
        email: user.email
      }, { merge: true }).catch(() => {});
    }

    // Live listener — updates avatar and saved posts in real time
    // BUG FIX: unsubscribe previous listener to prevent memory leak
    if (window._userDocUnsub) { window._userDocUnsub(); window._userDocUnsub = null; }
    window._userDocUnsub = onSnapshot(uRef, (d) => {
      if (!d.exists()) return;
      const data = d.data();
      userSavedPosts = data.savedPosts || [];
      const av = data.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(data.displayName||'U')}`;
      ['header-avatar','btm-avatar','create-avatar','sg-quick-avatar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.src = av;
      });
      if (!data.username) {
        document.getElementById('username-overlay').classList.add('open');
      }
    });

    closeOverlay('auth-overlay');
  } else {
    signInBtn.style.display = 'block';
    userActions.style.display = 'none';
    fabCreate.style.display = 'none';
    document.getElementById('sg-create-btn').style.display = 'none';
    userSavedPosts = [];
    // Show guest banner, hide quick post bar
    const guestBanner = document.getElementById('guest-banner');
    if (guestBanner) guestBanner.style.display = 'flex';
    const qp = document.getElementById('sg-quick-post');
    if (qp) qp.style.display = 'none';
    const sgCreate = document.getElementById('sg-create-btn');
    if (sgCreate) sgCreate.style.display = 'none';
  }
});

window.openAuthModal = () => {
  toggleAuthView('signin');
  document.getElementById('auth-overlay').classList.add('open');
};

window.toggleAuthView = (view) => {
  document.getElementById('auth-error-signin').textContent = '';
  document.getElementById('auth-error-signup').textContent = '';
  document.getElementById('auth-view-signin').style.display = view === 'signin' ? '' : 'none';
  document.getElementById('auth-view-signup').style.display = view === 'signup' ? '' : 'none';
};

window.handleGoogleSignIn = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
    closeOverlay('auth-overlay');
    showToast('Signed in!');
  } catch(e) { console.error(e); showToast('Google sign-in failed'); }
};

window.handleEmailSignIn = async (e) => {
  e.preventDefault();
  const email = document.getElementById('signin-email').value.trim();
  const pass = document.getElementById('signin-password').value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    closeOverlay('auth-overlay');
    showToast('Welcome back!');
  } catch(e) {
    document.getElementById('auth-error-signin').textContent = e.code === 'auth/invalid-credential' ? 'Invalid email or password' : e.message;
  }
};

window.handleEmailSignUp = async (e) => {
  e.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pass = document.getElementById('signup-password').value;
  if (!name || !email || !pass) return;
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(user, { displayName: name, photoURL: `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}` });
    await setDoc(doc(db, 'users', user.uid), {
      displayName: name,
      photoURL: `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}`,
      email,
      username: email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase(),
      followersCount: 0, followingCount: 0,
      followers: [], following: [], bookmarks: [], savedPosts: []
    });
    closeOverlay('auth-overlay');
    showToast('Account created! Welcome 🎉');
  } catch(e) {
    document.getElementById('auth-error-signup').textContent = e.code === 'auth/email-already-in-use' ? 'Email already in use' : e.message;
  }
};

window.doLogout = async () => {
  if (window._userDocUnsub) { window._userDocUnsub(); window._userDocUnsub = null; }
  await signOut(auth);
  closePage('profile-page');
  closePage('settings-page');
  showToast('Signed out successfully');
};

window.saveUsername = async () => {
  const un = document.getElementById('new-username-input').value.trim().toLowerCase().replace(/[^a-z0-9_.]/g,'');
  if (!un || un.length < 3) return showToast('Username must be at least 3 characters');
  if (!currentUser) return;
  try {
    await setDoc(doc(db, 'users', currentUser.uid), { username: un }, { merge: true });
    closeOverlay('username-overlay');
    showToast('Username saved!');
  } catch(e) { showToast('Error saving username'); }
};