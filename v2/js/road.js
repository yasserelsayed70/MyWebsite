// OutRun-style pseudo-3D road, drawn on a 2D canvas.
// The road is a list of short segments; each frame we project the segments in
// front of the camera to the screen, from near to far, then draw roadside
// sprites from far to near so closer ones cover farther ones.

const SEG = 200; // segment length (world units)
const ROAD_W = 2000; // half road width
const CAM_H = 1000; // camera height above the road
const CAM_DEPTH = 1 / Math.tan((100 / 2) * (Math.PI / 180)); // 100° field of view
const DRAW = 200; // segments drawn ahead
const PLAYER_Z = CAM_H * CAM_DEPTH; // distance from camera to the bike
const BLEND = 24; // segments used to blend colours between chapters
const START_LEN = 40;
const RUNOFF = DRAW + 40;

/* ---------- helpers ---------- */

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c, a = 1) => (a === 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);
const easeInOut = (t) => -Math.cos(Math.PI * t) / 2 + 0.5;

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function blendPalette(a, b, t) {
  const out = {};
  for (const k of Object.keys(a)) out[k] = mix(a[k], b[k], t);
  return out;
}

/* ---------- road ---------- */

export class Road {
  constructor(canvas, { road, career, projects }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.chapters = road.map((c) => ({
      ...c,
      job: career.find((j) => j.id === c.career),
      pal: Object.fromEntries(Object.entries(c.palette).map(([k, v]) => [k, hex(v)])),
    }));
    this.projects = projects;
    this.images = {};
    for (const [id, p] of Object.entries(projects)) {
      if (!p.image) continue;
      const img = new Image();
      img.decoding = "async";
      img.src = p.image;
      this.images[id] = img;
    }
    this.position = 0;
    this.skyOffset = 0;
    this.hits = []; // clickable billboard rectangles from the last frame
    this.build();
  }

  build() {
    const segs = (this.segments = []);
    const rand = seeded(7);
    const hill = (i) => Math.sin(i / 38) * 420 + Math.sin(i / 97) * 260;
    const add = (curve, chapter) => {
      const i = segs.length;
      segs.push({
        index: i,
        curve,
        chapter,
        p1: { world: { y: hill(i), z: i * SEG }, camera: {}, screen: {} },
        p2: { world: { y: hill(i + 1), z: (i + 1) * SEG }, camera: {}, screen: {} },
        sprites: [],
      });
    };

    // start straight
    for (let i = 0; i < START_LEN; i++) add(0, 0);
    this.chapterStart = [];
    this.chapters.forEach((ch, ci) => {
      const start = segs.length;
      this.chapterStart.push(start);
      const part = Math.floor(ch.length / ch.curves.length);
      ch.curves.forEach((c) => {
        for (let k = 0; k < part; k++) add(c * Math.sin(Math.PI * (k / part)), ci);
      });
      // chapter gate
      segs[start + 4].sprites.push({ type: "gate", chapter: ci, offset: 0 });
      // billboards, alternating sides
      const n = ch.billboards.length;
      ch.billboards.forEach((id, b) => {
        const at = start + 28 + Math.floor(((ch.length - 50) * b) / Math.max(n, 1));
        segs[at].sprites.push({ type: "billboard", id, chapter: ci, offset: b % 2 ? 1.3 : -1.3 });
      });
      // scenery
      for (let s = start; s < segs.length; s++) {
        if (s % 12 === 0) {
          segs[s].sprites.push({ type: "lamp", chapter: ci, offset: -1.18 });
          segs[s].sprites.push({ type: "lamp", chapter: ci, offset: 1.18 });
        }
        if (ch.scenery === "neon" && s % 6 === 3) {
          segs[s].sprites.push({ type: "pylon", chapter: ci, offset: s % 12 === 3 ? -1.4 : 1.4, hue: s % 24 < 12 ? 0 : 1 });
        }
        if (s % 3 === 0 && !segs[s].sprites.some((sp) => sp.type === "billboard")) {
          const side = rand() < 0.5 ? -1 : 1;
          const offset = side * (2.6 + rand() * 3.5);
          if (ch.scenery === "city" || ch.scenery === "neon") {
            segs[s].sprites.push({ type: "building", chapter: ci, offset, w: 900 + rand() * 1500, h: 2200 + rand() * 4800, seed: Math.floor(rand() * 1e6) });
          } else {
            segs[s].sprites.push({ type: "tree", chapter: ci, offset, h: 1400 + rand() * 1200 });
          }
        }
      }
    });
    // finish line and run-off
    const finish = segs.length + 12;
    for (let i = 0; i < RUNOFF; i++) add(0, this.chapters.length - 1);
    segs[finish].sprites.push({ type: "finish", chapter: this.chapters.length - 1, offset: 0 });
    this.finishIndex = finish;
    this.trackLength = segs.length * SEG;
    this.maxPosition = (finish + 6) * SEG - PLAYER_Z;

    // per-segment colours, blended at chapter boundaries
    for (const seg of segs) {
      const ci = seg.chapter;
      const into = seg.index - (this.chapterStart[ci] ?? 0);
      let pal = this.chapters[ci].pal;
      if (ci > 0 && into < BLEND) pal = blendPalette(this.chapters[ci - 1].pal, pal, into / BLEND);
      seg.pal = pal;
    }
  }

