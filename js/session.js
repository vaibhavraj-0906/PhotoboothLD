// Pure round/role/photo state for the current session. No DOM access here.
window.Session = (function () {
  const ROUND_COUNT = 4;
  let role = null; // 'A' | 'B'
  let roundIndex = 0;
  let photos = new Array(ROUND_COUNT).fill(null);

  function setRole(r) {
    role = r;
  }

  function getRole() {
    return role;
  }

  // Round 0 & 2 -> A poses first; round 1 & 3 -> B poses first.
  function getRoundRoles(idx) {
    const base = idx % 2 === 0 ? 'A' : 'B';
    const overlay = base === 'A' ? 'B' : 'A';
    return { base, overlay };
  }

  function isBaseThisRound() {
    return getRoundRoles(roundIndex).base === role;
  }

  function isOverlayThisRound() {
    return getRoundRoles(roundIndex).overlay === role;
  }

  function storePhoto(idx, dataUrl) {
    photos[idx] = dataUrl;
  }

  function getPhotos() {
    return photos;
  }

  function allPhotosCollected() {
    return photos.every((p) => p !== null);
  }

  function nextRound() {
    roundIndex += 1;
    return roundIndex;
  }

  function getRoundIndex() {
    return roundIndex;
  }

  function isLastRound() {
    return roundIndex === ROUND_COUNT - 1;
  }

  function reset() {
    role = null;
    roundIndex = 0;
    photos = new Array(ROUND_COUNT).fill(null);
  }

  return {
    ROUND_COUNT,
    setRole,
    getRole,
    getRoundRoles,
    isBaseThisRound,
    isOverlayThisRound,
    storePhoto,
    getPhotos,
    allPhotosCollected,
    nextRound,
    getRoundIndex,
    isLastRound,
    reset,
  };
})();
