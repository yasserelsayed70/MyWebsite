// Career mode: the page scrolls, the scroll position drives the bike along the road.
import { road as roadData, career, projects } from "./career.js";
import { Road } from "./road.js";
import { CharacterView } from "./character.js";

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export class CareerMode {
  constructor({ onExit }) {
    this.el = $("#careerMode");
    this.space = $("#scrollSpace");
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
    addEventListener("scroll", () => this.onScroll(), { passive: true });
    addEventListener("resize", () => this.sizeSpace());
    $("#road").addEventListener("click", (e) => {
      const link = this.road.hitTest(e.offsetX, e.offsetY);
      if (link) window.open(link, "_blank", "noopener");
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

  sizeSpace() {
    // ~9 px of scroll per road segment feels like a comfortable ride
    this.space.style.height = `${Math.round((this.road.maxPosition / 200) * 9) + innerHeight}px`;
  }

  onScroll() {
    if (!this.active) return;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, scrollY / max) : 0;
    this.target = p * this.road.maxPosition;
    if (scrollY > 40) $("#scrollHint").classList.add("gone");
  }

  start() {
    this.active = true;
    this.el.hidden = false;
    document.body.classList.add("riding");
    this.sizeSpace();
    scrollTo(0, 0);
    this.pos = this.target = 0;
    this.chapter = null;
    this.unlocked.clear();
    $("#scrollHint").classList.remove("gone");
    $("#finish").hidden = true;
    this.video.play().catch(() => {});
    this.last = performance.now();
    requestAnimationFrame(() => this.el.classList.add("on"));
    const loop = (t) => {
      if (!this.active) return;
      this.frame(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  exit(toParty) {
    this.active = false;
    this.el.classList.remove("on");
    this.video.pause();
    document.body.classList.remove("riding");
    this.space.style.height = "0px";
    scrollTo(0, 0);
    setTimeout(() => (this.el.hidden = true), 400);
    this.onExit(toParty);
  }

  frame(t) {
    const dt = Math.min((t - this.last) / 1000, 0.05);
    this.last = t;
    const prev = this.pos;
    this.pos += (this.target - this.pos) * Math.min(1, dt * (reduceMotion ? 20 : 3.5));
    const speed = (this.pos - prev) / Math.max(dt, 1e-3);

    const st = this.road.state(this.pos);
    this.road.render(this.pos, speed);

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
  }

  showChapter(i) {
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
