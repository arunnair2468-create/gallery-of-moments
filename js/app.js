/* ════════════════════════════════════════════════════════════════
   THE GALLERY OF MOMENTS — cinematic first-person museum
   v2: physically-based rendering, procedural PBR textures,
   3D Kerala exterior at dusk, film grain, handheld camera.
   ════════════════════════════════════════════════════════════════ */
(function () {
"use strict";

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* surface silent failures during development */
window.__errs = [];
addEventListener("error", (e) => window.__errs.push("err: " + e.message));
addEventListener("unhandledrejection", (e) => window.__errs.push("rej: " + (e.reason && e.reason.message || e.reason)));

const EYE = 1.62, WALL_H = 5.0;
const ROOM_GAP = 500;
const byRoom = {};
PHOTOS.forEach(p => (byRoom[p.room] = byRoom[p.room] || []).push(p));

/* input capability: a machine may have BOTH touch and mouse — honour the mouse */
const HAS_FINE = matchMedia("(pointer:fine)").matches;
const COARSE_ONLY = !HAS_FINE && matchMedia("(pointer:coarse)").matches;
if (COARSE_ONLY) document.body.classList.add("coarse");

/* ───────────────────────────── tween engine ─────────────────────────────── */
const TWEENS = [];
const easeIO = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeO = (t) => t * (2 - t);
function tween(dur, fn, ease, done) {
  TWEENS.push({ t0: performance.now(), dur, fn, ease: ease || easeO, done });
}
function stepTweens(now) {
  for (let i = TWEENS.length - 1; i >= 0; i--) {
    const tw = TWEENS[i];
    let t = (now - tw.t0) / tw.dur;
    if (t >= 1) { tw.fn(1); TWEENS.splice(i, 1); if (tw.done) tw.done(); }
    else tw.fn(tw.ease(Math.max(0, t)));
  }
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/* ═══════════════════════ PROCEDURAL TEXTURE FACTORY ═══════════════════════ */
function mkCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

/* soft multi-octave value noise via scaled-up tiny random canvases */
function noiseFill(ctx, w, h, octaves) {
  ctx.save();
  octaves.forEach((o) => {
    const s = mkCanvas(o.scale, o.scale), sx = s.getContext("2d");
    const img = sx.createImageData(o.scale, o.scale);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (Math.random() - 0.5) * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    sx.putImageData(img, 0, 0);
    ctx.globalAlpha = o.amp;
    ctx.globalCompositeOperation = o.op || "overlay";
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(s, 0, 0, w, h);
  });
  ctx.restore();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
}

/* grayscale height canvas → tangent-space normal map */
function heightToNormal(src, strength) {
  const w = src.width, h = src.height;
  const sctx = src.getContext("2d");
  const sd = sctx.getImageData(0, 0, w, h).data;
  const out = mkCanvas(w, h), octx = out.getContext("2d");
  const od = octx.createImageData(w, h);
  const g = (x, y) => sd[(((y + h) % h) * w + ((x + w) % w)) * 4];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (g(x + 1, y) - g(x - 1, y)) / 255 * strength;
    const dy = (g(x, y + 1) - g(x, y - 1)) / 255 * strength;
    const len = Math.sqrt(dx * dx + dy * dy + 1);
    const i = (y * w + x) * 4;
    od.data[i] = (-dx / len * 0.5 + 0.5) * 255;
    od.data[i + 1] = (dy / len * 0.5 + 0.5) * 255;
    od.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
    od.data[i + 3] = 255;
  }
  octx.putImageData(od, 0, 0);
  return out;
}
function tex(canvas, repeat, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.encoding = THREE.sRGBEncoding;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 8;
  return t;
}

const TEX = {};
function buildTextures() {
  /* ---- lime-washed plaster ---- */
  {
    const c = mkCanvas(512, 512), x = c.getContext("2d");
    x.fillStyle = "#dfd2b4"; x.fillRect(0, 0, 512, 512);
    noiseFill(x, 512, 512, [
      { scale: 4, amp: 0.20 }, { scale: 16, amp: 0.14 }, { scale: 64, amp: 0.10 }, { scale: 256, amp: 0.07 }
    ]);
    const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "rgba(255,246,220,.10)"); g.addColorStop(1, "rgba(120,90,55,.14)");
    x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    TEX.plaster = { map: tex(c, [2, 1], true), normalMap: tex(heightToNormal(c, 1.1), [2, 1]) };
  }
  /* ---- dark teak / rosewood ---- */
  {
    const c = mkCanvas(512, 512), x = c.getContext("2d");
    x.fillStyle = "#2f1c0f"; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 260; i++) {
      const px = Math.random() * 512, wl = 30 + Math.random() * 200;
      const v = Math.random();
      x.strokeStyle = v < 0.5 ? `rgba(18,10,5,${0.12 + Math.random() * 0.25})`
                              : `rgba(${95 + Math.random() * 55 | 0},${58 + Math.random() * 26 | 0},${26 + Math.random() * 14 | 0},${0.10 + Math.random() * 0.20})`;
      x.lineWidth = 0.6 + Math.random() * 2.4;
      x.beginPath(); x.moveTo(px, -10);
      for (let yy = 0; yy <= 512; yy += 32)
        x.lineTo(px + Math.sin(yy / wl + i) * (2 + Math.random() * 5), yy);
      x.stroke();
    }
    noiseFill(x, 512, 512, [{ scale: 128, amp: 0.10 }, { scale: 8, amp: 0.10 }]);
    const rough = mkCanvas(256, 256), rx = rough.getContext("2d");
    rx.fillStyle = "#8a8a8a"; rx.fillRect(0, 0, 256, 256);
    noiseFill(rx, 256, 256, [{ scale: 8, amp: 0.3 }, { scale: 64, amp: 0.25 }]);
    TEX.wood = {
      map: tex(c, null, true),
      normalMap: tex(heightToNormal(c, 0.7)),
      roughnessMap: tex(rough)
    };
  }
  /* ---- polished terracotta floor (athangudi feel) ---- */
  {
    const S = 1024, TS = S / 2;
    const c = mkCanvas(S, S), x = c.getContext("2d");
    const rough = mkCanvas(S, S), rx = rough.getContext("2d");
    const hgt = mkCanvas(S, S), hx = hgt.getContext("2d");
    hx.fillStyle = "#808080"; hx.fillRect(0, 0, S, S);
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
      const ox = tx * TS, oy = ty * TS;
      const v = Math.random() * 26 - 13;
      x.fillStyle = `rgb(${146 + v | 0},${72 + v * 0.6 | 0},${44 + v * 0.4 | 0})`;
      x.fillRect(ox, oy, TS, TS);
      /* colour clouds inside the tile */
      for (let i = 0; i < 9; i++) {
        const gx = ox + Math.random() * TS, gy = oy + Math.random() * TS, r = 40 + Math.random() * 150;
        const gg = x.createRadialGradient(gx, gy, 0, gx, gy, r);
        const dv = Math.random() * 30 - 15;
        gg.addColorStop(0, `rgba(${160 + dv | 0},${84 + dv * 0.6 | 0},${50 + dv * 0.4 | 0},.35)`);
        gg.addColorStop(1, "rgba(0,0,0,0)");
        x.fillStyle = gg; x.fillRect(ox, oy, TS, TS);
      }
      /* polished sheen variation */
      rx.fillStyle = `rgb(${70 + Math.random() * 40 | 0},0,0)`;
      rx.fillStyle = `rgb(${78 + Math.random() * 34 | 0},${78 | 0},${78 | 0})`;
      rx.fillRect(ox, oy, TS, TS);
      const sg = rx.createRadialGradient(ox + TS / 2, oy + TS / 2, 20, ox + TS / 2, oy + TS / 2, TS * 0.7);
      sg.addColorStop(0, "rgba(52,52,52,.85)"); sg.addColorStop(1, "rgba(150,150,150,.55)");
      rx.fillStyle = sg; rx.fillRect(ox, oy, TS, TS);
      /* tile dome height */
      const hg = hx.createRadialGradient(ox + TS / 2, oy + TS / 2, 10, ox + TS / 2, oy + TS / 2, TS * 0.74);
      hg.addColorStop(0, "rgba(176,176,176,.9)"); hg.addColorStop(1, "rgba(96,96,96,.9)");
      hx.fillStyle = hg; hx.fillRect(ox, oy, TS, TS);
    }
    /* grout */
    x.strokeStyle = "#3a1d10"; x.lineWidth = 7;
    hx.strokeStyle = "#2a2a2a"; hx.lineWidth = 9;
    rx.strokeStyle = "#d8d8d8"; rx.lineWidth = 9;
    [0, TS, S].forEach((p) => {
      x.beginPath(); x.moveTo(p, 0); x.lineTo(p, S); x.moveTo(0, p); x.lineTo(S, p); x.stroke();
      hx.beginPath(); hx.moveTo(p, 0); hx.lineTo(p, S); hx.moveTo(0, p); hx.lineTo(S, p); hx.stroke();
      rx.beginPath(); rx.moveTo(p, 0); rx.lineTo(p, S); rx.moveTo(0, p); rx.lineTo(S, p); rx.stroke();
    });
    noiseFill(x, S, S, [{ scale: 256, amp: 0.06 }]);
    TEX.floor = {
      map: tex(c, [1, 1], true),
      normalMap: tex(heightToNormal(hgt, 2.2), [1, 1]),
      roughnessMap: tex(rough, [1, 1])
    };
  }
  /* ---- dark ceiling planks ---- */
  {
    const c = mkCanvas(512, 512), x = c.getContext("2d");
    x.fillStyle = "#241509"; x.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 64) {
      x.fillStyle = `rgb(${40 + Math.random() * 12 | 0},${24 + Math.random() * 8 | 0},${12 | 0})`;
      x.fillRect(0, y + 2, 512, 60);
      for (let i = 0; i < 40; i++) {
        x.strokeStyle = `rgba(12,6,3,${0.1 + Math.random() * 0.25})`;
        x.lineWidth = 0.8 + Math.random() * 1.4;
        const yy = y + 4 + Math.random() * 56;
        x.beginPath(); x.moveTo(0, yy); x.bezierCurveTo(170, yy + 4, 340, yy - 4, 512, yy); x.stroke();
      }
    }
    TEX.ceil = { map: tex(c, [4, 4], true), normalMap: tex(heightToNormal(c, 0.8), [4, 4]) };
  }
  /* ---- terracotta roof tiles (exterior) ---- */
  {
    const c = mkCanvas(512, 512), x = c.getContext("2d");
    const hgt = mkCanvas(512, 512), hx = hgt.getContext("2d");
    const rw = 64, rh = 85;
    for (let row = 0; row < 512 / rh + 1; row++) {
      for (let col = 0; col < 512 / rw; col++) {
        const ox = col * rw, oy = row * rh - (row % 2) * 0;
        const v = Math.random() * 26 - 13;
        const g = x.createLinearGradient(ox, 0, ox + rw, 0);
        g.addColorStop(0, `rgb(${96 + v | 0},${40 + v * 0.5 | 0},${24 | 0})`);
        g.addColorStop(0.5, `rgb(${168 + v | 0},${82 + v * 0.5 | 0},${50 | 0})`);
        g.addColorStop(1, `rgb(${88 + v | 0},${36 + v * 0.5 | 0},${22 | 0})`);
        x.fillStyle = g; x.fillRect(ox, oy, rw, rh);
        const hg = hx.createLinearGradient(ox, 0, ox + rw, 0);
        hg.addColorStop(0, "#404040"); hg.addColorStop(0.5, "#d0d0d0"); hg.addColorStop(1, "#383838");
        hx.fillStyle = hg; hx.fillRect(ox, oy, rw, rh);
        x.fillStyle = "rgba(30,10,5,.5)"; x.fillRect(ox, oy + rh - 7, rw, 7);
        hx.fillStyle = "#181818"; hx.fillRect(ox, oy + rh - 7, rw, 7);
      }
    }
    noiseFill(x, 512, 512, [{ scale: 64, amp: 0.12 }, { scale: 256, amp: 0.08 }]);
    TEX.roof = { map: tex(c, [8, 3], true), normalMap: tex(heightToNormal(hgt, 2.6), [8, 3]) };
  }
  /* ---- dusk ground ---- */
  {
    const c = mkCanvas(512, 512), x = c.getContext("2d");
    x.fillStyle = "#31201c"; x.fillRect(0, 0, 512, 512);
    noiseFill(x, 512, 512, [{ scale: 8, amp: 0.25 }, { scale: 64, amp: 0.18 }, { scale: 256, amp: 0.10 }]);
    TEX.ground = { map: tex(c, [10, 10], true), normalMap: tex(heightToNormal(c, 1.4), [10, 10]) };
  }
  /* ---- decals ---- */
  {
    const c = mkCanvas(256, 256), x = c.getContext("2d");
    const g = x.createRadialGradient(128, 70, 8, 128, 110, 150);
    g.addColorStop(0, "rgba(255,214,150,.95)");
    g.addColorStop(0.45, "rgba(255,180,100,.32)");
    g.addColorStop(1, "rgba(255,160,80,0)");
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    TEX.pool = tex(c);
  }
  {
    const c = mkCanvas(256, 256), x = c.getContext("2d");
    const g = x.createRadialGradient(128, 128, 30, 128, 128, 128);
    g.addColorStop(0, "rgba(0,0,0,.62)"); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    TEX.shadow = tex(c);
  }
  {
    const c = mkCanvas(64, 256), x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, "rgba(0,0,0,.5)"); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(0, 0, 64, 256);
    TEX.aoStrip = tex(c);
  }
  {
    const c = mkCanvas(128, 128), x = c.getContext("2d");
    const g = x.createRadialGradient(64, 64, 2, 64, 64, 64);
    g.addColorStop(0, "rgba(255,235,190,1)");
    g.addColorStop(0.25, "rgba(255,190,110,.55)");
    g.addColorStop(1, "rgba(255,160,60,0)");
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    TEX.glowSprite = tex(c);
  }
  /* ---- door reveal glow ---- */
  {
    const c = mkCanvas(128, 256), x = c.getContext("2d");
    x.fillStyle = "#0b0503"; x.fillRect(0, 0, 128, 256);
    const g = x.createRadialGradient(64, 250, 8, 64, 245, 250);
    g.addColorStop(0, "rgba(255,190,105,.9)");
    g.addColorStop(0.4, "rgba(190,110,45,.30)");
    g.addColorStop(1, "rgba(16,7,3,0)");
    x.fillStyle = g; x.fillRect(0, 0, 128, 256);
    TEX.doorGlow = tex(c, null, true);
  }
  /* ---- dusk sky dome ---- */
  {
    const c = mkCanvas(1024, 512), x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "#0b0820");
    g.addColorStop(0.42, "#2a1638");
    g.addColorStop(0.66, "#6b2f45");
    g.addColorStop(0.82, "#c05a3a");
    g.addColorStop(0.93, "#e89050");
    g.addColorStop(1, "#f0a860");
    x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
    /* stars in the upper sky */
    for (let i = 0; i < 420; i++) {
      const sy = Math.pow(Math.random(), 2.2) * 300;
      const a = (1 - sy / 300) * (0.3 + Math.random() * 0.7);
      x.fillStyle = `rgba(255,244,224,${a})`;
      const r = Math.random() < 0.06 ? 1.6 : 0.8;
      x.fillRect(Math.random() * 1024, sy, r, r);
    }
    /* thin dusk clouds */
    for (let i = 0; i < 14; i++) {
      const cy = 260 + Math.random() * 160, cw = 120 + Math.random() * 300;
      const cg = x.createRadialGradient(0, 0, 0, 0, 0, cw);
      cg.addColorStop(0, "rgba(60,26,40,.30)"); cg.addColorStop(1, "rgba(60,26,40,0)");
      x.save(); x.translate(Math.random() * 1024, cy); x.scale(1, 0.14);
      x.fillStyle = cg; x.beginPath(); x.arc(0, 0, cw, 0, 7); x.fill(); x.restore();
    }
    TEX.sky = tex(c, null, true);
  }
  /* ---- palm silhouette billboard ---- */
  {
    const c = mkCanvas(256, 384), x = c.getContext("2d");
    x.strokeStyle = "#0d0713"; x.fillStyle = "#0d0713";
    x.lineWidth = 7; x.lineCap = "round";
    x.beginPath(); x.moveTo(128, 384);
    x.bezierCurveTo(122, 300, 138, 220, 130, 150); x.stroke();
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      const fx = Math.cos(a), fy = Math.sin(a) * 0.55 - 0.5;
      x.lineWidth = 4;
      x.beginPath(); x.moveTo(130, 148);
      const ex = 130 + fx * (60 + Math.random() * 40), ey = 148 + fy * 80 + 34;
      x.quadraticCurveTo(130 + fx * 46, 148 + fy * 66, ex, ey);
      x.stroke();
      /* leaflets */
      for (let s = 0.25; s < 1; s += 0.14) {
        const px2 = 130 + fx * 46 * s + (ex - 130 - fx * 46) * s * s;
        const py2 = 148 + fy * 66 * s + (ey - 148 - fy * 66) * s * s;
        x.lineWidth = 1.6;
        x.beginPath(); x.moveTo(px2, py2); x.lineTo(px2 + fx * 6 - fy * 12, py2 + 13); x.stroke();
      }
    }
    x.beginPath(); x.arc(130, 150, 7, 0, 7); x.fill();
    TEX.palm = tex(c, null, true);
  }
  /* film grain for the CSS layer */
  {
    const c = mkCanvas(160, 160), x = c.getContext("2d");
    const img = x.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 26;
    }
    x.putImageData(img, 0, 0);
    $("#grain").style.backgroundImage = `url(${c.toDataURL()})`;
  }
}

