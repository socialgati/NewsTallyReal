// NewsTally — Auth, Likes, Bookmarks, Comments, Profile

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
  input.value = '';
  
  const uSnap = await getDoc(doc(db, 'users', currentUser.uid)).catch(()=>null);
  const uData = uSnap?.data() || {};
  
  await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reposts', currentPostIdForComments, 'comments'), {
    text, userId: currentUser.uid,
    username: uData.username || currentUser.displayName || 'User',
    userAvatar: currentUser.photoURL || '',
    timestamp: serverTimestamp()
  });
  await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'reposts', currentPostIdForComments), { commentsCount: increment(1) }).catch(()=>{});
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
  
  const snap = await getDoc(doc(db, 'users', uid)).catch(()=>null);
  if (snap && snap.exists()) {
    const d = snap.data();
    document.getElementById('p-avatar').src = d.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(d.displayName||'U')}&background=random`;
    document.getElementById('p-name').textContent = d.displayName || 'User';
    document.getElementById('p-username').textContent = '@' + (d.username || 'user');
    document.getElementById('p-title').textContent = d.username ? '@' + d.username : 'Profile';
    document.getElementById('p-followers-count').textContent = d.followersCount || 0;
    document.getElementById('p-following-count').textContent = d.followingCount || 0;
    
    // Follow button
    const followArea = document.getElementById('p-follow-area');
    if (!isOwn) {
      const isFollowing = currentUser && (d.followers||[]).includes(currentUser.uid);
      followArea.innerHTML = `<button class="btn-follow ${isFollowing?'following':''}" onclick="toggleFollow('${uid}',${isFollowing})">${isFollowing?'Following':'Follow'}</button>`;
    } else {
      followArea.innerHTML = '';
    }
  }
  
  switchProfileTab('reposts', document.querySelector('.profile-tab.active'));
  
  // Load reposts
  const rSnap = await getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reposts'), where('userId','==',uid), orderBy('timestamp','desc'), limit(30))).catch(()=>null);
  const grid = document.getElementById('p-reposts-grid');
  document.getElementById('p-posts-count').textContent = rSnap ? rSnap.size : 0;
  if (rSnap && !rSnap.empty) {
    grid.innerHTML = rSnap.docs.map(d => `<div class="profile-thumb" onclick="openPage('post-detail-page')"><img src="${d.data().image||'https://placehold.co/400'}" loading="lazy" onerror="this.src='https://placehold.co/400/1a1a25/f0ede8?text=Post'"></div>`).join('');
  } else {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">No posts yet</div>`;
  }
}

window.switchProfileTab = (tab, btn) => {
  document.querySelectorAll('.profile-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.profile-grid').forEach(g => g.classList.remove('active'));
  const activeBtn = btn || document.querySelector(`[onclick*="switchProfileTab('${tab}'"]`) || document.querySelector('.profile-tab');
  if (activeBtn) activeBtn.classList.add('active');
  const grid = document.getElementById(`p-${tab}-grid`);
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
  document.getElementById('post-options-overlay').classList.add('open');
};

window.openCreatePostModal = (type) => {
  document.getElementById('create-modal').classList.add('open');
  document.getElementById('create-modal-title').textContent = type === 'photo' ? 'New Photo Post' : 'New Post';
  document.getElementById('caption-in').value = '';
  document.getElementById('drop-preview').style.display = 'none';
  document.getElementById('upload-ui').style.display = 'flex';
  document.getElementById('share-btn').disabled = false;
  document.getElementById('share-btn').style.opacity = '1';
};

window.openCreatePollModal = () => {
  const question = prompt('Poll question:');
  if (!question) return;
  const opt1 = prompt('Option 1:');
  const opt2 = prompt('Option 2:');
  if (!opt1 || !opt2) return;
  submitPollPost(question, [opt1, opt2]);
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
  showToast('Posted!');
  loadSocialgati(true);
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
  showToast('Poll posted!');
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
  if (!currentUser || currentUser.uid !== userId) return;
  if (confirm('Delete this post?')) {
    deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'reposts', postId))
      .then(() => { loadSocialgati(true); showToast('Post deleted'); });
  }
};