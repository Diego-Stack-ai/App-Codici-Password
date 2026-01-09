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
        },
        {
            id: 'p-2',
            nomeAccount: 'Facebook',
            username: 'mario.rossi.fb',
            password: 'PasswordFacebook',
            sitoWeb: 'https://facebook.com'
        }
    ]
  }
];

function getUsers() {
    // For this verification step, we always return the hardcoded user.
    return utenti;
}

function saveUsers(users) {
    // No-op for this verification step.
}

export { getUsers, saveUsers, utenti };
