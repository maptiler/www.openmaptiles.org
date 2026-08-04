// Entry point. Plain ES modules, no bundler: the repo has no JavaScript build step
// by design, so what ships is what is written here.
import { initTracking } from "./tracking.js";
import { initUI } from "./ui.js";
import { initHero } from "./hero.js";
import { initLanguages } from "./languages.js";
import { initMapStyles } from "./map-styles.js";
import { initViewersModal } from "./viewers-modal.js";
import { initSearch } from "./search.js";

const configEl = document.getElementById("site-config");
const config = configEl ? JSON.parse(configEl.textContent) : {};

initTracking();
initUI();
// The multilingual map is built when the hero dialog opens, not when its markup is
// found: every page on the home layout carries that markup, and only
// /languages/:code/ opens the dialog. Gating on presence downloaded the ~1.4 MB SDK
// on the homepage for a map that could not be shown. See languages.js.
//
// On /languages/:code/ the dialog is server-rendered open, so initHero's initial
// setOpen(true) fires this immediately — same behaviour as before on that route.
initHero(config, () => initLanguages(config));
initMapStyles(config);

// /viewers/ only — pulls maplibre-gl, leaflet and ol from their CDNs.
if (document.querySelector("[data-viewers-modal]")) {
  initViewersModal(config);
}

// Docs pages only. lunr and the corpus load on the first keystroke, not here.
initSearch(config);
