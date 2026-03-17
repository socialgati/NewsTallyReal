// ============================================================
// SHARED.JS — Shared between Socialgati (index.html) and NewsTally (newstally.html)
// Firebase config, auth, repost, common utils
// ============================================================


import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, limit, where, startAfter, arrayUnion, arrayRemove, serverTimestamp, increment, deleteField } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js';

// ===== FIREBASE CONFIG =====
const firebaseConfig = {
  apiKey: "AIzaSyA4zw5cZqxLwzkTy2e5NiHz-tGKqk1KGdI",
  authDomain: "newstally-df03c.firebaseapp.com",
  projectId: "newstally-df03c",
  storageBucket: "newstally-df03c.appspot.com",
  messagingSenderId: "506893212961",
  appId: "1:506893212961:web:63882290195da992207260"
};

// ===== GOOGLE SHEETS CONFIG =====
const SHEET_ID = '1Wy6rzaCALqPLFx079nqBCDRP7dk3au5eRO4GuMwQ8Sk';
const SHEETS_API_KEY = 'AIzaSyC8D-4bl3GDyj_--BGG1pPdO5Bz63r5iXI';
const SHEET_NAME = 'Sheet1';
const APP_ID = 'newstally-social';

// ===== INIT =====
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// ===== STATE =====
let currentUser = null;
let allNewsData = [];
let filteredNews = [];
const newsItemsMap = {}; // stores news items by id for safe onclick access
let displayedCount = 0;
const PAGE_SIZE = 9;
let carouselIndex = 0;
let carouselItems = [];
let carouselTimer = null;
let currentFilter = 'All';
let lastCommunityDoc = null;
let communityUnsub = null;
let commentsUnsub = null;
let currentPostIdForComments = null;
let currentProfileUid = null;
let userSavedPosts = [];
let authMode = 'signin';
let newsCache = null;
let newsCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
// Item store — prevents JSON/quote issues in onclick attributes
const _itemStore = new Map();


// ============================================================
// CROSS-PAGE NAVIGATION
// ============================================================
// Navigate to the other app page (feels instant with same-site nav)
window.goToSocialgati = () => {
  window.location.href = '/';
};
window.goToNewsTally = () => {
  window.location.href = '/newstally.html';
};

// Repost a news item to Socialgati (called from newstally.html)
window.quickRepostNews = async (itemOrId, btn) => {
  let item = (typeof itemOrId === 'string' && window.newsItemsMap?.[itemOrId])
    ? window.newsItemsMap[itemOrId]
    : (typeof itemOrId === 'object' ? itemOrId : null);
  if (!item) { showToast('Item not found'); return; }
  if (!currentUser) return openAuthModal();

  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
  try {
    const uSnap = await getDoc(doc(db, 'users', currentUser.uid)).catch(()=>null);
    const uData = uSnap?.data() || {};
    await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reposts'), {
      userId: currentUser.uid,
      username: uData.username || currentUser.displayName || 'User',
      userAvatar: currentUser.photoURL || '',
      image: item.image || '',
      headline: item.title,
      newsUrl: item.url || '',
      newsSource: item.source || '',
      newsCategory: item.category || '',
      likes: [], commentsCount: 0,
      timestamp: serverTimestamp(),
      type: 'repost'
    });
    if (btn) { btn.innerHTML = '<i class="fas fa-check"></i> Reposted'; btn.classList.add('saved'); btn.disabled = false; }
    showToast('✅ Reposted to Socialgati!');
  } catch(e) {
    console.error(e);
    if (btn) { btn.innerHTML = '<i class="fas fa-retweet"></i> Repost'; btn.disabled = false; }
    showToast('Repost failed. Try again.');
  }
};

// ============================================================
// SHARED UTILITIES
// ============================================================

// ===== LIKES & BOOKMARKS =====
window.toggleLike = async (id, dbl = false) => {
  if (!currentUser) return openAuthModal();
  const btn = document.getElementById(`like-btn-${id}`);
  const icon = btn?.querySelector('i');
  const cnt = document.getElementById(`like-count-${id}`);
  if (!btn || !icon) return;
  
  const isLiked = icon.classList.contains('fas');
  if (isLiked && dbl) return;
  
  icon.classList.toggle('fas', !isLiked);
  icon.classList.toggle('far', isLiked);
  btn.classList.toggle('liked', !isLiked);
  
  if (!isLiked) { icon.classList.add('heart-pop'); setTimeout(()=>icon.classList.remove('heart-pop'),400); }
  
  const c = parseInt(cnt.textContent) || 0;
  cnt.textContent = isLiked ? Math.max(0, c-1) : c+1;
  
  const ref2 = doc(db, 'artifacts', APP_ID, 'public', 'data', 'reposts', id);
  await updateDoc(ref2, { likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) }).catch(()=>{});
};