function labelTex(lines, W, H, opts) {
  opts = opts || {};
  const c = mkCanvas(W, H), ctx = c.getContext("2d");
  if (opts.bg) {
    ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(220,170,90,.7)"; ctx.lineWidth = 3;
    ctx.strokeRect(5, 5, W - 10, H - 10);
  }
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  lines.forEach((L) => {
    ctx.font = L.font; ctx.fillStyle = L.color;
    ctx.fillText(L.text, W / 2, H * L.y);
  });
  return tex(c, null, true);
}

/* ═══════════════════════════════ MATERIALS ════════════════════════════════ */
const MAT = {};
function buildMaterials() {
  MAT.plaster = new THREE.MeshStandardMaterial({
    map: TEX.plaster.map, normalMap: TEX.plaster.normalMap,
    normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.94, metalness: 0, envMapIntensity: 0.25
  });
  MAT.wood = new THREE.MeshStandardMaterial({
    map: TEX.wood.map, normalMap: TEX.wood.normalMap, roughnessMap: TEX.wood.roughnessMap,
    normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.62, metalness: 0.05, envMapIntensity: 0.7
  });
  MAT.woodLight = MAT.wood.clone(); MAT.woodLight.color = new THREE.Color(0x6e523a);
  MAT.floor = new THREE.MeshStandardMaterial({
    map: TEX.floor.map, normalMap: TEX.floor.normalMap, roughnessMap: TEX.floor.roughnessMap,
    normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1.0, metalness: 0.04, envMapIntensity: 1.0
  });
  MAT.ceil = new THREE.MeshStandardMaterial({
    map: TEX.ceil.map, normalMap: TEX.ceil.normalMap, roughness: 0.9, envMapIntensity: 0.45,
    emissive: 0x241709, emissiveIntensity: 0.55
  });
  MAT.roof = new THREE.MeshStandardMaterial({
    map: TEX.roof.map, normalMap: TEX.roof.normalMap,
    normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.85, envMapIntensity: 0.3,
    side: THREE.DoubleSide
  });
  MAT.ground = new THREE.MeshStandardMaterial({
    map: TEX.ground.map, normalMap: TEX.ground.normalMap, roughness: 1, envMapIntensity: 0.12
  });
  MAT.laterite = new THREE.MeshStandardMaterial({
    map: TEX.plaster.map, color: 0xa05a38, roughness: 0.95, envMapIntensity: 0.2,
    normalMap: TEX.plaster.normalMap, normalScale: new THREE.Vector2(0.8, 0.8)
  });
  MAT.brass = new THREE.MeshStandardMaterial({
    color: 0xd8a84e, roughness: 0.32, metalness: 0.95, envMapIntensity: 1.6
  });
  MAT.flame = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  MAT.matte = new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.9, envMapIntensity: 0.2 });
  MAT.recess = new THREE.MeshBasicMaterial({ map: TEX.doorGlow });
  MAT.pool = new THREE.MeshBasicMaterial({
    map: TEX.pool, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5
  });
  MAT.shadowDecal = new THREE.MeshBasicMaterial({
    map: TEX.shadow, transparent: true, depthWrite: false, opacity: 0.85
  });
  MAT.aoStrip = new THREE.MeshBasicMaterial({
    map: TEX.aoStrip, transparent: true, depthWrite: false, opacity: 0.75
  });
  MAT.glow = new THREE.SpriteMaterial({
    map: TEX.glowSprite, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
  });
}

/* ══════════════════════════════ RENDERER ══════════════════════════════════ */
let renderer, camera, clock;
let sceneInt, sceneExt;         // interior museum / exterior dusk
let mode = "ext";               // 'ext' | 'int'
const SPACES = {};
let current = null;
let inputLocked = true;
const photoMats = {};
let loadCount = 0;
const texLoader = new THREE.TextureLoader();

/* ── door portals: live snapshots of the room beyond each doorway ── */
const portalUsers = {};   // targetKey -> [materials waiting for that room's view]
const portalRT = {};      // targetKey -> WebGLRenderTarget
let portalCam = null;

function capturePortal(key) {
  const sp = SPACES[key];
  if (!sp || !renderer) return;
  if (!portalCam) {
    portalCam = new THREE.PerspectiveCamera(64, 0.55, 0.1, 90);
    portalCam.rotation.order = "YXZ";
  }
  if (!portalRT[key]) {
    portalRT[key] = new THREE.WebGLRenderTarget(320, 576);
    portalRT[key].texture.encoding = THREE.sRGBEncoding;
  }
  /* show only the target space, shoot from just inside its entrance door */
  const vis = [];
  Object.values(SPACES).forEach((s) => { vis.push([s.group, s.group.visible]); s.group.visible = (s === sp); });
  if (key === "hub") {
    portalCam.position.set(0, EYE, 8.4);
    portalCam.rotation.set(0, 0, 0);
  } else {
    /* room spawn sits 2.8m inside the north wall — the door plane is at spawn.z − 2.8 */
    portalCam.position.set(sp.spawn.cx + sp.spawn.x, EYE, sp.spawn.z - 2.2);
    portalCam.rotation.set(0, Math.PI, 0);
  }
  renderer.setRenderTarget(portalRT[key]);
  renderer.render(sceneInt, portalCam);
  renderer.setRenderTarget(null);
  vis.forEach(([grp, v]) => (grp.visible = v));
  (portalUsers[key] || []).forEach((m) => {
    m.map = portalRT[key].texture;
    /* interior doors: slightly dimmed glimpse; the front door: full view */
    m.color.set(m.userData.bright ? 0xd8d2c8 : 0x9d948a);
    m.needsUpdate = true;
  });
}

function initRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $("#stage").appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 320);
  camera.rotation.order = "YXZ";
  clock = new THREE.Clock();

  /* environment reflections from a tiny synthetic room */
  const pm = new THREE.PMREMGenerator(renderer);
  const es = new THREE.Scene();
  es.background = new THREE.Color(0x1a0f08);
  const mk = (col, w, h, x, y, z, ry, rx) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col }));
    m.position.set(x, y, z); if (ry) m.rotation.y = ry; if (rx) m.rotation.x = rx;
    es.add(m);
  };
  mk(0xffe2b0, 6, 3, 0, 4.5, 0, 0, Math.PI / 2);     // warm ceiling panel
  mk(0xffd090, 3, 2, -5, 2.4, 0, Math.PI / 2, 0);    // warm side
  mk(0x484031, 4, 2.4, 5, 2.2, 0, -Math.PI / 2, 0);  // dim side
  mk(0x40342a, 8, 8, 0, -2, 0, 0, -Math.PI / 2);     // floor bounce
  const envRT = pm.fromScene(es, 0.06);
  sceneInt = new THREE.Scene();
  sceneExt = new THREE.Scene();
  sceneInt.environment = envRT.texture;
  sceneExt.environment = envRT.texture;
  pm.dispose();
}

/* ═════════════════════════ SHARED BUILD HELPERS ═══════════════════════════ */
function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }

function turnedPillar(h) {
  const pts = [];
  const prof = [
    [0.20, 0], [0.20, 0.06], [0.14, 0.10], [0.155, 0.5], [0.12, 0.62],
    [0.105, h - 0.75], [0.14, h - 0.55], [0.125, h - 0.30], [0.19, h - 0.12], [0.19, h]
  ];
  prof.forEach((p) => pts.push(new THREE.Vector2(p[0], p[1])));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 10), MAT.wood);
  m.castShadow = true;
  return m;
}

function bench(w) {
  const g = new THREE.Group();
  const seat = box(w, 0.085, 0.55, MAT.wood); seat.position.y = 0.47; seat.castShadow = true;
  const rail = box(w - 0.3, 0.05, 0.4, MAT.wood); rail.position.y = 0.16;
  g.add(seat, rail);
  [-w / 2 + 0.16, w / 2 - 0.16].forEach((x) => {
    const leg = box(0.11, 0.44, 0.48, MAT.wood); leg.position.set(x, 0.235, 0); leg.castShadow = true;
    g.add(leg);
  });
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.5, 1.1), MAT.shadowDecal);
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.012;
  g.add(sh);
  return g;
}

function aoStrips(W, D) {
  /* soft contact shadow where walls meet the floor */
  const g = new THREE.Group();
  const mk = (len, x, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.55), MAT.aoStrip);
    m.rotation.x = -Math.PI / 2; m.rotation.z = ry;
    m.position.set(x, 0.015, z);
    g.add(m);
  };
  mk(W, 0, -D / 2 + 0.28, Math.PI);       // north
  mk(W, 0, D / 2 - 0.28, 0);              // south
  mk(D, -W / 2 + 0.28, 0, -Math.PI / 2);  // west
  mk(D, W / 2 - 0.28, 0, Math.PI / 2);    // east
  return g;
}

function dustField(w, d, h, n) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * w;
    pos[i * 3 + 1] = Math.random() * h;
    pos[i * 3 + 2] = (Math.random() - 0.5) * d;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xffd9a0, size: 0.016, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  pts.userData.dust = true;
  return pts;
}

function makeDoorway(targetKey, dw, dh, label, tag) {
  const g = new THREE.Group();
  /* jambs & lintels sit proud of both wall faces (wall is ±0.18) — nothing coplanar */
  const jamb = new THREE.BoxGeometry(0.2, dh + 0.18, 0.62);
  const l = new THREE.Mesh(jamb, MAT.wood); l.position.set(-dw / 2 - 0.1, dh / 2, 0);
  const r = new THREE.Mesh(jamb, MAT.wood); r.position.set(dw / 2 + 0.1, dh / 2, 0);
  const top = box(dw + 0.58, 0.22, 0.6, MAT.wood); top.position.set(0, dh + 0.11, 0);
  const top2 = box(dw + 0.94, 0.11, 0.68, MAT.wood); top2.position.set(0, dh + 0.285, 0);
  /* wooden casing lining the opening — masks the portal edges */
  const caseL = box(0.07, dh, 0.6, MAT.wood); caseL.position.set(-dw / 2 + 0.035, dh / 2, 0);
  const caseR = box(0.07, dh, 0.6, MAT.wood); caseR.position.set(dw / 2 - 0.035, dh / 2, 0);
  const caseT = box(dw, 0.07, 0.6, MAT.wood); caseT.position.set(0, dh - 0.035, 0);
  /* the portal: a live view of the room beyond this door */
  const pmat = new THREE.MeshBasicMaterial({ color: 0x2a201a, toneMapped: false });
  (portalUsers[targetKey] = portalUsers[targetKey] || []).push(pmat);
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), pmat);
  portal.position.set(0, dh / 2, -0.31);
  const fs = label.length > 14 ? "30px" : "38px";
  const plq = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 0.5),
    new THREE.MeshBasicMaterial({
      map: tag ? labelTex([{ text: label.toUpperCase(), font: fs + " Georgia", color: "#f0d9a4", y: 0.36 },
                           { text: tag, font: "italic 19px Georgia", color: "#b3925c", y: 0.72 }], 512, 136, { bg: "#1c0f06" })
               : labelTex([{ text: label.toUpperCase(), font: fs + " Georgia", color: "#f0d9a4", y: 0.54 }], 512, 136, { bg: "#1c0f06" })
    })
  );
  plq.position.set(0, dh + 0.78, 0.4);
  /* faint warm haze in the opening */
  const gl = new THREE.Sprite(MAT.glow.clone());
  gl.scale.set(1.5, 1.5, 1); gl.position.set(0, 0.7, -0.12);
  gl.material.opacity = 0.16;
  g.add(l, r, top, top2, caseL, caseR, caseT, portal, plq, gl);
  /* the whole doorway is clickable */
  g.traverse((o) => { o.userData = { type: "door", target: targetKey, label }; });
  return g;
}

function wallSegments(len, doors, mat, h) {
  h = h || WALL_H;
  const g = new THREE.Group();
  const t = 0.36;
  const xs = doors.slice().sort((a, b) => a.x - b.x);
  let cur = -len / 2;
  const seg = (a, b) => {
    if (b - a < 0.05) return;
    const m = box(b - a, h, t, mat);
    m.position.set((a + b) / 2, h / 2, 0);
    m.receiveShadow = true;
    g.add(m);
  };
  xs.forEach((d) => {
    seg(cur, d.x - d.w / 2);
    const lin = box(d.w, h - d.h, t, mat);
    lin.position.set(d.x, d.h + (h - d.h) / 2, 0);
    g.add(lin);
    cur = d.x + d.w / 2;
  });
  seg(cur, len / 2);
  return g;
}

/* ═══════════════════════════ EXTERIOR (dusk) ══════════════════════════════ */
const EXT = { doors: {}, anchors: {}, flames: [], fireflies: null };

