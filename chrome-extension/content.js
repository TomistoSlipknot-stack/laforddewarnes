// Content script - runs on laforddewarnes.com
// Listens for stock check requests from the page

window.addEventListener('message', (event) => {
  if (event.data?.type === 'FORD_CHECK_STOCK') {
    chrome.runtime.sendMessage(
      { type: 'CHECK_STOCK', partNumber: event.data.partNumber },
      (response) => {
        window.postMessage({
          type: 'FORD_STOCK_RESULT',
          partNumber: event.data.partNumber,
          results: response,
        }, '*');
      }
    );
  }
});

// Let the page know the extension is installed
window.postMessage({ type: 'FORD_EXTENSION_READY' }, '*');