window.toggleBookmark = async (id) => {
  if (!currentUser) return openAuthModal();
  const btn = document.getElementById(`bookmark-btn-${id}`);
  const icon = btn?.querySelector('i');
  if (!btn) return;
  
  const isSaved = userSavedPosts.includes(id);
  if (isSaved) { userSavedPosts = userSavedPosts.filter(x=>x!==id); }
  else { userSavedPosts.push(id); }
  
  icon.classList.toggle('fas', !isSaved);
  icon.classList.toggle('far', isSaved);
  btn.classList.toggle('bookmarked', !isSaved);
  
  await updateDoc(doc(db, 'users', currentUser.uid), { savedPosts: isSaved ? arrayRemove(id) : arrayUnion(id) }).catch(()=>{});
  showToast(isSaved ? 'Removed from saved' : 'Saved!');
};

// ===== COMMENTS =====
window.openComments = (pid) => {
  // Anyone can VIEW comments, no login needed
  currentPostIdForComments = pid;
  openPage('comments-page');
  const list = document.getElementById('comments-list');
  list.innerHTML = `<div style="text-align:center;padding:30px;color:var(--muted)">Loading...</div>`;
  if (commentsUnsub) commentsUnsub();
  commentsUnsub = onSnapshot(
    query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reposts', pid, 'comments'), orderBy('timestamp','desc')),
    snap => {
      if (snap.empty) { list.innerHTML = `<div style="text-align:center;padding:30px;color:var(--muted)">No comments yet. Be first!</div>`; return; }
      list.innerHTML = snap.docs.map(d => {
        const c = d.data();
        return `<div class="comment-item"><img src="${c.userAvatar||'https://ui-avatars.com/api/?name=U&background=efefef'}" class="comment-avatar" onerror="this.src='https://ui-avatars.com/api/?name=U&background=efefef'"><div class="comment-body"><span class="comment-user">${c.username||'User'} </span>${c.text}</div></div>`;
      }).join('');
    }
  );
};

window.submitComment = async () => {
  if (!currentUser) return openAuthModal();
  const input = document.getElementById('comment-input');
  const text = input.value.trim();
  if (!text || !currentPostIdForComments) return;
  input.value = ''; // Clear immediately for UX
  const btn = document.getElementById('comment-submit-btn');
  if (btn) btn.disabled = true;
  try {
    const uSnap = await getDoc(doc(db, 'users', currentUser.uid)).catch(()=>null);
    const uData = uSnap?.data() || {};
    await addDoc(
      collection(db, 'artifacts', APP_ID, 'public', 'data', 'reposts', currentPostIdForComments, 'comments'),
      { text, userId: currentUser.uid,
        username: uData.username || currentUser.displayName || 'User',
        userAvatar: currentUser.photoURL || '',
        timestamp: serverTimestamp() }
    );
    await updateDoc(
      doc(db, 'artifacts', APP_ID, 'public', 'data', 'reposts', currentPostIdForComments),
      { commentsCount: increment(1) }
    ).catch(()=>{});
  } catch(e) {
    console.error('Comment error:', e);
    showToast('Comment failed. Try again.');
    input.value = text; // restore on fail
  } finally {
    if (btn) btn.disabled = false;
  }
};

// ===== PROFILE =====
window.openProfile = () => {
  if (!currentUser) return openAuthModal();
  renderProfilePage(currentUser.uid);
};

window.openPublicProfile = (uid) => {
  if (!uid) return;
  renderProfilePage(uid);
};

