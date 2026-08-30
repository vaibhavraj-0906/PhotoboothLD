// Backdrop catalog and colour-grade "looks" applied to the finished frame.
window.Looks = (function () {
  const BACKDROPS = [
    { id: 'red-curtain', name: 'Red Curtain', src: 'backdrops/red-curtain.jpg' },
    { id: 'taupe-curtain', name: 'Taupe Curtain', src: 'backdrops/taupe-curtain.jpg' },
    { id: 'ivory-curtain', name: 'Ivory Curtain', src: 'backdrops/ivory-curtain.jpg' },
    { id: 'parchment', name: 'Parchment', src: 'backdrops/parchment.jpg' },
    { id: 'blue-check', name: 'Blue Check', src: 'backdrops/blue-check.jpg' },
    { id: 'red-check', name: 'Red Check', src: 'backdrops/red-check.jpg' },
    { id: 'hibiscus', name: 'Hibiscus', src: 'backdrops/hibiscus.jpg' },
    { id: 'blossom', name: 'Blossom', src: 'backdrops/blossom.jpg' },
  ];

  // Each look = a CSS filter chain plus optional wash layers drawn over the frame.
  // `lift` raises the blacks the way film stock does; `grain` adds fine noise.
  const FILTERS = [
    { id: 'none', name: 'None', css: 'none', layers: [] },
    {
      id: 'oslo', name: 'Oslo',
      css: 'saturate(0.82) contrast(1.12) brightness(1.04)',
      layers: [{ color: 'rgb(88,140,182)', alpha: 0.12, blend: 'soft-light' }],
    },
    {
      id: 'tokyo', name: 'Tokyo',
      css: 'saturate(1.28) contrast(1.16) brightness(0.99)',
      layers: [
        { color: 'rgb(255,60,140)', alpha: 0.10, blend: 'soft-light' },
        { color: 'rgb(40,200,255)', alpha: 0.10, blend: 'soft-light' },
      ],
    },
    {
      id: 'newyork', name: 'New York',
      css: 'saturate(0.74) contrast(1.28) brightness(0.97)',
      layers: [{ color: 'rgb(42,56,82)', alpha: 0.14, blend: 'soft-light' }],
      lift: 14,
    },
    {
      id: 'london', name: 'London',
      css: 'saturate(0.7) contrast(0.96) brightness(1.03)',
      layers: [{ color: 'rgb(122,132,124)', alpha: 0.14, blend: 'soft-light' }],
      lift: 20,
    },
    {
      id: 'paris', name: 'Paris',
      css: 'saturate(0.96) contrast(0.94) brightness(1.06)',
      layers: [{ color: 'rgb(255,188,198)', alpha: 0.16, blend: 'soft-light' }],
      lift: 18,
    },
    {
      id: 'venice', name: 'Venice',
      css: 'saturate(1.2) contrast(1.06) brightness(1.05)',
      layers: [{ color: 'rgb(255,178,88)', alpha: 0.18, blend: 'soft-light' }],
    },
    {
      id: 'cairo', name: 'Cairo',
      css: 'saturate(1.14) contrast(1.18) brightness(1.02) sepia(0.14)',
      layers: [{ color: 'rgb(232,150,58)', alpha: 0.18, blend: 'soft-light' }],
    },
    {
      id: 'rio', name: 'Rio',
      css: 'saturate(1.45) contrast(1.1) brightness(1.05)',
      layers: [{ color: 'rgb(255,138,58)', alpha: 0.10, blend: 'soft-light' }],
    },
    {
      id: 'jakarta', name: 'Jakarta',
      css: 'saturate(1.12) contrast(1.05) hue-rotate(-8deg)',
      layers: [{ color: 'rgb(58,182,140)', alpha: 0.14, blend: 'soft-light' }],
      lift: 12,
    },
    {
      id: 'melbourne', name: 'Melbourne',
      css: 'saturate(1.06) contrast(1.08) brightness(1.07)',
      layers: [{ color: 'rgb(198,228,255)', alpha: 0.10, blend: 'soft-light' }],
    },
    {
      id: 'berlin', name: 'Berlin',
      css: 'saturate(0.55) contrast(1.3) brightness(0.98)',
      layers: [{ color: 'rgb(70,82,96)', alpha: 0.14, blend: 'soft-light' }],
    },
    {
      id: 'dubai', name: 'Dubai',
      css: 'saturate(1.2) contrast(1.12) brightness(1.08)',
      layers: [{ color: 'rgb(255,200,110)', alpha: 0.18, blend: 'soft-light' }],
    },
    {
      id: 'kyoto', name: 'Kyoto',
      css: 'saturate(0.9) contrast(0.95) brightness(1.04)',
      layers: [{ color: 'rgb(230,170,190)', alpha: 0.13, blend: 'soft-light' }],
      lift: 16,
    },
    {
      id: 'vintage', name: 'Vintage B&W',
      css: 'grayscale(1) contrast(1.14) brightness(1.06) sepia(0.38)',
      layers: [{ color: 'rgb(255,232,196)', alpha: 0.12, blend: 'soft-light' }],
      lift: 22,
      grain: 0.09,
    },
  ];

  const backdropCache = {};
  let grainTile = null;

  function getFilter(id) {
    return FILTERS.find((f) => f.id === id) || FILTERS[0];
  }

  function getBackdrop(id) {
    return BACKDROPS.find((b) => b.id === id) || BACKDROPS[0];
  }

  function loadBackdrop(id) {
    const entry = getBackdrop(id);
    if (backdropCache[entry.id]) return Promise.resolve(backdropCache[entry.id]);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        backdropCache[entry.id] = img;
        resolve(img);
      };
      img.onerror = () => reject(new Error('Could not load backdrop ' + entry.id));
      img.src = entry.src;
    });
  }

  function preloadAll() {
    return Promise.all(BACKDROPS.map((b) => loadBackdrop(b.id).catch(() => null)));
  }

  function buildGrain() {
    const size = 128;
    const tile = document.createElement('canvas');
    tile.width = size;
    tile.height = size;
    const tctx = tile.getContext('2d');
    const data = tctx.createImageData(size, size);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = 110 + Math.random() * 90;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
      data.data[i + 3] = 255;
    }
    tctx.putImageData(data, 0, 0);
    return tile;
  }

  // Applies a look in place on a 2D context covering the whole frame.
  function applyFilter(ctx, width, height, filterId) {
    const look = getFilter(filterId);
    if (look.id === 'none') return;

    // Re-draw the frame through the CSS filter chain.
    if (look.css && look.css !== 'none') {
      const snapshot = document.createElement('canvas');
      snapshot.width = width;
      snapshot.height = height;
      snapshot.getContext('2d').drawImage(ctx.canvas, 0, 0);
      ctx.save();
      ctx.filter = look.css;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(snapshot, 0, 0);
      ctx.restore();
    }

    if (look.lift) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighten';
      ctx.fillStyle = 'rgb(' + look.lift + ',' + look.lift + ',' + Math.round(look.lift * 0.9) + ')';
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    (look.layers || []).forEach((layer) => {
      ctx.save();
      ctx.globalCompositeOperation = layer.blend;
      ctx.globalAlpha = layer.alpha;
      ctx.fillStyle = layer.color;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    });

    if (look.grain) {
      if (!grainTile) grainTile = buildGrain();
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = look.grain;
      const pattern = ctx.createPattern(grainTile, 'repeat');
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  // CSS filter string for previewing a look on a DOM element.
  function cssFor(filterId) {
    return getFilter(filterId).css || 'none';
  }

  return {
    BACKDROPS,
    FILTERS,
    getFilter,
    getBackdrop,
    loadBackdrop,
    preloadAll,
    applyFilter,
    cssFor,
  };
})();
