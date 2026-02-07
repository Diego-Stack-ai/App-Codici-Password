/**
 * PROTOCOLLO BASE CORE ENGINE v2.3 (CSP-Safe Edition)
 * Gestione centralizzata di Tema, Font, Protezioni e Meta-tag.
 * Blindatura Totale v3.1: CSP Optimized (Zero Inline Styles)
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
            window.ProtocolloBaseTheme = this;
        },

        setMode: function (mode) {
            localStorage.setItem('theme', mode);
            this.applyLogic();
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
            const isForcedDark = document.documentElement.classList.contains('protocol-forced-dark');

            let shouldBeDark = false;
            let colorSchemeValue = "light";

            // LOGICA DECISIONALE (Gerarchia)
            if (isForcedDark) {
                shouldBeDark = true;
                colorSchemeValue = "dark";
            } else if (savedTheme === 'light') {
                shouldBeDark = false;
                colorSchemeValue = "light";
            } else if (savedTheme === 'dark') {
                shouldBeDark = true;
                colorSchemeValue = "dark";
            } else {
                if (this.isDayTime()) {
                    shouldBeDark = false;
                    colorSchemeValue = "light";
                } else {
                    shouldBeDark = true;
                    colorSchemeValue = "dark";
                }
            }

            // APPLICAZIONE CLASSI DOM (CSP Safe: No inline styles)
            const html = document.documentElement;
            if (shouldBeDark) {
                html.classList.add('dark');
            } else {
                html.classList.remove('dark');
            }

            // INIEZIONE META TAG (BLINDATURA)
            this.injectMeta(colorSchemeValue);
        },

        injectMeta: function (scheme) {
            const head = document.head;

            // color-scheme
            let metaScheme = head.querySelector('meta[name="color-scheme"]');
            if (!metaScheme) {
                metaScheme = head.querySelector('meta[name="color-scheme"]') || document.createElement('meta');
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
            // Allineato con variabili CSS --bg-primary
            metaTheme.content = scheme === 'dark' ? "#0a0f1e" : "#e2e8f0";
        }
    };

    // --- 3. GESTIONE ASSET (Font, Icone) ---
    function injectGlobalAssets() {
        // Nessuna iniezione dinamica di link se non necessaria, preferire HTML statico per CSP
    }

    // --- 4. PROTEZIONI UI ---
    function applyProtections() {
        document.addEventListener('contextmenu', e => {
            if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName)) e.preventDefault();
        }, false);
    }

    // --- 5. STEALTH REVEAL (Safe Transition) ---
    function initReveal() {
        // CSP Safe: La classe .revealed è definita in operatore.css
        const reveal = () => {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    if (document.body) {
                        document.body.classList.add('revealed');
                    }
                }, 50);
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
