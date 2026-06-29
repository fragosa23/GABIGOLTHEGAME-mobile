let requested = false;

export async function requestMobileAppMode() {
  if (requested) return;
  requested = true;

  const root = document.documentElement;
  try {
    if (!document.fullscreenElement && root.requestFullscreen) {
      await root.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch (_) {
    // Some mobile browsers only allow fullscreen from specific gestures.
  }

  try {
    await screen.orientation?.lock?.('landscape');
  } catch (_) {
    // iOS Safari and some Android browsers do not expose orientation lock.
  }
}
