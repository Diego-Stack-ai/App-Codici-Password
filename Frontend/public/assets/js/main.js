function navigateTo(page) {
  window.location.href = `${page}.html`;
}

document.addEventListener('DOMContentLoaded', function() {

  // Logic for expandable cards and filters on the Account Privati page
  if (document.title === 'Account Privati') {

    const accountList = document.getElementById('account-list');

    // Card Expansion & Interaction Logic
    if (accountList) {
      accountList.addEventListener('click', function(e) {
        const target = e.target;
        const card = target.closest('.account-card');
        if (!card) return;

        // 1. Expand/Collapse Trigger
        const expandTrigger = target.closest('.expand-trigger');
        if (expandTrigger) {
          const content = card.querySelector('.expandable-content');
          const icon = expandTrigger.querySelector('.material-symbols-outlined');

          content.classList.toggle('hidden');
          icon.classList.toggle('rotate-180');
          return; // Stop further processing
        }

        // 2. Copy Button Logic
        const copyButton = target.closest('.copy-button');
        if (copyButton) {
            const passwordInput = copyButton.closest('.relative').querySelector('input');
            if (passwordInput) {
                navigator.clipboard.writeText(passwordInput.value).then(() => {
                    const icon = copyButton.querySelector('.material-symbols-outlined');
                    icon.textContent = 'check';
                    setTimeout(() => {
                        icon.textContent = 'content_copy';
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                });
            }
            return; // Stop further processing
        }

        // 3. Password Visibility Toggle
        const toggleButton = target.closest('.toggle-password');
        if (toggleButton) {
            const passwordInput = toggleButton.closest('.relative').querySelector('input');
            if (passwordInput) {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                const icon = toggleButton.querySelector('.material-symbols-outlined');
                icon.textContent = type === 'password' ? 'visibility' : 'visibility_off';
            }
        }
      });
    }

    // Filter Logic
    const filterButtons = document.querySelectorAll('.filter-btn');
    const accountCards = document.querySelectorAll('.account-card');

    filterButtons.forEach(button => {
      button.addEventListener('click', function() {
        // Manage active button state
        filterButtons.forEach(btn => {
            btn.classList.remove('active', 'bg-primary', 'text-white');
            btn.classList.add('bg-white', 'dark:bg-card-dark');
        });
        this.classList.add('active', 'bg-primary', 'text-white');
        this.classList.remove('bg-white', 'dark:bg-card-dark');

        const filter = this.id;

        // Apply filter to cards
        accountCards.forEach(card => {
          let show = false;
          if (filter === 'filter-all') {
            show = true;
          } else if (filter === 'filter-shared' && card.dataset.shared === 'true') {
            show = true;
          } else if (filter === 'filter-memorandum' && card.dataset.memorandum === 'true') {
            show = true;
          }

          card.style.display = show ? '' : 'none';
        });
      });
    });
  }

  // Generic password toggling for other pages (e.g., login)
  const genericTogglePasswordButtons = document.querySelectorAll('.toggle-password:not(#account-list .toggle-password)');
  genericTogglePasswordButtons.forEach(button => {
      button.addEventListener('click', function() {
          const passwordInput = this.closest('.relative').querySelector('input');
          if (passwordInput) {
              const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
              passwordInput.setAttribute('type', type);
              this.querySelector('.material-symbols-outlined').textContent = type === 'password' ? 'visibility' : 'visibility_off';
          }
      });
  });
});
