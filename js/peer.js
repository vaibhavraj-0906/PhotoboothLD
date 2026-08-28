// PeerJS wiring: room create/join, connection lifecycle, message send/receive.
window.PeerLink = (function () {
  const ID_PREFIX = 'photobooth-';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
  const HEARTBEAT_INTERVAL_MS = 5000;
  const HEARTBEAT_TIMEOUT_MS = 15000;
  const MAX_ID_RETRIES = 4;

  let peer = null;
  let conn = null;
  let heartbeatTimer = null;
  let heartbeatWatchdog = null;
  const listeners = {};

  function on(event, handler) {
    (listeners[event] = listeners[event] || []).push(handler);
  }

  function emit(event, payload) {
    (listeners[event] || []).forEach((h) => h(payload));
  }

  function generateCode(len = 5) {
    let code = '';
    for (let i = 0; i < len; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return code;
  }

  function wireConnection(connection) {
    conn = connection;
    conn.on('open', () => {
      startHeartbeat();
      emit('connected');
    });
    conn.on('data', (raw) => {
      const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (msg.type === window.MSG.PING) {
        send({ type: window.MSG.PONG });
        return;
      }
      if (msg.type === window.MSG.PONG) {
        resetWatchdog();
        return;
      }
      emit('message', msg);
    });
    conn.on('close', () => {
      stopHeartbeat();
      emit('partner-left');
    });
    conn.on('error', (err) => {
      emit('connection-error', err);
    });
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      send({ type: window.MSG.PING });
    }, HEARTBEAT_INTERVAL_MS);
    resetWatchdog();
  }

  function resetWatchdog() {
    clearTimeout(heartbeatWatchdog);
    heartbeatWatchdog = setTimeout(() => {
      emit('partner-left');
    }, HEARTBEAT_TIMEOUT_MS);
  }

  function stopHeartbeat() {
    clearInterval(heartbeatTimer);
    clearTimeout(heartbeatWatchdog);
  }

  function createRoom(attempt = 0) {
    const code = generateCode();
    peer = new Peer(ID_PREFIX + code);

    peer.on('open', () => {
      emit('room-ready', { code });
    });

    peer.on('connection', (incoming) => {
      wireConnection(incoming);
    });

    peer.on('error', (err) => {
      if (err.type === 'unavailable-id' && attempt < MAX_ID_RETRIES) {
        peer.destroy();
        createRoom(attempt + 1);
        return;
      }
      emit('connection-error', err);
    });
  }

  function joinRoom(code) {
    peer = new Peer();
    peer.on('open', () => {
      const connection = peer.connect(ID_PREFIX + code, { reliable: true });
      wireConnection(connection);
    });
    peer.on('error', (err) => {
      emit('connection-error', err);
    });
  }

  function send(msg) {
    if (conn && conn.open) {
      conn.send(msg);
    }
  }

  function notifyLeaving() {
    send({ type: window.MSG.PARTNER_LEFT, reason: 'left' });
  }

  function teardown() {
    stopHeartbeat();
    if (conn) conn.close();
    if (peer) peer.destroy();
    conn = null;
    peer = null;
  }

  return { on, createRoom, joinRoom, send, notifyLeaving, teardown };
})();
