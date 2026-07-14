import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createEventBus } from "./src/core/eventBus.js";
import { createStore } from "./src/state/store.js";
import { createThemeEngine } from "./src/theme/themeEngine.js?v=20260714-1";
import { GAME_MODES, getMode } from "./src/game/modes.js";
import { createRoundStateMachine } from "./src/game/roundStateMachine.js";
import { createMutatorEngine } from "./src/game/mutators.js?v=20260714-3";
import { createBossRoundManager } from "./src/game/bossRounds.js";
import { computeAnswerScore, computeAccuracy, computeRank } from "./src/game/scoring.js";
import { createRendererEngine } from "./src/engine/renderer.js?v=20260714-1";
import { createCameraController } from "./src/engine/cameraController.js?v=20260714-3";
import { createAudioEngine } from "./src/audio/audioEngine.js";
import { createOnboarding } from "./src/ui/onboarding.js?v=20260714-1";
import { createProgressionEngine } from "./src/progression/progression.js";
import { createAdaptiveSelector } from "./src/learning/adaptiveSelector.js";
import { createChallengeEngine } from "./src/challenges/challengeEngine.js";
import { createGhostReplay } from "./src/competition/ghostReplay.js";
import { createLeaderboardAdapter } from "./src/competition/leaderboardAdapter.js";
import { createTelemetry } from "./src/telemetry/events.js";

const STORAGE_KEYS = {
  highScoreLegacy: "aq3d.highScore",
  bestByMode: "aq3d.bestByMode",
  unlocked: "aq3d.unlockedCards",
  profile: "aq3d.profile",
  soundEnabled: "aq3d.soundEnabled",
  hapticsEnabled: "aq3d.hapticsEnabled",
  audioMaster: "aq3d.audio.master",
  audioSfx: "aq3d.audio.sfx",
  audioUi: "aq3d.audio.ui",
};

const DEFAULT_SELECTION = {
  nameDe: "Noch nichts ausgewählt",
  nameLatin: "–",
  funFact: "Wähle einen Modus und starte die Runde.",
};

const LAYER_CYCLE = ["bones", "muscles", "fasciae"];
const BUILD_ID = "2026-07-14.mobile-atlas.3";
const USE_MOBILE_LOD = shouldUseMobileLod();
const MODEL_ASSETS = {
  skeleton: USE_MOBILE_LOD
    ? ["./assets/derived/skeleton.mobile-lod1.v1.glb", "./assets/skeleton.glb"]
    : ["./assets/skeleton.glb", "./assets/derived/skeleton.mobile-lod1.v1.glb"],
  muscles: USE_MOBILE_LOD
    ? ["./assets/derived/muscles.mobile-lod1.v1.glb", "./assets/muscles.glb"]
    : ["./assets/muscles.glb", "./assets/derived/muscles.mobile-lod1.v1.glb"],
};
const PROFILE_PRESETS = {
  male: {
    key: "male",
    label: "Männlich",
    skeletonCandidates: MODEL_ASSETS.skeleton,
    muscleCandidates: MODEL_ASSETS.muscles,
  },
  female: {
    key: "female",
    label: "Weiblich",
    skeletonCandidates: MODEL_ASSETS.skeleton,
    muscleCandidates: MODEL_ASSETS.muscles,
  },
};

function shouldUseMobileLod() {
  const narrowViewport = window.matchMedia("(max-width: 52rem)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const limitedMemory = Number(navigator.deviceMemory || 8) <= 4;
  const saveData = Boolean(navigator.connection?.saveData);
  return narrowViewport || coarsePointer || limitedMemory || saveData;
}
const ui = {
  appShell: document.querySelector(".app-shell"),
  canvas: document.getElementById("sceneCanvas"),
  scenePanel: document.getElementById("scenePanel"),
  infoPanel: document.querySelector(".info-panel"),
  sheetHandleBtn: document.getElementById("sheetHandleBtn"),
  gestureHint: document.getElementById("gestureHint"),
  modeBadge: document.getElementById("modeBadge"),
  challengeBadge: document.getElementById("challengeBadge"),
  weeklyBadge: document.getElementById("weeklyBadge"),
  levelValue: document.getElementById("levelValue"),
  highScoreValue: document.getElementById("highScoreValue"),
  targetBanner: document.getElementById("targetBanner"),
  targetPrompt: document.getElementById("targetPrompt"),
  targetMeta: document.getElementById("targetMeta"),
  question: document.getElementById("questionText"),
  mutatorText: document.getElementById("mutatorText"),
  roundRuleText: document.getElementById("roundRuleText"),
  layerLockHint: document.getElementById("layerLockHint"),
  timerValue: document.getElementById("timerValue"),
  timerChip: document.getElementById("timerChip"),
  comboValue: document.getElementById("comboValue"),
  comboChip: document.getElementById("comboChip"),
  multiplierValue: document.getElementById("multiplierValue"),
  multiplierChip: document.getElementById("multiplierChip"),
  livesValue: document.getElementById("livesValue"),
  livesChip: document.getElementById("livesChip"),
  startRoundBtn: document.getElementById("startRoundBtn"),
  stopRoundBtn: document.getElementById("stopRoundBtn"),
  skipQuestionBtn: document.getElementById("skipQuestionBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  soundToggleBtn: document.getElementById("soundToggleBtn"),
  layerBonesBtn: document.getElementById("layerBonesBtn"),
  layerMusclesBtn: document.getElementById("layerMusclesBtn"),
  layerFasciaeBtn: document.getElementById("layerFasciaeBtn"),
  profileMaleBtn: document.getElementById("profileMaleBtn"),
  profileFemaleBtn: document.getElementById("profileFemaleBtn"),
  modeButtons: Array.from(document.querySelectorAll("[data-game-mode]")),
  scoreValue: document.getElementById("scoreValue"),
  correctValue: document.getElementById("correctValue"),
  wrongValue: document.getElementById("wrongValue"),
  streakValue: document.getElementById("streakValue"),
  unlockedCountValue: document.getElementById("unlockedCountValue"),
  nameDeValue: document.getElementById("nameDeValue"),
  nameLatinValue: document.getElementById("nameLatinValue"),
  factValue: document.getElementById("factValue"),
  collectionList: document.getElementById("collectionList"),
  leaderboardList: document.getElementById("leaderboardList"),
  countdownOverlay: document.getElementById("countdownOverlay"),
  countdownValue: document.getElementById("countdownValue"),
  resultsModal: document.getElementById("resultsModal"),
  finalModeValue: document.getElementById("finalModeValue"),
  finalScoreValue: document.getElementById("finalScoreValue"),
  finalHitsValue: document.getElementById("finalHitsValue"),
  finalAccuracyValue: document.getElementById("finalAccuracyValue"),
  finalComboValue: document.getElementById("finalComboValue"),
  finalTimeValue: document.getElementById("finalTimeValue"),
  finalRankValue: document.getElementById("finalRankValue"),
  playAgainBtn: document.getElementById("playAgainBtn"),
  closeResultsBtn: document.getElementById("closeResultsBtn"),
  resultsTitle: document.getElementById("resultsTitle"),
  finalBossValue: document.getElementById("finalBossValue"),
  finalMutatorsValue: document.getElementById("finalMutatorsValue"),
  finalChallengeValue: document.getElementById("finalChallengeValue"),
  masterVolumeInput: document.getElementById("masterVolumeInput"),
  sfxVolumeInput: document.getElementById("sfxVolumeInput"),
  uiVolumeInput: document.getElementById("uiVolumeInput"),
  hapticsToggleInput: document.getElementById("hapticsToggleInput"),
  flashOverlay: document.getElementById("flashOverlay"),
  toast: document.getElementById("toast"),
  panelTabButtons: Array.from(document.querySelectorAll("[data-panel-tab-btn]")),
  panelTabSections: Array.from(document.querySelectorAll("[data-panel-tab]")),
};

const state = {
  activeLayer: "bones",
  simulatedMuscleLook: false,
  profileKey: loadStoredProfile(),
  soundEnabled: loadStoredSoundEnabled(),
  hapticsEnabled: loadStoredHapticsEnabled(),
  activeThemeKey: "gameshow",
  activePanelTab: "play",
  sheetState: "expanded",
  requestedLayer: null,
  muscleLoadPromise: null,
  muscleLoadScheduled: false,
  assetGeneration: 0,
  selectedGameMode: "speedrun",
  activeMutators: [],
  activeMutatorLabels: [],
  dailyChallenge: null,
  weeklyChallenge: null,
  quizData: [],
  quizById: new Map(),
  tokenToId: new Map(),
  patternTokens: [],
  score: 0,
  streak: 0,
  correct: 0,
  wrong: 0,
  unlocked: loadStoredUnlocked(),
  bestByMode: loadStoredBestByMode(),
  selectedMesh: null,
  roots: {
    skeleton: null,
    muscle: null,
  },
  selectables: {
    bones: [],
    muscles: [],
    fasciae: [],
  },
  round: {
    id: 0,
    status: "idle",
    config: GAME_MODES.speedrun,
    currentQuestion: null,
    startedAt: 0,
    endAt: 0,
    elapsedSec: 0,
    timeRemaining: 0,
    answered: 0,
    correct: 0,
    wrong: 0,
    combo: 0,
    maxCombo: 0,
    perfectHits: 0,
    multiplier: 1,
    lives: null,
    recentIds: [],
    seenIds: [],
    endedReason: null,
    lastTickCueSecond: null,
    challengeSeed: null,
    lastUpdateAt: 0,
    allowedLayers: ["bones"],
  },
  toastTimer: null,
  toastQueue: [],
  toastVisible: false,
  pulseTimer: null,
  isLoadingProfile: false,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  lastFocusedElement: null,
  flags: {
    comboScale: 1,
    timeDrainPerSec: 0,
  },
  feel: {
    comboTier: 0,
    timerBand: "calm",
    bossActive: false,
  },
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x171116);
scene.fog = new THREE.Fog(0x171116, 6, 18);

const camera = new THREE.PerspectiveCamera(39, 1, 0.01, 80);
camera.position.set(2.2, 1.2, 3.8);

const cameraController = createCameraController({ camera, canvas: ui.canvas });
const rendererEngine = createRendererEngine({ canvas: ui.canvas, scene, camera });

const environment = new RoomEnvironment();
const pmremGenerator = new THREE.PMREMGenerator(rendererEngine.renderer);
const environmentTarget = pmremGenerator.fromScene(environment, 0.035);
scene.environment = environmentTarget.texture;
pmremGenerator.dispose();
environment.dispose?.();

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("./assets/draco/");
dracoLoader.setWorkerLimit(USE_MOBILE_LOD ? 2 : 3);
dracoLoader.preload();
gltfLoader.setDRACOLoader(dracoLoader);

const rootGroup = new THREE.Group();
scene.add(rootGroup);

const hemiLight = new THREE.HemisphereLight(0xffeee2, 0x1b0f17, 0.78);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xfff2e5, 1.82);
keyLight.position.set(4.8, 7.2, 5.4);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xd8a79c, 0.72);
fillLight.position.set(-5.2, 3.4, 3.2);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xf08e79, 0.68);
rimLight.position.set(-4.2, 5.4, -5.5);
scene.add(rimLight);

const floorMaterial = new THREE.MeshStandardMaterial({
  color: 0x2b1b22,
  roughness: 1,
  metalness: 0,
  transparent: true,
  opacity: 0.11,
});

