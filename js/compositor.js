// Builds the "both of us in one frame" image: shared backdrop + two opaque cut-outs.
window.Compositor = (function () {
  const FRAME_W = 640;
  const FRAME_H = 480;

  // Each partner keeps a fixed side for the whole strip so the couple stays put
  // between photos even as the pose-first role alternates.
  const PLACEMENT = {
    A: { scale: 0.88, centerX: 0.33 },
    B: { scale: 0.88, centerX: 0.67 },
  };

  function frameSize() {
    return { width: FRAME_W, height: FRAME_H };
  }

  // Cover-fit draw, matching CSS object-fit: cover.
  function drawCover(ctx, img, x, y, w, h) {
    const iw = img.width || img.videoWidth;
    const ih = img.height || img.videoHeight;
    if (!iw || !ih) return;
    const imgRatio = iw / ih;
    const boxRatio = w / h;
    let sx, sy, sw, sh;
    if (imgRatio > boxRatio) {
      sh = ih;
      sw = sh * boxRatio;
      sx = (iw - sw) / 2;
      sy = 0;
    } else {
      sw = iw;
      sh = sw / boxRatio;
      sx = 0;
      sy = (ih - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  const shadowCanvas = document.createElement('canvas');
  const shadowCtx = shadowCanvas.getContext('2d');

  // Turns a cut-out into a flat black silhouette, so the drop shadow reads as a
  // shadow rather than a blurred smear of the person's own colours.
  function silhouette(cutout) {
    shadowCanvas.width = cutout.width;
    shadowCanvas.height = cutout.height;
    shadowCtx.clearRect(0, 0, cutout.width, cutout.height);
    shadowCtx.drawImage(cutout, 0, 0);
    shadowCtx.globalCompositeOperation = 'source-in';
    shadowCtx.fillStyle = '#000';
    shadowCtx.fillRect(0, 0, cutout.width, cutout.height);
    shadowCtx.globalCompositeOperation = 'source-over';
    return shadowCanvas;
  }

  // Draws one person's cut-out at their assigned side, bottom-aligned so both
  // partners stand on the same floor line.
  function drawPerson(ctx, cutout, role) {
    if (!cutout) return;
    const place = PLACEMENT[role] || PLACEMENT.A;
    const w = FRAME_W * place.scale;
    const h = FRAME_H * place.scale;
    const x = FRAME_W * place.centerX - w / 2;
    const y = FRAME_H - h;

    // A soft shadow behind the figure grounds it against the backdrop.
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.filter = 'blur(14px)';
    ctx.drawImage(silhouette(cutout), x + 8, y + 8, w, h);
    ctx.restore();

    ctx.drawImage(cutout, x, y, w, h);
  }

  // Composes a full frame. Cut-outs are drawn fully opaque — no blending.
  function compose(ctx, { backdrop, cutoutA, cutoutB, filterId }) {
    ctx.clearRect(0, 0, FRAME_W, FRAME_H);

    if (backdrop) {
      drawCover(ctx, backdrop, 0, 0, FRAME_W, FRAME_H);
    } else {
      ctx.fillStyle = '#12161f';
      ctx.fillRect(0, 0, FRAME_W, FRAME_H);
    }

    drawPerson(ctx, cutoutA, 'A');
    drawPerson(ctx, cutoutB, 'B');

    if (filterId) Looks.applyFilter(ctx, FRAME_W, FRAME_H, filterId);
  }

  function composeToCanvas(opts) {
    const canvas = document.createElement('canvas');
    canvas.width = FRAME_W;
    canvas.height = FRAME_H;
    compose(canvas.getContext('2d'), opts);
    return canvas;
  }

  return { compose, composeToCanvas, frameSize, drawCover, FRAME_W, FRAME_H };
})();
