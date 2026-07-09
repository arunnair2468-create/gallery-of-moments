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
  /* ---- fine white gallery wall ---- */
  {
    const c = mkCanvas(512, 512), x = c.getContext("2d");
    x.fillStyle = "#f0eeea"; x.fillRect(0, 0, 512, 512);
    noiseFill(x, 512, 512, [
      { scale: 16, amp: 0.05 }, { scale: 64, amp: 0.04 }, { scale: 256, amp: 0.035 }
    ]);
    TEX.plaster = { map: tex(c, [2, 1], true), normalMap: tex(heightToNormal(c, 0.5), [2, 1]) };
  }
  /* ---- dark walnut floor planks (the reference-image floor) ---- */
  {
    const S = 512, PW = 128;
    const c = mkCanvas(S, S), x = c.getContext("2d");
    const rough = mkCanvas(S, S), rx = rough.getContext("2d");
    rx.fillStyle = "#5a5a5a"; rx.fillRect(0, 0, S, S);
    for (let col = 0; col < S / PW; col++) {
      const shift = (col % 2) * PW * 1.6;
      for (let row = -1; row < 3; row++) {
        const y0 = row * PW * 2 + shift;
        const v = Math.random() * 18 - 9;
        x.fillStyle = `rgb(${58 + v | 0},${36 + v * 0.7 | 0},${22 + v * 0.5 | 0})`;
        x.fillRect(col * PW, y0, PW, PW * 2);
        /* grain along the plank */
        for (let i = 0; i < 26; i++) {
          const gx = col * PW + 4 + Math.random() * (PW - 8);
          x.strokeStyle = `rgba(${20 + Math.random() * 30 | 0},${14 | 0},${8 | 0},${0.14 + Math.random() * 0.2})`;
          x.lineWidth = 0.6 + Math.random() * 1.4;
          x.beginPath(); x.moveTo(gx, y0 + 2);
          x.bezierCurveTo(gx + 3, y0 + PW * 0.6, gx - 3, y0 + PW * 1.4, gx + 2, y0 + PW * 2 - 2);
          x.stroke();
        }
        /* plank seams */
        x.fillStyle = "rgba(8,5,3,.85)";
        x.fillRect(col * PW, y0, 2, PW * 2);
        x.fillRect(col * PW, y0 + PW * 2 - 2, PW, 2);
        rx.fillStyle = `rgba(${86 + Math.random() * 26 | 0},0,0,1)`;
        rx.fillStyle = `rgb(${86 + Math.random() * 26 | 0},${86 | 0},${86 | 0})`;
        rx.fillRect(col * PW, y0, PW, PW * 2);
      }
    }
    noiseFill(x, S, S, [{ scale: 64, amp: 0.06 }]);
    TEX.wood = {
      map: tex(c, [1, 1], true),
      normalMap: tex(heightToNormal(c, 0.55), [1, 1]),
      roughnessMap: tex(rough, [1, 1])
    };
    TEX.wood.map.wrapS = TEX.wood.map.wrapT = THREE.RepeatWrapping;
    TEX.wood.normalMap.wrapS = TEX.wood.normalMap.wrapT = THREE.RepeatWrapping;
    TEX.wood.roughnessMap.wrapS = TEX.wood.roughnessMap.wrapT = THREE.RepeatWrapping;
  }
  /* ---- light oak floor planks ---- */
  {
    const S = 512, PW = 128;
    const c = mkCanvas(S, S), x = c.getContext("2d");
    const rough = mkCanvas(S, S), rx = rough.getContext("2d");
    rx.fillStyle = "#7e7e7e"; rx.fillRect(0, 0, S, S);
    for (let col = 0; col < S / PW; col++) {
      const shift = (col % 2) * PW * 1.6;
      for (let row = -1; row < 3; row++) {
        const y0 = row * PW * 2 + shift;
        const v = Math.random() * 22 - 11;
        x.fillStyle = `rgb(${198 + v | 0},${164 + v * 0.8 | 0},${118 + v * 0.6 | 0})`;
        x.fillRect(col * PW, y0, PW, PW * 2);
        for (let i = 0; i < 20; i++) {
          const gx = col * PW + 4 + Math.random() * (PW - 8);
          x.strokeStyle = `rgba(${150 + Math.random() * 40 | 0},${112 | 0},${70 | 0},${0.16 + Math.random() * 0.2})`;
          x.lineWidth = 0.6 + Math.random() * 1.2;
          x.beginPath(); x.moveTo(gx, y0 + 2);
          x.bezierCurveTo(gx + 3, y0 + PW * 0.6, gx - 3, y0 + PW * 1.4, gx + 2, y0 + PW * 2 - 2);
          x.stroke();
        }
        x.fillStyle = "rgba(120,92,58,.7)";
        x.fillRect(col * PW, y0, 1.6, PW * 2);
        x.fillRect(col * PW, y0 + PW * 2 - 1.6, PW, 1.6);
        rx.fillStyle = `rgb(${112 + Math.random() * 26 | 0},${112 | 0},${112 | 0})`;
        rx.fillRect(col * PW, y0, PW, PW * 2);
      }
    }
    noiseFill(x, S, S, [{ scale: 64, amp: 0.05 }]);
    TEX.floor = {
      map: tex(c, [1, 1], true),
      normalMap: tex(heightToNormal(c, 0.45), [1, 1]),
      roughnessMap: tex(rough, [1, 1])
    };
    ["map", "normalMap", "roughnessMap"].forEach((k) => {
      TEX.floor[k].wrapS = TEX.floor[k].wrapT = THREE.RepeatWrapping;
    });
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
    ctx.strokeStyle = "rgba(140,140,140,.4)"; ctx.lineWidth = 3;
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
  /* modern exhibition palette: white walls, walnut & oak floors, black steel, aluminium */
  MAT.plaster = new THREE.MeshStandardMaterial({
    map: TEX.plaster.map, normalMap: TEX.plaster.normalMap,
    normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.96, metalness: 0, envMapIntensity: 0.3
  });
  MAT.wood = new THREE.MeshStandardMaterial({          /* dark glossy walnut planks */
    map: TEX.wood.map, normalMap: TEX.wood.normalMap, roughnessMap: TEX.wood.roughnessMap,
    normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.38, metalness: 0.02, envMapIntensity: 1.1
  });
  MAT.woodLight = new THREE.MeshStandardMaterial({     /* matte black steel */
    color: 0x161616, roughness: 0.55, metalness: 0.6, envMapIntensity: 0.55
  });
  MAT.floor = new THREE.MeshStandardMaterial({         /* light oak planks */
    map: TEX.floor.map, normalMap: TEX.floor.normalMap, roughnessMap: TEX.floor.roughnessMap,
    normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.5, metalness: 0.02, envMapIntensity: 0.7
  });
  MAT.ceil = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });
  MAT.roof = MAT.ceil;
  MAT.ground = MAT.ceil;
  MAT.laterite = new THREE.MeshStandardMaterial({      /* raw concrete */
    map: TEX.plaster.map, color: 0x9d9a94, roughness: 0.6, envMapIntensity: 0.4,
    normalMap: TEX.plaster.normalMap, normalScale: new THREE.Vector2(0.2, 0.2)
  });
  MAT.brass = new THREE.MeshStandardMaterial({         /* brushed aluminium */
    color: 0xc9cccf, roughness: 0.34, metalness: 0.92, envMapIntensity: 1.2
  });
  MAT.flame = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  MAT.matte = new THREE.MeshStandardMaterial({ color: 0xf7f6f3, roughness: 0.92, envMapIntensity: 0.25 });
  MAT.recess = new THREE.MeshBasicMaterial({ map: TEX.doorGlow });
  MAT.pool = new THREE.MeshBasicMaterial({
    map: TEX.pool, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.42
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
    m.color.set(m.userData.bright ? 0xe6e5e2 : 0xb4b2ae);
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
  mk(0xffffff, 6, 3, 0, 4.5, 0, 0, Math.PI / 2);     // luminous ceiling
  mk(0xe8e8e8, 3, 2, -5, 2.4, 0, Math.PI / 2, 0);    // bright side
  mk(0x6a6a6a, 4, 2.4, 5, 2.2, 0, -Math.PI / 2, 0);  // dim side
  mk(0x4a3c30, 8, 8, 0, -2, 0, 0, -Math.PI / 2);     // walnut floor bounce
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
    color: 0xffffff, size: 0.014, transparent: true, opacity: 0.2,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  pts.userData.dust = true;
  return pts;
}

function makeDoorway(targetKey, dw, dh, label, tag, style) {
  const g = new THREE.Group();
  const dark = style && style.dark;
  /* minimal black metal portal frame, proud of both wall faces */
  const jamb = new THREE.BoxGeometry(0.1, dh + 0.1, 0.56);
  const l = new THREE.Mesh(jamb, MAT.woodLight); l.position.set(-dw / 2 - 0.05, dh / 2, 0);
  const r = new THREE.Mesh(jamb, MAT.woodLight); r.position.set(dw / 2 + 0.05, dh / 2, 0);
  /* signage band above the opening, exhibition-style */
  const band = box(dw + 0.7, 0.62, 0.5, MAT.woodLight);
  band.position.set(0, dh + 0.33, 0);
  const fs = label.length > 14 ? "44px" : "54px";
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(dw + 0.56, 0.5),
    new THREE.MeshBasicMaterial({
      map: tag ? labelTex([{ text: label.toUpperCase(), font: "600 " + fs + " 'Segoe UI'", color: "#f2f2f2", y: 0.4 },
                           { text: tag.toUpperCase(), font: "26px 'Segoe UI'", color: "#9a9a9a", y: 0.78 }], 768, 200)
               : labelTex([{ text: label.toUpperCase(), font: "600 " + fs + " 'Segoe UI'", color: "#f2f2f2", y: 0.58 }], 768, 200),
      transparent: true
    })
  );
  sign.position.set(0, dh + 0.33, 0.26);
  /* casing lining the opening — masks the portal edges */
  const caseL = box(0.06, dh, 0.56, MAT.woodLight); caseL.position.set(-dw / 2 + 0.03, dh / 2, 0);
  const caseR = box(0.06, dh, 0.56, MAT.woodLight); caseR.position.set(dw / 2 - 0.03, dh / 2, 0);
  const caseT = box(dw, 0.06, 0.56, MAT.woodLight); caseT.position.set(0, dh - 0.03, 0);
  /* the portal: a live view of the room beyond this door */
  const pmat = new THREE.MeshBasicMaterial({ color: dark ? 0x101010 : 0x1c1c1c, toneMapped: false });
  (portalUsers[targetKey] = portalUsers[targetKey] || []).push(pmat);
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), pmat);
  portal.position.set(0, dh / 2, -0.29);
  g.add(l, r, band, sign, caseL, caseR, caseT, portal);
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
  /* ── the LOBBY: a bright modern reception hall in front of the main hall ── */
  const S = sceneExt;
  S.background = new THREE.Color(0x0a0a0a);
  const LW = 16, LD = 30, LH = 4.6;

  /* polished concrete floor */
  const fmat = new THREE.MeshStandardMaterial({
    map: TEX.plaster.map, color: 0xa8a5a0, roughness: 0.42, envMapIntensity: 0.55,
    normalMap: TEX.plaster.normalMap, normalScale: new THREE.Vector2(0.12, 0.12)
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(LW, LD), fmat);
  floor.rotation.x = -Math.PI / 2; floor.position.z = LD / 2 - 1;
  floor.receiveShadow = true;
  S.add(floor);

  /* walls */
  const front = wallSegments(LW, [{ x: 0, w: 3.4, h: 3.05 }], MAT.plaster, LH);
  S.add(front);
  const sideL = box(0.36, LH, LD, MAT.plaster); sideL.position.set(-LW / 2 + 0.18, LH / 2, LD / 2 - 1); S.add(sideL);
  const sideR = sideL.clone(); sideR.position.x = LW / 2 - 0.18; S.add(sideR);
  const backW = box(LW, LH, 0.36, MAT.plaster); backW.position.set(0, LH / 2, LD - 1.2); S.add(backW);
  /* shadow-gap black skirting */
  [[0, 0.02, 0], [0, 0.02, 0]].forEach(() => {});
  const skirtF = box(LW, 0.09, 0.4, MAT.woodLight); skirtF.position.set(0, 0.045, 0.02); S.add(skirtF);
  const skirtL = box(0.4, 0.09, LD, MAT.woodLight); skirtL.position.set(-LW / 2 + 0.2, 0.045, LD / 2 - 1); S.add(skirtL);
  const skirtR = skirtL.clone(); skirtR.position.x = LW / 2 - 0.2; S.add(skirtR);

  /* luminous ceiling */
  S.add(lumCeiling(LW, LD, LH, 0xffffff, LD / 2 - 1));

  /* exhibition title on the front wall, big vinyl lettering */
  const title = new THREE.Mesh(
    new THREE.PlaneGeometry(7.6, 1.9),
    new THREE.MeshBasicMaterial({
      map: labelTex([
        { text: "THE GALLERY", font: "600 92px 'Segoe UI'", color: "#181818", y: 0.30 },
        { text: "OF MOMENTS", font: "600 92px 'Segoe UI'", color: "#181818", y: 0.62 },
        { text: "A  P H O T O G R A P H Y  E X H I B I T I O N  —  1 2 2  F R A M E S  F R O M  I N D I A", font: "26px 'Segoe UI'", color: "#6b6b6b", y: 0.88 }
      ], 1600, 400), transparent: true
    })
  );
  title.position.set(-4.1, 2.6, 0.20);
  S.add(title);

  /* glass entrance doors with black metal frames */
  const doorG = new THREE.Group();
  doorG.position.set(0, 0, 0.05);
  const caseM = MAT.woodLight;
  const cL = box(0.12, 3.05, 0.5, caseM); cL.position.set(-1.72, 1.525, -0.15);
  const cR = box(0.12, 3.05, 0.5, caseM); cR.position.set(1.72, 1.525, -0.15);
  const cT = box(3.6, 0.12, 0.5, caseM); cT.position.set(0, 3.04, -0.15);
  doorG.add(cL, cR, cT);
  /* the view into the main hall — what you fly into */
  const hallMat = new THREE.MeshBasicMaterial({ color: 0x141414, toneMapped: false });
  hallMat.userData.bright = true;
  (portalUsers.hub = portalUsers.hub || []).push(hallMat);
  const hallView = new THREE.Mesh(new THREE.PlaneGeometry(3.35, 2.98), hallMat);
  hallView.position.set(0, 1.5, -0.34);
  hallView.userData.enter = true;
  doorG.add(hallView);

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xcfe0e4, transparent: true, opacity: 0.16, roughness: 0.05,
    metalness: 0.1, envMapIntensity: 1.4, depthWrite: false
  });
  function glassDoor(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * -1.66, 0, 0.02);
    const panel = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 2.86), glassMat);
    glass.position.set(side * 0.81, 1.47, 0);
    const fT = box(1.62, 0.07, 0.05, caseM); fT.position.set(side * 0.81, 2.92, 0);
    const fB = box(1.62, 0.16, 0.05, caseM); fB.position.set(side * 0.81, 0.1, 0);
    const fS = box(0.06, 2.9, 0.05, caseM); fS.position.set(side * 1.6, 1.47, 0);
    const handle = box(0.035, 1.1, 0.035, caseM); handle.position.set(side * 0.18, 1.45, 0.07);
    panel.add(glass, fT, fB, fS, handle);
    panel.traverse((o) => (o.userData.enter = true));
    pivot.add(panel);
    return pivot;
  }
  const dl = glassDoor(1), dr = glassDoor(-1);
  doorG.add(dl, dr);
  EXT.doors.left = dl; EXT.doors.right = dr;
  S.add(doorG);

  /* wall panels: ABOUT (left wall) and CONTACT (right wall) */
  function wallPoster(x, ry, target, big, small) {
    const g = new THREE.Group();
    const back = box(2.5, 1.7, 0.06, MAT.woodLight);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(2.36, 1.56),
      new THREE.MeshBasicMaterial({
        map: labelTex([
          { text: big, font: "600 64px 'Segoe UI'", color: "#181818", y: 0.42 },
          { text: small, font: "30px 'Segoe UI'", color: "#7a7a7a", y: 0.72 }
        ], 1024, 680, { bg: "#f4f2ee" })
      })
    );
    face.position.z = 0.035;
    g.add(back, face);
    g.position.set(x, 1.85, 6.4);
    g.rotation.y = ry;
    g.traverse((o) => (o.userData.win = target));
    S.add(g);
  }
  wallPoster(-LW / 2 + 0.42, Math.PI / 2, "about", "ABOUT THE", "PHOTOGRAPHER");
  wallPoster(LW / 2 - 0.42, -Math.PI / 2, "hello", "SAY HELLO", "SOCIALS & CONTACT");

  /* a bench and a plinth with the exhibition brochure */
  const b = bench(2.2); b.position.set(-3.6, 0, 7.2); S.add(b);

  /* lighting: bright, even, gallery-clean */
  S.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 0.66));
  S.add(new THREE.AmbientLight(0xffffff, 0.28));
  const key = new THREE.SpotLight(0xfff4e4, 0.6, 30, 1.0, 0.8, 1.6);
  key.position.set(0, LH - 0.2, 6);
  key.target.position.set(0, 0, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  S.add(key, key.target);
  const wash = new THREE.SpotLight(0xffffff, 0.5, 20, 1.1, 0.9, 1.8);
  wash.position.set(-3, LH - 0.4, 5);
  wash.target.position.set(-4.1, 2.4, 0);
  S.add(wash, wash.target);

  S.add(dustField(LW - 2, LD - 4, LH, 120));

  /* 3D anchors for the HTML labels */
  EXT.anchors.door = new THREE.Vector3(0, 0.55, 1.2);
  EXT.anchors.about = new THREE.Vector3(-LW / 2 + 0.6, 0.72, 6.4);
  EXT.anchors.hello = new THREE.Vector3(LW / 2 - 0.6, 0.72, 6.4);
}