  segmentAt(z) {
    return this.segments[Math.max(0, Math.min(this.segments.length - 1, Math.floor(z / SEG)))];
  }

  /** chapter index, progress within that chapter (0..1) and total progress */
  state(pos = this.position) {
    const seg = this.segmentAt(pos + PLAYER_Z);
    const ci = seg.chapter;
    const start = this.chapterStart[ci];
    const len = this.chapters[ci].length;
    return {
      chapter: seg.index < this.chapterStart[0] ? -1 : ci,
      chapterProgress: Math.max(0, Math.min(1, (seg.index - start) / len)),
      progress: pos / this.maxPosition,
      curve: seg.curve,
    };
  }

  project(p, camX, camY, camZ, w, h) {
    p.camera.x = -camX;
    p.camera.y = p.world.y - camY;
    p.camera.z = p.world.z - camZ;
    p.screen.scale = CAM_DEPTH / p.camera.z;
    p.screen.x = Math.round(w / 2 + p.screen.scale * p.camera.x * this.S);
    p.screen.y = Math.round(h / 2 - p.screen.scale * p.camera.y * this.S);
    p.screen.w = Math.round(p.screen.scale * ROAD_W * this.S);
  }

  /* ---------- drawing ---------- */

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.dpr = dpr;
  }

  render(position, speed = 0) {
    this.resize();
    const { ctx, segments } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    // projection unit: tied to height so ultra-wide screens show more scenery
    // instead of a giant road; narrow (phone) screens fall back to width
    this.S = Math.min(w / 2, h * 0.85);
    this.position = position;

    const base = this.segmentAt(position);
    const basePct = (position % SEG) / SEG;
    const playerSeg = this.segmentAt(position + PLAYER_Z);
    const playerPct = ((position + PLAYER_Z) % SEG) / SEG;
    const playerY = playerSeg.p1.world.y + (playerSeg.p2.world.y - playerSeg.p1.world.y) * playerPct;
    const pal = playerSeg.pal;
    this.skyOffset += playerSeg.curve * speed * 0.00002;

    this.drawSky(w, h, pal, playerSeg);

    // road, near to far
    let x = 0;
    let dx = -(base.curve * basePct);
    let maxy = h;
    for (let n = 0; n < DRAW; n++) {
      const seg = segments[base.index + n];
      if (!seg) break;
      this.project(seg.p1, x, playerY + CAM_H, position, w, h);
      this.project(seg.p2, x + dx, playerY + CAM_H, position, w, h);
      x += dx;
      dx += seg.curve;
      seg.clip = maxy;
      seg.fog = 1 - Math.exp(-((n / DRAW) ** 2) * 4.5);
      if (seg.p1.camera.z <= CAM_DEPTH || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;
      this.drawSegment(seg, w);
      maxy = seg.p2.screen.y;
    }

    // sprites, far to near
    this.hits = [];
    for (let n = DRAW - 1; n > 0; n--) {
      const seg = segments[base.index + n];
      if (!seg || !seg.sprites.length || seg.p1.camera.z <= CAM_DEPTH) continue;
      const scale = seg.p1.screen.scale;
      const k = scale * this.S; // pixels per world unit at this depth
      for (const sp of seg.sprites) {
        const sx = seg.p1.screen.x + k * sp.offset * ROAD_W;
        const sy = seg.p1.screen.y;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, seg.clip);
        ctx.clip();
        this.drawSprite(sp, sx, sy, k, seg.pal, seg.fog);
        ctx.restore();
      }
    }

    this.drawSpeedLines(w, h, speed, pal);
  }

  drawSky(w, h, pal, seg) {
    const { ctx } = this;
    const horizon = h * 0.5;
    const g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, rgb(pal.skyTop));
    g.addColorStop(1, rgb(pal.skyBottom));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const ch = this.chapters[seg.chapter];
    const off = this.skyOffset * w;

    if (ch.scenery === "neon") {
      // stars + moon
      const r = seeded(3);
      ctx.fillStyle = "rgba(255,255,255,.75)";
      for (let i = 0; i < 120; i++) {
        const sx = (((r() * w * 2 - off * 0.2) % w) + w) % w;
        ctx.fillRect(sx, r() * horizon * 0.9, 1.5, 1.5);
      }
      ctx.fillStyle = "rgba(220,240,255,.9)";
      ctx.beginPath();
      ctx.arc(w * 0.78 - off * 0.05, horizon * 0.35, h * 0.05, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // synthwave striped sun
      const cx = w * 0.5 - off * 0.05;
      const cy = horizon * 0.86;
      const R = Math.min(w, h) * 0.2;
      const sg = ctx.createLinearGradient(0, cy - R, 0, cy + R);
      sg.addColorStop(0, rgb(mix(pal.accent, [255, 255, 255], 0.35)));
      sg.addColorStop(1, rgb(mix(pal.skyBottom, [255, 80, 120], 0.5)));
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = sg;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.fillStyle = rgb(pal.skyBottom);
      for (let i = 0; i < 7; i++) {
        const y = cy + R * (0.05 + i * 0.14);
        ctx.fillRect(cx - R, y, R * 2, R * 0.025 * (i + 1));
      }
      ctx.restore();
    }

    // far skyline / mountains
    const silhouette = mix(pal.fog, [0, 0, 0], 0.45);
    ctx.fillStyle = rgb(silhouette);
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    if (ch.scenery === "hills") {
      for (let x = 0; x <= w; x += 8) {
        const t = (x + off * 0.3) / w;
        const y = horizon - h * (0.06 + 0.04 * Math.sin(t * 9) + 0.03 * Math.sin(t * 23 + 1));
        ctx.lineTo(x, y);
      }
    } else {
      const r = seeded(11);
      const bw = w / 40;
      const shift = ((off * 0.3) % bw + bw) % bw;
      for (let i = -1; i < 42; i++) {
        const bh = h * (0.04 + r() * (ch.scenery === "neon" ? 0.16 : 0.1));
        const x0 = i * bw - shift;
        ctx.lineTo(x0, horizon - bh);
        ctx.lineTo(x0 + bw, horizon - bh);
      }
    }
    ctx.lineTo(w, horizon);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // ground below the horizon (shows where road is not drawn)
    ctx.fillStyle = rgb(mix(pal.fog, pal.ground, 0.5));
    ctx.fillRect(0, horizon, w, h - horizon);
  }

  drawSegment(seg, w) {
    const { ctx } = this;
    const { p1, p2, pal } = seg;
    const x1 = p1.screen.x, y1 = p1.screen.y, w1 = p1.screen.w;
    const x2 = p2.screen.x, y2 = p2.screen.y, w2 = p2.screen.w;
    const alt = Math.floor(seg.index / 3) % 2;
    const r1 = w1 / 7, r2 = w2 / 7;
    const quad = (c, ax, ay, bx, by, cx, cy, dx, dy) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.lineTo(cx, cy);
      ctx.lineTo(dx, dy);
      ctx.closePath();
      ctx.fill();
    };

    ctx.fillStyle = rgb(alt ? pal.ground : pal.ground2);
    ctx.fillRect(0, y2, w, y1 - y2 + 1);

    const rumble = rgb(alt ? pal.rumble : pal.rumble2);
    quad(rumble, x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2);
    quad(rumble, x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2);
    quad(rgb(alt ? pal.road : mix(pal.road, [0, 0, 0], 0.08)), x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2);

    if (alt) {
      const l1 = w1 / 40, l2 = w2 / 40;
      const lane = rgb(pal.lane);
      for (const f of [-1 / 3, 1 / 3]) {
        const lx1 = x1 + w1 * f * 2 * 0.75, lx2 = x2 + w2 * f * 2 * 0.75;
        quad(lane, lx1 - l1, y1, lx1 + l1, y1, lx2 + l2, y2, lx2 - l2, y2);
      }
    }

    if (seg.fog > 0.02) {
      ctx.fillStyle = rgb(pal.fog, seg.fog);
      ctx.fillRect(0, y2, w, y1 - y2 + 1);
    }
  }

  drawSprite(sp, x, y, k, pal, fog) {
    const { ctx } = this;
    const accent = this.chapters[sp.chapter].pal.accent;
    ctx.globalAlpha = 1 - fog * 0.85;

    switch (sp.type) {
      case "lamp": {
        const ph = 1700 * k, pw = Math.max(1, 45 * k);
        ctx.fillStyle = "#1a1f2b";
        ctx.fillRect(x - pw / 2, y - ph, pw, ph);
        const arm = 380 * k * -Math.sign(sp.offset);
        ctx.fillRect(Math.min(x, x + arm), y - ph, Math.abs(arm), pw);
        const r = Math.max(1.5, 70 * k);
        const g = ctx.createRadialGradient(x + arm, y - ph, 0, x + arm, y - ph, r * 4);
        g.addColorStop(0, rgb(mix(accent, [255, 255, 255], 0.6)));
        g.addColorStop(0.25, rgb(accent, 0.6));
        g.addColorStop(1, rgb(accent, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x + arm - r * 4, y - ph - r * 4, r * 8, r * 8);
        break;
      }
      case "pylon": {
        const ph = 2400 * k, pw = Math.max(1.5, 70 * k);
        const c = sp.hue ? [255, 45, 140] : [57, 240, 224];
        ctx.fillStyle = rgb(c);
        ctx.shadowColor = rgb(c);
        ctx.shadowBlur = Math.min(30, 20 * k * 40);
        ctx.fillRect(x - pw / 2, y - ph, pw, ph);
        ctx.shadowBlur = 0;
        break;
      }
      case "tree": {
        const th = sp.h * k, tw = th * 0.42;
        const leaf = mix(pal.ground, [0, 0, 0], 0.35);
        ctx.fillStyle = rgb(mix(leaf, [0, 0, 0], 0.3));
        ctx.fillRect(x - tw * 0.06, y - th * 0.25, tw * 0.12, th * 0.25);
        ctx.fillStyle = rgb(leaf);
        for (let i = 0; i < 3; i++) {
          const ty = y - th * (0.2 + i * 0.25);
          const tw2 = tw * (1 - i * 0.25);
          ctx.beginPath();
          ctx.moveTo(x - tw2 / 2, ty);
          ctx.lineTo(x + tw2 / 2, ty);
          ctx.lineTo(x, ty - th * 0.42);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
      case "building": {
        const bw = sp.w * k, bh = sp.h * k;
        ctx.fillStyle = rgb(mix(pal.fog, [5, 8, 16], 0.7));
        ctx.fillRect(x - bw / 2, y - bh, bw, bh);
        if (bw > 30) {
          const r = seeded(sp.seed);
          const cw = bw / 6, chh = cw * 0.8;
          ctx.fillStyle = rgb(accent, 0.55);
          for (let yy = y - bh + chh; yy < y - chh; yy += chh * 1.8) {
            for (let i = 0; i < 5; i++) if (r() < 0.35) ctx.fillRect(x - bw / 2 + cw * (i + 0.5), yy, cw * 0.55, chh * 0.6);
          }
        }
        break;
      }
      case "gate":
      case "finish": {
        const span = 1.22 * ROAD_W * k;
        const ph = 2500 * k, pw = Math.max(2, 150 * k), bh = 460 * k;
        ctx.fillStyle = "#0b0f1a";
        ctx.fillRect(x - span - pw / 2, y - ph, pw, ph);
        ctx.fillRect(x + span - pw / 2, y - ph, pw, ph);
        const top = y - ph;
        if (sp.type === "finish") {
          const cells = 24, cw = (span * 2) / cells;
          for (let i = 0; i < cells; i++)
            for (let j = 0; j < 2; j++) {
              ctx.fillStyle = (i + j) % 2 ? "#f2f2f2" : "#111";
              ctx.fillRect(x - span + i * cw, top + j * (bh / 2), cw + 0.5, bh / 2 + 0.5);
            }
          this.label(x, top - bh * 0.6, "FINISH · NEXT STOP: YOUR TEAM", bh * 0.55, rgb(accent));
        } else {
          ctx.fillStyle = "rgba(8,12,22,.92)";
          ctx.fillRect(x - span, top, span * 2, bh);
          ctx.fillStyle = rgb(accent);
          ctx.fillRect(x - span, top + bh - Math.max(1, bh * 0.08), span * 2, Math.max(1, bh * 0.08));
          const ch = this.chapters[sp.chapter];
          this.label(x, top + bh * 0.5, `${ch.chapter.toUpperCase()} · ${ch.job.company.toUpperCase()} · ${ch.year}`, bh * 0.45, "#fff");
        }
        break;
      }
      case "billboard": {
        const p = this.projects[sp.id];
        // Overhead gantry (an upside-down "L"): pole at the roadside, arm over
        // the road, sign hanging above the lane so it stays in view on phones.
        const side = Math.sign(sp.offset);
        const bw = 1900 * k;
        if (bw < 4) break;
        const bx = x - side * 0.85 * ROAD_W * k; // sign centre, over the lane
        const imgH = (bw * 9) / 16, capH = bw * 0.19;
        const top = y - 1900 * k - imgH - capH;
        const left = bx - bw / 2;
        const armY = top - 110 * k, armT = Math.max(1.5, 70 * k);
        const poleW = Math.max(2, 90 * k);
        ctx.fillStyle = "#1a1f2b";
        ctx.fillRect(x - poleW / 2, armY, poleW, y - armY); // pole
        const armEnd = bx - side * bw * 0.5;
        ctx.fillRect(Math.min(x, armEnd), armY, Math.abs(armEnd - x), armT); // arm
        for (const f of [-0.32, 0.32]) ctx.fillRect(bx + bw * f - armT / 4, armY, armT / 2, top - armY); // hangers
        ctx.fillStyle = rgb(accent);
        ctx.fillRect(Math.min(x, armEnd), armY + armT, Math.abs(armEnd - x), Math.max(1, armT * 0.15)); // neon trim
        ctx.fillStyle = "#0b0f1a";
        ctx.fillRect(left, top, bw, imgH + capH);
        const pad = bw * 0.025;
        const img = this.images[sp.id];
        if (img && img.complete && img.naturalWidth) {
          let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
          if (p.image.includes("ytimg")) { sy = sh * 0.125; sh *= 0.75; } // YouTube thumbnails are letterboxed
          const want = 16 / 9;
          if (sw / sh > want) { const nw = sh * want; sx += (sw - nw) / 2; sw = nw; } else { const nh = sw / want; sy += (sh - nh) / 2; sh = nh; }
          ctx.drawImage(img, sx, sy, sw, sh, left + pad, top + pad, bw - pad * 2, imgH - pad);
        } else {
          const g = ctx.createLinearGradient(left, top, left + bw, top + imgH);
          g.addColorStop(0, rgb(mix(accent, [0, 0, 0], 0.55)));
          g.addColorStop(1, rgb(mix(accent, [0, 0, 0], 0.85)));
          ctx.fillStyle = g;
          ctx.fillRect(left + pad, top + pad, bw - pad * 2, imgH - pad);
          // no image: the project name fills the sign, split over two lines if long
          const name = p.name.toUpperCase();
          const words = name.split(" ");
          let lines = [name];
          if (words.length > 1 && name.length > 10) {
            let best = 1, bestDiff = Infinity;
            for (let i = 1; i < words.length; i++) {
              const d = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
              if (d < bestDiff) { bestDiff = d; best = i; }
            }
            lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")];
          }
          const innerW = bw - pad * 6;
          const size = Math.min(...lines.map((l) => this.fitSize(l, innerW, imgH * 0.3, 700)));
          const lineH = size * 1.05;
          const y0 = top + imgH * 0.5 - (lineH * (lines.length - 1)) / 2;
          lines.forEach((l, i) => this.label(bx, y0 + i * lineH, l, size, "#fff"));
        }
        ctx.strokeStyle = rgb(accent);
        ctx.lineWidth = Math.max(1, bw * 0.008);
        ctx.strokeRect(left, top, bw, imgH + capH);
        if (bw > 70) {
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#fff";
          const hasImg = !!(img && img.complete && img.naturalWidth);
          const capW = bw - pad * 3;
          const line1 = (hasImg ? p.name : p.engine).toUpperCase();
          const line2 = (hasImg ? `${p.engine} · ${p.tag}` : p.tag).toUpperCase();
          ctx.font = `700 ${this.fitSize(line1, capW, capH * 0.44, 700)}px "Chakra Petch", sans-serif`;
          ctx.fillText(line1, left + pad * 1.5, top + imgH + capH * 0.36);
          if (bw > 160) {
            ctx.fillStyle = rgb(accent);
            ctx.font = `600 ${this.fitSize(line2, capW, capH * 0.26, 600)}px "Chakra Petch", sans-serif`;
            ctx.fillText(line2, left + pad * 1.5, top + imgH + capH * 0.74);
          }
        }
        if (p.link && fog < 0.5) this.hits.push({ x: left, y: top, w: bw, h: imgH + capH, link: p.link });
        break;
      }
    }
    ctx.globalAlpha = 1;
  }

  /** largest font size (up to max) at which text fits in maxW */
  fitSize(text, maxW, max, weight) {
    const { ctx } = this;
    ctx.font = `${weight} ${max}px "Chakra Petch", sans-serif`;
    const w = ctx.measureText(text).width;
    return w > maxW ? max * (maxW / w) : max;
  }

  label(x, y, text, size, color) {
    if (size < 4) return;
    const { ctx } = this;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.font = `700 ${size}px "Chakra Petch", sans-serif`;
    ctx.fillText(text, x, y);
  }

  drawSpeedLines(w, h, speed, pal) {
    const s = Math.min(Math.abs(speed) / 9000, 1);
    if (s < 0.08) return;
    const { ctx } = this;
    const r = seeded(Math.floor(performance.now() / 50));
    ctx.strokeStyle = rgb(mix(pal.accent, [255, 255, 255], 0.5), 0.35 * s);
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2;
      const r0 = Math.max(w, h) * (0.35 + r() * 0.2);
      const len = Math.max(w, h) * 0.15 * s;
      const cx = w / 2, cy = h * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
      ctx.stroke();
    }
  }

  hitTest(px, py) {
    const x = px * this.dpr, y = py * this.dpr;
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h.link;
    }
    return null;
  }
}
