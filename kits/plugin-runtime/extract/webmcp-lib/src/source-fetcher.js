export async function fetchAllSources() {
  if (typeof document === 'undefined') return '';
  
  const sources = [];
  const scripts = Array.from(document.querySelectorAll('script'));
  
  for (const script of scripts) {
    if (script.type && script.type !== 'text/javascript' && script.type !== 'module') continue;
    
    if (script.src) {
      try {
        // Only attempt same-origin or ones that might allow CORS
        const url = new URL(script.src, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
        if (url.origin === origin) {
          const res = await fetch(script.src);
          if (res.ok) {
            sources.push(await res.text());
          }
        }
      } catch (e) {
        // ignore fetch errors
      }
    } else if (script.textContent) {
      sources.push(script.textContent);
    }
  }
  
  return sources.join('\n\n');
}
