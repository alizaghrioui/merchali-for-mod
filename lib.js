// Pure helpers for print-ready export. No DOM access, so they can be unit-tested in Node.
(function (root) {
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(buf, start = 0, end = buf.length) {
    let c = 0xffffffff;
    for (let i = start; i < end; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // Insert a pHYs chunk (pixels per metre) right after IHDR so the PNG reports 300 DPI.
  function setDpi(png, dpi = 300) {
    const ppm = Math.round(dpi / 0.0254);
    const chunk = new Uint8Array(21);
    const dv = new DataView(chunk.buffer);
    dv.setUint32(0, 9);
    chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
    dv.setUint32(8, ppm);
    dv.setUint32(12, ppm);
    chunk[16] = 1; // unit: metre
    dv.setUint32(17, crc32(chunk, 4, 17));
    const out = new Uint8Array(png.length + 21);
    out.set(png.subarray(0, 33), 0); // 8-byte signature + 25-byte IHDR chunk
    out.set(chunk, 33);
    out.set(png.subarray(33), 54);
    return out;
  }

  // Minimal "store" (no compression) ZIP writer; PNGs are already compressed.
  function makeZip(files) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name);
      const crc = crc32(f.data);
      const size = f.data.length;

      const lh = new Uint8Array(30);
      const l = new DataView(lh.buffer);
      l.setUint32(0, 0x04034b50, true);
      l.setUint16(4, 20, true);
      l.setUint16(6, 0x0800, true);
      l.setUint16(8, 0, true);
      l.setUint16(10, 0, true);
      l.setUint16(12, 0x0021, true);
      l.setUint32(14, crc, true);
      l.setUint32(18, size, true);
      l.setUint32(22, size, true);
      l.setUint16(26, name.length, true);
      l.setUint16(28, 0, true);
      parts.push(lh, name, f.data);

      const ch = new Uint8Array(46);
      const c = new DataView(ch.buffer);
      c.setUint32(0, 0x02014b50, true);
      c.setUint16(4, 20, true);
      c.setUint16(6, 20, true);
      c.setUint16(8, 0x0800, true);
      c.setUint16(10, 0, true);
      c.setUint16(12, 0, true);
      c.setUint16(14, 0x0021, true);
      c.setUint32(16, crc, true);
      c.setUint32(20, size, true);
      c.setUint32(24, size, true);
      c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      central.push(ch, name);

      offset += 30 + name.length + size;
    }
    let cdSize = 0;
    for (const p of central) cdSize += p.length;
    const end = new Uint8Array(22);
    const e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, files.length, true);
    e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true);
    e.setUint32(16, offset, true);
    return parts.concat(central, [end]);
  }

  // Remove a solid background by flood-filling inward from the image border.
  // d is RGBA pixel data. tol is the allowed sum of |dR|+|dG|+|dB| from the background colour.
  // Pixels slightly beyond tol next to the removed area get partial alpha (soft edge).
  // Returns the number of pixels cleared; 0 means "nothing to do".
  function removeBg(d, w, h, tol) {
    const px = (x, y) => (y * w + x) * 4;
    const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)];
    if (corners.filter((i) => d[i + 3] < 16).length >= 3) return 0; // already transparent
    const opaque = corners.filter((i) => d[i + 3] >= 16);
    if (!opaque.length) return 0;
    const bg = [0, 1, 2].map((k) => Math.round(opaque.reduce((s, i) => s + d[i + k], 0) / opaque.length));
    const dist = (i) => Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]);
    if (opaque.some((i) => dist(i) > tol)) return 0; // corners disagree: not a solid background

    const seen = new Uint8Array(w * h);
    const stack = new Int32Array(w * h);
    let sp = 0;
    let removed = 0;

    const consider = (x, y) => {
      const p = y * w + x;
      if (seen[p]) return;
      const i = p * 4;
      if (d[i + 3] === 0) { seen[p] = 1; stack[sp++] = p; return; }
      const dd = dist(i);
      if (dd <= tol) { seen[p] = 1; stack[sp++] = p; }
      else if (dd <= tol * 2) {
        seen[p] = 1;
        d[i + 3] = Math.round((d[i + 3] * (dd - tol)) / tol);
      }
    };

    for (let x = 0; x < w; x++) { consider(x, 0); consider(x, h - 1); }
    for (let y = 0; y < h; y++) { consider(0, y); consider(w - 1, y); }

    while (sp > 0) {
      const p = stack[--sp];
      const x = p % w;
      const y = (p / w) | 0;
      const i = p * 4;
      if (d[i + 3] !== 0) { d[i + 3] = 0; removed++; }
      if (x > 0) consider(x - 1, y);
      if (x < w - 1) consider(x + 1, y);
      if (y > 0) consider(x, y - 1);
      if (y < h - 1) consider(x, y + 1);
    }
    return removed;
  }

  // Bounding box of pixels with alpha above thr, or null if the image is empty.
  function alphaBBox(d, w, h, thr = 8) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > thr) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  const api = { crc32, setDpi, makeZip, removeBg, alphaBBox };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MMLib = api;
})(typeof self !== "undefined" ? self : globalThis);
