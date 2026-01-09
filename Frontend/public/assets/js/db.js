// Mock database for users, persisted in localStorage to simulate a database.

const utenti = [
  {
    id: 'test-user-1',
    nome: "Mario",
    cognome: "Rossi",
    email: "mario.rossi@example.com",
    password: 'Password123',
    telefono: "+39 333 1234567",
    indirizzo: "Via Garibaldi, 10, 00184 Roma",
    codiceFiscale: "RSSMRA80A01H501U",
    iban: "IT60X0542811101000000123456",
    verified: true,
    accounts: [
        {
            id: 'p-1',
            nomeAccount: 'Google',
            username: 'mario.rossi@gmail.com',
            password: 'PasswordGoogle',
            sitoWeb: 'https://google.com'
        }
    ]
  }
];

function getUsers() {
    return utenti;
}

function saveUsers(users) {
    // This is a no-op for the verification step
}

// Keep other exports if they are needed by other parts of the app
export { getUsers, saveUsers, utenti };
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

/**
 * Retrieves the deadlines for a specific user.
 * @param {string} userId - The ID of the user.
 * @returns {Array} The array of deadline objects.
 */
function getScadenze(userId) {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    return user ? user.scadenze || [] : [];
}

/**
 * Saves a new or updated deadline for a specific user.
 * @param {string} userId - The ID of the user.
 * @param {object} scadenza - The deadline object to save.
 */
function saveScadenza(userId, scadenza) {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
        if (!users[userIndex].scadenze) {
            users[userIndex].scadenze = [];
        }
        const scadenzaIndex = users[userIndex].scadenze.findIndex(s => s.id === scadenza.id);
        if (scadenzaIndex !== -1) {
            users[userIndex].scadenze[scadenzaIndex] = scadenza;
        } else {
            users[userIndex].scadenze.push(scadenza);
        }
        saveUsers(users);
    }
}

/**
 * Deletes a deadline for a specific user.
 * @param {string} userId - The ID of the user.
 * @param {string} scadenzaId - The ID of the deadline to delete.
 */
function deleteScadenza(userId, scadenzaId) {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1 && users[userIndex].scadenze) {
        users[userIndex].scadenze = users[userIndex].scadenze.filter(s => s.id !== scadenzaId);
        saveUsers(users);
    }
}

// Initialize the base utenti array for the application.
const utenti = [];

export { getUsers, saveUsers, getScadenze, saveScadenza, deleteScadenza, utenti };