async function renderProfilePage(uid) {
  currentProfileUid = uid;
  openPage('profile-page');
  const isOwn = currentUser && currentUser.uid === uid;

  document.getElementById('p-logout-btn').style.display = isOwn ? 'block' : 'none';
  document.getElementById('p-edit-username-btn').style.display = isOwn ? 'inline' : 'none';

  // Reset to Posts tab
  switchProfileTab('reposts', document.querySelector('.profile-tab'));

  // Load user data
  const snap = await getDoc(doc(db, 'users', uid)).catch(()=>null);
  let savedPostIds = [];
  if (snap && snap.exists()) {
    const d = snap.data();
    savedPostIds = d.savedPosts || [];
    document.getElementById('p-avatar').src = d.photoURL ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(d.displayName||'U')}&background=random`;
    document.getElementById('p-name').textContent = d.displayName || 'User';
    document.getElementById('p-username').textContent = '@' + (d.username || 'user');
    document.getElementById('p-title').textContent = d.username ? '@' + d.username : 'Profile';
    document.getElementById('p-followers-count').textContent = d.followersCount || 0;
    document.getElementById('p-following-count').textContent = d.followingCount || 0;
    const followArea = document.getElementById('p-follow-area');
    if (!isOwn) {
      const isFollowing = currentUser && (d.followers||[]).includes(currentUser.uid);
      followArea.innerHTML = `<button class="btn-follow ${isFollowing?'following':''}" onclick="toggleFollow('${uid}',${isFollowing})">${isFollowing?'Following':'Follow'}</button>`;
    } else {
      followArea.innerHTML = '';
    }
  }

  // ---- LOAD POSTS ----
  const rSnap = await getDocs(query(
    collection(db, 'artifacts', APP_ID, 'public', 'data', 'reposts'),
    where('userId','==',uid), orderBy('timestamp','desc'), limit(30)
  )).catch(()=>null);
  const postsGrid = document.getElementById('p-reposts-grid');
  document.getElementById('p-posts-count').textContent = rSnap?.size || 0;
  if (rSnap && !rSnap.empty) {
    postsGrid.innerHTML = rSnap.docs.map(d => {
      const pd = d.data();
      const img = pd.image || (pd.type==='repost' ? '' : '');
      return `<div class="profile-thumb" onclick="viewProfilePost('${d.id}')">
        ${img ? `<img src="${img}" loading="lazy" onerror="this.parentElement.innerHTML='<div style=background:#f2f2f2;height:100%;display:flex;align-items:center;justify-content:center><i class=fas fa-file-alt style=color:#ccc></i></div>'">` 
              : `<div style="background:#f2f2f2;height:100%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#606060;padding:8px;text-align:center;word-break:break-word">${(pd.headline||'Post').substring(0,40)}</div>`}
      </div>`;
    }).join('');
  } else {
    postsGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#9aa0a6">No posts yet</div>`;
  }

  // ---- LOAD BOOKMARKS (real-time from Firestore) ----
  const bmGrid = document.getElementById('p-bookmarks-grid');
  if (isOwn && savedPostIds.length > 0) {
    bmGrid.innerHTML = '<div style="padding:16px;color:#606060;font-size:13px">Loading bookmarks...</div>';
    try {
      // Fetch saved posts in batches of 10 (Firestore 'in' limit)
      const chunks = [];
      for (let i = 0; i < savedPostIds.length; i += 10) chunks.push(savedPostIds.slice(i, i+10));
      const allDocs = [];
      for (const chunk of chunks) {
        const s = await getDocs(query(
          collection(db, 'artifacts', APP_ID, 'public', 'data', 'reposts'),
          where('__name__', 'in', chunk)
        )).catch(()=>null);
        if (s) s.docs.forEach(d => allDocs.push({ id: d.id, ...d.data() }));
      }
      if (allDocs.length === 0) {
        bmGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#9aa0a6"><i class="far fa-bookmark" style="font-size:32px;display:block;margin-bottom:8px"></i>No bookmarks yet</div>`;
      } else {
        bmGrid.innerHTML = allDocs.map(pd => `
          <div class="profile-thumb profile-bookmark-item" onclick="viewProfilePost('${pd.id}')">
            ${pd.image ? `<img src="${pd.image}" loading="lazy" onerror="this.style.display='none'">` 
                       : `<div style="background:#f2f2f2;height:100%;display:flex;align-items:center;justify-content:center;font-size:11px;color:#606060;padding:6px;text-align:center">${(pd.headline||'Post').substring(0,35)}</div>`}
          </div>`).join('');
      }
    } catch(e) {
      bmGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#9aa0a6">Could not load bookmarks</div>`;
    }
  } else if (isOwn) {
    bmGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#9aa0a6"><i class="far fa-bookmark" style="font-size:32px;display:block;margin-bottom:8px"></i>No bookmarks yet<br><small style="color:#aaa">Bookmark posts to see them here</small></div>`;
  } else {
    bmGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#9aa0a6">Bookmarks are private</div>`;
  }

  // ---- LOAD HISTORY (from localStorage — news reading history) ----
  const histGrid = document.getElementById('p-history-grid');
  if (isOwn) {
    const history = JSON.parse(localStorage.getItem('nt_history') || '[]');
    if (history.length === 0) {
      histGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#9aa0a6"><i class="fas fa-history" style="font-size:32px;display:block;margin-bottom:8px"></i>No reading history yet<br><small style="color:#aaa">News you read will appear here</small></div>`;
    } else {
      histGrid.innerHTML = `<div style="grid-column:1/-1;padding:12px">` +
        history.slice(0, 20).map(h => `
          <div onclick="openNewsDetail('${h.id}')" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f2f2f2;cursor:pointer">
            <img src="${h.image||'https://placehold.co/48x48/f2f2f2/606060?text=N'}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;flex-shrink:0" onerror="this.src='https://placehold.co/48x48/f2f2f2/606060?text=N'">
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;color:#0f0f0f;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${h.title||'Article'}</div>
              <div style="font-size:11px;color:#9aa0a6;margin-top:3px">${h.category||''} · ${new Date(h.ts||0).toLocaleDateString()}</div>
            </div>
            <i class="fas fa-chevron-right" style="color:#dadce0;font-size:12px;flex-shrink:0"></i>
          </div>`).join('') + `</div>`;
    }
  } else {
    histGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#9aa0a6">History is private</div>`;
  }
}

