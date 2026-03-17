// NewsTally — Firebase Config, Init & State

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
// ===== FIREBASE IMPORTS =====
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
