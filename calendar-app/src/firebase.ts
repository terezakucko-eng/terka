import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyD_F-TOZo08_5gx7SyNxhd0IoY5Tezl3G4",
  authDomain: "bc-slon.firebaseapp.com",
  projectId: "bc-slon",
  storageBucket: "bc-slon.firebasestorage.app",
  messagingSenderId: "376422143628",
  appId: "1:376422143628:web:4f3efcf2963bebbfe10da9"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