const floor = new THREE.Mesh(new THREE.CircleGeometry(3.2, 64), floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.35;
scene.add(floor);

const contactShadowMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  toneMapped: false,
  uniforms: {
    uColor: { value: new THREE.Color(0x050305) },
    uOpacity: { value: 0.46 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform float uOpacity;
    varying vec2 vUv;
    void main() {
      float distanceFromCenter = length(vUv - 0.5) * 2.0;
      float alpha = (1.0 - smoothstep(0.08, 1.0, distanceFromCenter)) * uOpacity;
      gl_FragColor = vec4(uColor, alpha);
    }
  `,
});
const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.72), contactShadowMaterial);
contactShadow.rotation.x = -Math.PI / 2;
contactShadow.position.y = floor.position.y + 0.006;
contactShadow.renderOrder = 2;
scene.add(contactShadow);

const sound = createAudioEngine();
const roundFsm = createRoundStateMachine("idle");
const mutatorEngine = createMutatorEngine();
const bossRoundManager = createBossRoundManager({ interval: 6, durationMs: 12000 });
const progressionEngine = createProgressionEngine();
const adaptiveSelector = createAdaptiveSelector();
const challengeEngine = createChallengeEngine();
const ghostReplay = createGhostReplay();
const leaderboardAdapter = createLeaderboardAdapter();
const telemetry = createTelemetry();
const eventBus = createEventBus();
const store = createStore({
  mode: state.selectedGameMode,
  score: 0,
  layer: state.activeLayer,
  status: state.round.status,
});

const themeEngine = createThemeEngine({
  onThemeChange: (theme) => {
    applyThemeToScene(theme.scene);
    rendererEngine.applyTheme(theme.scene);
    state.activeThemeKey = theme.key;
    if (ui.themeToggleBtn) {
      ui.themeToggleBtn.textContent = `Darstellung: ${theme.label}`;
    }
  },
});

const onboarding = createOnboarding({
  onDone: () => {
    showToast("Einführung abgeschlossen.");
  },
});

const TIMINGS = {
  countdownTickMs: state.reducedMotion ? 280 : 560,
  countdownGoMs: state.reducedMotion ? 150 : 280,
  answerCorrectMs: state.reducedMotion ? 180 : 520,
  answerWrongMs: state.reducedMotion ? 220 : 760,
  answerSkipMs: state.reducedMotion ? 160 : 380,
  toastMs: 2100,
};

bootstrap();

function bootstrap() {
  console.info(`[AQ3D] build ${BUILD_ID}`);
  state.dailyChallenge = challengeEngine.getDailyChallenge();
  state.weeklyChallenge = challengeEngine.getWeeklyChallenge();

  bindUiEvents();
  bindDomainEvents();
  setSelection(DEFAULT_SELECTION);
  setGameMode(state.selectedGameMode);
  setLayer("bones");
  updateProfileButtons();
  updateRoundRuleText();
  updateChallengeBadge();
  updateProgressionHud();
  sound.setEnabled(state.soundEnabled);
  sound.setVolume(loadStoredAudioVolume(STORAGE_KEYS.audioMaster, 1));
  sound.setChannelVolume("sfx", loadStoredAudioVolume(STORAGE_KEYS.audioSfx, 0.8));
  sound.setChannelVolume("ui", loadStoredAudioVolume(STORAGE_KEYS.audioUi, 0.7));
  updateSoundButton();
  updateAudioSettingsUI();
  themeEngine.applyTheme(themeEngine.getActiveThemeKey());
  updateScoreboard();
  updateLeaderboardView();
  updateLayerLockHint();
  setQuestion("Wähle einen Spielmodus und starte die Runde.");
  setTargetPrompt("Bereit für die nächste Runde?", "Wähle Modus und Ebene", "neutral");
  setPanelTab(state.activePanelTab);

  Promise.resolve()
    .then(loadQuizData)
    .then(() => loadLayers(state.profileKey, { silent: true, eagerMuscle: false }))
    .then(() => {
      updateCollectionView();
      resizeRenderer();
      frameModelInView(false);
      startRenderLoop();
      scheduleMuscleLayerLoad(PROFILE_PRESETS[state.profileKey], true);
      registerServiceWorker();
      onboarding.showIfNeeded();
      telemetry.track("app_bootstrap_complete", {
        challenge: state.dailyChallenge?.key || null,
      });
      showToast("AnatomyQuest ist bereit.");
    })
    .catch((error) => {
      console.error(error);
      telemetry.track("app_bootstrap_failed", { message: String(error?.message || error) });
      showToast("Initialisierung fehlgeschlagen. Bitte neu laden.");
    });
}

function bindUiEvents() {
  ui.startRoundBtn.addEventListener("click", () => {
    sound.unlock();
    telemetry.track("round_start_clicked", { mode: state.selectedGameMode });
    startRound();
  });

  ui.stopRoundBtn.addEventListener("click", () => {
    finishRound("aborted");
  });

  ui.skipQuestionBtn.addEventListener("click", () => {
    skipCurrentQuestion();
  });

  ui.themeToggleBtn.addEventListener("click", () => {
    const next = themeEngine.toggleTheme();
    telemetry.track("theme_changed", { theme: next.key });
  });

  ui.soundToggleBtn.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    sound.setEnabled(state.soundEnabled);
    storeSoundEnabled(state.soundEnabled);
    telemetry.track("sound_toggle", { enabled: state.soundEnabled });
    updateSoundButton();
  });

  ui.masterVolumeInput.addEventListener("input", () => {
    const value = Number(ui.masterVolumeInput.value) / 100;
    sound.setVolume(value);
    storeAudioVolume(STORAGE_KEYS.audioMaster, value);
  });

  ui.sfxVolumeInput.addEventListener("input", () => {
    const value = Number(ui.sfxVolumeInput.value) / 100;
    sound.setChannelVolume("sfx", value);
    storeAudioVolume(STORAGE_KEYS.audioSfx, value);
  });

  ui.uiVolumeInput.addEventListener("input", () => {
    const value = Number(ui.uiVolumeInput.value) / 100;
    sound.setChannelVolume("ui", value);
    storeAudioVolume(STORAGE_KEYS.audioUi, value);
  });

  ui.hapticsToggleInput.addEventListener("change", () => {
    state.hapticsEnabled = Boolean(ui.hapticsToggleInput.checked);
    storeHapticsEnabled(state.hapticsEnabled);
    telemetry.track("haptics_toggle", { enabled: state.hapticsEnabled });
  });

  ui.profileMaleBtn.addEventListener("click", () => {
    setProfile("male");
  });

  ui.profileFemaleBtn.addEventListener("click", () => {
    setProfile("female");
  });

  ui.playAgainBtn.addEventListener("click", () => {
    hideResults();
    startRound();
  });

  ui.closeResultsBtn.addEventListener("click", () => {
    hideResults();
  });

  for (const button of ui.modeButtons) {
    button.addEventListener("click", () => {
      setGameMode(button.dataset.gameMode);
    });
  }

  ui.layerBonesBtn.addEventListener("click", () => setLayer("bones"));
  ui.layerMusclesBtn.addEventListener("click", () => setLayer("muscles"));
  ui.layerFasciaeBtn.addEventListener("click", () => setLayer("fasciae"));

  for (const tabButton of ui.panelTabButtons) {
    tabButton.addEventListener("click", () => {
      const requestedTab = tabButton.dataset.panelTabBtn || "play";
      setPanelTab(state.activePanelTab === requestedTab && requestedTab !== "play" ? "play" : requestedTab);
    });
  }

  ui.sheetHandleBtn?.addEventListener("click", () => {
    if (state.activePanelTab !== "play") {
      setPanelTab("play");
      return;
    }
    setSheetState(state.sheetState === "peek" ? "expanded" : "peek");
  });

  let pointerDown = null;
  const activePointers = new Set();

  ui.canvas.addEventListener("pointerdown", (event) => {
    sound.unlock();
    activePointers.add(event.pointerId);
    ui.gestureHint?.classList.add("dismissed");
    pointerDown = activePointers.size === 1 ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
  });

  ui.canvas.addEventListener("pointermove", () => {
    if (activePointers.size > 1) {
      pointerDown = null;
    }
  });

  ui.canvas.addEventListener("pointerup", (event) => {
    activePointers.delete(event.pointerId);
    if (!pointerDown || pointerDown.id !== event.pointerId) {
      return;
    }

    const dragDistance = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
    pointerDown = null;
    if (dragDistance > 8) {
      return;
    }
    pickMeshFromPointer(event);
  });

  ui.canvas.addEventListener("pointercancel", (event) => {
    activePointers.delete(event.pointerId);
    if (pointerDown?.id === event.pointerId) {
      pointerDown = null;
    }
  });

  window.addEventListener("resize", resizeRenderer);
  window.visualViewport?.addEventListener("resize", resizeRenderer);
  if ("ResizeObserver" in window) {
    const canvasResizeObserver = new ResizeObserver(resizeRenderer);
    canvasResizeObserver.observe(ui.canvas);
  }
  ui.infoPanel?.addEventListener("transitionend", (event) => {
    if (event.propertyName === "height") {
      resizeRenderer();
      frameModelInView(true);
    }
  });
  window.addEventListener("keydown", handleGlobalKeydown);
}

function bindDomainEvents() {
  eventBus.on("round:started", (payload) => {
    telemetry.track("round_started", payload);
  });

  eventBus.on("round:finished", (payload) => {
    telemetry.track("round_finished", payload);
  });

  eventBus.on("answer", (payload) => {
    telemetry.track("answer", payload);
  });

  store.subscribe((nextState, prevState, meta) => {
    if (nextState.status !== prevState.status) {
      telemetry.track("status_transition", {
        from: prevState.status,
        to: nextState.status,
        meta,
      });
    }
  });
}

function handleGlobalKeydown(event) {
  const openModal = document.querySelector(".results-modal:not(.hidden)");
  if (openModal && openModal !== ui.resultsModal) {
    return;
  }

  if (!ui.resultsModal.classList.contains("hidden")) {
    handleResultsModalKeydown(event);
    return;
  }

  const target = event.target;
  const inEditable =
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
  if (inEditable) {
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    if (state.round.status === "active") {
      skipCurrentQuestion();
    } else if (state.round.status !== "countdown") {
      startRound();
    }
    return;
  }

  if (event.code === "Enter" && state.round.status !== "active" && state.round.status !== "countdown") {
    startRound();
    return;
  }

  if (event.code === "Escape" && (state.round.status === "active" || state.round.status === "countdown")) {
    finishRound("aborted");
    return;
  }

  if (event.code === "KeyS" && state.round.status === "active") {
    skipCurrentQuestion();
    return;
  }

  if (event.code === "Digit1") {
    setLayer("bones");
    return;
  }
  if (event.code === "Digit2") {
    setLayer("muscles");
    return;
  }
  if (event.code === "Digit3") {
    setLayer("fasciae");
    return;
  }

  if (event.code === "KeyM") {
    setGameMode("speedrun");
    return;
  }
  if (event.code === "KeyD") {
    setGameMode("sudden_death");
    return;
  }
  if (event.code === "KeyP") {
    setGameMode("precision");
  }
}

function handleResultsModalKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    hideResults();
    return;
  }

  if (event.key !== "Tab") {
    return;
  }

  const focusables = [ui.playAgainBtn, ui.closeResultsBtn];
  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
    return;
  }

  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function setGameMode(modeKey) {
  if (state.round.status === "countdown" || state.round.status === "active") {
    return;
  }

  const mode = getMode(modeKey);
  state.selectedGameMode = mode.key;
  state.round.config = mode;
  store.setState({ mode: mode.key }, "mode_changed");

  for (const button of ui.modeButtons) {
    button.classList.toggle("active", button.dataset.gameMode === state.selectedGameMode);
  }

  updateHighScoreDisplay();
  updateLeaderboardView();
  updateRoundRuleText();
  updateLayerLockHint();
  ui.modeBadge.textContent = `${state.round.config.label} · Bereit`;
  setQuestion(state.round.config.description);
  setTargetPrompt(`Modus: ${state.round.config.label}`, state.round.config.description, "neutral");
  telemetry.track("mode_changed", { mode: state.selectedGameMode });
}

async function setProfile(profileKey) {
  if (state.round.status === "countdown" || state.round.status === "active" || state.isLoadingProfile) {
    return;
  }

  const normalized = Object.hasOwn(PROFILE_PRESETS, profileKey) ? profileKey : "male";
  if (normalized === state.profileKey && state.roots.skeleton) {
    return;
  }

  state.isLoadingProfile = true;
  updateControls();
  setQuestion(`Lade Profil ${PROFILE_PRESETS[normalized].label}...`);
  setTargetPrompt(`Lade Profil: ${PROFILE_PRESETS[normalized].label}`, "Modelle werden vorbereitet.", "countdown");

  try {
    await loadLayers(normalized, { silent: false });
    state.profileKey = normalized;
    storeProfile(state.profileKey);
    updateProfileButtons();
    setLayer("bones");
    frameModelInView(false);
    setQuestion(`${PROFILE_PRESETS[state.profileKey].label} bereit. Starte die Runde.`);
    setTargetPrompt(
      `${PROFILE_PRESETS[state.profileKey].label} bereit`,
      "Starte eine Runde und triff die Zielstruktur möglichst schnell.",
      "neutral",
    );
    telemetry.track("profile_changed", { profile: state.profileKey });
  } catch (error) {
    console.error(error);
    showToast("Profil konnte nicht geladen werden.");
    setTargetPrompt("Profil konnte nicht laden", "Nutze die Standardmodelle oder lade neu.", "danger");
  } finally {
    state.isLoadingProfile = false;
    updateControls();
  }
}

function updateProfileButtons() {
  ui.profileMaleBtn.classList.toggle("active", state.profileKey === "male");
  ui.profileFemaleBtn.classList.toggle("active", state.profileKey === "female");
}

function updateSoundButton() {
  ui.soundToggleBtn.textContent = state.soundEnabled ? "Ton: An" : "Ton: Aus";
  ui.soundToggleBtn.setAttribute("aria-pressed", String(state.soundEnabled));
}

function updateAudioSettingsUI() {
  const master = loadStoredAudioVolume(STORAGE_KEYS.audioMaster, 1);
  const sfx = loadStoredAudioVolume(STORAGE_KEYS.audioSfx, 0.8);
  const uiVolume = loadStoredAudioVolume(STORAGE_KEYS.audioUi, 0.7);

  ui.masterVolumeInput.value = String(Math.round(master * 100));
  ui.sfxVolumeInput.value = String(Math.round(sfx * 100));
  ui.uiVolumeInput.value = String(Math.round(uiVolume * 100));
  ui.hapticsToggleInput.checked = state.hapticsEnabled;
}

function setPanelTab(tabKey) {
  const allowedTabs = new Set(["play", "info", "settings"]);
  const next = allowedTabs.has(tabKey) ? tabKey : "play";
  state.activePanelTab = next;
  ui.appShell.dataset.activePanel = next;

  for (const button of ui.panelTabButtons) {
    const active = (button.dataset.panelTabBtn || "") === next;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  }

  for (const section of ui.panelTabSections) {
    const sectionTab = section.dataset.panelTab || "play";
    const active = sectionTab === next;
    section.classList.toggle("tab-hidden", !active);
  }

  if (next === "play") {
    const compactRound = state.round.status === "countdown" || state.round.status === "active";
    setSheetState(compactRound ? "peek" : "expanded");
  } else {
    setSheetState("full");
  }
}

function setSheetState(sheetState) {
  const allowedStates = new Set(["peek", "expanded", "full"]);
  const next = allowedStates.has(sheetState) ? sheetState : "expanded";
  state.sheetState = next;
  ui.appShell.dataset.sheetState = next;
  ui.sheetHandleBtn?.setAttribute("aria-expanded", String(next !== "peek"));
  window.requestAnimationFrame(resizeRenderer);
}

function syncUiState() {
  const supportedStates = new Set(["idle", "countdown", "active", "ended"]);
  const roundStatus = supportedStates.has(state.round.status) ? state.round.status : "idle";
  ui.appShell.dataset.roundStatus = roundStatus;
}

function setTargetPrompt(title, meta = "", tone = "neutral") {
  if (!ui.targetPrompt || !ui.targetBanner) {
    return;
  }

  const supportedTones = ["neutral", "active", "boss", "success", "danger", "countdown"];
  const resolvedTone = supportedTones.includes(tone) ? tone : "neutral";
  const toneClasses = supportedTones.map((name) => `tone-${name}`);

  ui.targetPrompt.textContent = title || "Runde starten";
  if (ui.targetMeta) {
    ui.targetMeta.textContent = meta || "";
    ui.targetMeta.classList.toggle("hidden", !meta);
  }

  ui.targetBanner.classList.remove(...toneClasses);
  ui.targetBanner.classList.add(`tone-${resolvedTone}`);
  ui.targetBanner.classList.toggle("boss-pulse", resolvedTone === "boss");
}

function updateRoundRuleText() {
  const mode = state.round.config || getMode(state.selectedGameMode);
  const lives = mode.lives === null ? "Unbegrenzt" : String(mode.lives);
  const target = mode.targetAnswers ? `${mode.targetAnswers} Treffer` : "Zeitbasiert";
  const penalties = `Fehler -${mode.wrongPenalty}, Skip -${mode.skipPenalty}`;
  ui.roundRuleText.textContent = `Regel: ${mode.label} | Ziel: ${target} | Leben: ${lives} | ${penalties}`;
}

function updateMutatorText() {
  if (!ui.mutatorText) {
    return;
  }

  if (!state.activeMutatorLabels.length) {
    ui.mutatorText.textContent = "Mutatoren: keine";
    return;
  }

  ui.mutatorText.textContent = `Mutatoren: ${state.activeMutatorLabels.join(", ")}`;
}

function updateChallengeBadge() {
  if (!ui.challengeBadge || !ui.weeklyBadge) {
    return;
  }
  ui.challengeBadge.textContent = `Daily: ${state.dailyChallenge?.label || "n/a"}`;
  ui.weeklyBadge.textContent = `Weekly: ${state.weeklyChallenge?.label || "n/a"}`;
}

function updateProgressionHud() {
  if (!ui.levelValue) {
    return;
  }
  const progress = progressionEngine.getState();
  ui.levelValue.textContent = String(progress.level);
}

function updateLeaderboardView() {
  if (!ui.leaderboardList) {
    return;
  }

  const top = leaderboardAdapter.top(state.selectedGameMode, 5);
  ui.leaderboardList.innerHTML = "";

  if (!top.length) {
    const empty = document.createElement("li");
    empty.className = "collection-item locked";
    empty.textContent = "Noch keine Einträge.";
    ui.leaderboardList.append(empty);
    return;
  }

  top.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "collection-item unlocked";
    const timestamp = new Date(entry.timestamp).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
    });
    item.textContent = `#${index + 1} ${entry.score} Punkte | ${entry.accuracy}% | Rang ${entry.rank} | ${timestamp}`;
    ui.leaderboardList.append(item);
  });
}

