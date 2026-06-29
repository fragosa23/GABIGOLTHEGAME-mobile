let fullscreenOk = false;
let orientationOk = false;

export async function requestMobileAppMode() {
  const root = document.documentElement;
  document.body.style.minHeight = '100dvh';
  window.scrollTo(0, 1);

  if (!fullscreenOk && !document.fullscreenElement) {
    try {
      const request = root.requestFullscreen || root.webkitRequestFullscreen || document.body.requestFullscreen;
      if (request) {
        await request.call(root, { navigationUI: 'hide' });
        fullscreenOk = true;
      }
    } catch (_) {
      // Browsers may require a stricter user gesture or may not support fullscreen on mobile.
    }
  }

  if (!orientationOk) {
    try {
      await screen.orientation?.lock?.('landscape');
      orientationOk = true;
    } catch (_) {
      // iOS Safari and some Android browsers do not expose orientation lock.
    }
  }

  setTimeout(() => window.scrollTo(0, 1), 120);
}
