/**
 * PROTOCOLLO BASE - DOM UTILITIES (V4.4)
 * Funzioni sicure per la manipolazione del DOM e prevenzione XSS.
 */

/**
 * Imposta il contenuto di un elemento in modo sicuro (solo testo)
 * @param {HTMLElement} el - elemento target
 * @param {string} text - testo da inserire
 */
export const safeSetText = (el, text) => {
    if (!el) return;
    el.textContent = text;
};

/**
 * Crea un nuovo elemento con attributi e figli in modo sicuro
 * @param {string} tag - tipo di elemento (div, span, h3, etc)
 * @param {Object} props - attributi e classi {className, id, dataset, style, ...}
 * @param {Array<HTMLElement|string>|HTMLElement|string} children - figli (elementi o testo)
 * @returns {HTMLElement}
 */
export const createElement = (tag, props = {}, children = []) => {
    const el = document.createElement(tag);

    for (const key in props) {
        if (key === 'className') {
            el.className = props[key];
        } else if (key === 'dataset') {
            for (const dataKey in props.dataset) {
                el.dataset[dataKey] = props.dataset[dataKey];
            }
        } else if (key === 'id') {
            el.id = props[key];
        } else if (key === 'style' && typeof props[key] === 'object') {
            Object.assign(el.style, props[key]);
        } else if (key === 'textContent') {
            el.textContent = props[key];
        } else if (key === 'innerHTML') {
            console.warn("Uso di innerHTML in createElement bloccato per sicurezza.");
            // Non assegniamo innerHTML.
        } else if (key.startsWith('on') && typeof props[key] === 'function') {
            el[key] = props[key];
        } else if (key in el && typeof el[key] !== 'function') {
            try {
                el[key] = props[key];
            } catch (e) {
                el.setAttribute(key, props[key]);
            }
        } else {
            el.setAttribute(key, props[key]);
        }
    }

    const childrenArray = Array.isArray(children) ? children : [children];
    childrenArray.forEach(child => {
        if (child === null || child === undefined) return;
        if (typeof child === 'string' || typeof child === 'number') {
            el.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            el.appendChild(child);
        }
    });

    return el;
};

/**
 * Pulisce un elemento e aggiunge nuovi figli in modo efficiente
 * @param {HTMLElement} parent - elemento target
 * @param {Array<HTMLElement|string>|HTMLElement} children - array di elementi da aggiungere
 */
export const setChildren = (parent, children) => {
    if (!parent) return;
    parent.textContent = ''; // Svuota in modo sicuro (più veloce di innerHTML = '')

    const childrenArray = Array.isArray(children) ? children : [children];
    const frag = document.createDocumentFragment();

    childrenArray.forEach(c => {
        if (c === null || c === undefined) return;
        if (typeof c === 'string' || typeof c === 'number') {
            frag.appendChild(document.createTextNode(c));
        } else if (c instanceof Node) {
            frag.appendChild(c);
        }
    });

    parent.appendChild(frag);
};

/**
 * Helper per svuotare un elemento
 */
export const clearElement = (el) => {
    if (el) el.textContent = '';
};

/**
 * Crea un'icona placeholder con iniziali (Avatar Fallback)
 * @param {string} name - nome dell'account
 * @returns {HTMLElement}
 */
export const createSafeAccountIcon = (name) => {
    const initials = (name || '?').charAt(0).toUpperCase();
    return createElement('div', {
        className: 'w-full h-full flex items-center justify-center bg-white/5 text-white/20 text-2xl font-black uppercase'
    }, initials);
};
