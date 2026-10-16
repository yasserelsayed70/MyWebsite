// Performance tier. Budget phones get "lite mode": the same site, minus the
// purely decorative effects (blur, floating dust, light beams, glows) and with
// canvases rendered at 1x resolution.
//
// Detected from hardware hints, then confirmed with a quick frame-rate check
// during the loading screen. Force it for testing with ?lite=1 or ?lite=0.

export const perf = { lite: false, forced: false };

const cores = navigator.hardwareConcurrency || 8;
const memory = navigator.deviceMemory || 8; // GB (Chrome/Android only)
const saveData = navigator.connection?.saveData === true;
if (memory <= 4 || cores <= 4 || saveData) perf.lite = true;

const param = new URLSearchParams(location.search).get("lite");
if (param !== null) {
  perf.lite = param !== "0";
  perf.forced = true;
}
apply();

function apply() {
  document.documentElement.classList.toggle("lite", perf.lite);
}

export function setLite(on) {
  if (perf.forced || perf.lite === on) return;
  perf.lite = on;
  apply();
}

/** max device-pixel-ratio for canvases (lite renders at 1x) */
export const maxDpr = (normal) => (perf.lite ? 1 : Math.min(window.devicePixelRatio || 1, normal));

/** average frames per second over `ms` milliseconds */
export function measureFps(ms = 1500) {
  return new Promise((resolve) => {
    let frames = 0;
    const start = performance.now();
    const tick = (t) => {
      frames++;
      if (t - start < ms) requestAnimationFrame(tick);
      else resolve((frames * 1000) / (t - start));
    };
    requestAnimationFrame(tick);
  });
}
