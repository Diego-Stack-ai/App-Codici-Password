window.tailwind = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#137fec',
        'background-light': '#e2e8f0',
        'background-dark': '#0a162a',
        // Semantic Gradient Colors
        'private-from': '#137fec', 'private-to': '#0b4e92',
        'company-from': '#10b981', 'company-to': '#047857',
        'expiry-from': '#f97316', 'expiry-to': '#c2410c',
        'urgent-from': '#ef4444', 'urgent-to': '#991b1b',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg: '1rem',
        xl: '1.5rem',
        full: '9999px',
      },
      fontFamily: {
        display: ['Manrope', 'sans-serif'],
      },
    },
  },
};

// Standard Global Styles (Injected automatically)
(function () {
  const style = document.createElement('style');
  style.textContent = `
    /* Hide scrollbar for Chrome, Safari and Opera */
    ::-webkit-scrollbar {
      display: none;
    }
    /* Hide scrollbar for IE, Edge and Firefox */
    * {
      -ms-overflow-style: none;  /* IE and Edge */
      scrollbar-width: none;  /* Firefox */
    }

    /* --- iOS / Mobile Native App Feel Fixes --- */
    
    /* 1. Block System Dark Mode Interaction */
    :root {
        color-scheme: light; /* Force browser to render form controls in light mode by default */
    }
    html.dark {
        color-scheme: dark; /* Only switch if the class is explicitly added */
    }

    /* 2. Disable Long Press (Context Menu) & Text Selection Globally */
    * {
        -webkit-touch-callout: none !important; /* iOS: Disable context menu (copy/share/look up) */
        -webkit-user-select: none !important;   /* Safari: Disable text selection */
        user-select: none !important;           /* Standard: Disable text selection */
        -webkit-tap-highlight-color: transparent; /* Disable blue tap highlight */
    }

    /* 3. Re-enable for Input Fields & Specific Content */
    input, textarea, [contenteditable="true"], .selectable, .select-text {
        -webkit-touch-callout: default !important;
        -webkit-user-select: text !important;
        user-select: text !important;
        cursor: text;
    }
    
    /* Ensure Buttons are still clickable (select: none is fine, but just to be safe) */
    button, a {
        -webkit-user-select: none !important;
    }
  `;
  document.head.appendChild(style);
})();
