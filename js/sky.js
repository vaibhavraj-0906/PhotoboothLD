// Purely decorative: scatters a randomized starfield into the fixed background layer.
(function () {
  const container = document.getElementById('stars');
  if (!container) return;

  const STAR_COUNT = 140;
  const frag = document.createDocumentFragment();

  for (let i = 0; i < STAR_COUNT; i++) {
    const star = document.createElement('span');
    star.className = 'star';
    const size = Math.random() < 0.15 ? (Math.random() * 1.4 + 1.6) : (Math.random() * 1 + 0.6);
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.width = size + 'px';
    star.style.height = size + 'px';
    star.style.animationDuration = (Math.random() * 4 + 3) + 's';
    star.style.animationDelay = (Math.random() * 6) + 's';
    star.style.opacity = (Math.random() * 0.4 + 0.3).toFixed(2);
    frag.appendChild(star);
  }

  container.appendChild(frag);
})();
