import { profile, loadout, career, sideProjects, loadingTips } from "./career.js";
import { CharacterView } from "./character.js";
import { CareerMode } from "./careerMode.js";
import { track, setContext } from "./analytics.js";

const $ = (sel) => document.querySelector(sel);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const lobby = $("#lobby");
const vidIdle = $("#vidIdle");
const vidWave = $("#vidWave");

/* ---------------- Build UI from data ---------------- */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function loadoutHTML() {
  return loadout
    .map((l) => `<div class="item ${l.rarity}"><small>${esc(l.slot)}</small><b>${esc(l.item)}</b><span>${esc(l.note)}</span></div>`)
    .join("");
}

$("#nameplate").textContent = profile.name;
$("#loadout").innerHTML = loadoutHTML();
$("#playerCard").innerHTML = `
  <div class="tag">Player profile</div>
  <h1>${esc(profile.name)}</h1>
  <p class="title">${esc(profile.title)}</p>
  <div class="lvl">
    <div class="lvl-badge"><div><small>LVL</small>${profile.level}</div></div>
    <div class="xp">
      <small><span>Years in games</span><span>Next: your team</span></small>
      <div class="xp-bar" style="--xp:82%"><span></span></div>
    </div>
  </div>
  <div class="chips">
    <span class="chip hot">${esc(profile.relocation)}</span>
    <span class="chip">${esc(profile.location)}</span>
    ${profile.languages.map(([l, lv]) => `<span class="chip">${esc(l)} ${esc(lv)}</span>`).join("")}
  </div>`;
$("#cvLink").href = profile.cv;

/* ---------------- Boot sequence ---------------- */

const bootLines = $("#bootLines");
const bootBar = $("#bootBar");
const steps = [
  "Connecting to server · EU-West",
  "Authenticating player · Yasser Badr",
  "Syncing tick rate · 60 Hz",
  "Matchmaking · Searching for team",
  "Loading lobby",
];
let tipIndex = Math.floor(Math.random() * loadingTips.length);
$("#bootTip").textContent = loadingTips[tipIndex];
const tipTimer = setInterval(() => {
  tipIndex = (tipIndex + 1) % loadingTips.length;
  $("#bootTip").textContent = loadingTips[tipIndex];
}, 2200);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function videoReady(v) {
  return new Promise((resolve) => {
    if (v.readyState >= 3) return resolve();
    v.addEventListener("canplaythrough", resolve, { once: true });
    v.addEventListener("error", resolve, { once: true });
    setTimeout(resolve, 8000); // never block the lobby forever
  });
}

let skipped = false;
$("#bootSkip").addEventListener("click", () => (skipped = true));

async function boot() {
  const assets = videoReady(vidIdle); // the wave clip keeps loading in the background
  for (let i = 0; i < steps.length; i++) {
    if (skipped) break;
    const line = document.createElement("div");
    line.textContent = steps[i];
    bootLines.appendChild(line);
    bootBar.style.width = `${((i + 1) / steps.length) * 90}%`;
    await sleep(reduceMotion ? 80 : 420);
    line.classList.add("ok");
  }
  await assets;
  bootBar.style.width = "100%";
  if (!skipped) await sleep(350);
  clearInterval(tipTimer);
  $("#boot").classList.add("done");
  enterLobby();
}

/* ---------------- Character + spawn ---------------- */

let view = null;
try {
  view = new CharacterView($("#character"));
} catch (e) {
  console.warn("WebGL unavailable, using still image", e);
  $("#character").hidden = true;
  $("#characterFallback").hidden = false;
}

const fx = { glitch: 0, holo: 1, reveal: 0 };
const timeline = []; // { start, dur, fn(progress) }
const now = () => performance.now() / 1000;

function animate(dur, fn) {
  return new Promise((resolve) => timeline.push({ start: now(), dur, fn, resolve }));
}

function burst(strength = 0.6, ms = 160) {
  if (reduceMotion) return;
  fx.glitch = Math.max(fx.glitch, strength);
  setTimeout(() => (fx.glitch = 0), ms);
}

async function spawn() {
  if (reduceMotion || !view) {
    Object.assign(fx, { glitch: 0, holo: 0, reveal: 1 });
    return;
  }
  Object.assign(fx, { glitch: 0.5, holo: 1, reveal: 0 });
  $("#pad").classList.add("flash");
  await animate(1.1, (p) => {
    fx.reveal = p;
    fx.glitch = 0.15 + 0.4 * Math.random() * (1 - p);
  });
  fx.glitch = 0.8;
  await sleep(90);
  await animate(0.7, (p) => {
    fx.holo = 1 - p;
    fx.glitch = Math.random() < 0.25 ? 0.6 * (1 - p) : 0;
  });
  fx.glitch = 0;
  await sleep(250);
  burst(0.5, 110);
}

