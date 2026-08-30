// Camera access and raw frame capture. Compositing lives in compositor.js.
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

  function getStream() {
    return stream;
  }

  function stop() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  return { init, getStream, stop };
})();