function buildExterior() {
  const S = sceneExt;
  S.fog = new THREE.FogExp2(0x18101e, 0.016);

  /* sky */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(150, 32, 20),
    new THREE.MeshBasicMaterial({ map: TEX.sky, side: THREE.BackSide, fog: false })
  );
  S.add(sky);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({
    map: TEX.glowSprite, color: 0xffb45e, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  }));
  sun.scale.set(60, 60, 1); sun.position.set(-18, 6, -120);
  S.add(sun);

  /* ground */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 120), MAT.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  S.add(ground);
  /* worn laterite path to the door */
  const pathMat = new THREE.MeshStandardMaterial({
    map: TEX.floor.map, normalMap: TEX.floor.normalMap,
    color: 0x5c4434, roughness: 1.0, envMapIntensity: 0.06
  });
  const path = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 18), pathMat);
  path.rotation.x = -Math.PI / 2; path.position.set(0, 0.012, 9);
  S.add(path);

  /* ---- the house ---- */
  const H = new THREE.Group();
  const WW = 17, WH = 4.3;

  /* front wall with 3 openings */
  const front = wallSegments(WW, [
    { x: 0, w: 2.3, h: 3.0 }, { x: -5.4, w: 2.0, h: 2.2 }, { x: 5.4, w: 2.0, h: 2.2 }
  ], MAT.plaster, WH);
  /* raise window sills: fill below windows */
  [-5.4, 5.4].forEach((x) => {
    const sillFill = box(2.0, 1.0, 0.36, MAT.plaster);
    sillFill.position.set(x, 0.5, 0);
    front.add(sillFill);
  });
  H.add(front);
  const sideL = box(0.36, WH, 9, MAT.plaster); sideL.position.set(-WW / 2 + 0.18, WH / 2, -4.5); H.add(sideL);
  const sideR = sideL.clone(); sideR.position.x = WW / 2 - 0.18; H.add(sideR);
  const back = box(WW, WH, 0.36, MAT.plaster); back.position.set(0, WH / 2, -9); H.add(back);

  /* laterite plinth */
  const plinth = box(WW + 0.7, 0.5, 9.7, MAT.laterite);
  plinth.position.set(0, 0.25, -4.35);
  H.add(plinth);

  /* wooden pilasters on the facade */
  [-8, -3.4, 3.4, 8].forEach((x) => {
    const p = turnedPillar(WH - 0.1); p.position.set(x, 0.05, 0.34); H.add(p);
  });

  /* ---- main hip roof ---- */
  function slope(w0, w1, depth, rise) {
    /* trapezoid: bottom edge w0 at y0,z0 → top edge w1 */
    const geo = new THREE.BufferGeometry();
    const v = new Float32Array([
      -w0 / 2, 0, 0,  w0 / 2, 0, 0,  w1 / 2, rise, -depth,
      -w0 / 2, 0, 0,  w1 / 2, rise, -depth,  -w1 / 2, rise, -depth
    ]);
    const uv = new Float32Array([0, 0, 1, 0, 0.92, 1, 0, 0, 0.92, 1, 0.08, 1]);
    geo.setAttribute("position", new THREE.BufferAttribute(v, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, MAT.roof);
  }
  const roofG = new THREE.Group();
  const rf = slope(19.4, 8.4, 5.6, 3.1);           // front slope
  rf.position.set(0, WH, 1.2);
  const rb = slope(19.4, 8.4, 5.6, 3.1);           // back slope
  rb.position.set(0, WH, -10.2); rb.rotation.y = Math.PI;
  const rl = slope(11.4, 0.5, 5.5, 3.1);           // left hip
  rl.position.set(-9.7, WH, -4.5); rl.rotation.y = Math.PI / 2;
  const rr = slope(11.4, 0.5, 5.5, 3.1);           // right hip
  rr.position.set(9.7, WH, -4.5); rr.rotation.y = -Math.PI / 2;
  roofG.add(rf, rb, rl, rr);
  /* ridge */
  const ridge = box(8.6, 0.22, 0.5, MAT.wood); ridge.position.set(0, WH + 3.12, -4.5);
  roofG.add(ridge);
  /* fascia + rafter tails under the front eave */
  const fascia = box(19.6, 0.18, 0.1, MAT.wood); fascia.position.set(0, WH - 0.02, 1.22);
  roofG.add(fascia);
  /* soffit closes the eave so you cannot see the sky through it */
  const soffit = box(19.6, 0.06, 1.35, MAT.wood);
  soffit.position.set(0, WH - 0.06, 0.6);
  roofG.add(soffit);
  H.add(roofG);

  /* ---- upper gable tier (Kerala signature) ---- */
  const gg = new THREE.Group();
  const gw = 6.6, gh = 2.2, gd = 4.6;
  const gf = slope(gw + 1.4, 0.4, gd / 2, gh);
  gf.position.set(0, WH + 2.1, -4.5 + gd / 2 + 0.3);
  const gb = slope(gw + 1.4, 0.4, gd / 2, gh);
  gb.position.set(0, WH + 2.1, -4.5 - gd / 2 - 0.3); gb.rotation.y = Math.PI;
  /* slatted triangular gable face */
  const tri = new THREE.Shape();
  tri.moveTo(-gw / 2, 0); tri.lineTo(gw / 2, 0); tri.lineTo(0, gh); tri.closePath();
  const gface = new THREE.Mesh(new THREE.ShapeGeometry(tri), MAT.wood);
  gface.position.set(0, WH + 2.08, -4.5 + gd / 2 + 0.28);
  gg.add(gf, gb, gface);
  for (let i = 0; i < 6; i++) {
    const lw = gw * (1 - i / 6) * 0.82;
    const slat = box(lw, 0.09, 0.06, MAT.woodLight);
    slat.position.set(0, WH + 2.28 + i * 0.3, -4.5 + gd / 2 + 0.33);
    gg.add(slat);
  }
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 8), MAT.brass);
  fin.position.set(0, WH + 2.1 + gh + 0.25, -4.5);
  gg.add(fin);
  H.add(gg);

  /* ---- porch over the door ---- */
  const porch = new THREE.Group();
  const pr = slope(6.4, 5.0, 1.7, 1.0);
  pr.position.set(0, 3.45, 1.75);
  porch.add(pr);
  const pf = box(6.5, 0.14, 0.08, MAT.wood); pf.position.set(0, 3.42, 1.78); porch.add(pf);
  [-2.6, 2.6].forEach((x) => {
    const c = turnedPillar(3.35); c.position.set(x, 0.1, 1.55); porch.add(c);
  });
  /* steps */
  [[3.4, 0.16, 1.5, 0.08, 2.55], [2.9, 0.16, 1.1, 0.24, 2.35], [2.6, 0.16, 0.7, 0.4, 2.15]].forEach((s) => {
    const st = box(s[0], s[1], s[2], MAT.laterite);
    st.position.set(0, s[3], s[4]);
    st.receiveShadow = true;
    porch.add(st);
  });
  H.add(porch);

  /* ---- the great door ---- */
  const doorG = new THREE.Group();
  doorG.position.set(0, 0.5, 0.05);
  /* open casing around the doorway (NOT a solid block — the hall shows through) */
  const revL = box(0.16, 3.0, 0.5, MAT.wood); revL.position.set(-1.07, 1.5, -0.2);
  const revR = box(0.16, 3.0, 0.5, MAT.wood); revR.position.set(1.07, 1.5, -0.2);
  const revT = box(2.3, 0.16, 0.5, MAT.wood); revT.position.set(0, 2.92, -0.2);
  doorG.add(revL, revR, revT);
  /* through the opened doors you see the entrance hall itself, and fly into it */
  const hallMat = new THREE.MeshBasicMaterial({ color: 0x1c130c, toneMapped: false });
  hallMat.userData.bright = true;   /* the hall should read clearly, not dimly */
  (portalUsers.hub = portalUsers.hub || []).push(hallMat);
  const hallView = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.9), hallMat);
  hallView.position.set(0, 1.45, -0.38);
  hallView.userData.enter = true;   /* tapping the view walks you in */
  doorG.add(hallView);
  const doorMat = MAT.wood;
  function doorPanel(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * -1.06, 0, 0.1);
    const panel = new THREE.Group();
    const body = box(1.04, 2.86, 0.09, doorMat);
    body.position.set(side * 0.53, 1.45, 0);
    panel.add(body);
    /* recessed panel mouldings */
    [[0.62, 0.72], [1.45, 0.72], [2.28, 0.72]].forEach((pm) => {
      const mo = box(0.78, pm[1], 0.03, MAT.woodLight);
      mo.position.set(side * 0.53, pm[0], 0.055);
      panel.add(mo);
      const inner = box(0.68, pm[1] - 0.1, 0.03, doorMat);
      inner.position.set(side * 0.53, pm[0], 0.062);
      panel.add(inner);
    });
    /* brass studs */
    for (let ry = 0; ry < 3; ry++) for (let rx = 0; rx < 3; rx++) {
      const st = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), MAT.brass);
      st.position.set(side * (0.22 + rx * 0.3), 0.62 + ry * 0.83, 0.075);
      panel.add(st);
    }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), MAT.brass);
    knob.position.set(side * 0.97, 1.42, 0.09);
    panel.add(knob);
    panel.userData = { type: "enter" };
    panel.traverse((o) => (o.userData.enter = true));
    pivot.add(panel);
    return pivot;
  }
  const dl = doorPanel(1), dr = doorPanel(-1);
  doorG.add(dl, dr);
  EXT.doors.left = dl; EXT.doors.right = dr;
  H.add(doorG);
  /* threshold glow light */
  const doorLight = new THREE.PointLight(0xffb066, 1.1, 7, 2);
  doorLight.position.set(0, 2.2, 1.0);
  H.add(doorLight);

  /* ---- windows ---- */
  function windowUnit(x, target) {
    const w = new THREE.Group();
    w.position.set(x, 1.5, 0.05);
    const frame = box(2.15, 2.3, 0.42, MAT.wood); frame.position.y = 1.1; frame.position.z = -0.1;
    const glowP = new THREE.Mesh(new THREE.PlaneGeometry(1.86, 2.0),
      new THREE.MeshBasicMaterial({ color: 0xffbf70 }));
    glowP.position.set(0, 1.1, -0.28);
    /* slatted shutters slightly ajar */
    [-0.51, 0.51].forEach((sx, i) => {
      const sh = new THREE.Group();
      sh.position.set(sx * 1.86 / 1.86 * 0.93, 1.1, -0.05);
      const sf = box(0.9, 1.98, 0.05, MAT.wood);
      sh.add(sf);
      for (let s = 0; s < 9; s++) {
        const slat = box(0.78, 0.09, 0.03, MAT.woodLight);
        slat.position.set(0, -0.85 + s * 0.21, 0.045);
        slat.rotation.x = 0.5;
        sh.add(slat);
      }
      sh.rotation.y = (i === 0 ? 1 : -1) * 0.5;
      w.add(sh);
    });
    const sill = box(2.4, 0.13, 0.55, MAT.wood); sill.position.set(0, -0.06, 0.05);
    const cano = slope(2.9, 2.3, 0.8, 0.55); cano.position.set(0, 2.42, 0.5);
    w.add(frame, glowP, sill, cano);
    const wl = new THREE.PointLight(0xffa050, 0.65, 5, 2);
    wl.position.set(0, 1.2, 0.7);
    w.add(wl);
    w.traverse((o) => (o.userData.win = target));
    return w;
  }
  H.add(windowUnit(-5.4, "about"));
  H.add(windowUnit(5.4, "hello"));

  /* hanging brass lamp in the porch */
  const lampG = new THREE.Group();
  const chain = box(0.02, 0.9, 0.02, MAT.brass); chain.position.y = 2.95;
  const bowl = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.22, 12, 1, true), MAT.brass);
  bowl.rotation.x = Math.PI; bowl.position.y = 2.42;
  const fl = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 8), MAT.flame);
  fl.position.y = 2.6; fl.userData.flame = true;
  const flGlow = new THREE.Sprite(MAT.glow.clone());
  flGlow.scale.set(1.1, 1.1, 1); flGlow.position.y = 2.62;
  lampG.add(chain, bowl, fl, flGlow);
  lampG.position.set(0, 0, 1.5);
  H.add(lampG);
  EXT.flames.push(fl);

  /* two floor oil lamps flanking the steps */
  [-1.9, 1.9].forEach((x) => {
    const g2 = new THREE.Group();
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.8, 8), MAT.brass);
    st.position.y = 0.4;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.05, 0.07, 10), MAT.brass);
    cup.position.y = 0.82;
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.13, 8), MAT.flame);
    f2.position.y = 0.92; f2.userData.flame = true;
    const s2 = new THREE.Sprite(MAT.glow.clone()); s2.scale.set(0.9, 0.9, 1); s2.position.y = 0.93;
    const pl = new THREE.PointLight(0xffa050, 0.5, 4, 2); pl.position.y = 1.0;
    g2.add(st, cup, f2, s2, pl);
    g2.position.set(x, 0, 2.6);
    S.add(g2);
    EXT.flames.push(f2);
  });

  S.add(H);

  /* palm silhouettes */
  const palmMat = new THREE.MeshBasicMaterial({ map: TEX.palm, transparent: true, side: THREE.DoubleSide, fog: false });
  [[-16, 20, -14], [-24, 26, -6], [19, 24, -12], [26, 30, 2], [-30, 22, 6], [14, 18, -18]].forEach((p, i) => {
    const h2 = p[1] * 0.7;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(h2 * 0.67, h2), palmMat);
    m.position.set(p[0], h2 / 2 - 0.2, p[2]);
    m.rotation.y = (i % 2 ? -0.3 : 0.25);
    S.add(m);
  });

  /* fireflies */
  {
    const n = 26, geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 34;
      pos[i * 3 + 1] = 0.4 + Math.random() * 2.4;
      pos[i * 3 + 2] = -2 + Math.random() * 16;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    EXT.fireflies = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xcaff70, size: 0.07, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    S.add(EXT.fireflies);
  }

  /* dusk lighting */
  S.add(new THREE.HemisphereLight(0x503a66, 0x1c1210, 0.5));
  const warm = new THREE.DirectionalLight(0xff9860, 0.55);
  warm.position.set(-14, 8, -30);
  S.add(warm);
  const moon = new THREE.DirectionalLight(0x8fa8d8, 0.32);
  moon.position.set(10, 22, 18);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.left = -16; moon.shadow.camera.right = 16;
  moon.shadow.camera.top = 16; moon.shadow.camera.bottom = -16;
  S.add(moon);

  /* 3D anchors for the HTML labels */
  EXT.anchors.door = new THREE.Vector3(0, 0.65, 2.4);
  EXT.anchors.about = new THREE.Vector3(-5.4, 0.75, 1.2);
  EXT.anchors.hello = new THREE.Vector3(5.4, 0.75, 1.2);
}

/* ═══════════════════════════ INTERIOR SPACES ══════════════════════════════ */
function pictureLight(w) {
  const g = new THREE.Group();
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.34, 6), MAT.brass);
  rod.rotation.x = 0.75; rod.position.set(0, 0.13, 0.10);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, Math.min(w * 0.6, 0.8), 8, 1, true), MAT.brass);
  shade.rotation.z = Math.PI / 2; shade.position.set(0, 0.26, 0.20);
  g.add(rod, shade);
  return g;
}

function makeFramedPhoto(roomKey, it, x, cy, z, rotY) {
  const { p, w, h } = it;
  const grp = new THREE.Group();
  grp.position.set(x, cy, z);
  grp.rotation.y = rotY;

  /* soft drop shadow behind the frame */
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.55, h + 0.55), MAT.shadowDecal);
  sh.position.set(0.02, -0.03, 0.012);
  /* warm pool of light washing down the wall */
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(w + 1.3, h + 1.7), MAT.pool);
  pool.position.set(0, 0.34, 0.006);

  const frame = box(w + 0.18, h + 0.18, 0.075, MAT.wood);
  frame.position.z = 0.038;
  const lip = box(w + 0.07, h + 0.07, 0.055, MAT.woodLight);
  lip.position.z = 0.058;
  const matte = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.05, h + 0.05), MAT.matte);
  matte.position.z = 0.088;
  const mat = new THREE.MeshBasicMaterial({ color: 0x14100d });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  photo.position.z = 0.092;
  photo.userData = { type: "photo", def: p, w, h };

  const plight = pictureLight(w);
  plight.position.set(0, h / 2 + 0.16, 0.05);

  const plq = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.15),
    new THREE.MeshBasicMaterial({
      map: labelTex([{ text: p.title, font: "26px Georgia", color: "#e8d3a4", y: 0.54 }], 256, 64, { bg: "#1d1006" })
    })
  );
  plq.position.set(0, -h / 2 - 0.24, 0.03);

  grp.add(sh, pool, frame, lip, matte, photo, plight, plq);
  photoMats[roomKey].push({ mat, def: p, mesh: photo });
  return grp;
}

