// Visit + click tracking with Umami (cookieless, no consent banner needed).
// To switch it on, paste your Umami "Website ID" below. While it is empty
// nothing is sent; events are only printed to the console on localhost.

const UMAMI_WEBSITE_ID = "64465646-3f1e-4031-9533-c49dc2721735";
const UMAMI_SCRIPT = "https://cloud.umami.is/script.js";
// only count real visits, not local previews
const DOMAINS = "yasserbadr.com,www.yasserbadr.com,yasserbadr.pages.dev";

const queue = [];
const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);

if (UMAMI_WEBSITE_ID && !isLocal) {
  const s = document.createElement("script");
  s.defer = true;
  s.src = UMAMI_SCRIPT;
  s.dataset.websiteId = UMAMI_WEBSITE_ID;
  s.dataset.domains = DOMAINS;
  s.addEventListener("load", () => {
    while (queue.length) window.umami?.track(...queue.shift());
  });
  document.head.appendChild(s);
}

/** Record an event, e.g. track("cv_download", { from: "lobby" }) */
export function track(name, data) {
  if (isLocal) console.debug("[track]", name, data || "");
  if (!UMAMI_WEBSITE_ID || isLocal) return;
  if (window.umami) window.umami.track(name, data);
  else queue.push([name, data]);
}

/** Where on the site a click happened: lobby, road, or the open panel */
let context = () => "lobby";
export function setContext(fn) {
  context = fn;
}

// Every link and button on the site is tracked automatically.
// Add data-track="name" to an element to give its event a custom name.
document.addEventListener(
  "click",
  (e) => {
    const el = e.target.closest("a, button");
    if (!el) return;
    const from = context();
    let name = el.dataset.track;
    if (!name && el.tagName === "A") {
      const href = el.getAttribute("href") || "";
      if (href.endsWith(".pdf")) name = "cv_download";
      else if (href.startsWith("mailto:")) name = "contact_email";
      else if (href.includes("linkedin.com")) name = "contact_linkedin";
      else if (href.includes("youtube.com") || href.includes("steampowered.com")) name = "project_link";
      else name = "link_click";
      track(name, { from, label: el.textContent.trim().slice(0, 40) });
      return;
    }
    if (!name && el.dataset.action) name = `ui_${el.dataset.action}`;
    if (!name && el.id) name = `ui_${el.id}`;
    if (name) track(name, { from });
  },
  true
);
