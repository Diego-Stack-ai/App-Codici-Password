import { auth, db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

/**
 * Gets the UID of the currently authenticated user.
 * @returns {string|null} The UID of the current user, or null if no user is signed in.
 */
function getUserUID() {
  const user = auth.currentUser;
  if (user) {
    return user.uid;
  } else {
    window.LOG("No user is currently signed in.");
    return null;
  }
}

/**
 * Fetches the user's data from the 'utenti' collection in Firestore.
 * @param {string} uid - The user's UID.
 * @returns {Promise<object|null>} A promise that resolves with the user's data object, or null if not found.
 */
async function getUserData(uid) {
  if (!uid) {
    console.error("UID is required to fetch user data.");
    return null;
  }

  try {
    const userDocRef = doc(db, "utenti", uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      window.LOG("User data retrieved:", userDocSnap.data());
      return userDocSnap.data();
    } else {
      window.LOG("No such document for UID:", uid);
      return null;
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
    return null;
  }
}

export { getUserUID, getUserData };
