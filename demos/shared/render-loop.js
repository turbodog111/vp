(() => {
  'use strict';
  // Media events invalidate one still frame. Only visible playback owns a loop.
  function create(audio, draw) {
    let pending = 0;
    let disposed = false;
    function invalidate() {
      if (!disposed && !document.hidden && !pending) pending = requestAnimationFrame(frame);
    }
    function frame(now) {
      pending = 0;
      if (disposed || document.hidden) return;
      draw(now);
      if (!audio.paused && !audio.ended) invalidate();
    }
    function visibilityChanged() {
      if (pending) cancelAnimationFrame(pending);
      pending = 0;
      invalidate();
    }
    const events = ['play', 'pause', 'ended', 'seeked', 'loadedmetadata', 'emptied'];
    events.forEach(event => audio.addEventListener(event, invalidate));
    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('resize', invalidate);
    invalidate();
    return {
      invalidate,
      dispose() {
        disposed = true;
        if (pending) cancelAnimationFrame(pending);
        pending = 0;
        events.forEach(event => audio.removeEventListener(event, invalidate));
        document.removeEventListener('visibilitychange', visibilityChanged);
        window.removeEventListener('resize', invalidate);
      }
    };
  }
  window.VPFrameLoop = { create };
})();