function updateLayerLockHint() {
  if (!ui.layerLockHint) {
    return;
  }

  const inRound = state.round.status === "active" || state.round.status === "countdown";
  const singleLayerRound = state.round.allowedLayers.length <= 1;
  const shouldShow = inRound && singleLayerRound;

  ui.layerLockHint.classList.toggle("hidden", !shouldShow);
  if (shouldShow) {
    const onlyLayer = state.round.allowedLayers[0] || "bones";
    const label = onlyLayer === "muscles" ? "Muskel-Layer" : onlyLayer === "fasciae" ? "Faszien-Layer" : "Knochen-Layer";
    ui.layerLockHint.textContent = `In dieser Runde ist nur der ${label} aktiv.`;
  }
}

function applyThemeToScene(themeScene) {
  if (!themeScene) {
    return;
  }

  scene.background.set(themeScene.background);
  scene.fog.color.set(themeScene.fog);
  floorMaterial.color.set(themeScene.floor);

  keyLight.color.set(themeScene.keyLight.color);
  keyLight.intensity = themeScene.keyLight.intensity;

  fillLight.color.set(themeScene.fillLight.color);
  fillLight.intensity = themeScene.fillLight.intensity;

  hemiLight.color.set(themeScene.hemiLight.color);
  hemiLight.intensity = themeScene.hemiLight.intensity;

  rimLight.color.set(themeScene.rimLight.color);
  rimLight.intensity = themeScene.rimLight.intensity;
}

function frameModelInView(smooth = true) {
  const target =
    state.activeLayer === "bones"
      ? state.roots.skeleton || state.roots.muscle || rootGroup
      : state.roots.muscle || state.roots.skeleton || rootGroup;

  if (!target) {
    return;
  }

  if (state.sheetState === "full") {
    return;
  }

  const compactSheet = state.sheetState === "peek";
  const shortStage = ui.canvas.clientHeight < 560;
  cameraController.fitToObject(
    target,
    {
      margin: 1,
      targetHeightRatio: compactSheet ? (shortStage ? 0.7 : 0.74) : 0.76,
      targetWidthRatio: 0.84,
      yOffsetRatio: compactSheet && shortStage ? 0.2 : 0.12,
      constrainZoom: true,
      direction: [0.58, 0.08, 1],
      durationMs: 420,
      smooth,
    },
    smooth,
  );
}

function updateStageFloor(meshes = getActiveSelectables()) {
  const bounds = new THREE.Box3();
  const worldBounds = new THREE.Box3();
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  bounds.makeEmpty();

  for (const mesh of meshes) {
    if (!mesh?.visible || !mesh.geometry) {
      continue;
    }
    if (!mesh.geometry.boundingBox) {
      mesh.geometry.computeBoundingBox();
    }
    if (!mesh.geometry.boundingBox) {
      continue;
    }
    mesh.updateWorldMatrix(true, false);
    worldBounds.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    bounds.union(worldBounds);
  }

  if (bounds.isEmpty()) {
    return;
  }

  bounds.getCenter(center);
  bounds.getSize(size);
  const floorY = bounds.min.y - Math.max(0.006, size.y * 0.004);
  floor.position.set(center.x, floorY, center.z);
  contactShadow.position.set(center.x, floorY + 0.006, center.z);
  contactShadow.scale.set(
    THREE.MathUtils.clamp(size.x / 0.68, 0.72, 1.65),
    THREE.MathUtils.clamp(Math.max(size.z, size.x * 0.48) / 0.42, 0.7, 1.55),
    1,
  );
}

function startRound() {
  if (!state.quizData.length) {
    showToast("Keine Quizdaten verfügbar.");
    setTargetPrompt("Keine Quizdaten", "Bitte prüfe die Inhaltsdateien.", "danger");
    return;
  }
  if (state.round.status === "countdown" || state.round.status === "active") {
    return;
  }

  hideResults();
  setPanelTab("play");
  roundFsm.transition("countdown", true);
  bossRoundManager.reset();

  const loadedLayers = new Set(["bones"]);
  if (state.selectables.muscles.length) {
    loadedLayers.add("muscles");
  }
  if (state.selectables.fasciae.length) {
    loadedLayers.add("fasciae");
  }
  const allowedLayers = Array.from(
    new Set(state.quizData.map((item) => item.layer || "bones").filter((layer) => loadedLayers.has(layer))),
  );
  if (!allowedLayers.includes(state.activeLayer)) {
    setLayer(allowedLayers[0] || "bones");
    showToast(`Quiz-Layer gewechselt auf ${allowedLayers[0] || "bones"}.`);
  }

  state.flags.comboScale = 1;
  state.flags.timeDrainPerSec = 0;
  const seed = state.dailyChallenge?.seed || Date.now();
  const seededRng = challengeEngine.buildSeededRandom((seed + state.round.id + 1) >>> 0);
  const pickedMutators = mutatorEngine.pickForMode(state.selectedGameMode, seededRng);
  mutatorEngine.apply(pickedMutators, {
    cameraController,
    flags: state.flags,
  });
  state.activeMutators = pickedMutators.map((mutator) => mutator.key);
  state.activeMutatorLabels = pickedMutators.map((mutator) => mutator.label);
  updateMutatorText();

  const activeMode = getMode(state.selectedGameMode);
  ghostReplay.startRun({ modeKey: activeMode.key, seed });

  state.round = {
    ...state.round,
    id: state.round.id + 1,
    status: "countdown",
    config: activeMode,
    currentQuestion: null,
    startedAt: 0,
    endAt: 0,
    elapsedSec: 0,
    timeRemaining: activeMode.durationSec,
    answered: 0,
    correct: 0,
    wrong: 0,
    combo: 0,
    maxCombo: 0,
    perfectHits: 0,
    multiplier: 1,
    lives: activeMode.lives,
    recentIds: [],
    seenIds: [],
    endedReason: null,
    lastTickCueSecond: null,
    challengeSeed: seed,
    lastUpdateAt: 0,
    allowedLayers,
  };

  state.score = 0;
  state.streak = 0;
  state.correct = 0;
  state.wrong = 0;
  state.feel.comboTier = 0;
  state.feel.timerBand = "calm";
  state.feel.bossActive = false;
  setSheetState("peek");

  store.setState(
    {
      status: "countdown",
      score: state.score,
    },
    "round_start",
  );

  eventBus.emit("round:started", {
    mode: state.selectedGameMode,
    mutators: [...state.activeMutators],
    seed,
  });

  updateScoreboard();
  updateRoundHud();
  updateLayerLockHint();
  updateControls();
  showToast(`Runde: ${activeMode.label}. ${state.round.allowedLayers.join(", ")} aktiv.`);
  setTargetPrompt("Runde startet …", `${activeMode.label} wird vorbereitet.`, "countdown");

  const roundId = state.round.id;
  runCountdown(roundId);
}

