/**
 * Toast notification utility for DaisyUI 5
 * Shows temporary notifications that auto-dismiss after a specified duration
 */

/**
 * Show a toast notification
 * @param {string} message - The message to display (can be a translation key or plain text)
 * @param {string} type - Toast type: 'success', 'error', 'info', 'warning'
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
  // Create toast container if it doesn't exist
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container toast toast-top toast-end fixed top-4 right-4 z-50';
    document.body.appendChild(toastContainer);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `alert ${getAlertClass(type)} mb-2 shadow-lg min-w-80 max-w-md`;

  // Create toast content
  const content = document.createElement('span');
  content.className = 'text-sm';
  content.textContent = message;
  toast.appendChild(content);

  // Add to container
  toastContainer.appendChild(toast);

  // Auto-remove after duration
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease-in-out';

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}

/**
 * Get DaisyUI alert class based on toast type
 * @param {string} type - Toast type
 * @returns {string} DaisyUI alert class
 */
function getAlertClass(type) {
  switch (type) {
    case 'success':
      return 'alert-success';
    case 'error':
      return 'alert-error';
    case 'warning':
      return 'alert-warning';
    case 'info':
    default:
      return 'alert-info';
  }
}
