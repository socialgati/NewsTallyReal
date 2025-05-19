// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyA4zw5cZqxLwzkTy2e5NiHz-tGKqk1KGdI",
  authDomain: "newstally-df03c.firebaseapp.com",
  databaseURL: "https://newstally-df03c-default-rtdb.firebaseio.com",
  projectId: "newstally-df03c",
  storageBucket: "newstally-df03c.firebasestorage.app",
  messagingSenderId: "506893212961",
  appId: "1:506893212961:web:63882290195da992207260",
  measurementId: "G-54QER193B3"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Google Sign-In
function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider)
    .then((result) => {
      const user = result.user;
      db.collection('users').doc(user.uid).set({
        name: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        lastLogin: new Date()
      }).catch((error) => {
        console.error('Error saving user data:', error);
      });
      window.location.href = 'profile.html';
    })
    .catch((error) => {
      console.error('Sign-in error:', error);
      alert('Failed to sign in: ' + error.message);
    });
}

// Sign-Out
function signOut() {
  auth.signOut().then(() => {
    window.location.href = 'index.html';
  }).catch((error) => {
    console.error('Sign-out error:', error);
    alert('Failed to sign out: ' + error.message);
  });
}

// Update Auth UI
function updateAuthUI(user) {
  const authSection = document.getElementById('auth-section');
  if (user) {
    authSection.innerHTML = `
      <a href="profile.html">
        <img src="${user.photoURL}" alt="${user.displayName}'s Profile" class="w-8 h-8 rounded-full">
        <span class="text-white text-sm font-medium">${user.displayName.split(' ')[0]}</span>
      </a>
      <button id="sign-out-btn" class="bg-blue-600 text-white px-4 py-1 rounded-full hover:bg-blue-700">Sign Out</button>
    `;
    document.getElementById('sign-out-btn').addEventListener('click', signOut);
  } else {
    authSection.innerHTML = `
      <button id="sign-in-btn" class="bg-blue-600 text-white px-4 py-1 rounded-full hover:bg-blue-700">Sign In</button>
    `;
    document.getElementById('sign-in-btn').addEventListener('click', signInWithGoogle);
  }
}

// Auth State Listener
auth.onAuthStateChanged((user) => {
  updateAuthUI(user);
});

// Google Sheets API Configuration
const API_KEY = 'AIzaSyC8D-4bl3GDyj_--BGG1pPdO5Bz63r5iXI';
const SHEET_ID = '1Wy6rzaCALqPLFx079nqBCDRP7dk3au5eRO4GuMwQ8Sk';
const NEWS_SHEET_NAME = 'Sheet1';
const PLAYER_SHEET_NAME = 'Sheet2';

let news = [];
let topStories = [];
let topPlayers = [];
let featuredNews = [];
let currentSlide = 0;
let filteredNews = [];
let categories = [];
let displayedNewsCount = 0;
const NEWS_PER_PAGE = 15;
const PLAYER_ROTATION_INTERVAL = 30 * 1000;

