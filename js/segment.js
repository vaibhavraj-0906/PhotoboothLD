// Cuts a person out of their webcam frame using MediaPipe Selfie Segmentation.
// Everything runs locally in the browser — the raw background never leaves the device.
window.Segmenter = (function () {
  const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/';

  let solution = null;
  let lastResults = null;
  let ready = false;
  let busy = false;

  // Scratch canvases reused every frame so we are not allocating in the render loop.
  const maskCanvas = document.createElement('canvas');
  const maskCtx = maskCanvas.getContext('2d');
  const outCanvas = document.createElement('canvas');
  const outCtx = outCanvas.getContext('2d');

  function init() {
    if (solution) return Promise.resolve();
    if (typeof SelfieSegmentation === 'undefined') {
      return Promise.reject(new Error('Segmentation library failed to load'));
    }
    solution = new SelfieSegmentation({ locateFile: (file) => CDN + file });
    solution.setOptions({ modelSelection: 1, selfieMode: false });
    solution.onResults((results) => {
      lastResults = results;
      ready = true;
    });
    return Promise.resolve();
  }

  // Runs the model on the current video frame. Safe to call every animation frame —
  // overlapping calls are dropped rather than queued.
  async function update(videoEl) {
    if (!solution || busy) return ready;
    if (!videoEl.videoWidth) return ready;
    busy = true;
    try {
      await solution.send({ image: videoEl });
    } catch (e) {
      // A dropped frame is not worth interrupting the session for.
    } finally {
      busy = false;
    }
    return ready;
  }

  // Alpha response curve. CSS filters cannot reshape the alpha channel, so the
  // mask is remapped by hand: anything confidently "person" becomes fully solid,
  // anything confidently background disappears, and only a narrow band between
  // them stays soft to keep the outline from looking cut with scissors.
  const LOW = 0.34;
  const HIGH = 0.58;
  const ALPHA_LUT = (function () {
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      const v = i / 255;
      if (v <= LOW) lut[i] = 0;
      else if (v >= HIGH) lut[i] = 255;
      else {
        const t = (v - LOW) / (HIGH - LOW);
        lut[i] = Math.round(255 * t * t * (3 - 2 * t)); // smoothstep
      }
    }
    return lut;
  })();

  // Returns a canvas holding just the person on a transparent background.
  // `mirror` flips horizontally to match the selfie-style preview.
  function cutout({ width, height, mirror = true, feather = 1.5 }) {
    if (!lastResults || !lastResults.segmentationMask) return null;

    maskCanvas.width = width;
    maskCanvas.height = height;
    outCanvas.width = width;
    outCanvas.height = height;

    maskCtx.clearRect(0, 0, width, height);
    maskCtx.save();
    if (mirror) {
      maskCtx.translate(width, 0);
      maskCtx.scale(-1, 1);
    }
    maskCtx.filter = 'blur(' + feather + 'px)';
    maskCtx.drawImage(lastResults.segmentationMask, 0, 0, width, height);
    maskCtx.restore();
    maskCtx.filter = 'none';

    const maskData = maskCtx.getImageData(0, 0, width, height);
    const px = maskData.data;
    for (let i = 0; i < px.length; i += 4) {
      px[i + 3] = ALPHA_LUT[px[i + 3]];
    }
    maskCtx.putImageData(maskData, 0, 0);

    outCtx.clearRect(0, 0, width, height);
    outCtx.drawImage(maskCanvas, 0, 0);
    outCtx.globalCompositeOperation = 'source-in';
    outCtx.save();
    if (mirror) {
      outCtx.translate(width, 0);
      outCtx.scale(-1, 1);
    }
    outCtx.drawImage(lastResults.image, 0, 0, width, height);
    outCtx.restore();
    outCtx.globalCompositeOperation = 'source-over';

    // Copy out, since the scratch canvas is overwritten on the next frame.
    const copy = document.createElement('canvas');
    copy.width = width;
    copy.height = height;
    copy.getContext('2d').drawImage(outCanvas, 0, 0);
    return copy;
  }

  function isReady() {
    return ready;
  }

  return { init, update, cutout, isReady };
})();