window.viewProfilePost = (postId) => {
  // Open post detail or comments
  openComments(postId);
};

window.switchProfileTab = (tab, btn) => {
  document.querySelectorAll('.profile-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.profile-grid').forEach(g => g.classList.remove('active'));
  // Find the btn if not passed
  const activeBtn = (btn instanceof Element) ? btn
    : document.querySelector(`.profile-tab[onclick*="'${tab}'"]`)
    || document.querySelector('.profile-tab');
  if (activeBtn) activeBtn.classList.add('active');
  const grid = document.getElementById('p-' + tab + '-grid');
  if (grid) grid.classList.add('active');
};

window.toggleFollow = async (uid, isFollowing) => {
  if (!currentUser) return openAuthModal();
    const targetRef = doc(db, 'users', uid);
  const myRef = doc(db, 'users', currentUser.uid);
  
  if (isFollowing) {
    await updateDoc(targetRef, { followers: arrayRemove(currentUser.uid), followersCount: increment(-1) }).catch(()=>{});
    await updateDoc(myRef, { following: arrayRemove(uid), followingCount: increment(-1) }).catch(()=>{});
  } else {
    await updateDoc(targetRef, { followers: arrayUnion(currentUser.uid), followersCount: increment(1) }).catch(()=>{});
    await updateDoc(myRef, { following: arrayUnion(uid), followingCount: increment(1) }).catch(()=>{});
  }
  
  const btn = document.querySelector('.btn-follow');
  if (btn) {
    btn.classList.toggle('following', !isFollowing);
    btn.textContent = isFollowing ? 'Follow' : 'Following';
    btn.onclick = () => toggleFollow(uid, !isFollowing);
  }
};

window.editUsername = async () => {
  const newName = prompt('Enter new username (letters, numbers, _ and . only):');
  if (!newName) return;
  const cleaned = newName.trim().toLowerCase().replace(/[^a-z0-9_.]/g,'');
  if (cleaned.length < 3) return showToast('Username too short');
  try {
    await setDoc(doc(db, 'users', currentUser.uid), { username: cleaned }, { merge: true });
    document.getElementById('p-username').textContent = '@' + cleaned;
    showToast('Username updated!');
  } catch(e) { showToast('Error updating username'); }
};

window.openFollowList = async (type) => {
  openPage('follow-list-page');
  document.getElementById('follow-list-title').textContent = type === 'followers' ? 'Followers' : 'Following';
  const content = document.getElementById('follow-list-content');
  content.innerHTML = `<div style="text-align:center;padding:30px;color:var(--muted)">Loading...</div>`;
  
  const snap = await getDoc(doc(db, 'users', currentProfileUid)).catch(()=>null);
  const list = snap?.data()?.[type] || [];
  
  if (list.length === 0) { content.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)">No ${type} yet</div>`; return; }
  
  const users = await Promise.all(list.map(uid => getDoc(doc(db, 'users', uid)).catch(()=>null)));
  content.innerHTML = users.filter(Boolean).map(u => {
    if (!u.exists()) return '';
    const d = u.data();
    return `<div style="display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid var(--border);cursor:pointer" onclick="openPublicProfile('${u.id}')">
      <img src="${d.photoURL||'https://ui-avatars.com/api/?name=U&background=efefef'}" style="width:44px;height:44px;border-radius:50%;object-fit:cover">
      <div><div style="font-weight:700">${d.displayName||'User'}</div><div style="font-size:13px;color:var(--muted)">@${d.username||'user'}</div></div>
    </div>`;
  }).join('');
};

