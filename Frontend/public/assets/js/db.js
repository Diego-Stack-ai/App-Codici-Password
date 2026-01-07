// Mock database for users, persisted in localStorage to simulate a database.

/**
 * Retrieves the list of users from localStorage.
 * If no users are found, returns an empty array.
 * @returns {Array} The array of user objects.
 */
function getUsers() {
    const users = localStorage.getItem('utenti');
    // Initialize with an empty array if no users are stored yet.
    return users ? JSON.parse(users) : [];
}

/**
 * Saves the given array of users to localStorage.
 * @param {Array} users - The array of user objects to save.
 */
function saveUsers(users) {
    localStorage.setItem('utenti', JSON.stringify(users));
}

// Initialize the base utenti array for the application.
const utenti = [];

export { getUsers, saveUsers, utenti };