// Category Colors
const categoryColors = {
  'Top Story': 'bg-blue-600 text-white',
  'Top': 'bg-green-600 text-white',
  'Politics': 'bg-red-600 text-white',
  'Sports': 'bg-yellow-600 text-black',
  'Technology': 'bg-purple-600 text-white',
  'Entertainment': 'bg-pink-600 text-white',
  'Cricket': 'bg-teal-600 text-white',
  'default': 'bg-gray-600 text-white'
};

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('Service Worker registered:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

// Preload Images
function preloadImages(imageUrls) {
  imageUrls.forEach(url => {
    const img = new Image();
    img.src = url;
  });
}

// Debounce Function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Fetch News
async function fetchNews() {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${NEWS_SHEET_NAME}?key=${API_KEY}`
    );
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    if (!data.values) throw new Error('No data returned from Google Sheets API');
    const rows = data.values;
    const headers = rows[0];
    news = rows.slice(1).map(row => ({
      rank: parseInt(row[0]) || 0,
      headline: row[1] || '',
      source: row[2] || '',
      date: row[3] || '',
      description: row[4] || '',
      link: row[5] || '#',
      category: row[6] || 'default',
      image: row[7] || 'https://via.placeholder.com/400x300'
    }));
    processNewsData();
  } catch (error) {
    console.error('Error fetching news:', error.message);
    document.getElementById('top-stories').innerHTML = '<p class="text-red-600">Failed to load news.</p>';
    document.getElementById('news-feed').innerHTML = '<p class="text-red-600">Failed to load news.</p>';
    document.getElementById('featured-news-scroll').innerHTML = '<p class="text-red-600 text-sm">Failed to load featured news.</p>';
  }
}

function processNewsData() {
  topStories = news
    .filter(item => item.category.toLowerCase() === 'top story')
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 3);
  preloadImages(topStories.map(item => item.image));
  featuredNews = news
    .filter(item => item.category.toLowerCase() === 'top')
    .sort((a, b) => b.rank - a.rank);
  filteredNews = [...news];
  categories = ['All', ...new Set(news.map(item => item.category))];
  displayedNewsCount = 0;
  renderNews();
  setupCarousel();
  setupFilters();
  displayFeaturedNews();
  highlightActiveNav();
}

// Fetch Top Players
async function fetchTopPlayers() {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${PLAYER_SHEET_NAME}?key=${API_KEY}`
    );
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    if (!data.values) throw new Error('No data returned from Google Sheets API');
    const rows = data.values;
    const headers = rows[0];
    const allPlayers = rows.slice(1).map(row => ({
      rank: parseInt(row[0]) || 0,
      playerName: row[1] || '',
      biography: row[2] || '',
      image: row[3] || 'https://via.placeholder.com/150x150',
      category: row[4] || '',
      country: row[5] || '',
      status: row[6] || ''
    }));
    topPlayers = allPlayers
      .filter(player => player.image && !player.image.includes('via.placeholder.com'))
      .sort((a, b) => b.rank - a.rank);
    displayTopPlayers();
  } catch (error) {
    console.error('Error fetching top players:', error.message);
    document.getElementById('top-players').innerHTML = '<p class="text-red-600 text-sm">Failed to load top players.</p>';
  }
}

// Display Top Players
function displayTopPlayers() {
  const topPlayersDiv = document.getElementById('top-players');
  let currentIndex = 0;
  function renderPlayers() {
    const start = currentIndex % topPlayers.length;
    const selectedPlayers = [];
    for (let i = 0; i < 3; i++) {
      const index = (start + i) % topPlayers.length;
      if (topPlayers[index]) selectedPlayers.push(topPlayers[index]);
    }
    const playersHTML = selectedPlayers.length > 0
      ? selectedPlayers.map(item => `
          <div class="player-card flex items-center space-x-3">
            <a href="playerbio.html?player=${encodeURIComponent(item.playerName)}">
              <img src="${item.image}" alt="${item.playerName} Profile Image" class="player-image w-12 h-12" loading="lazy">
            </a>
            <div class="flex-1">
              <h4 class="text-sm font-semibold hover:text-blue-600 transition">
                <a href="playerbio.html?player=${encodeURIComponent(item.playerName)}">${item.playerName}</a>
              </h4>
              <p class="text-xs text-gray-600">Rank: ${item.rank}</p>
            </div>
          </div>
        `).join('')
      : '<p class="text-gray-600 text-sm">No top players available.</p>';
    topPlayersDiv.innerHTML = playersHTML;
    currentIndex = (currentIndex + 3) % topPlayers.length;
  }
  renderPlayers();
  setInterval(renderPlayers, PLAYER_ROTATION_INTERVAL);
}