/* ── small framed prints hanging from the hall ceiling, stirring gently ── */
const HANGING = [];
function buildHangingPhotos(g) {
  const picks = PHOTOS.slice().sort(() => Math.random() - 0.5).slice(0, 16);
  const spots = [];
  let guard = 0;
  while (spots.length < picks.length && guard++ < 500) {
    const a = Math.random() * Math.PI * 2;
    const r = 3.4 + Math.random() * 4.1;
    const x = Math.sin(a) * r, z = -Math.cos(a) * r;
    if (spots.some((s) => Math.hypot(s[0] - x, s[1] - z) < 1.5)) continue;
    spots.push([x, z]);
  }
  let pending = 0;
  picks.forEach((p, i) => {
    if (!spots[i]) return;
    let w = 0.34 + Math.random() * 0.3;      /* small frames only */
    let h = w / p.r;
    if (h > 0.85) { h = 0.85; w = h * p.r; }
    const drop = 0.7 + Math.random() * 0.8;  /* a few feet below the ceiling */
    const anchor = new THREE.Group();
    anchor.position.set(spots[i][0], WALL_H, spots[i][1]);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, drop, 4), MAT.brass);
    wire.position.y = -drop / 2;
    anchor.add(wire);
    const fg = new THREE.Group();
    fg.position.y = -drop - h / 2 - 0.04;
    const frame = box(w + 0.07, h + 0.07, 0.028, MAT.wood);
    const pm = new THREE.MeshBasicMaterial({ color: 0x1a1512 });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), pm);
    front.position.z = 0.016;
    front.userData = { type: "photo", def: p, w, h };
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), pm);
    back.rotation.y = Math.PI; back.position.z = -0.016;
    back.userData = { type: "photo", def: p, w, h };
    fg.add(frame, front, back);
    const baseY = Math.random() * Math.PI * 2;
    fg.rotation.y = baseY;
    anchor.add(fg);
    g.add(anchor);
    pending++;
    texLoader.load("assets/thumb/" + p.id + ".jpg", (tx) => {
      tx.encoding = THREE.sRGBEncoding;
      tx.anisotropy = 4;
      pm.map = tx; pm.color.set(0xffffff); pm.needsUpdate = true;
      if (--pending === 0) setTimeout(() => capturePortal("hub"), 120);
    }, undefined, () => { pending--; });
    HANGING.push({
      anchor, fg, baseY,
      f1: 0.22 + Math.random() * 0.2, f2: 0.11 + Math.random() * 0.14,
      p1: Math.random() * 9, p2: Math.random() * 9,
      amp: 0.018 + Math.random() * 0.03
    });
  });
}

function buildHub() {
  const R = 10.4, AP = R * Math.cos(Math.PI / 8), SIDE = 2 * R * Math.sin(Math.PI / 8);
  const g = new THREE.Group();

  const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 1.6, 32), MAT.floor.clone());
  floor.material.map = TEX.floor.map.clone();
  floor.material.map.repeat.set(9, 9);
  floor.material.map.wrapS = floor.material.map.wrapT = THREE.RepeatWrapping;
  floor.material.map.needsUpdate = true;
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);

  /* ceiling with square skylight (nadumuttam) */
  const shape = new THREE.Shape();
  shape.absarc(0, 0, R + 1.6, 0, Math.PI * 2);
  const hole = new THREE.Path();
  const HS = 1.9;
  hole.moveTo(-HS, -HS); hole.lineTo(HS, -HS); hole.lineTo(HS, HS); hole.lineTo(-HS, HS); hole.closePath();
  shape.holes.push(hole);
  const ceil = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), MAT.ceil);
  ceil.rotation.x = Math.PI / 2; ceil.position.y = WALL_H;
  g.add(ceil);
  /* sky glow above the opening */
  const skyP = new THREE.Mesh(new THREE.PlaneGeometry(HS * 2.4, HS * 2.4),
    new THREE.MeshBasicMaterial({ color: 0x4a5f9e }));
  skyP.rotation.x = Math.PI / 2; skyP.position.y = WALL_H + 0.9;
  g.add(skyP);
  /* skylight curb */
  [[0, -HS], [0, HS], [-HS, 0], [HS, 0]].forEach((p, i) => {
    const c = box(i < 2 ? HS * 2 + 0.3 : 0.3, 0.34, 0.3, MAT.wood);
    c.position.set(p[0], WALL_H + 0.05, p[1]);
    if (i >= 2) c.rotation.y = Math.PI / 2;
    g.add(c);
  });
  /* faint light shaft */
  const shaftTex = (() => {
    const c = mkCanvas(64, 256), x = c.getContext("2d");
    const gg = x.createLinearGradient(0, 0, 0, 256);
    gg.addColorStop(0, "rgba(150,180,255,.18)"); gg.addColorStop(1, "rgba(150,180,255,0)");
    x.fillStyle = gg; x.fillRect(0, 0, 64, 256);
    return tex(c);
  })();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(HS * 0.85, HS * 1.35, WALL_H, 4, 1, true),
    new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  shaft.position.y = WALL_H / 2; shaft.rotation.y = Math.PI / 4;
  g.add(shaft);

  const doors = [];
  ROOM_ORDER.forEach((key, i) => {
    const a = i * Math.PI / 4;
    const wall = new THREE.Group();
    wall.position.set(AP * Math.sin(a), 0, -AP * Math.cos(a));
    wall.rotation.y = -a;
    wall.add(wallSegments(SIDE + 0.7, [{ x: 0, w: 1.7, h: 2.95 }], MAT.plaster));
    wall.add(makeDoorway(key, 1.7, 2.95, ROOMS[key].name, ROOMS[key].tag));
    const cor = box(SIDE + 0.7, 0.17, 0.42, MAT.wood); cor.position.set(0, WALL_H - 0.28, 0.02); wall.add(cor);
    const sk = box(SIDE + 0.7, 0.26, 0.42, MAT.wood); sk.position.set(0, 0.13, 0.02); wall.add(sk);
    const p1 = turnedPillar(WALL_H); p1.position.set(-SIDE / 2 - 0.12, 0, 0.4); wall.add(p1);
    g.add(wall);
    doors.push({
      x: (AP - 1.15) * Math.sin(a), z: -(AP - 1.15) * Math.cos(a), r: 1.2, target: key,
      px: AP * Math.sin(a), pz: -AP * Math.cos(a), dx: Math.sin(a), dz: -Math.cos(a)
    });
  });

  /* central dais + nilavilakku */
  const daisMat = MAT.laterite.clone();
  daisMat.color = new THREE.Color(0x6e3d26);
  daisMat.roughness = 1.0;
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.7, 0.24, 28), daisMat);
  dais.position.y = 0.12; dais.castShadow = true; dais.receiveShadow = true;
  g.add(dais);
  const dsh = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), MAT.shadowDecal);
  dsh.rotation.x = -Math.PI / 2; dsh.position.y = 0.015;
  g.add(dsh);
  const lampG = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.10, 1.5, 12), MAT.brass);
  stem.position.y = 0.95; lampG.add(stem);
  [0.72, 1.14, 1.55].forEach((y, i) => {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.40 - i * 0.10, 0.46 - i * 0.10, 0.055, 20), MAT.brass);
    disc.position.y = y; lampG.add(disc);
  });
  const fl = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.2, 8), MAT.flame);
  fl.position.y = 1.80; fl.userData.flame = true; lampG.add(fl);
  const gl = new THREE.Sprite(MAT.glow.clone()); gl.scale.set(1.5, 1.5, 1); gl.position.y = 1.82;
  lampG.add(gl);
  lampG.position.y = 0.24;
  g.add(lampG);

  /* lights */
  const skyLight = new THREE.SpotLight(0x9fb4e8, 0.9, 26, 0.62, 0.9, 1.4);
  skyLight.position.set(0, WALL_H + 1.6, 0);
  skyLight.target.position.set(0, 0, 0);
  skyLight.castShadow = true;
  skyLight.shadow.mapSize.set(1024, 1024);
  skyLight.shadow.bias = -0.0004;
  g.add(skyLight, skyLight.target);
  const lampLight = new THREE.PointLight(0xffb668, 1.0, 15, 1.8);
  lampLight.position.set(0, 2.4, 0);
  g.add(lampLight);
  const fillL = new THREE.PointLight(0xffd9a8, 0.45, 30, 1.9);
  fillL.position.set(0, 4.2, 5.5);
  g.add(fillL);
  g.add(new THREE.AmbientLight(0xffe2c0, 0.16));

  /* welcome sign floating above the lamp (double-sided pair) */
  const signMat = new THREE.MeshBasicMaterial({
    map: labelTex([
      { text: "T H E   E N T R A N C E   H A L L", font: "34px Georgia", color: "#f0d9a4", y: 0.3 },
      { text: "eight doors, eight kinds of moments — step through any of them", font: "italic 20px Georgia", color: "#bb9a63", y: 0.66 }
    ], 1024, 200, { bg: "#1c0f06" }), transparent: false
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.72), signMat);
  sign.position.set(0, 2.6, 0.02);
  g.add(sign);
  const sign2 = sign.clone(); sign2.rotation.y = Math.PI; sign2.position.z = -0.02;
  g.add(sign2);

  /* ring of contact shadow at wall base */
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const st = new THREE.Mesh(new THREE.PlaneGeometry(SIDE, 0.55), MAT.aoStrip);
    st.rotation.x = -Math.PI / 2; st.rotation.z = -a + Math.PI;
    st.position.set((AP - 0.3) * Math.sin(a), 0.014, -(AP - 0.3) * Math.cos(a));
    g.add(st);
  }

  buildHangingPhotos(g);
  g.add(dustField(R * 1.5, R * 1.5, WALL_H, 200));
  sceneInt.add(g);
  g.visible = false;

  SPACES.hub = {
    key: "hub", group: g, doors,
    clampCircle: { r: AP - 0.9 },
    spawn: { x: 0, z: 6.6, yaw: 0 }
  };
}