function loop() {
  const t = now();
  for (let i = timeline.length - 1; i >= 0; i--) {
    const a = timeline[i];
    const p = Math.min((t - a.start) / a.dur, 1);
    a.fn(p);
    if (p >= 1) {
      timeline.splice(i, 1);
      a.resolve();
    }
  }
  if (view && !careerMode.active) {
    Object.assign(view.uniforms, fx);
    view.render(t);
  }
  requestAnimationFrame(loop);
}

function scheduleIdleGlitch() {
  if (reduceMotion) return;
  setTimeout(() => {
    if (activeVideo === vidIdle) burst(0.35 + Math.random() * 0.3, 90 + Math.random() * 120);
    scheduleIdleGlitch();
  }, 6000 + Math.random() * 7000);
}

let activeVideo = vidIdle;
function setVideo(v) {
  activeVideo = v;
  view?.setVideo(v);
}

async function enterLobby() {
  vidIdle.play().catch(() => {});
  setVideo(vidIdle);
  requestAnimationFrame(loop);
  await sleep(200);
  await spawn();
  lobby.classList.add("ready");
  scheduleIdleGlitch();
}

/* ---------------- Phone layout ---------------- */

// On phones the character fills the space between the player card and the
// buttons, so the full card, the character and the buttons all fit on screen.
const stage = $(".stage");
function layoutStage() {
  if (innerWidth > 760) {
    stage.style.height = stage.style.bottom = "";
    return;
  }
  const cardBottom = $("#playerCard").getBoundingClientRect().bottom;
  const buttonsTop = $(".bottom-left").getBoundingClientRect().top;
  const nameplate = 46; // room for the name above the head
  const padBelow = 0.1; // the floor pad hangs ~10% of the stage height below the feet
  const h = Math.max(180, (buttonsTop - cardBottom - nameplate - 8) / (1 + padBelow));
  stage.style.height = `${Math.round(h)}px`;
  stage.style.bottom = `${Math.round(innerHeight - buttonsTop + h * padBelow + 4)}px`;
}
layoutStage();
addEventListener("resize", layoutStage);
document.fonts?.ready.then(layoutStage);

/* ---------------- Parallax ---------------- */

window.addEventListener("pointermove", (e) => {
  if (reduceMotion) return;
  const x = (e.clientX / innerWidth) * 2 - 1;
  const y = (e.clientY / innerHeight) * 2 - 1;
  document.documentElement.style.setProperty("--mx", x.toFixed(3));
  document.documentElement.style.setProperty("--my", y.toFixed(3));
});

/* ---------------- Floating dust ---------------- */

