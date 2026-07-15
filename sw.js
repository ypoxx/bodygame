const CACHE_NAME = "anatomyquest3d-mobile-v17";
const APP_SHELL_FILES = [
  "./",
  "./index.html",
  "./favicon.ico",
  "./styles.css",
  "./styles.css?v=20260715-8",
  "./app.js",
  "./app.js?v=20260715-9",
  "./quizdata.json",
  "./content/structures.json",
  "./content/v2/runtime-index.json",
  "./manifest.json",
  "./src/core/eventBus.js",
  "./src/state/store.js",
  "./src/theme/themeEngine.js",
  "./src/theme/themeEngine.js?v=20260714-1",
  "./src/theme/tokens.js",
  "./src/theme/tokens.js?v=20260714-1",
  "./src/engine/renderer.js",
  "./src/engine/renderer.js?v=20260715-2",
  "./src/engine/cameraController.js",
  "./src/engine/cameraController.js?v=20260714-3",
  "./src/game/modes.js",
  "./src/game/roundStateMachine.js",
  "./src/game/mutators.js",
  "./src/game/mutators.js?v=20260714-3",
  "./src/game/bossRounds.js",
  "./src/game/scoring.js",
  "./src/audio/audioEngine.js",
  "./src/ui/onboarding.js",
  "./src/ui/onboarding.js?v=20260715-4",
  "./src/ui/exploreSearch.js",
  "./src/ui/exploreSearch.js?v=20260715-1",
  "./src/ui/exploreContent.js",
  "./src/ui/exploreContent.js?v=20260715-2",
  "./src/ui/exploreTerminology.js",
  "./src/ui/exploreTerminology.js?v=20260715-2",
  "./src/anatomy/softTissueTaxonomy.js",
  "./src/anatomy/softTissueTaxonomy.js?v=20260715-2",
  "./src/progression/progression.js",
  "./src/learning/adaptiveSelector.js",
  "./src/challenges/challengeEngine.js",
  "./src/competition/ghostReplay.js",
  "./src/competition/leaderboardAdapter.js",
  "./src/telemetry/events.js",
  "./assets/icons/icon-192.svg",
  "./assets/icons/icon-512.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/draco/draco_decoder.js",
  "./assets/draco/draco_decoder.wasm",
  "./assets/draco/draco_wasm_wrapper.js",
  "./assets/derived/skeleton.mobile-lod1.v2.glb",
  "./assets/derived/muscles.mobile-lod1.v2.glb",
  "./vendor/three/0.185.0/build/three.module.min.js",
  "./vendor/three/0.185.0/build/three.core.min.js",
  "./vendor/three/0.185.0/examples/jsm/controls/OrbitControls.js",
  "./vendor/three/0.185.0/examples/jsm/environments/RoomEnvironment.js",
  "./vendor/three/0.185.0/examples/jsm/loaders/DRACOLoader.js",
  "./vendor/three/0.185.0/examples/jsm/loaders/GLTFLoader.js",
  "./vendor/three/0.185.0/examples/jsm/utils/BufferGeometryUtils.js",
  "./vendor/three/0.185.0/examples/jsm/utils/SkeletonUtils.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  if (shouldUseNetworkFirst(event.request)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});

function shouldUseNetworkFirst(request) {
  if (!isSameOrigin(request.url)) {
    return false;
  }
  if (request.mode === "navigate") {
    return true;
  }

  const { pathname } = new URL(request.url);
  return (
    pathname.endsWith(".js") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".glb") ||
    pathname.endsWith(".json") ||
    pathname.endsWith(".webmanifest") ||
    pathname.endsWith("/index.html") ||
    pathname === "/" ||
    pathname.endsWith("/sw.js")
  );
}

function isSameOrigin(url) {
  return new URL(url).origin === self.location.origin;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status < 400) {
      const copy = response.clone();
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, copy);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    if (request.mode === "navigate") {
      return caches.match("./index.html");
    }
    throw new Error("Network and cache unavailable.");
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response && response.status < 400) {
    const copy = response.clone();
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, copy);
  }
  return response;
}
