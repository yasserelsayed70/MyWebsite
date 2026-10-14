// Career mode: the page scrolls, the scroll position drives the bike along the road.
import { road as roadData, career, projects } from "./career.js";
import { Road } from "./road.js";
import { CharacterView } from "./character.js";
import { track } from "./analytics.js";

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export class CareerMode {
  constructor({ onExit }) {
    this.el = $("#careerMode");
    this.onExit = onExit;
    this.road = new Road($("#road"), { road: roadData, career, projects });
    this.video = $("#vidRide");
    try {
      this.bike = new CharacterView($("#bike"));
      this.bike.setVideo(this.video);
    } catch {
      this.bike = null;
    }
    this.active = false;
    this.pos = 0;
    this.target = 0;
    this.chapter = null;
    this.unlocked = new Set();

    this.buildHud();
    this.bindInput();
    $("#road").addEventListener("click", (e) => {
      const link = this.road.hitTest(e.offsetX, e.offsetY);
      if (link) {
        track("billboard_click", { link });
        window.open(link, "_blank", "noopener");
      }
    });
    $("#road").addEventListener("mousemove", (e) => {
      $("#road").style.cursor = this.road.hitTest(e.offsetX, e.offsetY) ? "pointer" : "";
    });
    $("#careerBack").addEventListener("click", () => this.exit(false));
    $("#finishParty").addEventListener("click", () => this.exit(true));
  }

  buildHud() {
    const total = this.road.maxPosition;
    $("#trackMarks").innerHTML = roadData
      .map((c, i) => {
        const at = (this.road.chapterStart[i] * 200) / total;
        return `<span style="left:${(at * 100).toFixed(2)}%"><i></i>${c.year}</span>`;
      })
      .join("");
  }

  /* ---------- input ----------
     The ride is driven by wheel, touch and keys directly (not by page scroll),
     so it works in fullscreen and a downward swipe can never pull-to-refresh. */

  bindInput() {
    const PER_PX = 200 / 9; // world units per scrolled pixel (~9px per road segment)
    this.vel = 0;
    this.touching = false;
    const nudge = (dy) => {
      if (!this.active || this.building) return;
      this.target = Math.max(0, Math.min(this.road.maxPosition, this.target + dy * PER_PX));
      if (this.target > 400) $("#scrollHint").classList.add("gone");
    };
    this.el.addEventListener("wheel", (e) => {
      e.preventDefault();
      nudge(e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? innerHeight : 1));
    }, { passive: false });

    let lastY = 0, lastT = 0;
    this.el.addEventListener("touchstart", (e) => {
      if (e.target.closest("button, a")) return;
      this.touching = true;
      this.vel = 0;
      lastY = e.touches[0].clientY;
      lastT = performance.now();
    }, { passive: true });
    this.el.addEventListener("touchmove", (e) => {
      if (!this.touching) return;
      e.preventDefault(); // blocks pull-to-refresh and page bounce
      const y = e.touches[0].clientY, t = performance.now();
      const dy = (lastY - y) * 1.6; // swipe up = ride forward
      nudge(dy);
      this.vel = dy / Math.max(t - lastT, 1); // px per ms, for momentum
      lastY = y;
      lastT = t;
    }, { passive: false });
    this.el.addEventListener("touchend", () => (this.touching = false));
    this.nudge = nudge;

    addEventListener("keydown", (e) => {
      if (!this.active) return;
      const step = innerHeight * 0.8;
      const keys = { ArrowDown: 120, ArrowUp: -120, PageDown: step, PageUp: -step, " ": e.shiftKey ? -step : step };
      if (e.key in keys) { e.preventDefault(); nudge(keys[e.key]); }
      if (e.key === "Home") { e.preventDefault(); this.target = 0; }
      if (e.key === "End") { e.preventDefault(); this.target = this.road.maxPosition; }
      if (e.key === "Escape" && !document.fullscreenElement) this.exit(false);
    });

    // tap/click the progress bar to jump to a chapter
    $(".track").addEventListener("click", (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      this.target = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * this.road.maxPosition;
    });
  }

  /** fast map-loading screen, then the world builds itself around the bike */
  async start() {
    if (this.active || this.loading) return;
    this.loading = true;
    await this.showLoading();

    this.active = true;
    this.loading = false;
    this.el.hidden = false;
    document.body.classList.add("riding");
    const touch = matchMedia("(pointer: coarse)").matches;
    $("#scrollHint").firstChild.textContent = touch ? "Swipe up to ride" : "Scroll to ride";
    $("#scrollHint span").textContent = touch ? "▲" : "▼";
    this.vel = 0;
    this.pos = this.target = 0;
    this.chapter = null;
    this.unlocked.clear();
    this.seenChapters = new Set();
    this.completed = false;
    $("#scrollHint").classList.remove("gone");
    $("#finish").hidden = true;
    this.video.play().catch(() => {});

    this.buildStart = performance.now();
    this.building = !reduceMotion;
    this.el.classList.toggle("building", this.building);
    this.last = performance.now();
    requestAnimationFrame(() => this.el.classList.add("on"));
    $("#mapLoading").classList.add("done");
    const loop = (t) => {
      if (!this.active) return;
      this.frame(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  async showLoading() {
    const box = $("#mapLoading");
    const lines = $("#mapLines");
    const bar = $("#mapBar");
    lines.innerHTML = "";
    bar.style.width = "0%";
    box.hidden = false;
    box.classList.remove("done");
    $("#mapTip").textContent = "TIP: Scroll or swipe to ride through the career. Tap a billboard to watch the project.";
    const steps = ["Loading map · Career Road", "Generating terrain", "Placing billboards", "Spawning player"];
    const ready = new Promise((res) => {
      if (this.video.readyState >= 3) return res();
      this.video.addEventListener("canplay", res, { once: true });
      this.video.load();
      setTimeout(res, 5000);
    });
    for (let i = 0; i < steps.length; i++) {
      const line = document.createElement("div");
      line.textContent = steps[i];
      lines.appendChild(line);
      bar.style.width = `${((i + 1) / steps.length) * 90}%`;
      await new Promise((r) => setTimeout(r, reduceMotion ? 40 : 230));
      line.classList.add("ok");
    }
    await ready;
    bar.style.width = "100%";
    await new Promise((r) => setTimeout(r, 180));
  }

  exit(toParty) {
    track("ride_exit", { reached: `${Math.round(this.road.state(this.pos).progress * 100)}%`, finished: toParty });
    this.active = false;
    $("#mapLoading").hidden = true;
    this.el.classList.remove("on");
    this.video.pause();
    document.body.classList.remove("riding");
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    setTimeout(() => (this.el.hidden = true), 400);
    this.onExit(toParty);
  }

  frame(t) {
    const dt = Math.min((t - this.last) / 1000, 0.05);
    this.last = t;
    if (!this.touching && Math.abs(this.vel) > 0.01) {
      this.nudge(this.vel * dt * 1000);
      this.vel *= Math.exp(-dt * 3.2);
    }
    const prev = this.pos;
    this.pos += (this.target - this.pos) * Math.min(1, dt * (reduceMotion ? 20 : 3.5));
    const speed = (this.pos - prev) / Math.max(dt, 1e-3);

    const st = this.road.state(this.pos);
    // world construction intro (~2.6s): road, scenery, then the bike materialises
    let build = 1;
    if (this.building) {
      build = Math.min(1, (t - this.buildStart) / 2600);
      if (build >= 1) {
        this.building = false;
        this.el.classList.remove("building");
      }
    }
    this.road.render(this.pos, speed, build);
    if (this.bike) {
      const clamp = (v) => Math.max(0, Math.min(1, v));
      this.bike.uniforms.reveal = clamp((build - 0.45) / 0.3);
      this.bike.uniforms.holo = 1 - clamp((build - 0.8) / 0.2);
      this.bike.uniforms.glitch = build < 1 && Math.random() < 0.3 ? 0.4 * (1 - build) + 0.1 : 0;
    }

    // bike size follows the road's scale so they always match
    const unit = this.road.S / this.road.dpr;
    this.el.style.setProperty("--bike-h", `${Math.round(Math.max(unit * 0.64, innerHeight * 0.3))}px`);

    // bike lean on curves
    const lean = Math.max(-12, Math.min(12, -st.curve * Math.min(Math.abs(speed) / 3000, 1) * 3));
    $("#bikeWrap").style.transform = `translateX(-50%) rotate(${lean.toFixed(2)}deg)`;
    if (this.bike) this.bike.render(t / 1000);

    // HUD
    $("#trackFill").style.width = `${Math.min(100, st.progress * 100).toFixed(2)}%`;
    if (st.chapter !== this.chapter) {
      this.chapter = st.chapter;
      this.showChapter(st.chapter);
    }
    if (st.chapter >= 0 && st.chapterProgress > 0.65 && !this.unlocked.has(st.chapter)) {
      this.unlocked.add(st.chapter);
      const job = career.find((j) => j.id === roadData[st.chapter].career);
      if (job?.achievement) this.achievement(job.achievement);
    }
    $("#finish").hidden = st.progress < 0.985;
    if (!$("#finish").hidden && !this.completed) {
      this.completed = true;
      track("ride_complete");
    }
  }

  showChapter(i) {
    if (i >= 0 && !this.seenChapters.has(i)) {
      this.seenChapters.add(i);
      track("chapter_reached", { chapter: `${i + 1} · ${career.find((j) => j.id === roadData[i].career).company}` });
    }
    const card = $("#chapterCard");
    if (i < 0) {
      card.classList.remove("show");
      return;
    }
    const ch = roadData[i];
    const job = career.find((j) => j.id === ch.career);
    card.style.setProperty("--accent", ch.palette.accent);
    card.classList.remove("show");
    setTimeout(() => {
      card.innerHTML = `
        <div class="ch-tag">${esc(ch.chapter)} · ${esc(job.period)}</div>
        <h2>${esc(job.role)}</h2>
        <div class="ch-company">${esc(job.company)} <span>· ${esc(job.place)}</span></div>
        <ul>${job.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
        <div class="ch-projects">${ch.billboards
          .map((id) => projects[id])
          .map((p) => (p.link ? `<a href="${p.link}" target="_blank" rel="noopener">${esc(p.name)}</a>` : `<span>${esc(p.name)}</span>`))
          .join("")}</div>`;
      card.classList.add("show");
    }, 180);
  }

  achievement(text) {
    const el = $("#achievement");
    el.querySelector("b").textContent = text;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
  }
}