// Display Featured News
function displayFeaturedNews() {
  const featuredNewsScroll = document.getElementById('featured-news-scroll');
  const featuredHTML = featuredNews.length > 0
    ? featuredNews.map(item => `
        <article class="featured-news-card">
          <a href="opennews.html?headline=${encodeURIComponent(item.headline)}">
            <img src="${item.image}" alt="${item.headline}" class="w-full h-24 mb-2" loading="lazy">
            <h4 class="text-sm font-semibold text-gray-800 hover:text-blue-600 transition">${item.headline}</h4>
            <p class="text-xs text-gray-600 mt-1">${item.source}</p>
          </a>
        </article>
      `).join('')
    : '<p class="text-gray-600 text-sm">No featured news available.</p>';
  featuredNewsScroll.innerHTML = featuredHTML;
  const scrollContainer = document.getElementById('featured-news-scroll');
  const scrollLeftBtn = document.getElementById('scroll-left-btn');
  const scrollRightBtn = document.getElementById('scroll-right-btn');
  scrollLeftBtn.addEventListener('click', () => {
    scrollContainer.scrollBy({ left: -150, behavior: 'smooth' });
  });
  scrollRightBtn.addEventListener('click', () => {
    scrollContainer.scrollBy({ left: 150, behavior: 'smooth' });
  });
}

// Update Date and Time
function updateDateTime() {
  const now = new Date();
  const dateOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
  const formattedDate = now.toLocaleDateString('en-US', dateOptions);
  const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
  const formattedTime = now.toLocaleTimeString('en-US', timeOptions);
  const isoDateTime = now.toISOString();
  const dateElement = document.getElementById('current-date');
  const timeElement = document.getElementById('current-time');
  dateElement.textContent = formattedDate;
  dateElement.setAttribute('datetime', isoDateTime.split('T')[0]);
  timeElement.textContent = formattedTime;
  timeElement.setAttribute('datetime', isoDateTime);
}

// Update Carousel Slide
function updateCarouselSlide() {
  const carouselImage = document.getElementById('carousel-image');
  const carouselLink = document.getElementById('carousel-link');
  const carouselCaption = document.getElementById('carousel-caption');
  const dots = document.getElementsByClassName('carousel-dot');
  carouselImage.classList.remove('loaded');
  carouselImage.classList.add('loading');
  if (topStories.length > 0) {
    carouselLink.href = `opennews.html?headline=${encodeURIComponent(topStories[currentSlide].headline)}`;
    carouselCaption.textContent = topStories[currentSlide].headline;
    carouselImage.alt = topStories[currentSlide].headline;
    carouselImage.onload = () => {
      carouselImage.classList.remove('loading', 'hidden');
      carouselImage.classList.add('loaded');
      document.querySelector('.carousel .skeleton-image').classList.add('hidden');
    };
    carouselImage.onerror = () => {
      carouselImage.src = 'https://via.placeholder.com/600x400';
      carouselImage.classList.remove('loading', 'hidden');
      carouselImage.classList.add('loaded');
      document.querySelector('.carousel .skeleton-image').classList.add('hidden');
    };
    carouselImage.src = topStories[currentSlide].image;
    for (let i = 0; i < dots.length; i++) {
      dots[i].classList.remove('active');
      if (i === currentSlide) dots[i].classList.add('active');
    }
  }
}

// Setup Carousel
function setupCarousel() {
  const carouselImage = document.getElementById('carousel-image');
  const carouselLink = document.getElementById('carousel-link');
  const carouselCaption = document.getElementById('carousel-caption');
  const carouselDots = document.getElementById('carousel-dots');
  if (topStories.length === 0) {
    carouselImage.src = 'https://via.placeholder.com/600x400';
    carouselImage.alt = 'No Top Stories Available';
    carouselCaption.textContent = 'No Top Stories Available';
    carouselImage.classList.add('loaded', 'hidden');
    return;
  }
  carouselLink.href = `opennews.html?headline=${encodeURIComponent(topStories[currentSlide].headline)}`;
  carouselCaption.textContent = topStories[currentSlide].headline;
  carouselImage.alt = topStories[currentSlide].headline;
  carouselImage.onload = () => {
    carouselImage.classList.remove('loading', 'hidden');
    carouselImage.classList.add('loaded');
    document.querySelector('.carousel .skeleton-image').classList.add('hidden');
  };
  carouselImage.onerror = () => {
    carouselImage.src = 'https://via.placeholder.com/600x400';
    carouselImage.classList.remove('loading', 'hidden');
    carouselImage.classList.add('loaded');
    document.querySelector('.carousel .skeleton-image').classList.add('hidden');
  };
  carouselImage.src = topStories[currentSlide].image;
  carouselDots.innerHTML = topStories.map((_, index) => `
    <div class="carousel-dot ${index === 0 ? 'active' : ''}" data-slide="${index}"></div>
  `).join('');
  const dots = document.getElementsByClassName('carousel-dot');
  for (let i = 0; i < dots.length; i++) {
    dots[i].addEventListener('click', () => {
      currentSlide = parseInt(dots[i].dataset.slide);
      updateCarouselSlide();
    });
  }
  document.getElementById('prev-slide').addEventListener('click', () => {
    currentSlide = (currentSlide - 1 + topStories.length) % topStories.length;
    updateCarouselSlide();
  });
  document.getElementById('next-slide').addEventListener('click', () => {
    currentSlide = (currentSlide + 1) % topStories.length;
    updateCarouselSlide();
  });
}