async function runCountdown(roundId) {
  showCountdown("3");
  const mutatorSummary = state.activeMutatorLabels.length ? state.activeMutatorLabels.join(", ") : "Keine";
  setQuestion(`Runde startet. Regel aktiv: ${state.round.config.label}. Mutatoren: ${mutatorSummary}.`);

  for (const tick of [3, 2, 1]) {
    if (roundId !== state.round.id || state.round.status !== "countdown") {
      hideCountdown();
      return;
    }
    showCountdown(String(tick));
    setTargetPrompt(`Start in ${tick}`, `Modus ${state.round.config.label} | Mutatoren: ${mutatorSummary}`, "countdown");
    sound.countdown(tick);
    if (tick === 1) {
      triggerHaptic(12);
    }
    await delay(TIMINGS.countdownTickMs);
  }

  if (roundId !== state.round.id || state.round.status !== "countdown") {
    hideCountdown();
    return;
  }

  showCountdown("GO");
  setTargetPrompt("Los!", "Finde die Zielstruktur so schnell wie möglich.", "active");
  sound.go();
  triggerHaptic([16, 24, 28]);
  await delay(TIMINGS.countdownGoMs);
  hideCountdown();

  if (roundId !== state.round.id || state.round.status !== "countdown") {
    return;
  }

  beginActiveRound();
}

function beginActiveRound() {
  roundFsm.transition("active");
  state.round.status = "active";
  state.round.startedAt = performance.now();
  state.round.endAt = state.round.startedAt + state.round.config.durationSec * 1000;
  state.round.timeRemaining = state.round.config.durationSec;
  state.round.lastTickCueSecond = Math.ceil(state.round.timeRemaining);
  state.round.lastUpdateAt = state.round.startedAt;

  ui.modeBadge.textContent = `${state.round.config.label} · Aktiv`;
  sound.roundStart();
  store.setState({ status: "active" }, "round_live");
  updateControls();
  updateRoundHud();
  nextQuestion();
}

function nextQuestion() {
  if (state.round.status !== "active" || !state.quizData.length) {
    return;
  }

  const bossState = bossRoundManager.update();
  const allowed = state.round.allowedLayers || ["bones"];
  const preferredLayer = allowed.includes(state.activeLayer) ? state.activeLayer : allowed[0];
  const allowedPool = state.quizData.filter((item) => allowed.includes(item.layer || "bones"));
  const seenSet = new Set(state.round.seenIds || []);
  const unaskedAllowedPool = allowedPool.filter((item) => !seenSet.has(item.id));
  const effectiveAllowedPool = unaskedAllowedPool.length ? unaskedAllowedPool : allowedPool;
  const layerPool = effectiveAllowedPool.filter((item) => (item.layer || "bones") === preferredLayer);
  const candidate = adaptiveSelector.pickNextQuestion({
    recentIds: state.round.recentIds,
    itemsOverride: layerPool.length ? layerPool : effectiveAllowedPool,
  });
  if (!candidate) {
    return;
  }

  state.round.currentQuestion = {
    ...candidate,
    startedAt: performance.now(),
    answered: false,
    bossActive: bossState.active,
  };

  state.round.recentIds.push(candidate.id);
  if (state.round.recentIds.length > 6) {
    state.round.recentIds.shift();
  }
  state.round.seenIds.push(candidate.id);
  if (state.round.seenIds.length > 320) {
    state.round.seenIds.shift();
  }

  const candidateLayer = candidate.layer || "bones";
  if (candidateLayer !== state.activeLayer) {
    setLayer(candidateLayer);
    showToast(`Frage-Layer gewechselt: ${candidateLayer}.`);
  }

  const prefix = bossState.active ? "BONUSRUNDE · " : "";
  const layerLabel = candidateLayer === "muscles" ? "Muskel" : candidateLayer === "fasciae" ? "Faszie" : "Knochen";
  setQuestion(`${prefix}Finde ${candidate.nameLatin} (${candidate.nameDe}) [${layerLabel}].`);
  setTargetPrompt(
    `${prefix}Finde: ${candidate.nameLatin}`,
    `${candidate.nameDe} · ${layerLabel}`,
    bossState.active ? "boss" : "active",
  );
}

function skipCurrentQuestion() {
  if (state.round.status !== "active" || !state.round.currentQuestion || state.round.currentQuestion.answered) {
    return;
  }

  const config = state.round.config;

  state.round.currentQuestion.answered = true;
  adaptiveSelector.recordResult(state.round.currentQuestion.id, false);
  state.round.answered += 1;
  state.round.wrong += 1;
  state.wrong = state.round.wrong;
  state.streak = 0;
  state.round.combo = 0;
  state.round.multiplier = 1;

  if (config.lives !== null) {
    state.round.lives = Math.max(0, (state.round.lives ?? config.lives) - 1);
  }

  if (config.skipPenalty > 0) {
    state.score = Math.max(0, state.score - config.skipPenalty);
  }

  sound.wrong();
  triggerHaptic([12, 20, 12]);
  pulseFlash("wrong");
  pulseScenePanel("wrong");
  pulseHudChip(ui.comboChip, "pulse-bad");
  pulseHudChip(ui.livesChip, "pulse-bad");
  setQuestion("Frage übersprungen.");
  setTargetPrompt("Übersprungen", "Die nächste Zielstruktur folgt sofort.", "danger");
  ghostReplay.recordEvent({
    type: "skip",
    questionId: state.round.currentQuestion.id,
  });
  eventBus.emit("answer", {
    result: "skip",
    questionId: state.round.currentQuestion.id,
  });
  bossRoundManager.maybeActivate(state.round.answered);
  store.setState({ score: state.score }, "answer_skip");

  if (config.suddenDeath || state.round.lives === 0) {
    finishRound("fail");
    return;
  }

  updateScoreboard();
  updateRoundHud();
  checkRoundCompletion();

  window.setTimeout(() => {
    if (state.round.status === "active") {
      nextQuestion();
    }
  }, TIMINGS.answerSkipMs);
}

function handleRoundAnswer(mesh, entry, hitPoint = null) {
  const question = state.round.currentQuestion;
  if (!question || question.answered || state.round.status !== "active") {
    return;
  }

  question.answered = true;
  const isCorrect = Boolean(entry) && entry.id === question.id;
  const config = state.round.config;

  if (isCorrect) {
    const reactionSeconds = (performance.now() - question.startedAt) / 1000;
    const bossMultiplier = question.bossActive ? bossRoundManager.consumeHitBonus() : 1;
    const scoreResult = computeAnswerScore({
      isCorrect: true,
      reactionSeconds,
      combo: state.round.combo,
      modeConfig: config,
      bossMultiplier,
      mutatorKeys: state.activeMutators,
    });

    state.round.correct += 1;
    state.round.answered += 1;
    state.correct = state.round.correct;

    state.round.combo = scoreResult.comboNext;
    state.round.maxCombo = Math.max(state.round.maxCombo, state.round.combo);
    state.round.multiplier = scoreResult.multiplierNext;
    state.streak = scoreResult.streakNext;

    const points = scoreResult.pointsDelta;
    state.score = Math.max(0, state.score + points);

    if (reactionSeconds <= 2.2) {
      state.round.perfectHits += 1;
    }

    if (config.timeBonusOnCorrect > 0) {
      state.round.endAt += config.timeBonusOnCorrect * 1000;
    }

    adaptiveSelector.recordResult(question.id, true);
    applyMeshStyle(mesh, "correct");
    unlockCard(entry.id);
    sound.correct(state.round.combo);
    triggerHaptic(18);
    pulseFlash("correct");
    pulseScenePanel("correct");
    pulseHudChip(ui.comboChip, "pulse-good");
    pulseHudChip(ui.multiplierChip, "pulse-good");
    if (hitPoint) {
      spawnHitMarker(hitPoint.x, hitPoint.y, `+${points}`, "correct");
    }
    setQuestion(`Richtig! ${entry.nameLatin}  +${points} Punkte`);
    setTargetPrompt(`Treffer! +${points}`, `${entry.nameLatin} korrekt identifiziert.`, "success");
    ghostReplay.recordEvent({
      type: "hit",
      questionId: question.id,
      correct: true,
      reactionSeconds,
      points,
    });
    eventBus.emit("answer", {
      result: "correct",
      questionId: question.id,
      reactionSeconds,
      points,
    });
    bossRoundManager.maybeActivate(state.round.answered);
    store.setState({ score: state.score }, "answer_correct");

    updateScoreboard();
    updateRoundHud();
    checkRoundCompletion();

    window.setTimeout(() => {
      if (state.selectedMesh === mesh) {
        applyMeshStyle(mesh, "selected");
      }
      if (state.round.status === "active") {
        nextQuestion();
      }
    }, TIMINGS.answerCorrectMs);
  } else {
    const scoreResult = computeAnswerScore({
      isCorrect: false,
      reactionSeconds: 0,
      combo: state.round.combo,
      modeConfig: config,
      bossMultiplier: 1,
      mutatorKeys: state.activeMutators,
    });

    state.round.wrong += 1;
    state.round.answered += 1;
    state.wrong = state.round.wrong;

    state.streak = scoreResult.streakNext;
    state.round.combo = scoreResult.comboNext;
    state.round.multiplier = scoreResult.multiplierNext;

    if (config.lives !== null) {
      state.round.lives = Math.max(0, (state.round.lives ?? config.lives) - 1);
    }

    state.score = Math.max(0, state.score + scoreResult.pointsDelta);

    adaptiveSelector.recordResult(question.id, false);
    applyMeshStyle(mesh, "wrong");
    sound.wrong();
    triggerHaptic([12, 30, 12]);
    pulseFlash("wrong");
    pulseScenePanel("wrong");
    pulseHudChip(ui.comboChip, "pulse-bad");
    pulseHudChip(ui.livesChip, "pulse-bad");
    if (hitPoint) {
      spawnHitMarker(hitPoint.x, hitPoint.y, "X", "wrong");
    }
    setQuestion(`Falsch. Gesucht war ${question.nameLatin}.`);
    setTargetPrompt("Falsch", `Gesucht war ${question.nameLatin}.`, "danger");
    ghostReplay.recordEvent({
      type: "hit",
      questionId: question.id,
      correct: false,
      points: scoreResult.pointsDelta,
    });
    eventBus.emit("answer", {
      result: "wrong",
      questionId: question.id,
      points: scoreResult.pointsDelta,
    });
    bossRoundManager.maybeActivate(state.round.answered);
    store.setState({ score: state.score }, "answer_wrong");

    updateScoreboard();
    updateRoundHud();

    if (config.suddenDeath || state.round.lives === 0) {
      finishRound("fail");
      return;
    }

    checkRoundCompletion();

    window.setTimeout(() => {
      if (state.selectedMesh === mesh) {
        applyMeshStyle(mesh, "selected");
      }
      if (state.round.status === "active") {
        nextQuestion();
      }
    }, TIMINGS.answerWrongMs);
  }
}

function checkRoundCompletion() {
  if (state.round.status !== "active") {
    return;
  }

  const target = state.round.config.targetAnswers;
  if (target && state.round.answered >= target) {
    finishRound("target");
  }
}

