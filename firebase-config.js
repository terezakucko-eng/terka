// =====================================================
// FIREBASE KONFIGURACE
// =====================================================

// TODO: Nahraď těmito hodnotami z Firebase Console
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
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
