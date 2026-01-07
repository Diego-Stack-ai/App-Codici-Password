// File: js/tailwind-config.js
// Contiene le personalizzazioni per Tailwind CSS (colori, font, ecc.)

tailwind.config = {
  theme: {
    extend: {
      colors: {
        'primary': '#007bff',      // Blu primario
        'secondary': '#6c757d',    // Grigio secondario
        'success': '#28a745',     // Verde per le conferme
        'danger': '#dc3545',      // Rosso per gli errori
        'light': '#f8f9fa',       // Sfondo chiaro
        'dark': '#343a40',        // Testo scuro
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Font moderno
      },
    }
  }
}
