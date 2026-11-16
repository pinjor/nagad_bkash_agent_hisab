export async function registerOffline() {
  if (!('serviceWorker' in navigator)) return;
  const host = window.location.hostname.toLowerCase();
  const preview = ((host.endsWith('.lovable.app') || host.endsWith('.gpt-eng.com') || host.endsWith('.gptengineer.run')) && (/^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(host.split('.')[0]) || /^project--.+-dev$/.test(host.split('.')[0]))) || ['lovableproject.com', 'lovableproject-dev.com', 'beta.lovable.dev'].some(domain => host === domain || host.endsWith('.' + domain));
  if (!import.meta.env.PROD || window.self !== window.top || preview || new URLSearchParams(window.location.search).get('sw') === 'off') {
    for (const registration of await navigator.serviceWorker.getRegistrations()) {
      const worker = registration.active ?? registration.waiting ?? registration.installing;
      if (worker && new URL(worker.scriptURL).pathname === '/sw.js') await registration.unregister();
    }
    return;
  }
  const { registerSW } = await import('virtual:pwa-register');
  registerSW({ onNeedRefresh() { window.dispatchEvent(new Event('hisab:update')); }, onRegisterError() { window.dispatchEvent(new Event('hisab:offline-error')); } });
}