// ===== CREATE POST =====
window.openAddPostOptionsModal = () => {
  if (!currentUser) return openAuthModal();
  // Open text post directly (main action)
  openTextPostModal();
};

window.openPostOptionsSheet = () => {
  if (!currentUser) return openAuthModal();
  document.getElementById('post-options-overlay').classList.add('open');
};

window.openCreatePostModal = (type) => {
  if (!currentUser) return openAuthModal();
  document.getElementById('create-modal').classList.add('open');
  document.getElementById('create-modal-title').textContent = type === 'photo' ? 'New Photo Post' : 'New Post';
  document.getElementById('caption-in').value = '';
  document.getElementById('drop-preview').style.display = 'none';
  // Reset share btn
  const sb = document.getElementById('share-btn');
  if (sb) { sb.disabled = false; sb.style.opacity = '1'; }
  document.getElementById('upload-ui').style.display = 'flex';
  document.getElementById('share-btn').disabled = false;
  document.getElementById('share-btn').style.opacity = '1';
};

window.openCreatePollModal = () => {
  if (!currentUser) return openAuthModal();
  document.getElementById('create-poll-modal').classList.add('open');
};

window.previewImage = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const preview = document.getElementById('drop-preview');
    preview.src = ev.target.result;
    preview.style.display = 'block';
    document.getElementById('upload-ui').style.display = 'none';
  };
  reader.readAsDataURL(file);
};

window.submitPost = async () => {
  if (!currentUser) return openAuthModal();
  const file = document.getElementById('file-in').files[0];
  const caption = document.getElementById('caption-in').value.trim();
  if (!file && !caption) return showToast('Add a photo or caption');
  
  document.getElementById('share-btn').disabled = true;
  document.getElementById('share-btn').style.opacity = '0.5';
  
  const uSnap = await getDoc(doc(db, 'users', currentUser.uid)).catch(()=>null);
  const uData = uSnap?.data() || {};
  
  let imageURL = '';
  if (file) {
    document.getElementById('upload-progress').style.display = 'block';
    try {
      const storageRef = ref(storage, `posts/${currentUser.uid}/${Date.now()}_${file.name}`);
      const task = uploadBytesResumable(storageRef, file);
      await new Promise((res, rej) => {
        task.on('state_changed',
          snap => { document.getElementById('upload-bar').style.width = (snap.bytesTransferred / snap.totalBytes * 100) + '%'; },
          rej, res
        );
      });
      imageURL = await getDownloadURL(storageRef);
    } catch(e) { showToast('Upload failed. Check Firebase Storage rules.'); document.getElementById('share-btn').disabled = false; document.getElementById('share-btn').style.opacity='1'; return; }
  }
  
  await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reposts'), {
    userId: currentUser.uid,
    username: uData.username || currentUser.displayName || 'User',
    userAvatar: currentUser.photoURL || '',
    image: imageURL,
    headline: caption,
    likes: [], reposters: [], commentsCount: 0,
    timestamp: serverTimestamp(),
    type: 'post'
  });
  
  document.getElementById('create-modal').classList.remove('open');
  document.getElementById('upload-progress').style.display = 'none';
  document.getElementById('upload-bar').style.width = '0';
  document.getElementById('file-in').value = '';
  document.getElementById('caption-in').value = '';
  const shareBtn = document.getElementById('share-btn');
  if (shareBtn) { shareBtn.disabled = false; shareBtn.style.opacity = '1'; }
  showToast('Post ho gaya! ✅');
  loadSocialgati(true);
};

window.submitPollFromModal = async () => {
  const question = document.getElementById('poll-question-input')?.value.trim();
  const opt1 = document.getElementById('poll-opt1-input')?.value.trim();
  const opt2 = document.getElementById('poll-opt2-input')?.value.trim();
  const opt3 = document.getElementById('poll-opt3-input')?.value.trim();
  const opt4 = document.getElementById('poll-opt4-input')?.value.trim();
  if (!question) { showToast('Please enter a question'); return; }
  if (!opt1 || !opt2) { showToast('At least 2 options required'); return; }
  const options = [opt1, opt2, opt3, opt4].filter(Boolean);
  document.getElementById('create-poll-modal').classList.remove('open');
  // Clear inputs
  ['poll-question-input','poll-opt1-input','poll-opt2-input','poll-opt3-input','poll-opt4-input']
    .forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  await submitPollPost(question, options);
};

