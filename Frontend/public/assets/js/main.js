function navigateTo(page) {
  window.location.href = `${page}.html`;
}

document.addEventListener('DOMContentLoaded', function() {
  const togglePasswordButtons = document.querySelectorAll('.toggle-password');

  togglePasswordButtons.forEach(button => {
    button.addEventListener('click', function() {
      const passwordInputContainer = this.closest('.relative');
      if (!passwordInputContainer) return;

      const passwordInput = passwordInputContainer.querySelector('input');
      if (!passwordInput) return;

      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);

      const icon = this.querySelector('.material-symbols-outlined');
      if (icon) {
        icon.textContent = type === 'password' ? 'visibility' : 'visibility_off';
      }
    });
  });
});
