// Multilingual map preview for the language picker.
//
// The SDK is the vendored UMD build (assets/js/vendor/maptiler-sdk.umd.js),
// loaded on demand so the ~1.4 MB payload only lands on pages that show the map.
// It attaches to window.maptilersdk.
//
// No re-entrancy guard around map creation is needed here. Such guards exist to survive
// a component framework's
// mount→unmount→remount cycle and have no counterpart here.

const ZURICH_CENTER = [8.5417, 47.3769];
const ZURICH_ZOOM = 10.5;

const parseBbox = (bbox) => bbox.split(",").map(parseFloat);

let sdkPromise;

function loadSdk(base) {
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${base}/assets/js/vendor/maptiler-sdk.css`;
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = `${base}/assets/js/vendor/maptiler-sdk.umd.js`;
    script.onload = () => resolve(window.maptilersdk);
    script.onerror = () => reject(new Error("Failed to load MapTiler SDK"));
    document.head.appendChild(script);
  });

  return sdkPromise;
}

function hasWebGL() {
  const canvas = document.createElement("canvas");
  return Boolean(
    canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
  );
}

// Mirrors detectInitialCode(): explicit route language, else the first browser
// preference the site supports, else English.
function initialCode(root, languages) {
  const active = root.getAttribute("data-active-language");
  if (active && languages.some((l) => l.code === active)) return active;

  const supported = new Set(languages.map((l) => l.code));
  for (const pref of navigator.languages || [navigator.language]) {
    const code = String(pref).split("-")[0];
    if (supported.has(code)) return code;
  }
  return "en";
}

export async function initLanguages(config) {
  const root = document.querySelector("[data-languages-map]");
  if (!root) return;

  const container = root.querySelector("[data-languages-canvas]");
  const titleEl = root.querySelector("[data-languages-title]");
  const noWebgl = root.querySelector("[data-languages-nowebgl]");

  const languages = config.languages || [];
  const code = initialCode(root, languages);
  const current =
    languages.find((l) => l.code === code) ||
    languages.find((l) => l.code === "en") ||
    {};

  if (titleEl) titleEl.textContent = current.titlelocalized || current.title || "";

  if (!hasWebGL()) {
    if (noWebgl) noWebgl.removeAttribute("hidden");
    return;
  }

  let sdk;
  try {
    sdk = await loadSdk(config.baseurl || "");
  } catch (err) {
    console.error(err);
    return;
  }

  sdk.config.apiKey = config.apiKey;

  const map = new sdk.Map({
    container,
    style: sdk.MapStyle.OPENSTREETMAP,
    center: ZURICH_CENTER,
    zoom: ZURICH_ZOOM,
    attributionControl: {},
    // `hash` was tied to the non-embedded variant, which the site never renders.
    hash: false,
    navigationControl: false,
    geolocateControl: false,
    maptilerLogo: false,
  });

  const applyLanguage = (value) => {
    try {
      map.setLanguage(value === "native" ? sdk.Language.LOCAL : value);
    } catch {
      // Language code the SDK does not know — ignored rather than treated as an error.
    }
  };

  map.on("load", () => {
    map.resize();
    applyLanguage(code);

    // The original deliberately stayed on Zurich for the initial load and only
    // used a language's bbox on subsequent changes.
    const explicit = root.getAttribute("data-active-language");
    if (explicit && current.bbox) {
      map.fitBounds(parseBbox(current.bbox), { animate: true, padding: 10 });
    }
  });
}
