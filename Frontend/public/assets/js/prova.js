const fields = {
    inner: document.querySelector('#inner-height'),
    visual: document.querySelector('#visual-height'),
    screen: document.querySelector('#screen-height'),
    document: document.querySelector('#document-height')
};

function px(value) {
    return Number.isFinite(value) ? `${Math.round(value)} px` : 'non disponibile';
}

function updateViewportMetrics() {
    fields.inner.textContent = px(window.innerHeight);
    fields.visual.textContent = px(window.visualViewport?.height);
    fields.screen.textContent = px(window.screen?.height);
    fields.document.textContent = px(document.documentElement.getBoundingClientRect().height);
}

updateViewportMetrics();
window.addEventListener('resize', updateViewportMetrics, {passive: true});
window.addEventListener('orientationchange', updateViewportMetrics, {passive: true});
window.visualViewport?.addEventListener('resize', updateViewportMetrics, {passive: true});