/* luminous panel ceiling with black track rails — the modern-gallery signature */
function lumCeiling(w, d, h, tint, zc) {
  const g = new THREE.Group();
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ color: 0xdcdad6 }));
  back.rotation.x = Math.PI / 2; back.position.set(0, h, zc || 0);
  g.add(back);
  const panelM = new THREE.MeshBasicMaterial({ color: tint || 0xffffff });
  const nx = Math.max(2, Math.round(w / 2.6)), nz = Math.max(2, Math.round(d / 2.6));
  for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w / nx - 0.55, d / nz - 0.55), panelM);
    p.rotation.x = Math.PI / 2;
    p.position.set(-w / 2 + (ix + 0.5) * (w / nx), h - 0.02, (zc || 0) - d / 2 + (iz + 0.5) * (d / nz));
    g.add(p);
  }
  /* black track rails with little can spots */
  for (let ix = 1; ix < nx; ix++) {
    const rail = box(0.07, 0.07, d, MAT.woodLight);
    rail.position.set(-w / 2 + ix * (w / nx), h - 0.06, zc || 0);
    g.add(rail);
    for (let s = 0; s < 3; s++) {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 8), MAT.woodLight);
      can.position.set(-w / 2 + ix * (w / nx), h - 0.2, (zc || 0) - d / 2 + (s + 0.5) * (d / 3));
      can.rotation.z = 0.5 * (ix % 2 ? 1 : -1);
      g.add(can);
    }
  }
  return g;
}