function buildRoom(key, idx) {
  const defs = byRoom[key] || [];
  const cx = ROOM_GAP * (idx + 1);
  const hue = new THREE.Color(ROOMS[key].hue);

  const items = defs.map((p) => {
    let w = Math.sqrt(2.5 * p.r);
    w = clamp(w, 1.0, 2.7);
    return { p, w, h: w / p.r };
  });
  const GAPX = 0.95;
  const total = items.reduce((s, it) => s + it.w + GAPX, 0);
  let W = clamp(total * 0.42 + 5, 21, 34);
  let D = clamp((total * 0.58) / 2 + 5, 14, 26);
  const usable = (W - 3.4) + 2 * (D - 3.4);
  const scale = Math.min(1, usable / total);
  items.forEach((it) => { it.w *= scale; it.h *= scale; });

  const g = new THREE.Group();
  g.position.set(cx, 0, 0);

  const fmat = MAT.floor.clone();
  fmat.map = TEX.floor.map.clone();
  fmat.map.wrapS = fmat.map.wrapT = THREE.RepeatWrapping;
  fmat.map.repeat.set(W / 2.4, D / 2.4);
  fmat.map.needsUpdate = true;
  fmat.normalMap = TEX.floor.normalMap.clone();
  fmat.normalMap.wrapS = fmat.normalMap.wrapT = THREE.RepeatWrapping;
  fmat.normalMap.repeat.set(W / 2.4, D / 2.4);
  fmat.normalMap.needsUpdate = true;
  fmat.roughnessMap = TEX.floor.roughnessMap.clone();
  fmat.roughnessMap.wrapS = fmat.roughnessMap.wrapT = THREE.RepeatWrapping;
  fmat.roughnessMap.repeat.set(W / 2.4, D / 2.4);
  fmat.roughnessMap.needsUpdate = true;
  fmat.color = hue.clone().lerp(new THREE.Color(0xffffff), 0.66);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), fmat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), MAT.ceil);
  ceil.rotation.x = Math.PI / 2; ceil.position.y = WALL_H;
  g.add(ceil);
  /* beams */
  const nb = Math.max(3, Math.round(D / 3.2));
  for (let i = 0; i < nb; i++) {
    const z = -D / 2 + (i + 0.5) * (D / nb);
    const b = box(W, 0.24, 0.3, MAT.wood);
    b.position.set(0, WALL_H - 0.12, z);
    g.add(b);
  }
  const spine = box(0.36, 0.3, D, MAT.wood);
  spine.position.set(0, WALL_H - 0.15, 0);
  g.add(spine);

  /* north wall: doorways to everywhere */
  const others = ROOM_ORDER.filter((k) => k !== key);
  const doorList = ["hub"].concat(others);
  const slotW = (W - 2.4) / doorList.length;
  const doorDefs = doorList.map((t, i) => ({
    x: -(W - 2.4) / 2 + (i + 0.5) * slotW, w: 1.34, h: 2.6, target: t
  }));
  const north = new THREE.Group();
  north.position.set(0, 0, -D / 2);
  north.add(wallSegments(W, doorDefs, MAT.plaster));
  const zones = [];
  doorDefs.forEach((d) => {
    const label = d.target === "hub" ? "Entrance Hall" : ROOMS[d.target].name;
    const dw = makeDoorway(d.target, d.w, d.h, label, null);
    dw.position.x = d.x;
    north.add(dw);
    zones.push({
      x: cx + d.x, z: -D / 2 + 1.0, r: 1.05, target: d.target,
      px: cx + d.x, pz: -D / 2, dx: 0, dz: -1
    });
  });
  g.add(north);

  /* photo walls + trim */
  const walls = [
    { len: W, pos: [0, 0, D / 2], rotY: Math.PI },
    { len: D, pos: [-W / 2, 0, 0], rotY: Math.PI / 2 },
    { len: D, pos: [W / 2, 0, 0], rotY: -Math.PI / 2 }
  ];
  walls.forEach((wd) => {
    const m = box(wd.len + 0.4, WALL_H, 0.36, MAT.plaster);
    m.position.set(wd.pos[0], WALL_H / 2, wd.pos[2]);
    m.rotation.y = wd.rotY;
    m.receiveShadow = true;
    g.add(m);
    const rail = box(wd.len + 0.44, 0.08, 0.4, MAT.wood);
    rail.position.set(wd.pos[0], 0.94, wd.pos[2]); rail.rotation.y = wd.rotY;
    const skirt = box(wd.len + 0.44, 0.28, 0.42, MAT.wood);
    skirt.position.set(wd.pos[0], 0.14, wd.pos[2]); skirt.rotation.y = wd.rotY;
    const cornice = box(wd.len + 0.44, 0.17, 0.44, MAT.wood);
    cornice.position.set(wd.pos[0], WALL_H - 0.28, wd.pos[2]); cornice.rotation.y = wd.rotY;
    g.add(rail, skirt, cornice);
  });
  g.add(aoStrips(W, D));

  /* corner pillars */
  [[-W / 2 + 0.5, -D / 2 + 0.5], [W / 2 - 0.5, -D / 2 + 0.5],
   [-W / 2 + 0.5, D / 2 - 0.5], [W / 2 - 0.5, D / 2 - 0.5]].forEach((c) => {
    const p = turnedPillar(WALL_H); p.position.set(c[0], 0, c[1]); g.add(p);
    const psh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), MAT.shadowDecal);
    psh.rotation.x = -Math.PI / 2; psh.position.set(c[0], 0.013, c[1]);
    g.add(psh);
  });

  /* room title on the far (south) wall */
  const title = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 1.1),
    new THREE.MeshBasicMaterial({
      map: labelTex([
        { text: ROOMS[key].name.toUpperCase(), font: "62px Georgia", color: "#f3ddac", y: 0.38 },
        { text: ROOMS[key].tag, font: "italic 30px Georgia", color: "#b3925c", y: 0.78 }
      ], 1536, 256), transparent: true
    })
  );
  title.position.set(0, WALL_H - 0.95, D / 2 - 0.23);
  title.rotation.y = Math.PI;
  g.add(title);

  /* hang photographs */
  photoMats[key] = [];
  const queues = [[], [], []];
  const caps = [W - 3.4, D - 3.4, D - 3.4];
  const used = [0, 0, 0];
  let wi = 0;
  items.forEach((it) => {
    let tries = 0;
    while (used[wi] + it.w + GAPX > caps[wi] && tries < 3) { wi = (wi + 1) % 3; tries++; }
    queues[wi].push(it); used[wi] += it.w + GAPX;
    wi = (wi + 1) % 3;
  });
  const wallGeom = [
    { origin: new THREE.Vector3(0, 0, D / 2 - 0.20), dir: new THREE.Vector3(-1, 0, 0), rotY: Math.PI },
    { origin: new THREE.Vector3(-W / 2 + 0.20, 0, 0), dir: new THREE.Vector3(0, 0, -1), rotY: Math.PI / 2 },
    { origin: new THREE.Vector3(W / 2 - 0.20, 0, 0), dir: new THREE.Vector3(0, 0, 1), rotY: -Math.PI / 2 }
  ];
  queues.forEach((q, qi) => {
    if (!q.length) return;
    const wg = wallGeom[qi];
    const tw = q.reduce((s, it) => s + it.w, 0) + GAPX * (q.length - 1);
    let cursor = -tw / 2;
    q.forEach((it) => {
      const centerAlong = cursor + it.w / 2;
      cursor += it.w + GAPX;
      /* every frame hangs from the same baseline */
      const cy = 1.18 + it.h / 2;
      const pos = wg.origin.clone().add(wg.dir.clone().multiplyScalar(centerAlong));
      g.add(makeFramedPhoto(key, it, pos.x, cy, pos.z, wg.rotY));
    });
  });

  /* lights: one shadow spot + warm fills */
  const spot = new THREE.SpotLight(0xffe0b0, 0.85, 40, 0.9, 0.9, 1.5);
  spot.position.set(0, WALL_H - 0.4, 0);
  spot.target.position.set(0, 0, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0004;
  g.add(spot, spot.target);
  const f1 = new THREE.PointLight(0xffd9a4, 0.65, Math.max(W, D) * 1.5, 1.8);
  f1.position.set(-W / 4, WALL_H - 1, 0);
  const f2 = new THREE.PointLight(0xffd9a4, 0.65, Math.max(W, D) * 1.5, 1.8);
  f2.position.set(W / 4, WALL_H - 1, 0);
  const f3 = new THREE.PointLight(0xffc98a, 0.4, 28, 1.9);
  f3.position.set(0, 3, -D / 2 + 2.2);
  g.add(f1, f2, f3);
  g.add(new THREE.AmbientLight(0xffe2c0, 0.15));

  /* benches */
  const b1 = bench(2.4); b1.position.set(0, 0, D * 0.15); b1.rotation.y = Math.PI / 2;
  g.add(b1);
  if (W > 26) { const b2 = bench(2.4); b2.position.set(0, 0, -D * 0.12); b2.rotation.y = Math.PI / 2; g.add(b2); }

  g.add(dustField(W, D, WALL_H, 240));
  sceneInt.add(g);
  g.visible = false;

  SPACES[key] = {
    key, group: g, doors: zones,
    bounds: { minX: cx - W / 2 + 0.85, maxX: cx + W / 2 - 0.85, minZ: -D / 2 + 0.8, maxZ: D / 2 - 0.85 },
    spawn: { x: 0, z: -D / 2 + 2.8, yaw: Math.PI, cx }
  };
}

/* ───────────────────── lazy photo texture load/unload ───────────────────── */
function loadRoomTextures(key) {
  let batch = 0;
  const done = () => {
    batch--;
    /* refresh this room's door-portraits once the fade-in has finished */
    if (batch === 0) setTimeout(() => capturePortal(key), 650);
  };
  (photoMats[key] || []).forEach((rec) => {
    if (rec.mat.map || rec.loading) return;
    rec.loading = true;
    batch++;
    loadCount++; updateLoadRing();
    texLoader.load("assets/mid/" + rec.def.id + ".jpg", (t) => {
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = 8;
      rec.mat.map = t;
      rec.mat.needsUpdate = true;
      rec.loading = false;
      tween(500, (k) => rec.mat.color.setScalar(0.08 + 0.92 * k));
      loadCount--; updateLoadRing();
      done();
    }, undefined, () => { rec.loading = false; loadCount--; updateLoadRing(); done(); });
  });
}
function unloadRoomTextures(key) {
  (photoMats[key] || []).forEach((rec) => {
    if (rec.mat.map) {
      rec.mat.map.dispose();
      rec.mat.map = null;
      rec.mat.color.set(0x14100d);
      rec.mat.needsUpdate = true;
    }
  });
}
function updateLoadRing() { $("#loadRing").classList.toggle("on", loadCount > 0); }

/* ═══════════════════════════ MOVEMENT & INPUT ═════════════════════════════ */
const move = {
  yawV: 0, pitch: 0, yaw: 0, speed: 0, targetPitch: 0,
  mouseX: 0.5, mouseY: 0.5, keys: {}, bobT: 0, touchWalk: 0,
  joyX: 0, joyY: 0,
  pointerIn: true, extDolly: 10.5
};
const ray = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();
let hover = null, downPos = null;

