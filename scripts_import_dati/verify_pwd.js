const API_KEY = "AIzaSyDDt-PacoHtUQg6Ow7-1UxvrGVZLXVYx-o";
const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
const payload = {
  email: "boschettodiego@gmail.com",
  password: "SOLdato13@@@",
  returnSecureToken: true
};

fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
})
.then(res => res.json())
.then(data => {
    if (data.idToken) {
        console.log("SUCCESSO: La password fornita 'SOLdato13@@@' e corretta per", payload.email);
    } else {
        console.error("ERRORE di login:", data.error ? data.error.message : data);
    }
})
.catch(err => console.error("Network error:", err));