/* ═══════════════════════════ INTERIOR SPACES ══════════════════════════════ */
function pictureLight() {
  /* small black track can aimed at the print (dark rooms only) */
  const g = new THREE.Group();
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), MAT.woodLight);
  arm.rotation.x = 1.15; arm.position.set(0, 0.2, 0.13);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.058, 0.15, 10), MAT.woodLight);
  can.rotation.x = 0.85; can.position.set(0, 0.37, 0.26);
  g.add(arm, can);
  return g;
}

function makeFramedPhoto(roomKey, it, x, cy, z, rotY, style) {
  style = style || STYLES[roomKey] || {};
  const { p, w, h } = it;
  const grp = new THREE.Group();
  grp.position.set(x, cy, z);
  grp.rotation.y = rotY;

  /* soft drop shadow behind the frame */
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.5, h + 0.5), MAT.shadowDecal);
  sh.position.set(0.015, -0.025, 0.012);
  grp.add(sh);
  /* pool of spot light washing the wall — only in the dark, theatrical rooms */
  if (style.pool) {
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(w + 1.2, h + 1.6), MAT.pool);
    pool.position.set(0, 0.3, 0.006);
    grp.add(pool);
    const plight = pictureLight();
    plight.position.set(0, h / 2 + 0.14, 0.05);
    grp.add(plight);
  }

  const mat = new THREE.MeshBasicMaterial({ color: 0x14100d });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  photo.userData = { type: "photo", def: p, w, h };

  /* frame per gallery style */
  const F = style.frame || "alu";
  if (F === "alu") {                    /* thin brushed-aluminium gallery frame */
    const fr = box(w + 0.2, h + 0.2, 0.035, MAT.brass); fr.position.z = 0.03;
    const matte = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.17, h + 0.17), MAT.matte);
    matte.position.z = 0.05;
    photo.position.z = 0.053;
    grp.add(fr, matte, photo);
  } else if (F === "float") {           /* frameless print floated off the wall */
    const back = box(w + 0.02, h + 0.02, 0.05, MAT.woodLight); back.position.z = 0.05;
    photo.position.z = 0.078;
    grp.add(back, photo);
  } else if (F === "floatBlack") {      /* deep black box frame, full-bleed */
    const fr = box(w + 0.12, h + 0.12, 0.07, MAT.woodLight); fr.position.z = 0.035;
    photo.position.z = 0.073;
    grp.add(fr, photo);
  } else if (F === "blackWide") {       /* wide black frame + big white matte */
    const fr = box(w + 0.3, h + 0.3, 0.05, MAT.woodLight); fr.position.z = 0.03;
    const matte = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.24, h + 0.24), MAT.matte);
    matte.position.z = 0.058;
    photo.position.z = 0.061;
    grp.add(fr, matte, photo);
  } else if (F === "whiteBox") {        /* deep white shadow-box */
    const fr = box(w + 0.22, h + 0.22, 0.09, MAT.matte); fr.position.z = 0.045;
    photo.position.z = 0.093;
    grp.add(fr, photo);
  } else if (F === "clip") {            /* print clipped to a raw board */
    const board = box(w + 0.06, h + 0.06, 0.022, MAT.matte.clone());
    board.material.color = new THREE.Color(0xd9d4cc);
    board.position.z = 0.03;
    photo.position.z = 0.045;
    grp.add(board, photo);
  } else if (F === "lightbox") {        /* backlit lightbox — the print glows */
    const rim = box(w + 0.14, h + 0.14, 0.1, MAT.woodLight); rim.position.z = 0.04;
    const glowFace = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.1, h + 0.1),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glowFace.position.z = 0.092;
    photo.position.z = 0.096;
    grp.add(rim, glowFace, photo);
  }

  /* caption chip below, exhibition-label style */
  const dark = !!style.dark;
  const plq = new THREE.Mesh(
    new THREE.PlaneGeometry(0.66, 0.15),
    new THREE.MeshBasicMaterial({
      map: labelTex([{ text: p.title, font: "500 30px 'Segoe UI'", color: dark ? "#e8e8e8" : "#2a2a2a", y: 0.56 }], 288, 66),
      transparent: true
    })
  );
  plq.position.set(0, -h / 2 - 0.22, 0.03);
  grp.add(photo, plq);

  photoMats[roomKey].push({ mat, def: p, mesh: photo });
  return grp;
}