function finishRound(reason) {
  if (state.round.status === "idle" || state.round.status === "ended") {
    return;
  }

  const now = performance.now();

  if (state.round.status === "countdown") {
    roundFsm.transition("ended", true);
    state.round.status = "ended";
    state.round.endedReason = "aborted";
    hideCountdown();
    setQuestion("Runde abgebrochen.");
    setTargetPrompt("Runde abgebrochen", "Du kannst direkt neu starten.", "neutral");
    ui.modeBadge.textContent = `${state.round.config.label} · Bereit`;
    mutatorEngine.clear({
      cameraController,
      flags: state.flags,
    });
    state.activeMutators = [];
    state.activeMutatorLabels = [];
    state.feel.comboTier = 0;
    state.feel.timerBand = "calm";
    state.feel.bossActive = false;
    updateMutatorText();
    store.setState({ status: "ended" }, "round_aborted");
    updateControls();
    return;
  }

  roundFsm.transition("ended", true);
  state.round.status = "ended";
  state.round.endedReason = reason;
  state.round.elapsedSec = Math.max(0, (now - state.round.startedAt) / 1000);
  state.round.timeRemaining = Math.max(0, (state.round.endAt - now) / 1000);
  const roundMutatorLabels = [...state.activeMutatorLabels];
  bossRoundManager.update(now);
  mutatorEngine.clear({
    cameraController,
    flags: state.flags,
  });
  state.activeMutators = [];
  state.activeMutatorLabels = [];
  state.feel.comboTier = 0;
  state.feel.timerBand = "calm";
  state.feel.bossActive = false;
  updateMutatorText();
  store.setState({ status: "ended", score: state.score }, "round_end");

  const modeKey = state.round.config.key;
  const best = state.bestByMode[modeKey] ?? 0;
  if (state.score > best) {
    state.bestByMode[modeKey] = state.score;
    storeBestByMode(state.bestByMode);
    showToast(`Neuer ${state.round.config.label}-Bestwert: ${state.score}`);
  }

  const accuracy = computeAccuracy(state.round.correct, state.round.answered);
  const usedTime = state.round.elapsedSec;
  const rank = computeRank({
    score: state.score,
    accuracy,
    bossHits: bossRoundManager.getState().completedCount,
  });

  const progressionResult = progressionEngine.addRoundResult({
    score: state.score,
    accuracy,
    rank,
    modeKey,
  });
  updateProgressionHud();
  if (progressionResult.levelUp) {
    showToast(`Level Up! Du bist jetzt Level ${progressionResult.currentLevel}.`);
  }

  const dailySuccess = challengeEngine.evaluateDaily(state.dailyChallenge, {
    score: state.score,
    accuracy,
    maxCombo: state.round.maxCombo,
    perfectHits: state.round.perfectHits,
  });
  if (dailySuccess) {
    showToast("Daily Challenge abgeschlossen.");
  }

  const leaderboardEntry = leaderboardAdapter.submitEntry({
    modeKey,
    score: state.score,
    accuracy,
    rank,
  });
  updateLeaderboardView();

  const weakSpots = adaptiveSelector.getWeakSpots(2);
  if (weakSpots.length) {
    const names = weakSpots
      .map((spot) => state.quizById.get(spot.id)?.nameDe || spot.id)
      .join(", ");
    showToast(`Weak Spot Training: ${names}`);
  }

  ui.finalModeValue.textContent = state.round.config.label;
  ui.resultsTitle.textContent = `${state.round.config.label} Ergebnis`;
  ui.finalScoreValue.textContent = String(state.score);
  ui.finalHitsValue.textContent = `${state.round.correct} / ${state.round.answered}`;
  ui.finalAccuracyValue.textContent = `${accuracy}%`;
  if (ui.finalComboValue) {
    ui.finalComboValue.textContent = `${state.round.maxCombo}×`;
  }
  ui.finalTimeValue.textContent = formatClock(usedTime);
  ui.finalRankValue.textContent = rank;
  ui.finalBossValue.textContent = String(bossRoundManager.getState().completedCount);
  ui.finalMutatorsValue.textContent = roundMutatorLabels.length
    ? roundMutatorLabels.join(", ")
    : "Keine";
  ui.finalChallengeValue.textContent = dailySuccess ? "Daily geschafft" : "Daily offen";

  showResults();
  sound.roundEnd(reason, rank);
  triggerHaptic(reason === "fail" ? [20, 40, 20] : [18, 14, 18, 14]);
  const ghost = ghostReplay.finishRun({
    score: state.score,
    accuracy,
    rank,
    modeKey,
  });
  if (ghost?.summary?.score === state.score) {
    showToast("Neuer Ghost-Run gespeichert.");
  }

  ui.modeBadge.textContent = `${state.round.config.label} · Beendet`;
  updateHighScoreDisplay();
  updateControls();

  const reasonText =
    reason === "time"
      ? "Zeit ist abgelaufen."
      : reason === "target"
        ? "Ziel erreicht."
        : reason === "fail"
          ? "Runde verloren."
          : "Runde beendet.";

  const levelInfo = progressionResult.levelUp
    ? ` Level Up auf ${progressionResult.currentLevel}.`
    : ` Level ${progressionResult.currentLevel}.`;
  setQuestion(`${reasonText} Score ${state.score}, Genauigkeit ${accuracy}%.${levelInfo}`);
  setTargetPrompt(
    `Runde beendet: ${rank}`,
    `${reasonText} Score ${state.score} | Genauigkeit ${accuracy}%`,
    reason === "fail" ? "danger" : "success",
  );

  eventBus.emit("round:finished", {
    reason,
    modeKey,
    score: state.score,
    accuracy,
    rank,
    dailySuccess,
    leaderboardEntry,
  });
}

function showResults() {
  state.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  ui.resultsModal.classList.remove("hidden");
  ui.resultsModal.setAttribute("aria-hidden", "false");
  window.setTimeout(() => {
    ui.playAgainBtn.focus();
  }, 0);
}

function hideResults() {
  ui.resultsModal.classList.add("hidden");
  ui.resultsModal.setAttribute("aria-hidden", "true");

  if (state.round.status === "ended") {
    state.round.status = "idle";
    roundFsm.transition("idle", true);
    store.setState({ status: "idle" }, "results_closed");
    ui.modeBadge.textContent = `${state.round.config.label} · Bereit`;
    updateLayerLockHint();
    setTargetPrompt("Bereit für die nächste Runde?", "Wähle Modus und Ebene", "neutral");
    setPanelTab("play");
    updateControls();
  }

  if (state.lastFocusedElement) {
    state.lastFocusedElement.focus();
    state.lastFocusedElement = null;
  }
}

function showCountdown(value) {
  ui.countdownValue.textContent = value;
  ui.countdownOverlay.classList.remove("hidden");
  ui.countdownOverlay.classList.add("retrigger");
  void ui.countdownOverlay.offsetWidth;
  window.requestAnimationFrame(() => ui.countdownOverlay.classList.remove("retrigger"));
}

function hideCountdown() {
  ui.countdownOverlay.classList.add("hidden");
}

function updateControls() {
  const locked = state.round.status === "countdown" || state.round.status === "active";
  const uiLocked = locked || state.isLoadingProfile;
  const inCountdown = state.round.status === "countdown";
  const inActiveRound = state.round.status === "active";
  const allowedLayers = state.round.allowedLayers || ["bones"];

  for (const button of ui.modeButtons) {
    button.disabled = uiLocked;
  }

  const layerButtons = [
    { button: ui.layerBonesBtn, key: "bones" },
    { button: ui.layerMusclesBtn, key: "muscles" },
    { button: ui.layerFasciaeBtn, key: "fasciae" },
  ];

  for (const { button, key } of layerButtons) {
    const notAllowedByRound = inActiveRound && !allowedLayers.includes(key);
    button.disabled = state.isLoadingProfile || inCountdown || notAllowedByRound;
    button.title = notAllowedByRound ? "In dieser Runde ist dieser Layer nicht Bestandteil der Fragen." : "";
  }

  ui.profileMaleBtn.disabled = uiLocked;
  ui.profileFemaleBtn.disabled = uiLocked;
  ui.themeToggleBtn.disabled = state.isLoadingProfile;
  ui.profileMaleBtn.title = uiLocked ? "Während einer aktiven Runde gesperrt." : "";
  ui.profileFemaleBtn.title = uiLocked ? "Während einer aktiven Runde gesperrt." : "";
  ui.themeToggleBtn.title = state.isLoadingProfile ? "Während des Profil-Ladens gesperrt." : "";

  ui.startRoundBtn.disabled = uiLocked;
  ui.stopRoundBtn.disabled = !locked;
  ui.skipQuestionBtn.disabled = state.round.status !== "active";
  ui.skipQuestionBtn.title = state.round.status !== "active" ? "Nur während einer aktiven Runde verfügbar." : "";

  syncUiState();
  if (state.activePanelTab === "play") {
    if (locked && state.sheetState !== "peek") {
      setSheetState("peek");
    } else if (!locked && state.round.status === "idle" && state.sheetState === "peek") {
      setSheetState("expanded");
    }
  }
  updateLayerLockHint();
}

async function loadQuizData() {
  let data = [];

  try {
    const response = await fetch("./content/structures.json");
    if (!response.ok) {
      throw new Error(`content/structures.json konnte nicht geladen werden (${response.status})`);
    }
    const structures = await response.json();
    data = structures.map((item) => ({
      id: item.id,
      nameDe: item.nameDe,
      nameLatin: item.nameLatin,
      funFact: item.funFact,
      layer: item.layer || "bones",
    }));
  } catch (contentError) {
    const fallbackResponse = await fetch("./quizdata.json");
    if (!fallbackResponse.ok) {
      throw contentError;
    }
    data = await fallbackResponse.json();
    showToast("Quiz aus quizdata.json geladen (Fallback).");
  }

  data = data.map((item) => ({
    ...item,
    layer: item.layer || "bones",
  }));

  state.quizData = data;
  state.quizById = new Map(data.map((item) => [item.id, item]));
  adaptiveSelector.setItems(data);
  buildTokenIndex(data);
}

function buildTokenIndex(data) {
  state.tokenToId.clear();
  const availableIds = new Set(data.map((entry) => entry.id));

  for (const entry of data) {
    const tokens = [entry.id, entry.nameDe, entry.nameLatin];
    for (const token of tokens) {
      const normalized = normalizeToken(token);
      if (normalized) {
        state.tokenToId.set(normalized, entry.id);
      }
    }
  }

  // Alias groups are resolved dynamically against current content IDs.
  // This keeps legacy terms (e.g. "mandibula") and model terms (e.g. "mandible")
  // mapped to an existing quiz entry instead of stale hard-coded IDs.
  const aliasGroups = [
    ["cranium", "skull", "schaedel"],
    ["femur", "osfemoris", "oberschenkelknochen"],
    ["stapes", "steigbuegel"],
    ["patella", "kniescheibe"],
    ["clavicle", "clavicula", "schluesselbein"],
    ["humerus", "oberarmknochen"],
    ["mandible", "mandibula", "unterkiefer", "lowerjaw"],
    ["scapula", "schulterblatt"],
    ["pelvis", "becken"],
    ["calcaneus", "fersenbein"],
  ];

  for (const group of aliasGroups) {
    let resolvedId = null;
    for (const aliasToken of group) {
      const candidateId = state.tokenToId.get(aliasToken);
      if (candidateId && availableIds.has(candidateId)) {
        resolvedId = candidateId;
        break;
      }
    }

    if (!resolvedId) {
      continue;
    }

    for (const aliasToken of group) {
      state.tokenToId.set(aliasToken, resolvedId);
    }
  }

  state.patternTokens = Array.from(state.tokenToId.keys()).sort((a, b) => b.length - a.length);
}

