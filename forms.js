/**
 * VAB BOOST - Forms JavaScript (Legacy Support)
 * This file is for backward compatibility
 */

// Redirect to main script
console.log('forms.js is deprecated. Using script.js instead.');

// Include main script if not already loaded
if (!window.VABBoost) {
    const script = document.createElement('script');
    script.src = '/js/script.js';
    document.head.appendChild(script);
}