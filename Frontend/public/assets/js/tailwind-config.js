tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6', // Tailwind's blue-500, a likely candidate based on other classes
        'background-light': '#ffffff',
        'background-dark': '#1e293b', // slate-800, a common dark background
      },
      fontFamily: {
        display: ['Manrope', 'sans-serif'],
      },
    },
  },
};