function buildHub() {
  /* the MAIN HALL — an octagonal white gallery court with a luminous ceiling */
  const R = 10.4, AP = R * Math.cos(Math.PI / 8), SIDE = 2 * R * Math.sin(Math.PI / 8);
  const g = new THREE.Group();

  /* glossy dark-walnut floor (the reference-image look) */
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 1.6, 32), MAT.wood.clone());
  floor.material.map = TEX.wood.map.clone();
  floor.material.map.repeat.set(7, 7);
  floor.material.map.wrapS = floor.material.map.wrapT = THREE.RepeatWrapping;
  floor.material.map.needsUpdate = true;
  floor.material.roughness = 0.34;
  floor.material.envMapIntensity = 1.1;
  floor.rotation.x = -Math.PI / 2;
  floor.rotation.z = Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);

  /* luminous ceiling disc + panel grid */
  const ceilBack = new THREE.Mesh(new THREE.CircleGeometry(R + 1.6, 32),
    new THREE.MeshBasicMaterial({ color: 0xd8d6d2 }));
  ceilBack.rotation.x = Math.PI / 2; ceilBack.position.y = WALL_H;
  g.add(ceilBack);
  const panelM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let ix = -2; ix <= 2; ix++) for (let iz = -2; iz <= 2; iz++) {
    if (Math.hypot(ix, iz) > 2.5) continue;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), panelM);
    p.rotation.x = Math.PI / 2;
    p.position.set(ix * 2.95, WALL_H - 0.02, iz * 2.95);
    g.add(p);
  }
  /* radial black track rails */
  for (let i = 0; i < 4; i++) {
    const rail = box(0.07, 0.07, (R + 0.8) * 2, MAT.woodLight);
    rail.position.y = WALL_H - 0.07;
    rail.rotation.y = i * Math.PI / 4;
    g.add(rail);
  }

  const doors = [];
  ROOM_ORDER.forEach((key, i) => {
    const a = i * Math.PI / 4;
    const wall = new THREE.Group();
    wall.position.set(AP * Math.sin(a), 0, -AP * Math.cos(a));
    wall.rotation.y = -a;
    wall.add(wallSegments(SIDE + 0.7, [{ x: 0, w: 1.7, h: 2.95 }], MAT.plaster));
    wall.add(makeDoorway(key, 1.7, 2.95, ROOMS[key].name, ROOMS[key].tag));
    const sk = box(SIDE + 0.7, 0.09, 0.42, MAT.woodLight); sk.position.set(0, 0.045, 0.02); wall.add(sk);
    g.add(wall);
    doors.push({
      x: (AP - 1.15) * Math.sin(a), z: -(AP - 1.15) * Math.cos(a), r: 1.2, target: key,
      px: AP * Math.sin(a), pz: -AP * Math.cos(a), dx: Math.sin(a), dz: -Math.cos(a)
    });
  });

  /* central freestanding title panel — like the feature wall of a real show */
  const cp = new THREE.Group();
  const plinth = box(4.3, 0.12, 1.2, MAT.woodLight); plinth.position.y = 0.06; cp.add(plinth);
  const core = box(3.9, 2.75, 0.22, MAT.plaster.clone());
  core.material.color = new THREE.Color(0xf6f4f0);
  core.position.y = 1.5; core.castShadow = true;
  cp.add(core);
  const edge = box(4.0, 2.85, 0.1, MAT.woodLight); edge.position.y = 1.5; cp.add(edge);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 2.4),
    new THREE.MeshBasicMaterial({
      map: labelTex([
        { text: "THE GALLERY OF MOMENTS", font: "600 74px 'Segoe UI'", color: "#181818", y: 0.26 },
        { text: "eight rooms · eight kinds of moments", font: "italic 34px 'Segoe UI'", color: "#8a8a8a", y: 0.46 },
        { text: "Photographed across India — on a DSLR on good days,", font: "30px 'Segoe UI'", color: "#5a5a5a", y: 0.66 },
        { text: "a phone on honest ones. Walk through any doorway.", font: "30px 'Segoe UI'", color: "#5a5a5a", y: 0.78 }
      ], 1500, 1000), transparent: true
    })
  );
  face.position.set(0, 1.55, 0.17);
  cp.add(face);
  const face2 = face.clone(); face2.rotation.y = Math.PI; face2.position.z = -0.17;
  cp.add(face2);
  const csh = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.6), MAT.shadowDecal);
  csh.rotation.x = -Math.PI / 2; csh.position.y = 0.014;
  cp.add(csh);
  g.add(cp);

  /* lights */
  const skyLight = new THREE.SpotLight(0xffffff, 0.7, 26, 0.75, 0.85, 1.5);
  skyLight.position.set(0, WALL_H + 1.2, 0);
  skyLight.target.position.set(0, 0, 0);
  skyLight.castShadow = true;
  skyLight.shadow.mapSize.set(1024, 1024);
  skyLight.shadow.bias = -0.0004;
  g.add(skyLight, skyLight.target);
  g.add(new THREE.HemisphereLight(0xffffff, 0x9a948c, 0.62));
  g.add(new THREE.AmbientLight(0xffffff, 0.22));

  /* ring of contact shadow at wall base */
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const st = new THREE.Mesh(new THREE.PlaneGeometry(SIDE, 0.55), MAT.aoStrip);
    st.rotation.x = -Math.PI / 2; st.rotation.z = -a + Math.PI;
    st.position.set((AP - 0.3) * Math.sin(a), 0.014, -(AP - 0.3) * Math.cos(a));
    g.add(st);
  }

  g.add(dustField(R * 1.5, R * 1.5, WALL_H, 140));
  sceneInt.add(g);
  g.visible = false;

  SPACES.hub = {
    key: "hub", group: g, doors,
    clampCircle: { r: AP - 0.9 },
    obstacles: [{ minX: -2.4, maxX: 2.4, minZ: -1.1, maxZ: 1.1 }],
    spawn: { x: 0, z: 6.6, yaw: 0 }
  };
}