function addEvents() {
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  addEventListener("mousemove", (e) => {
    move.mouseX = e.clientX / innerWidth;
    move.mouseY = e.clientY / innerHeight;
    move.pointerIn = true;
    mouseNDC.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const cur = $("#cursor"), lab = $("#cursorLabel");
    cur.style.left = e.clientX + "px"; cur.style.top = e.clientY + "px";
    lab.style.left = e.clientX + "px"; lab.style.top = e.clientY + "px";
  });
  document.addEventListener("mouseleave", () => { move.pointerIn = false; });
  document.addEventListener("mouseenter", () => { move.pointerIn = true; });

  addEventListener("wheel", (e) => {
    if (inputLocked || uiOpen()) return;
    const d = e.deltaMode === 1 ? e.deltaY * 24 : e.deltaY;
    if (mode === "int") {
      move.speed += -d * 0.0042;   /* scroll up = walk forward */
      move.speed = clamp(move.speed, -4.6, 4.6);
    } else {
      move.extDolly = clamp(move.extDolly + d * 0.008, 5.6, 13.5);   /* scroll up = step closer */
    }
  }, { passive: true });

  addEventListener("keydown", (e) => {
    move.keys[e.key.toLowerCase()] = true;
    if (e.key === "Escape") { closeLightbox(); closeAllOverlays(); }
  });
  addEventListener("keyup", (e) => { move.keys[e.key.toLowerCase()] = false; });

  renderer.domElement.addEventListener("pointerdown", (e) => { downPos = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!downPos) return;
    const dx = e.clientX - downPos[0], dy = e.clientY - downPos[1];
    downPos = null;
    if (dx * dx + dy * dy > 64 || inputLocked || uiOpen()) return;
    mouseNDC.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    castHover();
    if (mode === "ext") {
      if (hover) {
        const u = hover.userData;
        if (u.enter) enterGallery();
        else if (u.win === "about") openOverlay("aboutOverlay");
        else if (u.win === "hello") openOverlay("connectOverlay");
      }
      return;
    }
    if (hover) {
      if (hover.userData.type === "photo") openLightbox(hover);
      else if (hover.userData.type === "door") flyDoor(hover.userData.target);
    }
  });

  /* touch: drag to look, buttons to walk */
  let lastT = null;
  renderer.domElement.addEventListener("touchstart", (e) => { lastT = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
  renderer.domElement.addEventListener("touchmove", (e) => {
    if (!lastT || inputLocked) return;
    const t = e.touches[0];
    /* natural grab: swipe right pans the view left, in sync with the finger */
    move.yaw += (t.clientX - lastT[0]) * 0.0042;
    if (mode === "ext") move.yaw = clamp(move.yaw, -0.62, 0.62);
    move.targetPitch = clamp(move.targetPitch + (t.clientY - lastT[1]) * 0.002, -0.5, 0.5);
    lastT = [t.clientX, t.clientY];
  }, { passive: true });
  renderer.domElement.addEventListener("touchend", () => { lastT = null; }, { passive: true });
  /* virtual joystick: up/down = walk, left/right = turn */
  const joy = $("#joy"), knob = $("#joyKnob");
  const JR = 42;
  let joyId = null, joyCX = 0, joyCY = 0;
  const setKnob = (dx, dy) => {
    knob.style.transform = "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px))";
  };
  joy.addEventListener("pointerdown", (e) => {
    joyId = e.pointerId;
    joy.classList.add("active");
    const r = joy.getBoundingClientRect();
    joyCX = r.left + r.width / 2; joyCY = r.top + r.height / 2;
    try { joy.setPointerCapture(joyId); } catch (_) { /* synthetic pointers can't be captured */ }
    e.preventDefault();
  });
  joy.addEventListener("pointermove", (e) => {
    if (e.pointerId !== joyId) return;
    let dx = e.clientX - joyCX, dy = e.clientY - joyCY;
    const d = Math.hypot(dx, dy) || 1;
    if (d > JR) { dx = dx / d * JR; dy = dy / d * JR; }
    setKnob(dx, dy);
    move.joyX = dx / JR;
    move.joyY = dy / JR;
  });
  const joyEnd = (e) => {
    if (e.pointerId !== joyId) return;
    joyId = null;
    joy.classList.remove("active");
    setKnob(0, 0);
    move.joyX = 0; move.joyY = 0;
  };
  joy.addEventListener("pointerup", joyEnd);
  joy.addEventListener("pointercancel", joyEnd);

  if (COARSE_ONLY) {
    $("#hudHint").innerHTML = "joystick: push up to walk, sideways to turn &nbsp;·&nbsp; drag the view to look &nbsp;·&nbsp; tap photos &amp; doors";
    $("#lHint").innerHTML = "joystick: look around &amp; step closer &nbsp;·&nbsp; tap the door to enter, the windows to peek";
  }
}

function uiOpen() {
  return $("#lightbox").classList.contains("on") || document.querySelector(".overlay.on") !== null;
}

function castHover() {
  const root = mode === "ext" ? sceneExt : (current && current.group);
  if (!root) { hover = null; return; }
  ray.setFromCamera(mouseNDC, camera);
  const hits = ray.intersectObjects(root.children || [root], true);
  hover = null;
  for (const h of hits) {
    const u = h.object.userData || {};
    if (u.dust) continue;
    if (mode === "ext") {
      if (u.enter || u.win) { hover = h.object; break; }
      break;
    }
    if (u.type === "photo" || u.type === "door") { hover = h.object; break; }
    if (h.object.material === MAT.pool || h.object.material === MAT.shadowDecal || h.object.material === MAT.aoStrip) continue;
    break;
  }
  const cur = $("#cursor"), lab = $("#cursorLabel");
  if (mode === "ext") {
    renderer.domElement.style.cursor = hover ? "pointer" : "default";
    return;
  }
  if (hover && !uiOpen()) {
    cur.classList.add("hot");
    const u = hover.userData;
    lab.textContent = u.type === "photo" ? u.def.title : "→ " + (u.target === "hub" ? "Entrance Hall" : ROOMS[u.target].name);
    lab.classList.add("on");
  } else {
    cur.classList.remove("hot");
    lab.classList.remove("on");
  }
}

/* ═══════════════════════════ SPACE TRAVEL ═════════════════════════════════ */
function fadeCurtain(on, slow) {
  const f = $("#fade");
  f.classList.toggle("slow", !!slow);
  f.classList.toggle("on", on);
  return delay(slow ? 1150 : 480);
}
/* swap visible space + place the camera at the arrival door of `key` */
function placeArrival(key, prev, glide) {
  const target = SPACES[key];
  if (prev) prev.group.visible = false;
  current = target;
  target.group.visible = true;

  if (key === "hub") {
    let s = target.spawn;
    if (prev && prev.key !== "hub") {
      /* step out of the hub door that belongs to the room we came from */
      const i = ROOM_ORDER.indexOf(prev.key);
      const a = i * Math.PI / 4, R2 = 10.4 * Math.cos(Math.PI / 8) - 1.6;
      s = { x: R2 * Math.sin(a), z: -R2 * Math.cos(a), yaw: Math.PI - a };
    }
    camera.position.set(s.x, EYE, s.z);
    move.yaw = s.yaw;
  } else if (glide && prev) {
    /* arrive through the door in `key` that leads back to where we came from */
    const back = target.doors.find((d) => d.target === prev.key) || target.doors[0];
    camera.position.set(back.x, EYE, back.z + 0.35);
    move.yaw = Math.PI;
  } else {
    const s = target.spawn;
    camera.position.set(s.cx + s.x, EYE, s.z);
    move.yaw = s.yaw;
  }
  move.pitch = 0; move.targetPitch = 0; move.yawV = 0;
  move.speed = glide ? 2.7 : 0;                 /* keep the momentum through the door */
  camera.rotation.set(0, move.yaw, 0);
  zoneArmed = false;                            /* don't re-trigger the door we arrived through */

  if (prev && prev.key !== "hub") unloadRoomTextures(prev.key);
  if (key !== "hub") loadRoomTextures(key);

  const hr = $("#hudRoom");
  hr.classList.remove("show");
  setTimeout(() => {
    $("#hudRoomName").textContent = key === "hub" ? "The Entrance Hall" : ROOMS[key].name;
    $("#hudRoomTag").textContent = key === "hub" ? SITE.subtitle : ROOMS[key].tag;
    hr.classList.add("show");
  }, 300);
  buildMapCards();
}

async function goSpace(key, instant) {
  const target = SPACES[key];
  if (!target || (current && current.key === key)) return;
  inputLocked = true;
  if (!instant) await fadeCurtain(true);
  placeArrival(key, current, false);
  await fadeCurtain(false);
  inputLocked = false;
}

/* fly swiftly through a door and come out the other side */
let flying = false;
let zoneArmed = true;
async function flyDoor(targetKey) {
  if (flying) return;
  const zone = current && current.doors.find((d) => d.target === targetKey);
  if (!zone) return goSpace(targetKey);
  flying = true; inputLocked = true;

  const start = camera.position.clone();
  const end = new THREE.Vector3(zone.px + zone.dx * 0.8, EYE, zone.pz + zone.dz * 0.8);
  const startYaw = move.yaw, startPitch = move.pitch;
  const endYaw = Math.atan2(-zone.dx, -zone.dz);
  let dyaw = endYaw - startYaw;
  while (dyaw > Math.PI) dyaw -= Math.PI * 2;
  while (dyaw < -Math.PI) dyaw += Math.PI * 2;

  const dist = start.distanceTo(end);
  const dur = clamp(dist * 200, 700, 1500);
  const fadeEl = $("#fade");
  fadeEl.classList.add("fast");
  setTimeout(() => fadeEl.classList.add("on"), Math.max(0, dur - 180));

  await new Promise((res) => {
    tween(dur, (k) => {
      const e = k * k * (0.55 + 0.45 * k);            /* accelerate into the door */
      camera.position.lerpVectors(start, end, e);
      camera.position.y = EYE;
      move.yaw = startYaw + dyaw * Math.min(1, k * 2.1);
      move.pitch = startPitch * Math.max(0, 1 - k * 2.1);
      camera.rotation.y = move.yaw;
      camera.rotation.x = move.pitch;
      camera.fov = 62 + 10 * k * k;                    /* subtle speed rush */
      camera.updateProjectionMatrix();
    }, (t) => t, res);
  });

  placeArrival(targetKey, current, true);
  await delay(30);                                     /* one frame in the new room */
  fadeEl.classList.remove("on");
  await delay(190);
  fadeEl.classList.remove("fast");
  inputLocked = false;
  flying = false;
}

/* ════════════════════════════ MAIN LOOP ═══════════════════════════════════ */
let hintTimer = 0;
const _sway = { a: Math.random() * 9, b: Math.random() * 9 };

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  stepTweens(now);
  const t = now * 0.001;

  /* handheld micro-sway (the "someone is filming" feel) */
  const swayY = (Math.sin(t * 0.53 + _sway.a) + Math.sin(t * 0.31 + _sway.b) * 0.6) * 0.0035;
  const swayP = (Math.sin(t * 0.42 + _sway.b) + Math.sin(t * 0.23 + _sway.a) * 0.7) * 0.0028;

  if (mode === "ext" && !inputLocked && !uiOpen()) {
    /* limited look-around + scroll dolly outside */
    if (HAS_FINE && move.pointerIn && !move.joyX && !move.joyY) {
      const dx = move.mouseX - 0.5, dy = move.mouseY - 0.5;
      move.yaw += ((-dx * 0.42) - move.yaw) * Math.min(1, dt * 3.2);
      move.targetPitch = -dy * 0.22 + 0.02;
    }
    /* joystick outside: left/right looks across the facade, up/down walks nearer/farther */
    if (move.joyX) move.yaw = clamp(move.yaw - move.joyX * Math.abs(move.joyX) * dt * 1.3, -0.62, 0.62);
    if (move.joyY) move.extDolly = clamp(move.extDolly + move.joyY * dt * 4.2, 5.6, 13.5);
    move.pitch += (move.targetPitch - move.pitch) * Math.min(1, dt * 3.2);
    const dz = move.extDolly - camera.position.z;
    camera.position.z += dz * Math.min(1, dt * 3);
    camera.position.x += (move.yaw * -2.2 - camera.position.x) * Math.min(1, dt * 2);
    camera.position.y = EYE + Math.sin(t * 0.5) * 0.012;
    camera.rotation.y = move.yaw + swayY;
    camera.rotation.x = move.pitch + swayP;
    if (HAS_FINE) castHover();
    placeLabels();
  }

  if (mode === "int" && current && !inputLocked && !uiOpen()) {
    if (HAS_FINE && move.pointerIn) {
      const dx = move.mouseX - 0.5;
      const dzn = Math.abs(dx) < 0.08 ? 0 : (dx - Math.sign(dx) * 0.08) / 0.42;
      move.yawV += (-dzn * Math.abs(dzn) * 1.75 - move.yawV) * Math.min(1, dt * 7);
      move.yaw += move.yawV * dt;
      const dy = move.mouseY - 0.5;
      const pz = Math.abs(dy) < 0.12 ? 0 : (dy - Math.sign(dy) * 0.12) / 0.38;
      move.targetPitch = -pz * 0.42;
    } else if (HAS_FINE) {
      move.yawV *= Math.pow(0.05, dt);
      move.yaw += move.yawV * dt;
    }
    move.pitch += (move.targetPitch - move.pitch) * Math.min(1, dt * 5);

    let key = 0;
    if (move.keys["w"] || move.keys["arrowup"]) key = 1;
    if (move.keys["s"] || move.keys["arrowdown"]) key = -1;
    if (move.keys["a"] || move.keys["arrowleft"]) move.yaw += dt * 1.7;
    if (move.keys["d"] || move.keys["arrowright"]) move.yaw -= dt * 1.7;
    /* joystick: X turns (quadratic for fine control near centre), Y walks */
    if (move.joyX) move.yaw -= move.joyX * Math.abs(move.joyX) * dt * 2.3;
    const drive = key || move.touchWalk || -move.joyY * 1.25;
    if (drive) move.speed += (drive * 3.1 - move.speed) * Math.min(1, dt * 5);
    move.speed *= Math.pow(0.24, dt);
    if (Math.abs(move.speed) < 0.01) move.speed = 0;

    const fx = -Math.sin(move.yaw), fz = -Math.cos(move.yaw);
    const nx = camera.position.x + fx * move.speed * dt;
    const nz = camera.position.z + fz * move.speed * dt;
    let px = nx, pz2 = nz;
    if (current.key === "hub") {
      const r = Math.hypot(nx, nz), max = current.clampCircle.r;
      if (r > max) { px = nx / r * max; pz2 = nz / r * max; }
    } else {
      const b = current.bounds;
      px = clamp(nx, b.minX, b.maxX);
      pz2 = clamp(nz, b.minZ, b.maxZ);
    }
    camera.position.x = px; camera.position.z = pz2;

    let inZone = false;
    for (const d of current.doors) {
      if (Math.hypot(px - d.x, pz2 - d.z) < d.r) {
        inZone = true;
        if (zoneArmed) flyDoor(d.target);
        break;
      }
    }
    if (!inZone) zoneArmed = true;

    move.bobT += dt * (2 + Math.abs(move.speed) * 2.2);
    const bobA = Math.min(1, Math.abs(move.speed) / 3) * 0.026;
    camera.position.y = EYE + Math.sin(move.bobT * 3.1) * bobA;
    const targetFov = 62 + Math.min(1, Math.abs(move.speed) / 4.2) * 5;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
    camera.updateProjectionMatrix();

    camera.rotation.y = move.yaw + swayY;
    camera.rotation.x = move.pitch + swayP;

    if (HAS_FINE) castHover();
  }

  /* ambient animation */
  const root = mode === "ext" ? sceneExt : (current && current.group);
  if (root) {
    root.traverse((o) => {
      if (o.userData.dust) o.rotation.y += dt * 0.01;
      if (o.userData.flame) {
        o.scale.y = 1 + Math.sin(now * 0.011 + o.id) * 0.22;
        o.scale.x = 1 + Math.sin(now * 0.017 + o.id) * 0.1;
      }
    });
  }
  /* the hanging frames sway and twirl in an imperceptible breeze */
  if (mode === "int" && current && current.key === "hub") {
    for (const hg of HANGING) {
      hg.anchor.rotation.x = Math.sin(t * hg.f1 + hg.p1) * hg.amp;
      hg.anchor.rotation.z = Math.sin(t * hg.f2 + hg.p2) * hg.amp * 1.35;
      hg.fg.rotation.y = hg.baseY + Math.sin(t * 0.16 + hg.p2) * 0.55;
    }
  }

  if (mode === "ext" && EXT.fireflies) {
    EXT.fireflies.material.opacity = 0.55 + Math.sin(t * 2.2) * 0.35;
    EXT.fireflies.position.y = Math.sin(t * 0.5) * 0.3;
    EXT.fireflies.position.x = Math.sin(t * 0.23) * 0.8;
  }

  if (mode === "int" && hintTimer < 26) {
    hintTimer += dt;
    if (hintTimer >= 26) $("#hudHint").classList.add("hide");
  }
  renderer.render(mode === "ext" ? sceneExt : sceneInt, camera);
}

