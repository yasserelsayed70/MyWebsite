// Makes the phone / browser Back button work inside the site.
// Each open "layer" (a panel, the career road) adds one history entry, so Back
// closes that layer instead of leaving the site.

const stack = []; // open layers, top = last
const handlers = {}; // layer name -> what Back should do
let skip = 0; // popstate events we caused ourselves and must ignore

history.replaceState({ layer: "base" }, "");

/** what to do when Back is pressed while `layer` is on top */
export function onBack(layer, fn) {
  handlers[layer] = fn;
}

export function pushLayer(layer) {
  stack.push(layer);
  history.pushState({ layer }, "");
}

/** swap the top layer without adding history (e.g. road -> party panel) */
export function replaceTop(layer) {
  if (!stack.length) return pushLayer(layer);
  stack[stack.length - 1] = layer;
  history.replaceState({ layer }, "");
}

/** close the top layer from the UI (× button, Lobby button...) */
export function popLayer(layer) {
  if (stack[stack.length - 1] !== layer) return;
  stack.pop();
  skip++;
  history.back();
}

export const topLayer = () => stack[stack.length - 1];

addEventListener("popstate", () => {
  if (skip) {
    skip--;
    return;
  }
  const layer = stack.pop();
  if (layer) handlers[layer]?.();
});