/* every gallery gets its own exhibition design */
const STYLES = {
  aviary:   { wall: 0xf2efe9, floor: "oak",      ceil: "lum",     frame: "alu" },
  wings:    { wall: 0x24272b, floor: "walnut",   ceil: "dark",    frame: "float",      dark: true, pool: true },
  wild:     { wall: 0xe9e6df, floor: "concrete", ceil: "lum",     frame: "floatBlack", panels: true },
  streets:  { wall: 0x37322e, floor: "concrete", ceil: "dark",    frame: "clip",       dark: true, pool: true, warm: true },
  heritage: { wall: 0xcfc8bb, floor: "walnut",   ceil: "lum",     frame: "blackWide" },
  green:    { wall: 0xf2efe9, floor: "oak",      ceil: "lumWarm", frame: "whiteBox" },
  light:    { wall: 0x141414, floor: "gloss",    ceil: "black",   frame: "lightbox",   dark: true },
  longexp:  { wall: 0x171a24, floor: "gloss",    ceil: "dark",    frame: "float",      dark: true, pool: true, neon: 0x4a5cff }
};

function roomFloorMat(style, W, D) {
  if (style.floor === "gloss") {
    return new THREE.MeshStandardMaterial({
      color: 0x0d0d0f, roughness: 0.18, metalness: 0.15, envMapIntensity: 1.3
    });
  }
  if (style.floor === "concrete") {
    const m = new THREE.MeshStandardMaterial({
      map: TEX.plaster.map.clone(), color: 0x9d9a94, roughness: 0.5, envMapIntensity: 0.45,
      normalMap: TEX.plaster.normalMap, normalScale: new THREE.Vector2(0.15, 0.15)
    });
    m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
    m.map.repeat.set(W / 6, D / 6);
    m.map.needsUpdate = true;
    return m;
  }
  const src = style.floor === "walnut" ? TEX.wood : TEX.floor;
  const base = style.floor === "walnut" ? MAT.wood : MAT.floor;
  const m = base.clone();
  m.map = src.map.clone();
  m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
  m.map.repeat.set(W / 3.4, D / 3.4);
  m.map.needsUpdate = true;
  m.roughness = style.floor === "walnut" ? 0.34 : 0.5;
  m.envMapIntensity = style.floor === "walnut" ? 1.1 : 0.7;
  return m;
}