/* project 3D anchors → HTML label positions */
function placeLabels() {
  const map = [["hsDoor", "door"], ["hsAbout", "about"], ["hsHello", "hello"]];
  map.forEach(([id, key]) => {
    const el = $("#" + id);
    const v = EXT.anchors[key].clone().project(camera);
    if (v.z > 1) { el.classList.remove("on"); return; }
    el.classList.add("on");
    el.style.left = ((v.x + 1) / 2 * innerWidth) + "px";
    el.style.top = ((1 - v.y) / 2 * innerHeight) + "px";
  });
}

/* ═══════════════════════════ ENTER / EXIT ═════════════════════════════════ */
let entering = false;
async function enterGallery() {
  if (entering || mode !== "ext") return;
  entering = true;
  inputLocked = true;
  $("#landing").classList.add("entering");

  /* swing the doors open ahead of you */
  tween(1500, (k) => {
    EXT.doors.left.rotation.y = -1.92 * k;
    EXT.doors.right.rotation.y = 1.92 * k;
  }, easeIO);

  /* fly through the open door — the hall is visible beyond it the whole way */
  const sx = camera.position.x, sz = camera.position.z;
  const sy0 = move.yaw, sp0 = move.pitch;
  const dur = 2100;
  const fadeEl = $("#fade");
  fadeEl.classList.add("fast");
  setTimeout(() => fadeEl.classList.add("on"), dur - 170);
  await new Promise((res) => {
    tween(dur, (k) => {
      const e = k * k * (0.55 + 0.45 * k);          /* accelerate into the doorway */
      camera.position.x = lerp(sx, 0, Math.min(1, k * 1.6));
      camera.position.z = lerp(sz, -0.15, e);
      camera.position.y = EYE;
      move.yaw = lerp(sy0, 0, Math.min(1, k * 2));
      move.pitch = lerp(sp0, 0, Math.min(1, k * 2));
      camera.rotation.y = move.yaw;
      camera.rotation.x = move.pitch;
      camera.fov = 62 + 8 * k * k;
      camera.updateProjectionMatrix();
    }, (t) => t, res);
  });

  /* emerge inside the entrance hall, still moving — exactly where the
     door's view of the hall was photographed from */
  mode = "int";
  $("#landing").classList.add("gone");
  $("#hud").classList.add("on");
  if (HAS_FINE) document.body.classList.add("walking");
  camera.fov = 62; camera.updateProjectionMatrix();
  current = SPACES.hub;
  current.group.visible = true;
  camera.position.set(0, EYE, 8.55);
  move.yaw = 0; move.pitch = 0; move.targetPitch = 0; move.yawV = 0;
  move.speed = 2.9;                                  /* glide on into the hall */
  camera.rotation.set(0, 0, 0);
  zoneArmed = false;
  $("#hudRoomName").textContent = "The Entrance Hall";
  $("#hudRoomTag").textContent = SITE.subtitle;
  $("#hudRoom").classList.add("show");
  buildMapCards();
  await delay(30);
  fadeEl.classList.remove("on");
  await delay(190);
  fadeEl.classList.remove("fast");
  inputLocked = false;
  entering = false;
  /* reset the doors quietly for next time */
  EXT.doors.left.rotation.y = 0;
  EXT.doors.right.rotation.y = 0;
}

async function exitToEntrance() {
  await fadeCurtain(true);
  mode = "ext";
  $("#hud").classList.remove("on");
  document.body.classList.remove("walking");
  $("#landing").classList.remove("gone", "entering");
  if (current) { current.group.visible = false; current = null; }
  move.yaw = 0; move.pitch = 0; move.targetPitch = 0; move.extDolly = 10.5;
  camera.position.set(0, EYE, 10.5);
  camera.rotation.set(0, 0, 0);
  await fadeCurtain(false);
  inputLocked = false;
}

/* ═════════════════════════════ LIGHTBOX ═══════════════════════════════════ */
let lbMesh = null;
function meshScreenRect(mesh) {
  const u = mesh.userData;
  const cs = [[-u.w / 2, -u.h / 2], [u.w / 2, -u.h / 2], [-u.w / 2, u.h / 2], [u.w / 2, u.h / 2]];
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  cs.forEach((c) => {
    const v = new THREE.Vector3(c[0], c[1], 0).applyMatrix4(mesh.matrixWorld).project(camera);
    const sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight;
    minX = Math.min(minX, sx); maxX = Math.max(maxX, sx);
    minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
  });
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
function setImgRect(img, r) {
  img.style.left = r.x + "px"; img.style.top = r.y + "px";
  img.style.width = r.w + "px"; img.style.height = r.h + "px";
}
function openLightbox(mesh) {
  lbMesh = mesh;
  const def = mesh.userData.def;
  const lb = $("#lightbox"), img = $("#lbImg");
  img.style.transition = "none";
  img.src = "assets/mid/" + def.id + ".jpg";
  setImgRect(img, meshScreenRect(mesh));
  lb.classList.add("on");
  $("#lbTitle").textContent = def.title;
  $("#lbCap").textContent = def.cap;
  $("#lbRoom").textContent = ROOMS[def.room].name;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    img.style.transition = "";
    lb.classList.add("dim");
    const r = def.r;
    let w = innerWidth * 0.9, h = w / r;
    const maxH = innerHeight * 0.8;
    if (h > maxH) { h = maxH; w = h * r; }
    setImgRect(img, { x: (innerWidth - w) / 2, y: (innerHeight - h) / 2 - innerHeight * 0.02, w, h });
  }));
  const big = new Image();
  big.onload = () => { if (lbMesh === mesh) img.src = big.src; };
  big.src = "assets/img/" + def.id + ".jpg";
}
function closeLightbox() {
  const lb = $("#lightbox"), img = $("#lbImg");
  if (!lb.classList.contains("on")) return;
  lb.classList.remove("dim");
  if (lbMesh) {
    img.src = "assets/mid/" + lbMesh.userData.def.id + ".jpg";
    setImgRect(img, meshScreenRect(lbMesh));
  }
  setTimeout(() => lb.classList.remove("on"), 660);
  lbMesh = null;
}
$("#lbClose").addEventListener("click", closeLightbox);
$("#lightbox").addEventListener("click", (e) => { if (e.target.id === "lightbox") closeLightbox(); });

/* ═══════════════════════ OVERLAYS, MAP, STATIC ════════════════════════════ */
function openOverlay(id) { $("#" + id).classList.add("on"); }
function closeAllOverlays() { document.querySelectorAll(".overlay.on").forEach((o) => o.classList.remove("on")); }
document.querySelectorAll(".overlay-close").forEach((b) =>
  b.addEventListener("click", () => $("#" + b.dataset.close).classList.remove("on")));
document.querySelectorAll(".overlay").forEach((o) =>
  o.addEventListener("click", (e) => { if (e.target === o) o.classList.remove("on"); }));

function buildMapCards() {
  const grid = $("#mapGrid");
  grid.innerHTML = "";
  const mk = (key, name, tag, count) => {
    const b = document.createElement("button");
    b.className = "map-card" + (current && current.key === key ? " here" : "");
    b.style.setProperty("--hue", key === "hub" ? "#c9922e" : ROOMS[key].hue);
    b.innerHTML = `<b>${name}${current && current.key === key ? " <u>· you are here</u>" : ""}</b><i>${tag}${count ? " · " + count + " frames" : ""}</i>`;
    b.addEventListener("click", () => { closeAllOverlays(); goSpace(key); });
    grid.appendChild(b);
  };
  mk("hub", "The Entrance Hall", "where every door begins", 0);
  ROOM_ORDER.forEach((k) => mk(k, ROOMS[k].name, ROOMS[k].tag, (byRoom[k] || []).length));
}

function fillStaticContent() {
  $("#aboutText").innerHTML = SITE.about.map((p) => `<p>${p}</p>`).join("");
  $("#socialLinks").innerHTML = SITE.socials.map((s) =>
    `<a href="${s.url}" target="_blank" rel="noopener"><span class="ic">${s.icon}</span>${s.name}</a>`).join("");
}

$("#btnMap").addEventListener("click", () => { buildMapCards(); openOverlay("mapOverlay"); });
$("#btnAbout2").addEventListener("click", () => openOverlay("aboutOverlay"));
$("#btnConnect2").addEventListener("click", () => openOverlay("connectOverlay"));
$("#btnExit").addEventListener("click", exitToEntrance);
$("#hsDoor").addEventListener("click", enterGallery);
$("#hsAbout").addEventListener("click", () => openOverlay("aboutOverlay"));
$("#hsHello").addEventListener("click", () => openOverlay("connectOverlay"));

/* ═══════════════════════════════ BOOT ═════════════════════════════════════ */
async function boot() {
  fillStaticContent();
  document.title = SITE.title + " — " + SITE.subtitle;
  await delay(60);   // let the boot screen paint
  initRenderer();
  buildTextures();
  buildMaterials();
  buildExterior();
  buildHub();
  ROOM_ORDER.forEach((k, i) => buildRoom(k, i));
  addEvents();
  camera.position.set(0, EYE, move.extDolly);
  camera.rotation.set(0, 0, 0);
  requestAnimationFrame(loop);
  await delay(350);
  $("#boot").classList.add("off");
  inputLocked = false;
  /* first portal captures, staggered so nothing hitches */
  ["hub"].concat(ROOM_ORDER).forEach((k, i) => setTimeout(() => capturePortal(k), 700 + i * 160));
}
boot();

/* small console API — handy for debugging and power users */
window.GALLERY = {
  enter: enterGallery,
  exit: exitToEntrance,
  go: (k) => goSpace(k),
  fly: (k) => flyDoor(k),
  cam: () => camera,
  state: () => ({ mode, room: current && current.key, locked: inputLocked, flying, entering }),
  scene: () => (mode === "ext" ? sceneExt : sceneInt),
  spaces: () => SPACES,
  hover: () => hover,
  move
};

})();
