// Screen controller / state machine — wires camera, segmentation, peer, and strip together.
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
    stopPreviewLoop();
    el('error-title').textContent = title;
    el('error-detail').textContent = detail || '';
    showScreen('error');
  }

  // ---- Shared scene settings (kept in sync across both peers) ----
  let backdropId = Looks.BACKDROPS[0].id;
  let filterId = 'none';
  let backdropImg = null;

  // ---- Camera + segmentation ----
  const liveVideo = el('live-video');
  const previewVideoCreate = el('preview-video-create');
  const stageCanvas = el('stage-canvas');
  const stageCtx = stageCanvas.getContext('2d');
  stageCanvas.width = Compositor.FRAME_W;
  stageCanvas.height = Compositor.FRAME_H;

  let cameraStream = null;
  let segmentReady = false;

  async function ensureCamera() {
    if (cameraStream) return cameraStream;
    cameraStream = await Camera.init(liveVideo);
    return cameraStream;
  }

  async function ensureSegmenter() {
    if (segmentReady) return;
    await Segmenter.init();
    segmentReady = true;
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

  // ---- Scene pickers ----
  function buildPickers() {
    const bd = el('backdrop-picker');
    bd.innerHTML = '';
    Looks.BACKDROPS.forEach((b) => {
      const btn = document.createElement('button');
      btn.className = 'swatch' + (b.id === backdropId ? ' selected' : '');
      btn.style.backgroundImage = 'url("' + b.src + '")';
      btn.title = b.name;
      btn.setAttribute('aria-label', b.name);
      btn.addEventListener('click', () => {
        backdropId = b.id;
        broadcastSettings();
        refreshPickers();
        loadBackdropImage();
      });
      bd.appendChild(btn);
    });

    ['filter-picker', 'review-filter-picker'].forEach((containerId) => {
      const fp = el(containerId);
      fp.innerHTML = '';
      Looks.FILTERS.forEach((f) => {
        const chip = document.createElement('button');
        chip.className = 'chip' + (f.id === filterId ? ' selected' : '');
        chip.textContent = f.name;
        chip.addEventListener('click', () => {
          filterId = f.id;
          broadcastSettings();
          refreshPickers();
          if (screens['strip-review'].classList.contains('active')) finishStrip();
        });
        fp.appendChild(chip);
      });
    });
  }

  function refreshPickers() {
    Array.from(el('backdrop-picker').children).forEach((c, i) => {
      c.classList.toggle('selected', Looks.BACKDROPS[i].id === backdropId);
    });
    ['filter-picker', 'review-filter-picker'].forEach((containerId) => {
      Array.from(el(containerId).children).forEach((c, i) => {
        c.classList.toggle('selected', Looks.FILTERS[i].id === filterId);
      });
    });
  }

  function broadcastSettings() {
    PeerLink.send({ type: MSG.SETTINGS, backdropId, filterId });
  }

  function loadBackdropImage() {
    return Looks.loadBackdrop(backdropId).then((img) => {
      backdropImg = img;
      return img;
    });
  }

  // ---- Peer events ----
  PeerLink.on('room-ready', ({ code }) => {
    currentRoomCode = code;
    el('room-code-display').textContent = code;
  });

  PeerLink.on('connected', async () => {
    PeerLink.send({ type: MSG.HELLO, role: Session.getRole() });
    buildPickers();
    showScreen('connected-ready');

    const status = el('setup-status');
    try {
      await ensureCamera();
      await loadBackdropImage();
      status.textContent = 'Loading the cut-out engine…';
      await ensureSegmenter();
      Looks.preloadAll();
      status.textContent = 'Ready when you are.';
      el('btn-start-session').disabled = false;
      // Role A is the one whose picks win on first sync.
      if (Session.getRole() === 'A') broadcastSettings();
    } catch (e) {
      showError('Setup failed', e.message || 'Could not start the camera or the cut-out engine.');
    }
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
    if (screens['strip-review'].classList.contains('active')) return;
    showError('Your partner disconnected', 'Ask them to reconnect with a fresh room code to try again.');
  });

  PeerLink.on('message', (msg) => {
    switch (msg.type) {
      case MSG.SETTINGS:
        backdropId = msg.backdropId;
        filterId = msg.filterId;
        refreshPickers();
        loadBackdropImage();
        if (screens['strip-review'].classList.contains('active')) finishStrip();
        break;
      case MSG.START_SESSION:
        beginSession();
        break;
      case MSG.BASE_CUTOUT:
        handleBaseCutout(msg);
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

  // ---- Live composited preview ----
  const roundIndicator = el('round-indicator');
  const roleBadge = el('role-badge');
  const statusText = el('round-status-text');
  const captureBtn = el('btn-capture');
  const thumbnailStrip = el('thumbnail-strip');

  let previewRaf = null;
  let partnerCutout = null; // decoded <img> of the base partner's cut-out this round
  let baseCaptured = false;
  let cutoutReceivedFor = -1;

  function startPreviewLoop() {
    if (previewRaf) return;
    const tick = async () => {
      previewRaf = requestAnimationFrame(tick);
      if (!liveVideo.videoWidth) return;
      await Segmenter.update(liveVideo);
      const mine = Segmenter.cutout({
        width: Compositor.FRAME_W,
        height: Compositor.FRAME_H,
        mirror: true,
      });
      if (!mine) return;
      const role = Session.getRole();
      Compositor.compose(stageCtx, {
        backdrop: backdropImg,
        cutoutA: role === 'A' ? mine : partnerCutout,
        cutoutB: role === 'B' ? mine : partnerCutout,
        filterId,
      });
    };
    previewRaf = requestAnimationFrame(tick);
  }

  function stopPreviewLoop() {
    if (previewRaf) cancelAnimationFrame(previewRaf);
    previewRaf = null;
  }

  function renderRound() {
    liveVideo.srcObject = cameraStream;
    liveVideo.play();

    const idx = Session.getRoundIndex();
    roundIndicator.textContent = 'Photo ' + (idx + 1) + ' of ' + Session.ROUND_COUNT;

    partnerCutout = null;
    baseCaptured = false;
    cutoutReceivedFor = -1;
    renderThumbnails();

    if (Session.isBaseThisRound()) {
      roleBadge.textContent = 'Pose first';
      statusText.textContent = 'Strike a pose — your partner will match it.';
      captureBtn.disabled = false;
    } else {
      roleBadge.textContent = 'Match your partner';
      statusText.textContent = "Waiting for your partner's pose…";
      captureBtn.disabled = true;
    }

    showScreen('round-capture');
    startPreviewLoop();
  }

  function renderThumbnails() {
    thumbnailStrip.innerHTML = '';
    Session.getPhotos().forEach((p) => {
      if (!p) return;
      const img = document.createElement('img');
      img.src = p;
      img.style.filter = Looks.cssFor(filterId);
      thumbnailStrip.appendChild(img);
    });
  }

  function handleBaseCutout(msg) {
    if (msg.roundIndex !== Session.getRoundIndex()) return;
    if (!Session.isOverlayThisRound()) return;
    const img = new Image();
    img.onload = () => {
      partnerCutout = img;
      cutoutReceivedFor = msg.roundIndex;
      statusText.textContent = 'They\'re in frame — pose alongside them, then capture!';
      captureBtn.disabled = false;
    };
    img.src = msg.imageData;
  }

  function handleCompositeResult(msg) {
    if (msg.roundIndex !== Session.getRoundIndex()) return;
    if (!Session.isBaseThisRound()) return;
    Session.storePhoto(msg.roundIndex, msg.imageData);
    goToTransition(msg.roundIndex, msg.imageData);
  }

  captureBtn.addEventListener('click', async () => {
    const idx = Session.getRoundIndex();
    await Segmenter.update(liveVideo);
    const mine = Segmenter.cutout({
      width: Compositor.FRAME_W,
      height: Compositor.FRAME_H,
      mirror: true,
    });
    if (!mine) {
      statusText.textContent = 'Still finding you — hold still a moment and try again.';
      return;
    }

    if (Session.isBaseThisRound()) {
      if (baseCaptured) return;
      baseCaptured = true;
      captureBtn.disabled = true;
      // Send only the cut-out: the partner never receives our actual room.
      PeerLink.send({
        type: MSG.BASE_CUTOUT,
        roundIndex: idx,
        imageData: mine.toDataURL('image/png'),
      });
      statusText.textContent = 'Sent! Waiting for your partner to join the frame…';
    } else {
      if (cutoutReceivedFor !== idx) return;
      captureBtn.disabled = true;
      const role = Session.getRole();
      // Bake unfiltered so the filter stays changeable on the review screen.
      const composed = Compositor.composeToCanvas({
        backdrop: backdropImg,
        cutoutA: role === 'A' ? mine : partnerCutout,
        cutoutB: role === 'B' ? mine : partnerCutout,
        filterId: null,
      });
      const dataUrl = composed.toDataURL('image/jpeg', 0.9);
      Session.storePhoto(idx, dataUrl);
      PeerLink.send({ type: MSG.COMPOSITE_RESULT, roundIndex: idx, imageData: dataUrl });
      goToTransition(idx, dataUrl);
    }
  });

  function goToTransition(idx, imageData) {
    stopPreviewLoop();
    const thumb = el('transition-thumb');
    thumb.src = imageData;
    thumb.style.filter = Looks.cssFor(filterId);
    el('transition-text').textContent = Session.isLastRound()
      ? 'Last one! Building your strip…'
      : 'Nice! Get ready for the next photo…';
    showScreen('round-transition');

    setTimeout(() => {
      if (Session.isLastRound()) {
        finishStrip();
      } else {
        Session.nextRound();
        renderRound();
      }
    }, 1600);
  }

  // ---- Strip review ----
  async function finishStrip() {
    const canvas = await Strip.buildStrip(Session.getPhotos(), filterId);
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
    stopPreviewLoop();
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