async function submitPollPost(question, options) {
  if (!currentUser) return openAuthModal();
  const uSnap = await getDoc(doc(db, 'users', currentUser.uid)).catch(()=>null);
  const uData = uSnap?.data() || {};
  await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reposts'), {
    userId: currentUser.uid,
    username: uData.username || currentUser.displayName || 'User',
    userAvatar: currentUser.photoURL || '',
    headline: question,
    pollOptions: options.map(t => ({ text: t, votes: 0, voters: [] })),
    likes: [], commentsCount: 0,
    timestamp: serverTimestamp(),
    type: 'poll'
  });
  showToast('Poll post ho gaya!');
  loadSocialgati(true);
}

window.votePoll = async (postId, optionIdx) => {
  if (!currentUser) return openAuthModal();
  const ref2 = doc(db, 'artifacts', APP_ID, 'public', 'data', 'reposts', postId);
  const snap = await getDoc(ref2);
  if (!snap.exists()) return;
  const opts = snap.data().pollOptions || [];
  if ((opts[optionIdx].voters||[]).includes(currentUser.uid)) return showToast('Already voted');
  opts[optionIdx].votes = (opts[optionIdx].votes||0) + 1;
  opts[optionIdx].voters = [...(opts[optionIdx].voters||[]), currentUser.uid];
  await updateDoc(ref2, { pollOptions: opts });
  loadSocialgati(true);
};

window.showPostMenu = (postId, userId) => {
  if (!currentUser) return openAuthModal();
  const isOwn = currentUser.uid === userId;
  const options = isOwn
    ? ['Delete Post', 'Cancel']
    : ['Report Post', 'Cancel'];
  // Simple native action sheet
  const choice = isOwn
    ? confirm('Delete this post?')
    : confirm('Report this post as inappropriate?');
  if (!choice) return;
  if (isOwn) {
    deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'reposts', postId))
      .then(() => { showToast('Post deleted'); })
      .catch(() => showToast('Could not delete. Try again.'));
  } else {
    // Save report to Firestore
    addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reports'), {
      postId, reportedBy: currentUser.uid,
      reason: 'inappropriate', timestamp: serverTimestamp()
    }).then(() => showToast('Post reported. We will review it.'))
      .catch(() => showToast('Report failed. Try again.'));
  }
};

// ===== NOTIFICATIONS =====
window.openNotificationsPage = () => openPage('notifications-page');

// ===== USER SEARCH =====
window.handleUserSearch = async (val) => {
  const res = document.getElementById('search-results');
  if (!val.replace('@','').trim()) { res.classList.remove('open'); return; }
  res.classList.add('open');
  res.innerHTML = `<div style="padding:12px 16px;color:var(--muted);font-size:13px">Searching...</div>`;
  
  try {
    const q = query(collection(db, 'users'), where('username', '>=', val.replace('@','')), where('username', '<=', val.replace('@','') + '\uf8ff'), limit(5));
    const snap = await getDocs(q);
    if (snap.empty) { res.innerHTML = `<div style="padding:12px 16px;color:var(--muted);font-size:13px">No users found</div>`; return; }
    res.innerHTML = snap.docs.map(d => {
      const u = d.data();
      return `<div class="search-result-item" onclick="openPublicProfile('${d.id}');document.getElementById('user-search-input').value='';document.getElementById('search-results').classList.remove('open')">
        <img src="${u.photoURL||'https://ui-avatars.com/api/?name=U&background=efefef'}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">
        <div><div style="font-weight:700;font-size:14px">${u.displayName||'User'}</div><div style="font-size:12px;color:var(--muted)">@${u.username||'user'}</div></div>
      </div>`;
    }).join('');
  } catch(e) { res.innerHTML = `<div style="padding:12px 16px;color:var(--muted);font-size:13px">Error searching</div>`; }
};

// ===== STORY (placeholder) =====
window.openAddStoryOptions = () => {
  if (!currentUser) return openAuthModal();
  showToast('Story feature coming soon!');
};

// ===== SHARE =====
window.sharePost = (user, id) => {
  if (navigator.share) {
    navigator.share({ title: `Post by @${user}`, url: location.href });
  } else {
    navigator.clipboard?.writeText(location.href);
    showToast('Link copied!');
  }
};

