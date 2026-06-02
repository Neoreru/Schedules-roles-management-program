import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyAYgNIFAGYscAB5CrV-DdBYDx5nirQ7hVY",
  authDomain: "team-schedules-roles-app.firebaseapp.com",
  projectId: "team-schedules-roles-app",
  storageBucket: "team-schedules-roles-app.firebasestorage.app",
  messagingSenderId: "444901470063",
  appId: "1:444901470063:web:7dde1092a81302d036429a",
}

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)