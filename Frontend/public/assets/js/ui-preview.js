(() => {
  const root = document.documentElement;
  const frame = document.querySelector('.device-frame');
  const modal = document.getElementById('vault-modal');

  function showView(name) {
    document.querySelectorAll('.app-view').forEach(panel => panel.classList.toggle('is-active', panel.dataset.panel === name));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('is-active', item.dataset.view === name));
    if (name === 'vault') openModal();
  }

  function openModal() {
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('is-open'));
    modal.querySelector('.modal-close').focus();
  }

  function closeModal() {
    modal.classList.remove('is-open');
    setTimeout(() => { modal.hidden = true; }, 180);
  }

  document.addEventListener('click', event => {
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) showView(viewButton.dataset.view);
  });

  document.querySelectorAll('.preview-size').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.preview-size').forEach(item => item.classList.remove('is-active'));
    button.classList.add('is-active');
    frame.dataset.size = button.dataset.size;
  }));

  document.getElementById('theme-toggle').addEventListener('click', event => {
    const dark = root.dataset.theme === 'dark';
    root.dataset.theme = dark ? 'light' : 'dark';
    event.currentTarget.querySelector('.material-symbols-outlined').textContent = dark ? 'dark_mode' : 'light_mode';
  });

  document.getElementById('open-vault-modal').addEventListener('click', openModal);
  modal.querySelectorAll('.modal-close, .modal-cancel').forEach(button => button.addEventListener('click', closeModal));
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.hidden) closeModal(); });
})();
