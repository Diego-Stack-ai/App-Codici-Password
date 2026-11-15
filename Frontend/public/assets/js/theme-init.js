// Synchronous theme setup; automatic mode follows Europe/Rome.

(function () {
    let bodyObserver = null, classic = null;
    function applyTheme(updateGraphics = true) {
    try {
        if (updateGraphics) {
        classic ??= localStorage.getItem('ui_graphics') === 'classic';
        if (classic) document.documentElement.dataset.uiGraphics = 'classic';
        else delete document.documentElement.dataset.uiGraphics;
        if (document.body) {
            if (document.body.hasAttribute('data-ui-revision')) {
                document.body.setAttribute('data-ui-revision', classic ? 'classica' : 'tre-livelli');
            }
            bodyObserver?.disconnect(); bodyObserver = null;
        } else if (!bodyObserver) {
            bodyObserver = new MutationObserver(() => { if (document.body) applyTheme(); });
            bodyObserver.observe(document.documentElement, { childList: true });
            document.addEventListener('DOMContentLoaded', applyTheme, { once: true });
        }
        }

        const savedColorTheme = localStorage.getItem('color_theme');
        const colorTheme = ['blue', 'green', 'red', 'sand', 'petrol', 'lavender', 'dusty-rose'].includes(savedColorTheme) ? savedColorTheme : 'blue';
        document.documentElement.dataset.colorTheme = colorTheme;

        if (document.documentElement.classList.contains('protocol-forced-dark')) {
            document.documentElement.classList.add('dark');
            document.documentElement.dataset.themeMode = 'security-dark';
            document.documentElement.dataset.themeResolved = 'dark';
            return;
        }

        const savedTheme = localStorage.getItem('theme');
        const localTheme = ['light', 'dark', 'auto'].includes(savedTheme) ? savedTheme : 'auto';
        const AUTO_LIGHT_START = 8;
        const AUTO_DARK_START = 21;
        let isDark = false;

        if (localTheme === 'dark') {
            isDark = true;
        } else if (localTheme === 'light') {
            isDark = false;
        } else {
            try {
                const italyTime = new Intl.DateTimeFormat('en-US', {
                    hour: 'numeric',
                    hour12: false,
                    timeZone: 'Europe/Rome'
                }).format(new Date());

                const hour = parseInt(italyTime);
                isDark = (hour < AUTO_LIGHT_START || hour >= AUTO_DARK_START);
            } catch (e) {
                isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            }
        }

        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        document.documentElement.dataset.themeMode = localTheme;
        document.documentElement.dataset.themeResolved = isDark ? 'dark' : 'light';
    } catch (e) {
        console.warn('Theme init failed', e);
    }
    }
    applyTheme();
    // Sync appearance only; structural graphics stay fixed until the next load.
    window.addEventListener('storage', event => {
        if (event.key === null || ['theme', 'color_theme'].includes(event.key)) applyTheme(false);
    });
})();