function buildRoom(key, idx) {
  const defs = byRoom[key] || [];
  const style = STYLES[key] || STYLES.aviary;
  const cx = ROOM_GAP * (idx + 1);

  const items = defs.map((p) => {
    let w = Math.sqrt(2.5 * p.r);
    w = clamp(w, 1.0, 2.7);
    return { p, w, h: w / p.r };
  });
  const GAPX = 0.95;
  const total = items.reduce((s, it) => s + it.w + GAPX, 0);
  let W = clamp(total * 0.42 + 5, 21, 34);
  let D = clamp((total * 0.58) / 2 + 5, 14, 26);
  /* rooms with centre panels put ~40% of the photos there, so walls can relax */
  const panelShare = style.panels ? 0.4 : 0;
  const usable = ((W - 3.4) + 2 * (D - 3.4)) / (1 - panelShare);
  const scale = Math.min(1, usable / total);
  items.forEach((it) => { it.w *= scale; it.h *= scale; });

  const g = new THREE.Group();
  g.position.set(cx, 0, 0);
  const obstacles = [];

  /* floor */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), roomFloorMat(style, W, D));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);

  /* walls, tinted per style */
  const wallMat = MAT.plaster.clone();
  wallMat.color = new THREE.Color(style.wall);
  if (style.dark) wallMat.envMapIntensity = 0.1;

  /* ceiling per style */
  if (style.ceil === "lum" || style.ceil === "lumWarm") {
    g.add(lumCeiling(W, D, WALL_H, style.ceil === "lumWarm" ? 0xfff3df : 0xffffff, 0));
  } else {
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D),
      new THREE.MeshStandardMaterial({ color: style.ceil === "black" ? 0x0a0a0a : 0x141414, roughness: 0.95 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = WALL_H;
    g.add(ceil);
    /* technical rails with can spots, like a converted warehouse */
    const nr = Math.max(2, Math.round(D / 5));
    for (let i = 0; i < nr; i++) {
      const z = -D / 2 + (i + 0.5) * (D / nr);
      const rail = box(W - 3, 0.06, 0.06, MAT.woodLight);
      rail.position.set(0, WALL_H - 0.3, z);
      g.add(rail);
    }
  }

  /* north wall: doorways to everywhere */
  const others = ROOM_ORDER.filter((k) => k !== key);
  const doorList = ["hub"].concat(others);
  const slotW = (W - 2.4) / doorList.length;
  const doorDefs = doorList.map((t, i) => ({
    x: -(W - 2.4) / 2 + (i + 0.5) * slotW, w: 1.34, h: 2.6, target: t
  }));
  const north = new THREE.Group();
  north.position.set(0, 0, -D / 2);
  north.add(wallSegments(W, doorDefs, wallMat));
  const zones = [];
  doorDefs.forEach((d) => {
    const label = d.target === "hub" ? "Main Hall" : ROOMS[d.target].name;
    const dw = makeDoorway(d.target, d.w, d.h, label, null, style);
    dw.position.x = d.x;
    north.add(dw);
    zones.push({
      x: cx + d.x, z: -D / 2 + 1.0, r: 1.05, target: d.target,
      px: cx + d.x, pz: -D / 2, dx: 0, dz: -1
    });
  });
  g.add(north);

  /* photo walls + black shadow-gap skirting */
  const walls = [
    { len: W, pos: [0, 0, D / 2], rotY: Math.PI },
    { len: D, pos: [-W / 2, 0, 0], rotY: Math.PI / 2 },
    { len: D, pos: [W / 2, 0, 0], rotY: -Math.PI / 2 }
  ];
  walls.forEach((wd) => {
    const m = box(wd.len + 0.4, WALL_H, 0.36, wallMat);
    m.position.set(wd.pos[0], WALL_H / 2, wd.pos[2]);
    m.rotation.y = wd.rotY;
    m.receiveShadow = true;
    g.add(m);
    const skirt = box(wd.len + 0.44, 0.09, 0.4, MAT.woodLight);
    skirt.position.set(wd.pos[0], 0.045, wd.pos[2]); skirt.rotation.y = wd.rotY;
    g.add(skirt);
  });
  g.add(aoStrips(W, D));

  /* neon accent strip along the wall base (long-exposure room) */
  if (style.neon) {
    const nm = new THREE.MeshBasicMaterial({ color: style.neon });
    walls.forEach((wd) => {
      const strip = box(wd.len - 1, 0.025, 0.02, nm);
      strip.position.set(wd.pos[0], 0.14, wd.pos[2]);
      strip.rotation.y = wd.rotY;
      strip.position.x += Math.sin(wd.rotY) * 0.22;
      strip.position.z += Math.cos(wd.rotY) * 0.22;
      g.add(strip);
    });
  }

  /* room title on the far (south) wall */
  const titleCol = style.dark ? "#f0f0f0" : "#181818";
  const tagCol = style.dark ? "#9a9a9a" : "#8a8a8a";
  const title = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 1.1),
    new THREE.MeshBasicMaterial({
      map: labelTex([
        { text: ROOMS[key].name.toUpperCase(), font: "600 64px 'Segoe UI'", color: titleCol, y: 0.38 },
        { text: ROOMS[key].tag.toUpperCase(), font: "28px 'Segoe UI'", color: tagCol, y: 0.76 }
      ], 1536, 256), transparent: true
    })
  );
  title.position.set(0, WALL_H - 0.95, D / 2 - 0.23);
  title.rotation.y = Math.PI;
  g.add(title);

  /* distribute photographs: centre panels first (if any), then the walls */
  photoMats[key] = [];
  let wallItems = items;
  if (style.panels) {
    const nPanel = Math.round(items.length * panelShare);
    const panelItems = items.slice(items.length - nPanel);
    wallItems = items.slice(0, items.length - nPanel);
    /* freestanding double-sided panels down the middle, reference-image style */
    const rows = Math.ceil(panelItems.length / 2);
    const gapZ = Math.min(5.2, (D - 6) / Math.max(1, rows - 1));
    for (let i = 0; i < rows; i++) {
      const z = -((rows - 1) / 2) * gapZ + i * gapZ;
      const a = panelItems[i * 2], b = panelItems[i * 2 + 1];
      const pw = Math.max(a ? a.w : 0, b ? b.w : 0) + 1.3;
      const panel = new THREE.Group();
      const core = box(pw, 3.15, 0.16, wallMat.clone());
      core.position.y = 1.575; core.castShadow = true;
      panel.add(core);
      const foot = box(pw - 0.3, 0.09, 0.5, MAT.woodLight); foot.position.y = 0.045; panel.add(foot);
      const psh = new THREE.Mesh(new THREE.PlaneGeometry(pw + 1.2, 1.8), MAT.shadowDecal);
      psh.rotation.x = -Math.PI / 2; psh.position.y = 0.013; panel.add(psh);
      if (a) panel.add(framedOnPanel(key, a, 0.085, 0, style));
      if (b) panel.add(framedOnPanel(key, b, -0.085, Math.PI, style));
      panel.position.set(0, 0, z);
      g.add(panel);
      obstacles.push({ minX: -pw / 2, maxX: pw / 2, minZ: z - 0.35, maxZ: z + 0.35 });
    }
  }

  const queues = [[], [], []];
  const caps = [W - 3.4, D - 3.4, D - 3.4];
  const used = [0, 0, 0];
  let wi = 0;
  wallItems.forEach((it) => {
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
      const cy = 1.18 + it.h / 2;
      const pos = wg.origin.clone().add(wg.dir.clone().multiplyScalar(centerAlong));
      g.add(makeFramedPhoto(key, it, pos.x, cy, pos.z, wg.rotY, style));
    });
  });

  /* lights per mood */
  if (style.dark) {
    const spot = new THREE.SpotLight(style.warm ? 0xffe6c4 : 0xffffff, 0.75, 40, 0.95, 0.9, 1.6);
    spot.position.set(0, WALL_H - 0.4, 0);
    spot.target.position.set(0, 0, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0004;
    g.add(spot, spot.target);
    g.add(new THREE.HemisphereLight(0xdadada, 0x1a1a1a, 0.3));
    g.add(new THREE.AmbientLight(style.warm ? 0xffe9cf : 0xf0f2ff, 0.22));
    if (style.neon) {
      const nglow = new THREE.PointLight(style.neon, 0.5, 30, 2);
      nglow.position.set(0, 0.6, 0);
      g.add(nglow);
    }
  } else {
    const spot = new THREE.SpotLight(0xffffff, 0.55, 40, 1.0, 0.9, 1.7);
    spot.position.set(0, WALL_H - 0.3, 0);
    spot.target.position.set(0, 0, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0004;
    g.add(spot, spot.target);
    g.add(new THREE.HemisphereLight(0xffffff, 0x9a948c, 0.6));
    g.add(new THREE.AmbientLight(0xffffff, 0.26));
  }

  /* benches */
  if (!style.panels) {
    const b1 = bench(2.4); b1.position.set(0, 0, D * 0.15); b1.rotation.y = Math.PI / 2;
    g.add(b1);
    obstacles.push({ minX: -0.35, maxX: 0.35, minZ: D * 0.15 - 1.3, maxZ: D * 0.15 + 1.3 });
  }

  g.add(dustField(W, D, WALL_H, style.dark ? 220 : 120));
  sceneInt.add(g);
  g.visible = false;

  SPACES[key] = {
    key, group: g, doors: zones, obstacles,
    bounds: { minX: cx - W / 2 + 0.85, maxX: cx + W / 2 - 0.85, minZ: -D / 2 + 0.8, maxZ: D / 2 - 0.85 },
    spawn: { x: 0, z: -D / 2 + 2.8, yaw: Math.PI, cx }
  };
}

/* helper: hang a framed photo on a freestanding panel face */
function framedOnPanel(roomKey, it, zOff, rotY, style) {
  const f = makeFramedPhoto(roomKey, it, 0, 1.62, 0, rotY, style);
  f.position.z = zOff;
  return f;
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
    texLoader.load("../assets/mid/" + rec.def.id + ".jpg", (t) => {
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
      move.speed += d * 0.0042;
      move.speed = clamp(move.speed, -4.6, 4.6);
    } else {
      move.extDolly = clamp(move.extDolly + d * 0.008, 5.6, 13.5);
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
    move.yaw -= (t.clientX - lastT[0]) * 0.0042;
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
    $("#lHint").innerHTML = "joystick: look around &amp; step closer &nbsp;·&nbsp; tap the doors to enter, the wall panels to read";
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
    lab.textContent = u.type === "photo" ? u.def.title : "→ " + (u.target === "hub" ? "Main Hall" : ROOMS[u.target].name);
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
    $("#hudRoomName").textContent = key === "hub" ? "The Main Hall" : ROOMS[key].name;
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
    /* freestanding panels & benches are solid */
    if (current.obstacles) {
      const PR = 0.42;
      for (const o of current.obstacles) {
        const ox = current.spawn.cx || 0;
        const mnX = o.minX + ox - PR, mxX = o.maxX + ox + PR;
        const mnZ = o.minZ - PR, mxZ = o.maxZ + PR;
        if (px > mnX && px < mxX && pz2 > mnZ && pz2 < mxZ) {
          const d1 = px - mnX, d2 = mxX - px, d3 = pz2 - mnZ, d4 = mxZ - pz2;
          const m = Math.min(d1, d2, d3, d4);
          if (m === d1) px = mnX; else if (m === d2) px = mxX;
          else if (m === d3) pz2 = mnZ; else pz2 = mxZ;
        }
      }
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
  $("#hudRoomName").textContent = "The Main Hall";
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
  img.src = "../assets/mid/" + def.id + ".jpg";
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
  big.src = "../assets/img/" + def.id + ".jpg";
}
function closeLightbox() {
  const lb = $("#lightbox"), img = $("#lbImg");
  if (!lb.classList.contains("on")) return;
  lb.classList.remove("dim");
  if (lbMesh) {
    img.src = "../assets/mid/" + lbMesh.userData.def.id + ".jpg";
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
  mk("hub", "The Main Hall", "where every door begins", 0);
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
  cast: (nx, ny) => { mouseNDC.set(nx, ny); castHover(); return hover && hover.userData; },
  move
};

})();
