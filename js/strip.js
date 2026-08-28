// Combines 4 composite photos into a final vertical photobooth strip and triggers a local download.
window.Strip = (function () {
  const PHOTO_W = 400;
  const PHOTO_H = 300;
  const PADDING = 20;
  const FOOTER_H = 60;

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  // Draws an image cropped/centered to fill the target box (object-fit: cover behavior).
  function drawCover(ctx, img, x, y, w, h) {
    const imgRatio = img.width / img.height;
    const boxRatio = w / h;
    let sx, sy, sw, sh;
    if (imgRatio > boxRatio) {
      sh = img.height;
      sw = sh * boxRatio;
      sx = (img.width - sw) / 2;
      sy = 0;
    } else {
      sw = img.width;
      sh = sw / boxRatio;
      sx = 0;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  async function buildStrip(dataUrls) {
    const images = await Promise.all(dataUrls.map(loadImage));
    const stripW = PHOTO_W + PADDING * 2;
    const stripH = PADDING + images.length * (PHOTO_H + PADDING) + FOOTER_H;

    const canvas = document.createElement('canvas');
    canvas.width = stripW;
    canvas.height = stripH;
    const ctx = canvas.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, 0, stripH);
    bg.addColorStop(0, '#0b1122');
    bg.addColorStop(1, '#060912');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, stripW, stripH);

    images.forEach((img, i) => {
      const x = PADDING;
      const y = PADDING + i * (PHOTO_H + PADDING);
      drawCover(ctx, img, x, y, PHOTO_W, PHOTO_H);
      const border = ctx.createLinearGradient(x, y, x + PHOTO_W, y + PHOTO_H);
      border.addColorStop(0, '#2fd9a8');
      border.addColorStop(1, '#8b6fe8');
      ctx.strokeStyle = border;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, PHOTO_W, PHOTO_H);
    });

    ctx.fillStyle = 'rgba(234, 244, 243, 0.75)';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    const dateStr = new Date().toLocaleDateString();
    ctx.fillText('PhotoboothLD — ' + dateStr, stripW / 2, stripH - FOOTER_H / 2 + 5);

    return canvas;
  }

  function download(canvas, filename = 'photoboothld-strip.jpg') {
    canvas.toBlob(
      (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      },
      'image/jpeg',
      0.92
    );
  }

  return { buildStrip, download };
})();
