// =====================================================
// FIREBASE KONFIGURACE
// =====================================================

// TODO: Nahraď těmito hodnotami z Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyArmmq7vN1kHLESLQnQgeveBF27VhSgCb4",
  authDomain: "rs-sledovani-konkurence.firebaseapp.com",
  projectId: "rs-sledovani-konkurence",
  storageBucket: "rs-sledovani-konkurence.firebasestorage.app",
  messagingSenderId: "365593630854",
  appId: "1:365593630854:web:9a6e9f21ca8fade9e95907"
};

// Inicializace Firebase
let db = null;
let auth = null;

async function initFirebase() {
    try {
        // Inicializace Firebase App
        const app = firebase.initializeApp(firebaseConfig);

        // Inicializace Firestore
        db = firebase.firestore();

        // Inicializace Auth (volitelné - pro přihlašování)
        auth = firebase.auth();

        console.log('✅ Firebase úspěšně inicializován');
        return true;
    } catch (error) {
        console.error('❌ Chyba při inicializaci Firebase:', error);
        alert('Nepodařilo se připojit k databázi. Aplikace bude používat lokální úložiště.');
        return false;
    }
}

// Export pro použití v app.js
window.firebaseConfig = firebaseConfig;
window.initFirebase = initFirebase;
window.getFirestore = () => db;
window.getAuth = () => auth;