// Like Functionality
async function toggleLike(headline, user) {
  if (!user) {
    alert('Please sign in to like articles.');
    return;
  }
  const likeRef = db.collection('likes').doc(`${user.uid}_${headline}`);
  const doc = await likeRef.get();
  if (doc.exists) {
    await likeRef.delete();
    return false;
  } else {
    await likeRef.set({
      userId: user.uid,
      headline: headline,
      timestamp: new Date()
    });
    return true;
  }
}

async function getLikeCount(headline) {
  const likes = await db.collection('likes').where('headline', '==', headline).get();
  return likes.size;
}

async function isLikedByUser(headline, user) {
  if (!user) return false;
  const likeRef = db.collection('likes').doc(`${user.uid}_${headline}`);
  const doc = await likeRef.get();
  return doc.exists;
}

// Comment Functionality
async function addComment(headline, user, commentText) {
  if (!user) {
    alert('Please sign in to comment.');
    return;
  }
  if (!commentText.trim()) {
    alert('Comment cannot be empty.');
    return;
  }
  await db.collection('comments').add({
    headline: headline,
    userId: user.uid,
    userName: user.displayName,
    userPhoto: user.photoURL,
    text: commentText,
    timestamp: new Date()
  });
}

async function getComments(headline) {
  const comments = await db.collection('comments')
    .where('headline', '==', headline)
    .orderBy('timestamp', 'desc')
    .get();
  return comments.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

// Share Functionality
function shareArticle(headline, link) {
  const shareData = {
    title: headline,
    url: link
  };
  if (navigator.share) {
    navigator.share(shareData)
      .then(() => console.log('Article shared successfully'))
      .catch(error => console.error('Error sharing article:', error));
  } else {
    navigator.clipboard.writeText(link)
      .then(() => alert('Link copied to clipboard!'))
      .catch(error => {
        console.error('Error copying link:', error);
        alert('Failed to copy link.');
      });
  }
}

// Render News
async function renderNews(append = false) {
  const topStoriesDiv = document.getElementById('top-stories');
  topStoriesDiv.innerHTML = topStories.length > 0
    ? topStories.map(item => `
        <article class="mb-6">
          <span class="bg-blue-600 text-white text-xs px-3 py-1 rounded-full">Top Story</span>
          <h3 class="text-xl font-semibold mt-3 hover:text-blue-600 transition">
            <a href="opennews.html?headline=${encodeURIComponent(item.headline)}">${item.headline}</a>
          </h3>
          <p class="text-gray-600 text-sm mt-1">${item.source} • ${item.date}</p>
        </article>
      `).join('')
    : '<p class="text-gray-600">No Top Stories available.</p>';
  const newsFeed = document.getElementById('news-feed');
  const user = auth.currentUser;
  const reversedNews = [...filteredNews].reverse();
  const startIndex = append ? displayedNewsCount : 0;
  const endIndex = Math.min(startIndex + NEWS_PER_PAGE, reversedNews.length);
  const newsToDisplay = reversedNews.slice(startIndex, endIndex);
  const newsHTML = await Promise.all(newsToDisplay.map(async item => {
    const likeCount = await getLikeCount(item.headline);
    const isLiked = await isLikedByUser(item.headline, user);
    const comments = await getComments(item.headline);
    return `
      <article class="news-card bg-white p-4 rounded-xl shadow-md flex items-start space-x-4">
        <img src="${item.image}" alt="${item.headline}" class="w-24 h-24 object-cover rounded-lg" loading="lazy">
        <div class="flex-1">
          <span class="category-badge ${
            categoryColors[item.category] || categoryColors['default']
          }">${item.category}</span>
          <h3 class="text-lg font-semibold hover:text-blue-600 transition">
            <a href="opennews.html?headline=${encodeURIComponent(item.headline)}">${item.headline}</a>
          </h3>
          <p class="text-gray-600 mt-1 text-sm">${item.description.slice(0, 100)}...</p>
          <p class="text-xs text-gray-500 mt-1">${item.source} • ${item.date}</p>
          <div class="interaction-buttons">
            <span class="interaction-btn like-btn ${isLiked ? 'liked' : ''}" data-headline="${encodeURIComponent(item.headline)}">
              <i class="fas fa-heart"></i> <span>${likeCount}</span>
            </span>
            <span class="interaction-btn comment-btn" data-headline="${encodeURIComponent(item.headline)}">
              <i class="fas fa-comment"></i> <span>${comments.length}</span>
            </span>
            <span class="interaction-btn share-btn" data-headline="${encodeURIComponent(item.headline)}" data-link="${item.link}">
              <i class="fas fa-share"></i> Share
            </span>
          </div>
          <div class="comment-section" id="comment-section-${encodeURIComponent(item.headline)}">
            <textarea class="comment-input" placeholder="Add a comment..."></textarea>
            <button class="comment-submit">Submit</button>
            <div class="comment-list">
              ${comments.map(comment => `
                <div class="comment-item">
                  <img src="${comment.userPhoto}" alt="${comment.userName}">
                  <div class="comment-content">
                    <p><strong>${comment.userName}</strong>: ${comment.text}</p>
                    <span>${new Date(comment.timestamp.toDate()).toLocaleString()}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </article>
    `;
  }));
  if (append) {
    newsFeed.insertAdjacentHTML('beforeend', newsHTML.join(''));
  } else {
    newsFeed.innerHTML = newsHTML.join('');
  }
  document.querySelectorAll('.news-card').forEach((card, index) => {
    setTimeout(() => {
      card.classList.add('loaded');
    }, index * 100);
  });
  // Add event listeners for interaction buttons
  document.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const headline = decodeURIComponent(btn.dataset.headline);
      const isLiked = await toggleLike(headline, auth.currentUser);
      const likeCount = await getLikeCount(headline);
      btn.classList.toggle('liked', isLiked);
      btn.querySelector('span').textContent = likeCount;
    });
  });
  document.querySelectorAll('.comment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const headline = decodeURIComponent(btn.dataset.headline);
      const commentSection = document.getElementById(`comment-section-${encodeURIComponent(headline)}`);
      commentSection.classList.toggle('active');
    });
  });
  document.querySelectorAll('.comment-submit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.news-card');
      const headline = decodeURIComponent(card.querySelector('.comment-btn').dataset.headline);
      const input = card.querySelector('.comment-input');
      await addComment(headline, auth.currentUser, input.value);
      input.value = '';
      renderNews(append); // Re-render to update comments
    });
  });
  document.querySelectorAll('.share-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const headline = decodeURIComponent(btn.dataset.headline);
      const link = btn.dataset.link;
      shareArticle(headline, link);
    });
  });
  displayedNewsCount = endIndex;
  const loadMoreDiv = document.getElementById('load-more');
  if (displayedNewsCount >= reversedNews.length) {
    loadMoreDiv.style.display = 'none';
  } else {
    loadMoreDiv.style.display = 'block';
  }
  const structuredData = newsToDisplay.map(item => ({
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": item.headline,
    "image": item.image,
    "datePublished": item.date,
    "description": item.description.slice(0, 100) + "...",
    "author": {
      "@type": "Organization",
      "name": item.source
    },
    "publisher": {
      "@type": "Organization",
      "name": "NewsTally",
      "logo": {
        "@type": "ImageObject",
        "url": "https://newstally.online/images/logo.png"
      }
    }
  }));
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(structuredData);
  document.head.appendChild(script);
  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('loaded');
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '100px' });
  document.querySelectorAll('.news-card:not(.loaded)').forEach(card => {
    observer.observe(card);
  });
}

// Setup Load More
function setupLoadMore() {
  const loadMoreBtn = document.getElementById('load-more-btn');
  const loadMoreText = document.getElementById('load-more-text');
  const loadMoreSpinner = document.getElementById('load-more-spinner');
  loadMoreBtn.addEventListener('click', async () => {
    loadMoreText.textContent = 'Loading...';
    loadMoreSpinner.classList.remove('hidden');
    loadMoreBtn.disabled = true;
    await new Promise(resolve => setTimeout(resolve, 1000));
    renderNews(true);
    loadMoreText.textContent = 'Load More';
    loadMoreSpinner.classList.add('hidden');
    loadMoreBtn.disabled = false;
  });
}

// Setup Filters and Search
function setupFilters() {
  const categoryFilter = document.getElementById('category-filter');
  categoryFilter.innerHTML = categories.map(category => `
    <option value="${category}">${category}</option>
  `).join('');
  categoryFilter.addEventListener('change', (e) => {
    const selectedCategory = e.target.value;
    filteredNews = selectedCategory === 'All' ? news : news.filter(item => item.category === selectedCategory);
    displayedNewsCount = 0;
    renderNews();
  });
  const searchToggle = document.getElementById('search-toggle');
  const searchResults = document.getElementById('search-results');
  const searchInput = document.getElementById('search-input');
  const searchResultsList = document.getElementById('search-results-list');
  searchToggle.addEventListener('click', () => {
    searchResults.classList.toggle('hidden');
    if (!searchResults.classList.contains('hidden')) {
      searchInput.focus();
    }
  });
  const debouncedSearch = debounce((query) => {
    const results = news.filter(item =>
      item.headline.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.source.toLowerCase().includes(query)
    );
    searchResultsList.innerHTML = results.length > 0
      ? results.map(item => `
          <div class="search-result-card" data-headline="${encodeURIComponent(item.headline)}">
            <h4 class="text-sm font-semibold text-gray-800">${item.headline}</h4>
            <p class="text-xs text-gray-600 mt-1">${item.source} • ${item.category}</p>
          </div>
        `).join('')
      : '<p class="text-gray-600 text-sm p-4">No results found.</p>';
    searchResultsList.querySelectorAll('.search-result-card').forEach(card => {
      card.addEventListener('click', () => {
        const headline = card.dataset.headline;
        window.location.href = `opennews.html?headline=${headline}`;
      });
    });
  }, 300);
  searchInput.addEventListener('input', (e) => {
    debouncedSearch(e.target.value.toLowerCase());
  });
  document.addEventListener('click', (e) => {
    if (!searchResults.contains(e.target) && e.target !== searchToggle && !searchToggle.contains(e.target)) {
      searchResults.classList.add('hidden');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchResults.classList.add('hidden');
    }
  });
}

// Highlight Active Nav
function highlightActiveNav() {
  const navLinks = document.querySelectorAll('#nav-menu a, #nav-panel a');
  const bottomNavLinks = document.querySelectorAll('.bottom-nav a');
  navLinks.forEach(link => {
    if (link.href.includes('index.html') || (link.href.endsWith('#') && window.location.pathname.endsWith('index.html'))) {
      link.classList.add('nav-active');
    }
  });
  bottomNavLinks.forEach(link => {
    if (link.href.includes('index.html') || (link.href.endsWith('#') && window.location.pathname.endsWith('index.html'))) {
      link.classList.add('nav-active');
    }
  });
}

// Navigation Panel Toggle
document.getElementById('menu-toggle').addEventListener('click', () => {
  document.getElementById('nav-panel').classList.toggle('open');
});
document.getElementById('close-panel').addEventListener('click', () => {
  document.getElementById('nav-panel').classList.remove('open');
});

// Initialize
updateDateTime();
setInterval(updateDateTime, 1000);
fetchNews();
fetchTopPlayers();
setupLoadMore();
