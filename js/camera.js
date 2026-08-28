// Camera access, still-frame capture, ghost overlay, and final composite baking.
window.Camera = (function () {
  let stream = null;

  async function init(videoEl) {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false,
    });
    videoEl.srcObject = stream;
    await videoEl.play();
    return stream;
  }

  function stop() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  // Draws the current video frame to a canvas, mirrored to match the on-screen preview.
  function captureFrame(videoEl, { mirror = true } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    if (mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function captureDataUrl(videoEl, quality = 0.8) {
    return captureFrame(videoEl, { mirror: true }).toDataURL('image/jpeg', quality);
  }

  // Bakes the overlay partner's live frame + the base partner's ghost still into one composite.
  function composite(videoEl, ghostImgEl, opacity, quality = 0.85) {
    const canvas = captureFrame(videoEl, { mirror: true });
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(ghostImgEl, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    return canvas.toDataURL('image/jpeg', quality);
  }

  return { init, stop, captureFrame, captureDataUrl, composite };
})();