(function dust() {
  const c = $("#dust");
  const ctx = c.getContext("2d");
  let parts = [];
  function resize() {
    c.width = c.clientWidth;
    c.height = c.clientHeight;
    parts = Array.from({ length: Math.round((c.width * c.height) / 26000) }, () => ({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      r: Math.random() * 1.6 + 0.4,
      s: Math.random() * 0.35 + 0.1,
      a: Math.random() * 0.5 + 0.15,
    }));
  }
  resize();
  addEventListener("resize", resize);
  (function tick() {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of parts) {
      if (!reduceMotion) {
        p.y -= p.s;
        if (p.y < -5) p.y = c.height + 5;
      }
      ctx.fillStyle = `rgba(120,240,255,${p.a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(tick);
  })();
})();

/* ---------------- Real ping ---------------- */

async function measurePing() {
  try {
    const t0 = performance.now();
    await fetch(`${location.pathname}?ping=${Date.now()}`, { method: "HEAD", cache: "no-store" });
    const ms = Math.max(1, Math.round(performance.now() - t0));
    $("#pingVal").textContent = ms;
    const el = $("#ping");
    el.classList.toggle("mid", ms >= 80 && ms < 160);
    el.classList.toggle("bad", ms >= 160);
  } catch {
    $("#pingVal").textContent = "--";
  }
}
measurePing();
setInterval(measurePing, 5000);

/* ---------------- Toast ---------------- */

let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}

/* ---------------- Modal sheets ---------------- */

const modal = $("#modal");
let openPanel = null;
function openSheet(html, name) {
  openPanel = name;
  track("panel_open", { panel: name });
  $("#sheetBody").innerHTML = html;
  modal.hidden = false;
  modal.querySelector(".sheet-close").focus();
}
function closeSheet() {
  modal.hidden = true;
}

function quickViewHTML() {
  return `
    <h2 id="sheetTitle">${esc(profile.name)}</h2>
    <p class="sub">${esc(profile.title)} · ${esc(profile.location)} · ${esc(profile.relocation)}</p>
    <p>${esc(profile.summary)}</p>
    <div class="contact-grid"><a class="btn" href="${profile.cv}" download>Download CV</a></div>
    <h3>Experience</h3>
    ${career
      .map(
        (j) => `<article class="job">
          <header><b>${esc(j.role)} — ${esc(j.company)}</b><span class="when">${esc(j.period)}</span></header>
          <div class="where">${esc(j.place)}</div>
          <ul>${j.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
        </article>`)
      .join("")}
    <h3>Projects</h3>
    ${sideProjects.map((p) => `<p><b>${esc(p.name)}</b> — ${esc(p.role)}. ${esc(p.text)}</p>`).join("")}
    <h3>Loadout</h3>
    <div class="loadout">${loadoutHTML()}</div>
    <h3>Languages</h3>
    <p>${profile.languages.map(([l, lv]) => `${esc(l)}: ${esc(lv)}`).join(" · ")}</p>
    <h3>Contact</h3>
    ${contactHTML()}`;
}

function contactHTML() {
  return `<div class="contact-grid">
      <a class="btn" href="mailto:${profile.email}">Email<small>${esc(profile.email)}</small></a>
      <a class="btn" href="${profile.linkedin}" target="_blank" rel="noopener">LinkedIn<small>yasserbadrdev</small></a>
      <a class="btn" href="${profile.github}" target="_blank" rel="noopener">GitHub<small>yasserelsayed70</small></a>
    </div>`;
}

function partyHTML() {
  return `
    <h2 id="sheetTitle">You joined the party</h2>
    <p class="sub">Squad up with ${esc(profile.name)} — ${esc(profile.title)}.</p>
    <div class="party-row">
      <div class="filled">${esc(profile.name)}</div>
      <div class="filled">You</div>
      <div>Open slot</div>
      <div>Open slot</div>
    </div>
    <h3>Start the conversation</h3>
    ${contactHTML()}
    <h3>Grab the CV</h3>
    <div class="contact-grid"><a class="btn" href="${profile.cv}" download>Download CV</a></div>`;
}

/* ---------------- Join party ---------------- */

let partyBusy = false;
function joinParty() {
  if (partyBusy) return;
  partyBusy = true;
  burst(0.7, 140);
  vidWave.currentTime = 0;
  vidWave.play().catch(() => {});
  setVideo(vidWave);
  setTimeout(() => {
    $("#invite").hidden = false;
  }, 1800);
}

vidWave.addEventListener("ended", () => {
  burst(0.5, 120);
  setVideo(vidIdle);
  partyBusy = false;
});

/* ---------------- Actions ---------------- */

const actions = {
  play: () => {
    if (careerMode.active) return;
    // fullscreen must be requested directly inside the click (not supported on iPhone, which is fine)
    const root = document.documentElement;
    if (!document.fullscreenElement && root.requestFullscreen) root.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    // glitch the character out of the lobby, then load the map
    if (!reduceMotion) {
      fx.holo = 1;
      animate(0.45, (p) => {
        fx.reveal = 1 - p;
        fx.glitch = 0.3 + 0.5 * Math.random();
      }).then(() => (fx.glitch = 0));
    }
    setTimeout(() => careerMode.start(), reduceMotion ? 0 : 420);
  },
  locker: () => openSheet(`<h2 id="sheetTitle">Locker</h2><p class="sub">Equipped loadout</p><div class="loadout">${loadoutHTML()}</div>`, "locker"),
  quick: () => openSheet(quickViewHTML(), "quick_view"),
  party: joinParty,
  accept: () => {
    $("#invite").hidden = true;
    openSheet(partyHTML(), "party");
  },
  close: closeSheet,
};

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (el && actions[el.dataset.action]) actions[el.dataset.action]();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSheet();
});

/* ---------------- Career mode ---------------- */

// tells the click tracker where a click happened
setContext(() => (!modal.hidden ? `panel_${openPanel}` : careerMode.active ? "road" : "lobby"));

const careerMode = new CareerMode({
  onExit: async (toParty) => {
    // hide the character until the respawn starts, so the old frame never flashes
    Object.assign(fx, { glitch: 0, holo: 1, reveal: 0 });
    $("#invite").hidden = true;
    // finishing the road opens the party panel straight away; the character respawns behind it
    if (toParty) openSheet(partyHTML(), "party_after_ride");
    await sleep(450);
    await spawn();
  },
});

boot();
