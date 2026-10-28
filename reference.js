/* Local reference framing. No AI requests and no background removal. */
globalThis.MerchReference = (() => {
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  async function load(url, signal) {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error("Could not load the reference image. Pick another image and try again.");
    const blob = await response.blob();
    if (blob.size > 12 * 1024 * 1024) throw new Error("Choose a reference image smaller than 12 MB.");
    const bitmap = await createImageBitmap(blob);
    if (!bitmap.width || !bitmap.height) { bitmap.close(); throw new Error("The reference image is empty."); }
    return bitmap;
  }

  function autoFocus(bitmap, site) {
    const fallback = { zoom: site === "Amazon" ? 2 : 1, x: 50, y: site === "Amazon" ? 52 : 50 };
    const scale = 192 / Math.max(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    const w = canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    const h = canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h).data;
    // Sample both sides of the chest to estimate the cloth color, away from the print.
    const colors = new Map();
    for (let y = Math.floor(h * .32); y < h * .72; y++) {
      for (let x = Math.floor(w * .23); x < w * .77; x++) {
        if (x > w * .35 && x < w * .65) continue;
        const i = (y * w + x) * 4;
        const key = (pixels[i] >> 4) * 256 + (pixels[i + 1] >> 4) * 16 + (pixels[i + 2] >> 4);
        const cell = colors.get(key) || [0, 0, 0, 0];
        cell[0]++; cell[1] += pixels[i]; cell[2] += pixels[i + 1]; cell[3] += pixels[i + 2];
        colors.set(key, cell);
      }
    }
    const dominant = [...colors.values()].sort((a, b) => b[0] - a[0])[0];
    if (!dominant) return fallback;
    const base = dominant.slice(1).map((n) => n / dominant[0]);
    const left = Math.floor(w * .19), right = Math.ceil(w * .81);
    const top = Math.floor(h * .20), bottom = Math.ceil(h * .87);
    const mask = new Uint8Array(w * h);
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      const i = (y * w + x) * 4;
      const distance = (pixels[i] - base[0]) ** 2 + (pixels[i + 1] - base[1]) ** 2 + (pixels[i + 2] - base[2]) ** 2;
      if (distance > 55 ** 2) mask[y * w + x] = 1;
    }
    const components = [];
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      const start = y * w + x;
      if (!mask[start]) continue;
      const queue = [start];
      mask[start] = 0;
      let minX = x, maxX = x, minY = y, maxY = y, touchesEdge = false;
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const index = queue[cursor], px = index % w, py = Math.floor(index / w);
        minX = Math.min(minX, px); maxX = Math.max(maxX, px);
        minY = Math.min(minY, py); maxY = Math.max(maxY, py);
        if (px === left || px === right - 1 || py === top || py === bottom - 1) touchesEdge = true;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx, ny = py + dy, next = ny * w + nx;
          if (nx < left || nx >= right || ny < top || ny >= bottom || !mask[next]) continue;
          mask[next] = 0; queue.push(next);
        }
      }
      if (!touchesEdge && queue.length >= 5) components.push({ minX, maxX, minY, maxY, area: queue.length });
    }
    const score = (c) => c.area / (1 + 16 * (((c.minX + c.maxX) / (2 * w) - .5) ** 2 + ((c.minY + c.maxY) / (2 * h) - .52) ** 2));
    components.sort((a, b) => score(b) - score(a));
    const primary = components[0];
    if (!primary || primary.area < w * h * .008) return fallback;
    const box = { ...primary };
    // Include nearby disconnected lettering and ornaments, excluding the garment edges.
    for (let pass = 0; pass < 3; pass++) for (const c of components) {
      if (c.maxX < box.minX - w * .07 || c.minX > box.maxX + w * .07 ||
          c.maxY < box.minY - h * .09 || c.minY > box.maxY + h * .09) continue;
      box.minX = Math.min(box.minX, c.minX); box.maxX = Math.max(box.maxX, c.maxX);
      box.minY = Math.min(box.minY, c.minY); box.maxY = Math.max(box.maxY, c.maxY);
    }
    const bw = (box.maxX - box.minX + 1) * 1.18 + w * .045;
    const bh = (box.maxY - box.minY + 1) * 1.18 + h * .045;
    const aspect = clamp(bw / bh, .45, 2.5);
    const frameW = Math.min(w, h * aspect), frameH = frameW / aspect;
    return {
      zoom: clamp(Math.min(frameW / bw, frameH / bh), 1, 5),
      x: 100 * (box.minX + box.maxX + 1) / (2 * w),
      y: 100 * (box.minY + box.maxY + 1) / (2 * h), aspect
    };
  }

  function bounds(bitmap, focus) {
    const zoom = clamp(Number(focus.zoom) || 1, 1, 6);
    const aspect = Number(focus.aspect) > 0 ? Number(focus.aspect) : bitmap.width / bitmap.height;
    const frameWidth = Math.min(bitmap.width, bitmap.height * aspect);
    const width = frameWidth / zoom, height = frameWidth / aspect / zoom;
    const x = clamp(bitmap.width * (Number(focus.x) / 100) - width / 2, 0, bitmap.width - width);
    const y = clamp(bitmap.height * (Number(focus.y) / 100) - height / 2, 0, bitmap.height - height);
    return { x, y, width, height };
  }

  function crop(bitmap, focus) {
    const rect = bounds(bitmap, focus);
    const scale = Math.min(1, 1024 / Math.max(rect.width, rect.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
  return { load, autoFocus, bounds, crop };
})();