async function loadLayers(profileKey, options = {}) {
  const { silent = false, eagerMuscle = !silent } = options;
  const normalized = Object.hasOwn(PROFILE_PRESETS, profileKey) ? profileKey : "male";
  const preset = PROFILE_PRESETS[normalized];

  clearLoadedLayers();
  state.profileKey = normalized;
  updateProfileButtons();

  await loadSkeletonLayer(preset, silent);
  if (eagerMuscle) {
    await beginMuscleLayerLoad(preset, silent, state.assetGeneration);
  }
  frameModelInView(false);

  if (!silent) {
    showToast(`Profil aktiv: ${preset.label}`);
  }
}

function scheduleMuscleLayerLoad(preset, silent = true) {
  if (!preset || state.roots.muscle || state.muscleLoadPromise || state.muscleLoadScheduled) {
    return;
  }

  const generation = state.assetGeneration;
  state.muscleLoadScheduled = true;
  const start = () => {
    if (!state.muscleLoadScheduled || generation !== state.assetGeneration || state.roots.muscle) {
      return;
    }
    beginMuscleLayerLoad(preset, silent, generation);
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(start, { timeout: 2200 });
  } else {
    window.setTimeout(start, 650);
  }
}

function beginMuscleLayerLoad(preset, silent = true, generation = state.assetGeneration) {
  if (state.roots.muscle) {
    return Promise.resolve(state.roots.muscle);
  }
  if (state.muscleLoadPromise) {
    return state.muscleLoadPromise;
  }

  state.muscleLoadScheduled = false;
  const promise = loadMuscleLayer(preset, silent, generation)
    .then(() => {
      if (generation !== state.assetGeneration) {
        return null;
      }
      updateControls();
      if (state.requestedLayer && state.roots.muscle) {
        const requestedLayer = state.requestedLayer;
        state.requestedLayer = null;
        setLayer(requestedLayer);
      }
      return state.roots.muscle;
    })
    .finally(() => {
      if (state.muscleLoadPromise === promise) {
        state.muscleLoadPromise = null;
      }
    });
  state.muscleLoadPromise = promise;
  return promise;
}

function clearLoadedLayers() {
  state.assetGeneration += 1;
  state.muscleLoadPromise = null;
  state.muscleLoadScheduled = false;
  state.requestedLayer = null;
  if (state.selectedMesh) {
    applyMeshStyle(state.selectedMesh, "base");
    state.selectedMesh = null;
  }
  rendererEngine.setOutlineSelection([]);

  for (const root of [state.roots.skeleton, state.roots.muscle]) {
    if (!root) {
      continue;
    }
    rootGroup.remove(root);
    disposeNodeTree(root);
  }

  state.roots.skeleton = null;
  state.roots.muscle = null;
  state.selectables.bones = [];
  state.selectables.muscles = [];
  state.selectables.fasciae = [];
}

function disposeNodeTree(root) {
  root.traverse((node) => {
    if (!node.isMesh) {
      return;
    }
    if (node.geometry) {
      node.geometry.dispose();
    }
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (material && typeof material.dispose === "function") {
        material.dispose();
      }
    }
  });
}

async function loadSkeletonLayer(preset, silent) {
  try {
    const loaded = await loadFirstAvailableGltf(preset.skeletonCandidates);
    const model = loaded.gltf.scene;
    model.name = "skeleton-layer";
    model.position.set(0, -0.4, 0);
    rootGroup.add(model);

    state.roots.skeleton = model;
    state.selectables.bones = prepareMeshes(model, "bones");
    updateStageFloor(state.selectables.bones);

    if (!silent) {
      const fallbackHint = loaded.index > 0 ? " (Fallback-Modell)" : "";
      showToast(`Skelett geladen (${state.selectables.bones.length} Teile)${fallbackHint}.`);
    }
  } catch (error) {
    console.warn("Skelettmodell nicht gefunden, Platzhalter wird genutzt.", error);
    const fallback = createFallbackSkeleton();
    rootGroup.add(fallback);
    state.roots.skeleton = fallback;
    state.selectables.bones = prepareMeshes(fallback, "bones");
    if (!silent) {
      showToast("Kein Skelettmodell gefunden. Platzhalter aktiv.");
    }
  }
}

async function loadMuscleLayer(preset, silent, generation = state.assetGeneration) {
  try {
    const loaded = await loadFirstAvailableGltf(preset.muscleCandidates);
    const model = loaded.gltf.scene;
    if (generation !== state.assetGeneration) {
      disposeNodeTree(model);
      return null;
    }
    model.name = "muscle-layer";
    model.position.set(0, -0.4, 0);
    model.visible = false;
    rootGroup.add(model);

    state.roots.muscle = model;
    const softMeshes = prepareMeshes(model, "muscle");
    state.selectables.muscles = softMeshes.filter((mesh) => mesh.userData.structureType === "muscle");
    state.selectables.fasciae = softMeshes.filter((mesh) => mesh.userData.structureType === "fascia");

    if (!silent) {
      const fallbackHint = loaded.index > 0 ? " (Fallback-Modell)" : "";
      const visibleSoftMeshes = state.selectables.muscles.length + state.selectables.fasciae.length;
      showToast(
        `Weichteillayer geladen (${state.selectables.muscles.length} Muskeln, ${state.selectables.fasciae.length} Faszien, gesamt ${visibleSoftMeshes})${fallbackHint}.`,
      );
    }
    return model;
  } catch {
    if (generation === state.assetGeneration) {
      state.roots.muscle = null;
      state.selectables.muscles = [];
      state.selectables.fasciae = [];
      if (!silent) {
        showToast("Kein Muskel-/Faszienmodell gefunden.");
      }
    }
    return null;
  }
}

async function loadFirstAvailableGltf(candidates) {
  let lastError = null;
  for (let index = 0; index < candidates.length; index += 1) {
    const path = candidates[index];
    try {
      const gltf = await gltfLoader.loadAsync(path);
      return { gltf, path, index };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Kein GLTF-Kandidat konnte geladen werden.");
}

function createFallbackSkeleton() {
  const group = new THREE.Group();
  group.name = "fallback-skeleton";

  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0xe9e3d5,
    roughness: 0.58,
    metalness: 0.04,
  });

  const parts = [
    { id: "Skull", geo: new THREE.SphereGeometry(0.43, 28, 22), pos: [0, 2.35, 0] },
    { id: "Mandibula", geo: new THREE.BoxGeometry(0.45, 0.2, 0.35), pos: [0, 2.05, 0.12] },
    { id: "Clavicula", geo: new THREE.BoxGeometry(1.2, 0.12, 0.18), pos: [0, 1.75, 0.05] },
    { id: "Scapula", geo: new THREE.BoxGeometry(0.44, 0.5, 0.14), pos: [-0.62, 1.52, -0.09] },
    { id: "Humerus", geo: new THREE.CylinderGeometry(0.12, 0.12, 0.92, 20), pos: [-0.93, 1.04, 0] },
    { id: "Pelvis", geo: new THREE.BoxGeometry(1.15, 0.52, 0.44), pos: [0, 1.02, 0] },
    { id: "Femur", geo: new THREE.CylinderGeometry(0.16, 0.14, 1.32, 24), pos: [-0.25, 0.2, 0] },
    { id: "Patella", geo: new THREE.SphereGeometry(0.13, 16, 16), pos: [-0.25, -0.45, 0.18] },
    { id: "Calcaneus", geo: new THREE.BoxGeometry(0.4, 0.2, 0.62), pos: [-0.25, -1.05, -0.14] },
    { id: "Stapes", geo: new THREE.TorusGeometry(0.08, 0.026, 8, 18), pos: [0.23, 2.26, 0.12] },
  ];

  for (const part of parts) {
    const mesh = new THREE.Mesh(part.geo, baseMaterial.clone());
    mesh.name = part.id;
    mesh.userData.boneId = part.id;
    mesh.position.set(part.pos[0], part.pos[1], part.pos[2]);
    group.add(mesh);
  }

  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 1.2, 18), baseMaterial.clone());
  spine.name = "SpineProxy";
  spine.position.set(0, 1.05, -0.08);
  group.add(spine);

  return group;
}

function prepareMeshes(root, layerName) {
  const meshes = [];

  root.traverse((node) => {
    if (!node.isMesh) {
      return;
    }

    if (shouldIgnoreMesh(node)) {
      node.visible = false;
      return;
    }

    node.userData.layer = layerName;
    node.userData.structureType = layerName === "muscle" ? classifySoftTissue(node.name) : "bone";
    node.userData.boneId = node.userData.boneId || inferBoneId(node.name) || null;
    node.castShadow = false;
    node.receiveShadow = false;
    if (node.geometry && !node.geometry.boundingSphere) {
      node.geometry.computeBoundingSphere();
    }
    tuneMeshMaterial(node, layerName);
    meshes.push(node);
  });

  return meshes;
}

