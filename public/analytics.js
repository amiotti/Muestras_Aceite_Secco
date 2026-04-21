/**
 * Vercel Web Analytics initialization
 * This script loads and initializes Vercel Analytics for tracking page views and web vitals
 */

(function() {
  // Load the Vercel Analytics script
  const script = document.createElement('script');
  script.src = 'https://cdn.vercel-insights.com/v1/script.js';
  script.defer = true;
  script.setAttribute('data-auto', 'true');
  
  // Handle script load errors gracefully
  script.onerror = function() {
    console.warn('Vercel Analytics script failed to load');
  };
  
  // Append script to document head
  document.head.appendChild(script);
})();
