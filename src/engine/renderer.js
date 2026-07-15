import * as THREE from "three";

const MOBILE_BREAKPOINT = 820;
const MOBILE_DPR_CAP = 1.6;
const CONSTRAINED_MOBILE_DPR_CAP = 1.35;
const DESKTOP_DPR_CAP = 2;

const OUTLINE_VERTEX_SHADER = /* glsl */ `
  uniform float outlineThickness;

  void main() {
    vec3 displacedPosition = position + normalize(normal) * outlineThickness;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
  }
`;

const OUTLINE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 outlineColor;
  uniform float outlineOpacity;

  void main() {
    gl_FragColor = vec4(outlineColor, outlineOpacity);
  }
`;

function isCoarsePointer() {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
}

export function shouldUseSelectionOutline(width, coarsePointer = isCoarsePointer()) {
  return Number(width) > MOBILE_BREAKPOINT && !coarsePointer;
}

function isConstrainedDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const hasLimitedMemory = Number(navigator.deviceMemory || 8) <= 4;
  const savesData = Boolean(navigator.connection?.saveData);
  return hasLimitedMemory || savesData;
}

function getAdaptivePixelRatio(width) {
  const devicePixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const mobile = width <= MOBILE_BREAKPOINT || isCoarsePointer();
  const cap = mobile
    ? isConstrainedDevice()
      ? CONSTRAINED_MOBILE_DPR_CAP
      : MOBILE_DPR_CAP
    : DESKTOP_DPR_CAP;

  return Math.max(1, Math.min(devicePixelRatio, cap));
}

function createOutlineMaterial(color, thickness) {
  return new THREE.ShaderMaterial({
    name: "AnatomySelectionOutlineMaterial",
    uniforms: {
      outlineColor: { value: color.clone() },
      outlineOpacity: { value: 0.92 },
      outlineThickness: { value: thickness },
    },
    vertexShader: OUTLINE_VERTEX_SHADER,
    fragmentShader: OUTLINE_FRAGMENT_SHADER,
    side: THREE.BackSide,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false,
    fog: false,
  });
}

function getLocalOutlineThickness(mesh) {
  const geometry = mesh.geometry;
  if (!geometry.boundingSphere) {
    geometry.computeBoundingSphere();
  }

  const localRadius = geometry.boundingSphere?.radius || 0.08;
  const worldScale = new THREE.Vector3();
  mesh.getWorldScale(worldScale);
  const maximumScale = Math.max(Math.abs(worldScale.x), Math.abs(worldScale.y), Math.abs(worldScale.z), 0.0001);
  const worldRadius = localRadius * maximumScale;
  const worldThickness = THREE.MathUtils.clamp(worldRadius * 0.022, 0.0012, 0.0065);
  return worldThickness / maximumScale;
}

function collectOutlineMeshes(objects) {
  const meshes = new Set();

  for (const object of Array.isArray(objects) ? objects : []) {
    if (!object) {
      continue;
    }

    object.traverse((node) => {
      if (
        node.isMesh &&
        node.geometry?.attributes?.position &&
        node.geometry?.attributes?.normal &&
        !node.userData?.isSelectionOutline
      ) {
        meshes.add(node);
      }
    });
  }

  return meshes;
}

export function createRendererEngine({ canvas, scene, camera }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
    stencil: false,
  });

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = false;

  const outlineColor = new THREE.Color(0xff755f);
  const outlineShells = new Map();
  let outlineSelection = [];
  let lastWidth = 0;
  let lastHeight = 0;
  let lastPixelRatio = 0;

  function removeOutlineShell(mesh) {
    const shell = outlineShells.get(mesh);
    if (!shell) {
      return;
    }

    if (shell.parent) {
      shell.parent.remove(shell);
    }
    shell.material.dispose();
    outlineShells.delete(mesh);
  }

  function addOutlineShell(mesh) {
    if (outlineShells.has(mesh)) {
      return;
    }

    mesh.updateWorldMatrix(true, false);
    const material = createOutlineMaterial(outlineColor, getLocalOutlineThickness(mesh));
    const shell = new THREE.Mesh(mesh.geometry, material);
    shell.name = `${mesh.name || "anatomy-part"}-selection-outline`;
    shell.renderOrder = Math.max(8, (mesh.renderOrder || 0) + 1);
    shell.frustumCulled = mesh.frustumCulled;
    shell.matrixAutoUpdate = false;
    shell.layers.mask = mesh.layers.mask;
    shell.userData.isSelectionOutline = true;
    shell.userData.excludeFromBounds = true;
    shell.raycast = () => {};
    mesh.add(shell);
    outlineShells.set(mesh, shell);
  }

  function resize(width, height) {
    const nextWidth = Math.max(1, Math.round(width || 0));
    const nextHeight = Math.max(1, Math.round(height || 0));
    if (!width || !height) {
      return;
    }

    const outlinesWereEnabled = shouldUseOutlineShells();
    const pixelRatio = getAdaptivePixelRatio(nextWidth);
    const pixelRatioChanged = Math.abs(pixelRatio - lastPixelRatio) > 0.001;
    if (pixelRatioChanged) {
      renderer.setPixelRatio(pixelRatio);
      lastPixelRatio = pixelRatio;
    }

    if (pixelRatioChanged || nextWidth !== lastWidth || nextHeight !== lastHeight) {
      renderer.setSize(nextWidth, nextHeight, false);
      lastWidth = nextWidth;
      lastHeight = nextHeight;
    }

    if (outlinesWereEnabled !== shouldUseOutlineShells()) {
      refreshOutlineSelection();
    }
  }

  function render() {
    renderer.render(scene, camera);
  }

  function shouldUseOutlineShells() {
    return shouldUseSelectionOutline(lastWidth);
  }

  function refreshOutlineSelection() {
    // The emissive/color treatment remains the primary mobile selection cue.
    // Avoid duplicating selected geometry with an extra shader pass on narrow
    // viewports: it costs another draw call and can stall software/mobile WebGL
    // drivers while compiling the outline program during the first selection.
    const selectedMeshes = shouldUseOutlineShells() ? collectOutlineMeshes(outlineSelection) : new Set();

    for (const mesh of outlineShells.keys()) {
      if (!selectedMeshes.has(mesh)) {
        removeOutlineShell(mesh);
      }
    }

    for (const mesh of selectedMeshes) {
      addOutlineShell(mesh);
    }
  }

  function setOutlineSelection(objects) {
    outlineSelection = Array.isArray(objects) ? [...objects] : [];
    refreshOutlineSelection();
  }

  function applyTheme(themeScene) {
    if (!themeScene) {
      return;
    }

    const nextOutlineColor =
      themeScene.outline?.visibleEdgeColor ?? themeScene.outline?.color ?? themeScene.accentColor;
    if (nextOutlineColor !== undefined) {
      outlineColor.set(nextOutlineColor);
      for (const shell of outlineShells.values()) {
        shell.material.uniforms.outlineColor.value.copy(outlineColor);
      }
    }

    if (Number.isFinite(themeScene.toneMappingExposure)) {
      renderer.toneMappingExposure = themeScene.toneMappingExposure;
    }
  }

  function dispose() {
    outlineSelection = [];
    for (const mesh of [...outlineShells.keys()]) {
      removeOutlineShell(mesh);
    }
    renderer.dispose();
  }

  return {
    renderer,
    composer: null,
    render,
    resize,
    setOutlineSelection,
    applyTheme,
    dispose,
  };
}
