// Vercel Speed Insights initialization
// This manually injects the Speed Insights script based on the official implementation
(function() {
  // Initialize the queue for Speed Insights events
  if (window.si) return;
  
  window.si = function() {
    window.siq = window.siq || [];
    window.siq.push(arguments);
  };

  // Create and inject the Speed Insights script
  function injectScript() {
    // Check if script is already loaded
    var scriptSrc = '/_vercel/speed-insights/script.js';
    if (document.head.querySelector('script[src*="' + scriptSrc + '"]')) {
      return;
    }

    var script = document.createElement('script');
    script.src = scriptSrc;
    script.defer = true;
    
    // Add SDK metadata
    script.dataset.sdkn = '@vercel/speed-insights';
    script.dataset.sdkv = '2.0.0';
    
    script.onerror = function() {
      console.log('[Vercel Speed Insights] Failed to load script. Please check if any content blockers are enabled.');
    };
    
    document.head.appendChild(script);
  }

  // Inject when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectScript);
  } else {
    injectScript();
  }
})();