function shouldIgnoreMesh(node) {
  const name = String(node.name || "").trim();
  if (!name) {
    return false;
  }

  const lower = name.toLowerCase();

  if (lower.endsWith(".g") || lower.endsWith(".j")) {
    return true;
  }

  const helperTokens = [
    "how to",
    "navigation",
    "manipulation",
    "selection",
    "stored views",
    "outliner",
    "cross section",
    "sagittal plane",
    "longitudinal plane",
    "display.st",
    "layers.st",
    "colors.st",
    "take a picture",
    "annotation",
    "labels",
    "label",
    "caption",
    "text",
  ];

  if (helperTokens.some((token) => lower.includes(token))) {
    return true;
  }

  const looksLikeLargeLabel = /^[A-Z0-9 .,'()/-]{6,}$/.test(name) && name.includes(" ");
  if (looksLikeLargeLabel) {
    return true;
  }

  if (node.geometry) {
    node.geometry.computeBoundingBox();
    const bbox = node.geometry.boundingBox;
    if (bbox) {
      const size = new THREE.Vector3();
      bbox.getSize(size);
      const dims = [size.x, size.y, size.z].sort((a, b) => a - b);
      if (dims[0] < 0.002 && dims[2] > 0.8) {
        return true;
      }
      if (dims[0] < 0.0015 && dims[1] < 0.08 && dims[2] < 0.08) {
        return true;
      }
      const thinAxes = [size.x, size.y, size.z].filter((value) => value < 0.004).length;
      if (thinAxes >= 2 && dims[2] > 0.03) {
        return true;
      }
    }
  }

  return false;
}

function classifySoftTissue(name) {
  const value = String(name || "")
    .toLowerCase()
    .replace(/[_.-]+/g, " ");

  const fasciaTokens = [
    "fascia",
    "fascial",
    "aponeurosis",
    "retinaculum",
    "septum",
    "sheath",
    "capsule",
    "tendon",
    "ligament",
    "bursa",
    "thoracolumbar",
  ];

  if (fasciaTokens.some((token) => value.includes(token))) {
    return "fascia";
  }

  return "muscle";
}

function tuneMeshMaterial(mesh, layerName) {
  const preset = getTissuePreset(mesh, layerName);
  const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const tunedMaterials = sourceMaterials.map((source) => {
    const material = new THREE.MeshStandardMaterial({
      color: preset.color,
      roughness: preset.roughness,
      metalness: 0,
      emissive: 0x000000,
      emissiveIntensity: 0,
      side: preset.doubleSided ? THREE.DoubleSide : source?.side ?? THREE.FrontSide,
      transparent: Boolean(source?.transparent && (source?.opacity ?? 1) < 1),
      opacity: source?.opacity ?? 1,
      alphaTest: source?.alphaTest ?? 0,
      depthWrite: source?.depthWrite ?? true,
      flatShading: false,
    });
    material.envMapIntensity = preset.envMapIntensity;
    material.forceSinglePass = true;
    material.userData.baseColor = material.color.clone();
    material.userData.baseEmissive = material.emissive.clone();
    material.userData.baseEmissiveIntensity = 0;
    return material;
  });

  mesh.material = Array.isArray(mesh.material) ? tunedMaterials : tunedMaterials[0];
}

function getTissuePreset(mesh, layerName) {
  const name = String(mesh.name || "").toLowerCase();
  if (layerName === "muscle") {
    if (name.includes("bursa")) {
      return { color: 0xb9878d, roughness: 0.76, envMapIntensity: 0.4, doubleSided: true };
    }
    if (
      mesh.userData.structureType === "fascia" ||
      ["tendon", "ligament", "aponeuros", "retinac", "sheath"].some((token) => name.includes(token))
    ) {
      return { color: 0xb9a494, roughness: 0.72, envMapIntensity: 0.44, doubleSided: true };
    }
    return { color: 0x91363a, roughness: 0.59, envMapIntensity: 0.5, doubleSided: false };
  }

  if (["tooth", "teeth", "dens", "enamel"].some((token) => name.includes(token))) {
    return { color: 0xe7ddd0, roughness: 0.4, envMapIntensity: 0.66, doubleSided: false };
  }
  if (["cartilage", "meniscus", "disc", "labrum"].some((token) => name.includes(token))) {
    return { color: 0xb98f88, roughness: 0.7, envMapIntensity: 0.46, doubleSided: true };
  }
  return { color: 0xcab49f, roughness: 0.64, envMapIntensity: 0.54, doubleSided: false };
}

function inferBoneId(rawName) {
  const token = normalizeToken(rawName);
  if (!token) {
    return null;
  }

  const direct = state.tokenToId.get(token);
  if (direct) {
    return direct;
  }

  for (const pattern of state.patternTokens) {
    if (token.includes(pattern)) {
      return state.tokenToId.get(pattern);
    }
  }

  return null;
}

function normalizeToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function setLayer(layerName) {
  if (state.round.status === "countdown") {
    return;
  }

  if (state.round.status === "active") {
    const allowed = state.round.allowedLayers || ["bones"];
    if (!allowed.includes(layerName)) {
      showToast(`Layer ${layerName} ist in dieser Runde nicht freigegeben.`);
      return;
    }
  }

  if (!LAYER_CYCLE.includes(layerName)) {
    layerName = "bones";
  }

  if (layerName !== "bones" && !state.roots.muscle) {
    state.requestedLayer = layerName;
    if (!state.muscleLoadPromise) {
      showToast("Weichteile werden geladen …");
    }
    beginMuscleLayerLoad(PROFILE_PRESETS[state.profileKey], true, state.assetGeneration);
    return;
  }

  const layerChanged = state.activeLayer !== layerName;
  if (layerChanged && state.selectedMesh) {
    applyMeshStyle(state.selectedMesh, "base");
    state.selectedMesh = null;
    rendererEngine.setOutlineSelection([]);
  }

  state.activeLayer = layerName;
  store.setState({ layer: layerName }, "layer_changed");

  const hasMuscleModel = Boolean(state.roots.muscle);
  if (state.roots.skeleton) {
    state.roots.skeleton.visible = hasMuscleModel ? layerName === "bones" : true;
  }
  if (state.roots.muscle) {
    state.roots.muscle.visible = layerName !== "bones";
  }

  applySoftTissueVisibility(layerName);
  updateLayerButtons();

  state.simulatedMuscleLook = !hasMuscleModel && layerName !== "bones";
  applyEnvironmentLook();
  telemetry.track("layer_changed", { layer: layerName });
  updateLayerLockHint();
  window.requestAnimationFrame(() => {
    updateStageFloor();
    if (layerChanged && (state.round.status === "idle" || state.round.status === "ended")) {
      frameModelInView(true);
    }
  });
}

function applySoftTissueVisibility(layerName) {
  const showMuscles = layerName === "muscles";
  const showFasciae = layerName === "fasciae";

  for (const mesh of state.selectables.muscles) {
    mesh.visible = showMuscles;
  }
  for (const mesh of state.selectables.fasciae) {
    mesh.visible = showFasciae;
  }
}

function updateLayerButtons() {
  ui.layerBonesBtn.classList.toggle("active", state.activeLayer === "bones");
  ui.layerMusclesBtn.classList.toggle("active", state.activeLayer === "muscles");
  ui.layerFasciaeBtn.classList.toggle("active", state.activeLayer === "fasciae");
}

function applyEnvironmentLook() {
  if (state.simulatedMuscleLook) {
    scene.background.set(0x1c1116);
    scene.fog.color.set(0x1c1116);
    keyLight.color.set(0xffe7d8);
    keyLight.intensity = 1.7;
    fillLight.color.set(0xd08e80);
    fillLight.intensity = 0.7;
    hemiLight.color.set(0xffe5d8);
    hemiLight.intensity = 0.76;
    rimLight.color.set(0xe56f5e);
    rimLight.intensity = 0.64;
    floorMaterial.color.set(0x321b22);
  } else {
    const theme = themeEngine.getTheme(state.activeThemeKey);
    applyThemeToScene(theme.scene);
  }
}

function getActiveSelectables() {
  if (state.activeLayer === "muscles" && state.roots.muscle) {
    return state.selectables.muscles;
  }
  if (state.activeLayer === "fasciae" && state.roots.muscle) {
    return state.selectables.fasciae;
  }
  return state.selectables.bones;
}

function pickMeshFromPointer(event) {
  const meshes = getActiveSelectables();
  if (!meshes.length) {
    return;
  }

  const rect = ui.canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(meshes, false);
  const mesh = hits[0]?.object || findNearestMeshByScreenDistance(meshes, pointer, 22);
  if (!mesh) {
    return;
  }
  const entry = getEntryForMesh(mesh);

  selectMesh(mesh, "selected");
  if (state.round.status !== "active" && state.round.status !== "countdown") {
    focusIfTiny(mesh);
  }
  if (entry) {
    setSelection(entry);
  } else {
    const structureType =
      mesh.userData.structureType === "fascia"
        ? "Faszie"
        : mesh.userData.structureType === "muscle"
          ? "Muskel"
          : "Struktur";
    setSelection({
      nameDe: formatStructureName(mesh.name),
      nameLatin: "-",
      funFact: `${structureType} (noch nicht im Quizdatensatz hinterlegt).`,
    });
  }

  if (state.round.status === "active") {
    handleRoundAnswer(mesh, entry, { x: event.clientX, y: event.clientY });
  }
}

function findNearestMeshByScreenDistance(meshes, pointerNdc, maxDistancePx = 22) {
  const centerWorld = new THREE.Vector3();
  const centerNdc = new THREE.Vector3();
  const halfWidth = Math.max(1, ui.canvas.clientWidth / 2);
  const halfHeight = Math.max(1, ui.canvas.clientHeight / 2);
  let bestMesh = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const mesh of meshes) {
    if (!mesh.visible) {
      continue;
    }
    if (!mesh.geometry) {
      continue;
    }

    mesh.geometry.computeBoundingSphere();
    const sphere = mesh.geometry.boundingSphere;
    if (!sphere) {
      continue;
    }

    centerWorld.copy(sphere.center).applyMatrix4(mesh.matrixWorld);
    centerNdc.copy(centerWorld).project(camera);

    if (
      !Number.isFinite(centerNdc.x) ||
      !Number.isFinite(centerNdc.y) ||
      !Number.isFinite(centerNdc.z) ||
      centerNdc.z < -1 ||
      centerNdc.z > 1
    ) {
      continue;
    }

    const dxPx = (centerNdc.x - pointerNdc.x) * halfWidth;
    const dyPx = (centerNdc.y - pointerNdc.y) * halfHeight;
    const distance = Math.hypot(dxPx, dyPx);
    if (distance < bestDistance && distance <= maxDistancePx) {
      bestDistance = distance;
      bestMesh = mesh;
    }
  }

  return bestMesh;
}

function getEntryForMesh(mesh) {
  if (!mesh) {
    return null;
  }
  const boneId = mesh.userData.boneId || inferBoneId(mesh.name);
  if (!boneId) {
    return null;
  }
  return state.quizById.get(boneId) || null;
}

