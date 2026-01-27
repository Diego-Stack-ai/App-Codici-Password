/**
 * TITANIUM CORE ENGINE v2.2 (Time-Lock Protocol)
 * Gestione centralizzata di Tema, Font, Protezioni e Meta-tag.
 * Blindatura Totale v3: Time-Based Logic per modalità Auto.
 */

(function () {
    // --- 1. CONFIGURAZIONE TAILWIND (Pillar della Blindatura) ---
    window.tailwind = window.tailwind || {};
    window.tailwind.config = {
        darkMode: 'class', // OBBLIGATORIO: Ignora il sistema
        theme: {
            extend: {}
        }
    };

    // --- 2. LOGICA TEMA CENTRALE ---
    const ThemeManager = {
        init: function () {
            this.applyLogic();
            // Controllo ogni minuto per il cambio orario (se in auto)
            setInterval(() => this.applyLogic(), 60000);

            // Espone API globale
            window.TitaniumTheme = this;
        },

        setMode: function (mode) {
            localStorage.setItem('theme', mode);
            this.applyLogic();
            // Reload necessario solo se vogliamo purificare il DOM completamente, 
            // ma con la logica attuale basta riapplicare. 
            // Per sicurezza nelle impostazioni facciamo reload, qui applichiamo.
        },

        getMode: function () {
            return localStorage.getItem('theme') || 'auto';
        },

        isDayTime: function () {
            const hour = new Date().getHours();
            return hour >= 7 && hour < 19;
        },

        applyLogic: function () {
            const savedTheme = this.getMode();
            const isForcedDark = document.documentElement.classList.contains('titanium-forced-dark');

            let shouldBeDark = false;
            let colorSchemeValue = "light";

            // LOGICA DECISIONALE (Gerarchia)
            if (isForcedDark) {
                // 1. Priorità massima: Pagine di sicurezza (Login, Reset)
                shouldBeDark = true;
                colorSchemeValue = "dark";
            } else if (savedTheme === 'light') {
                // 2. Manuale Utente: CHIARO (Ignora tutto)
                shouldBeDark = false;
                colorSchemeValue = "light";
            } else if (savedTheme === 'dark') {
                // 3. Manuale Utente: SCURO (Ignora tutto)
                shouldBeDark = true;
                colorSchemeValue = "dark";
            } else {
                // 4. Automatico: LOGICA TIME-BASED (Ignora sensore telefono)
                // 07:00 - 19:00 -> CHIARO
                // 19:00 - 07:00 -> SCURO
                if (this.isDayTime()) {
                    shouldBeDark = false;
                    colorSchemeValue = "light";
                } else {
                    shouldBeDark = true;
                    colorSchemeValue = "dark";
                }
            }

            // APPLICAZIONE CLASSI DOM
            const html = document.documentElement;
            if (shouldBeDark) {
                html.classList.add('dark');
                html.style.backgroundColor = "#0a0f1e";
            } else {
                html.classList.remove('dark');
                html.style.backgroundColor = "#f0f4f8";
            }

            // INIEZIONE META TAG (BLINDATURA)
            this.injectMeta(colorSchemeValue);
        },

        injectMeta: function (scheme) {
            const head = document.head;

            // color-scheme
            let metaScheme = head.querySelector('meta[name="color-scheme"]');
            if (!metaScheme) {
                metaScheme = document.createElement('meta');
                metaScheme.name = "color-scheme";
                head.appendChild(metaScheme);
            }
            metaScheme.content = scheme;

            // theme-color
            let metaTheme = head.querySelector('meta[name="theme-color"]');
            if (!metaTheme) {
                metaTheme = document.createElement('meta');
                metaTheme.name = "theme-color";
                head.appendChild(metaTheme);
            }
            metaTheme.content = scheme === 'dark' ? "#0a0f1e" : "#f0f4f8";
        }
    };

    // --- 3. GESTIONE ASSET (Font, Icone) ---
    function injectGlobalAssets() {
        const head = document.head;
        if (!document.querySelector('link[href*="fonts.googleapis.com"]')) {
            const assets = [
                { rel: "preconnect", href: "https://fonts.googleapis.com" },
                { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
                { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&display=swap" },
                { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" }
            ];
            assets.forEach(attr => {
                const link = document.createElement('link');
                Object.assign(link, attr);
                head.appendChild(link);
            });
        }
    }

    // --- 4. PROTEZIONI UI ---
    function applyProtections() {
        // Disabilita zoom su iOS (spesso ignorato ma ci proviamo)
        // Disabilita long-press menu contestuale tranne su input
        document.addEventListener('contextmenu', e => {
            if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName)) e.preventDefault();
        }, false);
    }

    // --- 5. STEALTH REVEAL (Previene flash bianco) ---
    function initReveal() {
        const style = document.createElement('style');
        style.innerHTML = `body { opacity: 0; transition: opacity 0.3s ease-in-out; }`;
        document.head.appendChild(style);

        const reveal = () => {
            requestAnimationFrame(() => {
                setTimeout(() => { document.body.style.opacity = '1'; }, 50);
            });
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', reveal);
        } else {
            reveal();
        }
    }

    // --- AVVIO ---
    ThemeManager.init();
    injectGlobalAssets();
    applyProtections();
    initReveal();

})();
