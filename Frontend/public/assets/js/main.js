
function navigateTo(page) {
  // Adjust the path based on the current directory structure
  // This assumes the assets folder is one level up from the page folder
  window.location.href = `../${page}/${page}.html`;
}

document.addEventListener('DOMContentLoaded', function() {
  // --- Generalized Password Visibility Toggle ---
  document.querySelectorAll('.toggle-password').forEach(button => {
    button.addEventListener('click', function() {
      const passwordInput = this.previousElementSibling;
      if (passwordInput && (passwordInput.type === 'password' || passwordInput.type === 'text')) {
        // Toggle the input type
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);

        // Toggle the icon
        const icon = this.querySelector('i');
        if (icon) {
            if (type === 'password') {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            } else {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            }
        }
      }
    });
  });

  // --- Copy to Clipboard Functionality ---
  document.querySelectorAll('.copy-button').forEach(button => {
    button.addEventListener('click', function() {
      const targetId = this.dataset.copyTarget;
      const targetElement = document.getElementById(targetId);
      
      if (targetElement) {
        const valueToCopy = targetElement.value || targetElement.textContent;
        
        navigator.clipboard.writeText(valueToCopy).then(() => {
          // Provide visual feedback
          const originalText = this.innerHTML;
          this.textContent = 'Copiato!';
          setTimeout(() => {
            this.innerHTML = originalText;
          }, 2000); // Revert back after 2 seconds
        }).catch(err => {
          console.error('Failed to copy: ', err);
        });
      }
    });
  });
});