function formatStructureName(name) {
  return String(name || "Unbekannt")
    .replace(/[_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function selectMesh(mesh, styleName) {
  if (state.selectedMesh && state.selectedMesh !== mesh) {
    applyMeshStyle(state.selectedMesh, "base");
  }
  state.selectedMesh = mesh;
  applyMeshStyle(mesh, styleName);
  rendererEngine.setOutlineSelection([mesh]);
}

function focusIfTiny(mesh) {
  if (!mesh?.geometry) {
    return;
  }

  mesh.geometry.computeBoundingBox();
  const bbox = mesh.geometry.boundingBox;
  if (!bbox) {
    return;
  }

  const size = new THREE.Vector3();
  bbox.getSize(size);
  const maxSize = Math.max(size.x, size.y, size.z);

  if (maxSize < 0.22) {
    cameraController.focusOnObject(mesh);
  }
}

function applyMeshStyle(mesh, styleName) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

  for (const material of materials) {
    if (!material) {
      continue;
    }

    const baseColor = material.userData.baseColor || null;
    const baseEmissive = material.userData.baseEmissive || null;
    const baseEmissiveIntensity = material.userData.baseEmissiveIntensity ?? 1;

    if (styleName === "base") {
      if (material.color && baseColor) {
        material.color.copy(baseColor);
      }
      if (material.emissive && baseEmissive) {
        material.emissive.copy(baseEmissive);
      }
      if (typeof material.emissiveIntensity === "number") {
        material.emissiveIntensity = baseEmissiveIntensity;
      }
      continue;
    }

    if (material.color && baseColor) {
      if (styleName === "selected") {
        material.color.copy(baseColor).lerp(new THREE.Color(0xe45f4f), 0.42);
      } else if (styleName === "correct") {
        material.color.copy(baseColor).lerp(new THREE.Color(0x3ca56f), 0.58);
      } else if (styleName === "wrong") {
        material.color.copy(baseColor).lerp(new THREE.Color(0xc94961), 0.62);
      }
    }

    if (material.emissive) {
      if (styleName === "selected") {
        material.emissive.set(0x6b231f);
      } else if (styleName === "correct") {
        material.emissive.set(0x143e29);
      } else if (styleName === "wrong") {
        material.emissive.set(0x561522);
      }
    }

    if (typeof material.emissiveIntensity === "number") {
      material.emissiveIntensity = styleName === "selected" ? 0.28 : 0.42;
    }
  }
}

function updateRoundHud() {
  const remaining = state.round.status === "active" ? state.round.timeRemaining : state.round.config.durationSec;
  const isActive = state.round.status === "active";
  const roundedRemaining = Math.max(0, Math.ceil(remaining));
  ui.timerValue.textContent = formatClock(remaining);
  const timerWarning = isActive && roundedRemaining <= 10 && roundedRemaining > 5;
  const timerDanger = isActive && roundedRemaining <= 5;
  ui.timerValue.classList.toggle("warning", timerWarning);
  ui.timerValue.classList.toggle("danger", timerDanger);
  ui.timerChip.classList.toggle("warning", timerWarning);
  ui.timerChip.classList.toggle("danger", timerDanger);
  const totalDuration = Math.max(1, state.round.config.durationSec || 1);
  const timerProgress = THREE.MathUtils.clamp(remaining / totalDuration, 0, 1);
  ui.timerChip.style.setProperty("--timer-offset", String(113 * (1 - timerProgress)));

  ui.comboValue.textContent = `${state.round.combo}×`;
  ui.multiplierValue.textContent = `${state.round.multiplier.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}×`;
  ui.livesValue.textContent =
    state.round.config.lives === null
      ? "∞"
      : String(state.round.lives === null ? state.round.config.lives : state.round.lives);

  const comboTier = getComboTier(state.round.combo);
  applyComboTierClasses(comboTier);
  if (isActive && comboTier > state.feel.comboTier) {
    sound.comboTier(comboTier);
    pulseHudChip(ui.comboChip, "pulse-good");
    pulseHudChip(ui.multiplierChip, "pulse-good");
  }
  state.feel.comboTier = comboTier;

  const timerBand = getTimerBand(isActive, roundedRemaining);
  if (isActive && timerBand !== state.feel.timerBand) {
    if (timerBand === "warning") {
      sound.hurryPulse(1);
      pulseHudChip(ui.timerChip, "pulse-bad");
    } else if (timerBand === "danger") {
      sound.hurryPulse(2);
      pulseHudChip(ui.timerChip, "pulse-bad");
      if (!state.feel.bossActive) {
        setTargetPrompt("Finale Sekunden!", "Jetzt zählt jeder Treffer.", "danger");
      }
    }
  }
  state.feel.timerBand = timerBand;

  if (isActive) {
    const boss = bossRoundManager.getState();
    if (boss.active) {
      ui.modeBadge.textContent = `${state.round.config.label} · Bonus`;
      ui.modeBadge.classList.add("boss-live");
      if (!state.feel.bossActive) {
        sound.bossStart();
        triggerHaptic([16, 26, 16, 26, 22]);
        pulseHudChip(ui.timerChip, "pulse-boss");
        pulseHudChip(ui.livesChip, "pulse-boss");
        pulseScenePanel("boss");
        setTargetPrompt("Bonusrunde!", "Mehr Punkte für präzise Treffer.", "boss");
        showToast("Bonusrunde aktiviert.");
      }
    } else {
      ui.modeBadge.textContent = `${state.round.config.label} · Aktiv`;
      ui.modeBadge.classList.remove("boss-live");
      if (state.feel.bossActive && state.round.currentQuestion) {
        setTargetPrompt(
          `Finde: ${state.round.currentQuestion.nameLatin}`,
          `${state.round.currentQuestion.nameDe} · Runde läuft`,
          "active",
        );
      }
    }
    state.feel.bossActive = boss.active;
  } else {
    ui.modeBadge.classList.remove("boss-live");
    state.feel.bossActive = false;
    state.feel.timerBand = "calm";
  }
}

function getComboTier(combo) {
  if (combo >= 10) {
    return 3;
  }
  if (combo >= 6) {
    return 2;
  }
  if (combo >= 3) {
    return 1;
  }
  return 0;
}

function applyComboTierClasses(tier) {
  const classes = ["combo-tier-1", "combo-tier-2", "combo-tier-3"];
  ui.comboValue.classList.remove(...classes);
  ui.multiplierValue.classList.remove(...classes);
  if (tier > 0) {
    const className = `combo-tier-${tier}`;
    ui.comboValue.classList.add(className);
    ui.multiplierValue.classList.add(className);
  }
}

function getTimerBand(isActive, roundedRemaining) {
  if (!isActive) {
    return "calm";
  }
  if (roundedRemaining <= 5) {
    return "danger";
  }
  if (roundedRemaining <= 10) {
    return "warning";
  }
  return "calm";
}

function updateScoreboard() {
  ui.scoreValue.textContent = String(state.score);
  ui.streakValue.textContent = String(state.streak);
  ui.correctValue.textContent = String(state.correct);
  ui.wrongValue.textContent = String(state.wrong);
  ui.unlockedCountValue.textContent = `${state.unlocked.size} / ${state.quizData.length}`;
  store.setState({ score: state.score }, "scoreboard");
}

function updateHighScoreDisplay() {
  const value = state.bestByMode[state.selectedGameMode] ?? 0;
  ui.highScoreValue.textContent = String(value);
}

function pulseFlash(kind) {
  if (!ui.flashOverlay) {
    return;
  }
  if (state.reducedMotion) {
    return;
  }

  ui.flashOverlay.classList.remove("correct", "wrong");
  void ui.flashOverlay.offsetWidth;
  ui.flashOverlay.classList.add(kind);

  window.clearTimeout(state.pulseTimer);
  state.pulseTimer = window.setTimeout(() => {
    ui.flashOverlay.classList.remove("correct", "wrong");
  }, 280);
}

function pulseHudChip(chip, className) {
  if (!chip || state.reducedMotion) {
    return;
  }

  chip.classList.remove("pulse-good", "pulse-bad", "pulse-boss");
  void chip.offsetWidth;
  chip.classList.add(className);

  window.setTimeout(() => {
    chip.classList.remove(className);
  }, 500);
}

function pulseScenePanel(kind) {
  if (!ui.scenePanel || state.reducedMotion) {
    return;
  }

  const className = kind === "correct" ? "hit-correct" : kind === "boss" ? "hit-boss" : "hit-wrong";
  ui.scenePanel.classList.remove("hit-correct", "hit-wrong", "hit-boss");
  void ui.scenePanel.offsetWidth;
  ui.scenePanel.classList.add(className);

  window.setTimeout(() => {
    ui.scenePanel.classList.remove(className);
  }, 420);
}

function spawnHitMarker(clientX, clientY, text, kind) {
  if (!ui.scenePanel) {
    return;
  }

  const rect = ui.scenePanel.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }

  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
    return;
  }

  const marker = document.createElement("div");
  marker.className = `hit-marker ${kind === "correct" ? "correct" : "wrong"}`;
  marker.textContent = text;
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  ui.scenePanel.append(marker);

  window.setTimeout(() => {
    marker.remove();
  }, 600);
}

function setSelection(entry) {
  ui.nameDeValue.textContent = entry.nameDe || "-";
  ui.nameLatinValue.textContent = entry.nameLatin || "-";
  ui.factValue.textContent = entry.funFact || "-";
}

function setQuestion(text) {
  ui.question.textContent = text;
}

function updateCollectionView() {
  ui.collectionList.innerHTML = "";

  for (const item of state.quizData) {
    const unlocked = state.unlocked.has(item.id);
    const li = document.createElement("li");
    li.className = unlocked ? "collection-item unlocked" : "collection-item locked";

    const title = document.createElement("p");
    title.className = "collection-title";
    title.textContent = unlocked ? item.nameDe : "Verschlossen";

    const latin = document.createElement("p");
    latin.className = "collection-latin";
    latin.textContent = item.nameLatin;

    const fact = document.createElement("p");
    fact.className = "collection-fact";
    fact.textContent = unlocked ? item.funFact : `Löse die Quizfrage zu ${item.nameDe}.`;

    li.append(title, latin, fact);
    ui.collectionList.append(li);
  }

  updateScoreboard();
}

function unlockCard(boneId) {
  if (state.unlocked.has(boneId)) {
    return;
  }
  state.unlocked.add(boneId);
  storeUnlocked(state.unlocked);
  updateCollectionView();
}

function loadStoredProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.profile);
    if (raw && Object.hasOwn(PROFILE_PRESETS, raw)) {
      return raw;
    }
  } catch {
    // ignore
  }
  return "male";
}

function storeProfile(profileKey) {
  try {
    localStorage.setItem(STORAGE_KEYS.profile, profileKey);
  } catch {
    // optional persistence
  }
}

function loadStoredSoundEnabled() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.soundEnabled);
    if (raw === "false") {
      return false;
    }
    if (raw === "true") {
      return true;
    }
  } catch {
    // ignore
  }
  return true;
}

function storeSoundEnabled(value) {
  try {
    localStorage.setItem(STORAGE_KEYS.soundEnabled, String(Boolean(value)));
  } catch {
    // optional persistence
  }
}

function loadStoredHapticsEnabled() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.hapticsEnabled);
    if (raw === "false") {
      return false;
    }
    if (raw === "true") {
      return true;
    }
  } catch {
    // ignore
  }
  return true;
}

function storeHapticsEnabled(value) {
  try {
    localStorage.setItem(STORAGE_KEYS.hapticsEnabled, String(Boolean(value)));
  } catch {
    // optional persistence
  }
}

function loadStoredAudioVolume(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return Math.min(1, Math.max(0, parsed));
    }
  } catch {
    // ignore
  }
  return fallback;
}

function storeAudioVolume(key, value) {
  try {
    localStorage.setItem(key, String(Math.min(1, Math.max(0, Number(value) || 0))));
  } catch {
    // optional persistence
  }
}

function loadStoredBestByMode() {
  const fallback = {
    speedrun: 0,
    sudden_death: 0,
    precision: 0,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.bestByMode);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        speedrun: Number(parsed.speedrun) || 0,
        sudden_death: Number(parsed.sudden_death) || 0,
        precision: Number(parsed.precision) || 0,
      };
    }
  } catch {
    // ignore
  }

  try {
    const legacy = Number(localStorage.getItem(STORAGE_KEYS.highScoreLegacy));
    if (Number.isFinite(legacy) && legacy > 0) {
      fallback.speedrun = legacy;
    }
  } catch {
    // ignore
  }

  return fallback;
}

function storeBestByMode(bestByMode) {
  try {
    localStorage.setItem(STORAGE_KEYS.bestByMode, JSON.stringify(bestByMode));
  } catch {
    // optional persistence
  }
}

function loadStoredUnlocked() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.unlocked);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function storeUnlocked(unlocked) {
  try {
    localStorage.setItem(STORAGE_KEYS.unlocked, JSON.stringify(Array.from(unlocked)));
  } catch {
    // optional persistence
  }
}

function showToast(message) {
  if (!message) {
    return;
  }
  state.toastQueue.push(String(message));
  processToastQueue();
}

function processToastQueue() {
  if (state.toastVisible || state.toastQueue.length === 0) {
    return;
  }

  state.toastVisible = true;
  const message = state.toastQueue.shift();
  ui.toast.textContent = message;
  ui.toast.classList.add("visible");

  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => {
    ui.toast.classList.remove("visible");
    state.toastVisible = false;
    processToastQueue();
  }, TIMINGS.toastMs);
}

function triggerHaptic(pattern) {
  if (!state.hapticsEnabled) {
    return;
  }
  if (!("vibrate" in navigator)) {
    return;
  }
  try {
    navigator.vibrate(pattern);
  } catch {
    // ignore
  }
}

function resizeRenderer() {
  const width = ui.canvas.clientWidth;
  const height = ui.canvas.clientHeight;
  if (!width || !height) {
    return;
  }

  rendererEngine.resize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  if (state.round.status !== "active" && state.round.status !== "countdown" && !state.isLoadingProfile) {
    frameModelInView(true);
  }
}

function startRenderLoop() {
  let lastRenderAt = 0;
  const render = (timestamp = performance.now()) => {
    requestAnimationFrame(render);
    if (document.hidden) {
      lastRenderAt = timestamp;
      return;
    }

    updateRoundClock(timestamp);
    const softTissueVisible = state.activeLayer === "muscles" || state.activeLayer === "fasciae";
    const roundLive = state.round.status === "active" || state.round.status === "countdown";
    const targetFps = softTissueVisible ? 30 : roundLive ? 45 : 30;
    const frameInterval = 1000 / targetFps;
    if (timestamp - lastRenderAt < frameInterval) {
      return;
    }

    lastRenderAt = timestamp;
    cameraController.update(timestamp);
    rendererEngine.render();
  };
  render();
}

function updateRoundClock(now) {
  if (state.round.status !== "active") {
    return;
  }

  const deltaSec = Math.max(0, (now - (state.round.lastUpdateAt || now)) / 1000);
  state.round.lastUpdateAt = now;

  if (state.flags.timeDrainPerSec > 0) {
    state.round.endAt -= state.flags.timeDrainPerSec * deltaSec * 1000;
  }

  bossRoundManager.update(now);

  const elapsedSec = Math.max(0, (now - state.round.startedAt) / 1000);
  state.round.elapsedSec = elapsedSec;

  if (Number.isFinite(state.round.endAt) && state.round.endAt > 0) {
    state.round.timeRemaining = Math.max(0, (state.round.endAt - now) / 1000);
  } else {
    state.round.timeRemaining = 0;
  }

  const second = Math.ceil(state.round.timeRemaining);
  if (second !== state.round.lastTickCueSecond) {
    state.round.lastTickCueSecond = second;
    if (second <= 10 && second > 0) {
      sound.tick(second);
    }
  }

  updateRoundHud();

  if (state.round.timeRemaining <= 0) {
    finishRound("time");
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  if (window.location.protocol === "file:") {
    return;
  }

  const host = window.location.hostname;
  const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (isLocalhost) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => {
        // ignore unregister errors during local dev
      });
    return;
  }

  navigator.serviceWorker
    .register("./sw.js?v=20260208-1")
    .then((registration) => registration.update())
    .catch((error) => {
      console.warn("Service Worker konnte nicht registriert werden.", error);
    });
}

function formatClock(totalSeconds) {
  const clamped = Math.max(0, totalSeconds || 0);
  const min = Math.floor(clamped / 60);
  const sec = Math.floor(clamped % 60);
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
