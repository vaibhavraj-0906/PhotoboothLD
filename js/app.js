// Screen controller / state machine — wires camera, peer, session, and strip modules together.
(function () {
  const el = (id) => document.getElementById(id);

  const screens = {
    landing: el('screen-landing'),
    'waiting-create': el('screen-waiting-create'),
    'waiting-join': el('screen-waiting-join'),
    'connected-ready': el('screen-connected-ready'),
    'round-capture': el('screen-round-capture'),
    'round-transition': el('screen-round-transition'),
    'strip-review': el('screen-strip-review'),
    error: el('screen-error'),
  };

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  function showError(title, detail) {
    el('error-title').textContent = title;
    el('error-detail').textContent = detail || '';
    showScreen('error');
  }

  // ---- Camera pre-flight ----
  const liveVideo = el('live-video');
  const previewVideoCreate = el('preview-video-create');
  let cameraStream = null;

  async function ensureCamera() {
    if (cameraStream) return cameraStream;
    cameraStream = await Camera.init(liveVideo);
    return cameraStream;
  }

  // ---- Landing ----
  el('btn-create').addEventListener('click', async () => {
    el('landing-error').hidden = true;
    try {
      await ensureCamera();
    } catch (e) {
      el('landing-error').textContent = 'Camera access is required to play. Please allow camera access and reload.';
      el('landing-error').hidden = false;
      return;
    }
    previewVideoCreate.srcObject = cameraStream;
    previewVideoCreate.play();
    Session.setRole('A');
    PeerLink.createRoom();
    showScreen('waiting-create');
  });

  el('form-join').addEventListener('submit', async (e) => {
    e.preventDefault();
    el('landing-error').hidden = true;
    const code = el('input-code').value.trim().toUpperCase();
    if (!code) return;
    try {
      await ensureCamera();
    } catch (err) {
      el('landing-error').textContent = 'Camera access is required to play. Please allow camera access and reload.';
      el('landing-error').hidden = false;
      return;
    }
    Session.setRole('B');
    PeerLink.joinRoom(code);
    showScreen('waiting-join');
  });

  // Prefill room code from a shared link.
  const urlCode = new URLSearchParams(location.search).get('room');
  if (urlCode) el('input-code').value = urlCode.toUpperCase();

  // ---- Waiting: create ----
  let currentRoomCode = '';
  el('btn-copy-link').addEventListener('click', () => {
    const link = location.origin + location.pathname + '?room=' + currentRoomCode;
    navigator.clipboard.writeText(link).then(() => {
      const btn = el('btn-copy-link');
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => (btn.textContent = original), 1500);
    });
  });

  // ---- Peer events ----
  PeerLink.on('room-ready', ({ code }) => {
    currentRoomCode = code;
    el('room-code-display').textContent = code;
  });

  PeerLink.on('connected', () => {
    PeerLink.send({ type: MSG.HELLO, role: Session.getRole() });
    showScreen('connected-ready');
  });

  PeerLink.on('connection-error', (err) => {
    const type = err && err.type;
    if (type === 'peer-unavailable') {
      showError('Room not found', 'Double-check the code with your partner and try again.');
    } else {
      showError('Connection problem', 'Something went wrong connecting to your partner (' + (type || 'unknown error') + '). This can happen on restrictive networks — try a different one (e.g. mobile hotspot).');
    }
  });

  PeerLink.on('partner-left', () => {
    if (screens['strip-review'].classList.contains('active')) return; // session already finished, no need to alarm
    showError('Your partner disconnected', 'Ask them to reconnect with a fresh room code to try again.');
  });

  PeerLink.on('message', (msg) => {
    switch (msg.type) {
      case MSG.START_SESSION:
        beginSession();
        break;
      case MSG.BASE_PHOTO:
        handleBasePhoto(msg);
        break;
      case MSG.COMPOSITE_RESULT:
        handleCompositeResult(msg);
        break;
      default:
        break;
    }
  });

  el('btn-error-home').addEventListener('click', () => {
    PeerLink.teardown();
    Session.reset();
    showScreen('landing');
  });

  // ---- Session start ----
  let sessionStarted = false;
  el('btn-start-session').addEventListener('click', () => {
    PeerLink.send({ type: MSG.START_SESSION, roundCount: Session.ROUND_COUNT });
    beginSession();
  });

  function beginSession() {
    if (sessionStarted) return;
    sessionStarted = true;
    renderRound();
  }

  // ---- Round capture ----
  const roundIndicator = el('round-indicator');
  const roleBadge = el('role-badge');
  const ghostOverlay = el('ghost-overlay');
  const overlayControls = el('overlay-controls');
  const opacitySlider = el('opacity-slider');
  const statusText = el('round-status-text');
  const captureBtn = el('btn-capture');
  const thumbnailStrip = el('thumbnail-strip');

  let baseCaptured = false; // has the base partner captured+sent this round?
  let ghostReceivedFor = -1; // roundIndex the ghost currently shown belongs to

  function renderRound() {
    liveVideo.srcObject = cameraStream;
    liveVideo.play();

    const idx = Session.getRoundIndex();
    roundIndicator.textContent = 'Photo ' + (idx + 1) + ' of ' + Session.ROUND_COUNT;

    ghostOverlay.hidden = true;
    ghostOverlay.src = '';
    overlayControls.hidden = true;
    baseCaptured = false;
    ghostReceivedFor = -1;

    renderThumbnails();

    if (Session.isBaseThisRound()) {
      roleBadge.textContent = 'Pose first';
      statusText.textContent = 'Strike a pose, then hit capture!';
      captureBtn.disabled = false;
    } else {
      roleBadge.textContent = 'Match your partner';
      statusText.textContent = "Waiting for your partner's pose…";
      captureBtn.disabled = true;
    }

    showScreen('round-capture');
  }

  function renderThumbnails() {
    thumbnailStrip.innerHTML = '';
    Session.getPhotos().forEach((p) => {
      if (!p) return;
      const img = document.createElement('img');
      img.src = p;
      thumbnailStrip.appendChild(img);
    });
  }

  function handleBasePhoto(msg) {
    if (msg.roundIndex !== Session.getRoundIndex()) return;
    if (Session.isOverlayThisRound()) {
      ghostOverlay.src = msg.imageData;
      ghostOverlay.hidden = false;
      overlayControls.hidden = false;
      ghostReceivedFor = msg.roundIndex;
      statusText.textContent = 'Align yourself, then hit capture!';
      captureBtn.disabled = false;
    }
  }

  function handleCompositeResult(msg) {
    if (msg.roundIndex !== Session.getRoundIndex()) return;
    if (Session.isBaseThisRound()) {
      Session.storePhoto(msg.roundIndex, msg.imageData);
      goToTransition(msg.roundIndex, msg.imageData);
    }
  }

  captureBtn.addEventListener('click', () => {
    const idx = Session.getRoundIndex();
    if (Session.isBaseThisRound()) {
      if (baseCaptured) return;
      baseCaptured = true;
      const dataUrl = Camera.captureDataUrl(liveVideo);
      PeerLink.send({ type: MSG.BASE_PHOTO, roundIndex: idx, imageData: dataUrl });
      captureBtn.disabled = true;
      statusText.textContent = "Sent! Waiting for your partner to match your pose…";
    } else {
      if (ghostReceivedFor !== idx) return;
      const composite = Camera.composite(liveVideo, ghostOverlay, parseFloat(opacitySlider.value));
      Session.storePhoto(idx, composite);
      captureBtn.disabled = true;
      PeerLink.send({ type: MSG.COMPOSITE_RESULT, roundIndex: idx, imageData: composite });
      goToTransition(idx, composite);
    }
  });

  function goToTransition(idx, imageData) {
    el('transition-thumb').src = imageData;
    el('transition-text').textContent = Session.isLastRound() ? 'Last one! Building your strip…' : 'Nice! Get ready for the next photo…';
    showScreen('round-transition');

    setTimeout(() => {
      if (Session.isLastRound()) {
        finishStrip();
      } else {
        Session.nextRound();
        renderRound();
      }
    }, 1500);
  }

  // ---- Strip review ----
  async function finishStrip() {
    const canvas = await Strip.buildStrip(Session.getPhotos());
    const displayCanvas = el('strip-canvas');
    displayCanvas.width = canvas.width;
    displayCanvas.height = canvas.height;
    displayCanvas.getContext('2d').drawImage(canvas, 0, 0);
    displayCanvas._sourceCanvas = canvas;
    showScreen('strip-review');
  }

  el('btn-download').addEventListener('click', () => {
    const canvas = el('strip-canvas')._sourceCanvas;
    if (canvas) Strip.download(canvas);
  });

  el('btn-start-over').addEventListener('click', () => {
    PeerLink.teardown();
    Session.reset();
    sessionStarted = false;
    showScreen('landing');
  });

  // ---- Boot: feature detection ----
  window.addEventListener('beforeunload', () => PeerLink.notifyLeaving());

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.RTCPeerConnection) {
    showError('Unsupported browser', 'Please use an up-to-date Chrome, Firefox, Edge, or Safari to use this app.');
  } else {
    showScreen('landing');
  }
})();
