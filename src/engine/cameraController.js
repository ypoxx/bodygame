import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const DEFAULT_TWEEN_DURATION_MS = 420;
const FULL_TURN_RADIANS = Math.PI * 2;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

export const TOUCH_DRAG_THRESHOLD_PX = 12;

export function resolveTouchDragAxis(
  deltaX,
  deltaY,
  thresholdPx = TOUCH_DRAG_THRESHOLD_PX,
) {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
    return null;
  }

  const safeThreshold = Number.isFinite(thresholdPx)
    ? Math.max(0, thresholdPx)
    : TOUCH_DRAG_THRESHOLD_PX;
  if (Math.hypot(deltaX, deltaY) <= safeThreshold) {
    return null;
  }

  return Math.abs(deltaX) >= Math.abs(deltaY) ? "horizontal" : "vertical";
}

export function calculateWorldYTrackDelta({
  deltaY,
  viewportHeight,
  cameraDistance = 0,
  verticalFovDegrees = 50,
  orthographicHeight = null,
  zoom = 1,
  speed = 1,
}) {
  if (!Number.isFinite(deltaY) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return 0;
  }

  const safeSpeed = Number.isFinite(speed) ? speed : 1;
  let visibleWorldHeight;

  if (Number.isFinite(orthographicHeight)) {
    const safeZoom = Number.isFinite(zoom) ? Math.max(Math.abs(zoom), Number.EPSILON) : 1;
    visibleWorldHeight = Math.abs(orthographicHeight) / safeZoom;
  } else {
    const safeDistance = Number.isFinite(cameraDistance) ? Math.max(0, cameraDistance) : 0;
    const safeFov = Number.isFinite(verticalFovDegrees)
      ? THREE.MathUtils.clamp(Math.abs(verticalFovDegrees), 1, 179)
      : 50;
    visibleWorldHeight = 2 * safeDistance * Math.tan(THREE.MathUtils.degToRad(safeFov) / 2);
  }

  return (deltaY / viewportHeight) * visibleWorldHeight * safeSpeed;
}

function easeOutCubic(value) {
  return 1 - (1 - value) ** 3;
}

function shouldExcludeFromBounds(node) {
  return Boolean(
    node.userData?.excludeFromBounds ||
      node.userData?.excludeFromCameraBounds ||
      node.userData?.isSelectionOutline ||
      node.type?.endsWith("Helper"),
  );
}

function expandBoxByMesh(targetBox, mesh, scratch) {
  if (!mesh.geometry?.attributes?.position) {
    return;
  }

  if (mesh.isInstancedMesh) {
    if (!mesh.geometry.boundingBox) {
      mesh.geometry.computeBoundingBox();
    }
    if (!mesh.geometry.boundingBox) {
      return;
    }

    for (let index = 0; index < mesh.count; index += 1) {
      mesh.getMatrixAt(index, scratch.instanceMatrix);
      scratch.worldMatrix.multiplyMatrices(mesh.matrixWorld, scratch.instanceMatrix);
      scratch.meshBox.copy(mesh.geometry.boundingBox).applyMatrix4(scratch.worldMatrix);
      targetBox.union(scratch.meshBox);
    }
    return;
  }

  if (mesh.isSkinnedMesh && typeof mesh.computeBoundingBox === "function") {
    mesh.computeBoundingBox();
    if (mesh.boundingBox) {
      scratch.meshBox.copy(mesh.boundingBox).applyMatrix4(mesh.matrixWorld);
      targetBox.union(scratch.meshBox);
      return;
    }
  }

  if (!mesh.geometry.boundingBox) {
    mesh.geometry.computeBoundingBox();
  }
  if (!mesh.geometry.boundingBox) {
    return;
  }

  scratch.meshBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
  targetBox.union(scratch.meshBox);
}

function computeVisibleBounds(root, targetBox, scratch) {
  targetBox.makeEmpty();
  root.updateWorldMatrix(true, true);

  function visit(node) {
    if (!node.visible || shouldExcludeFromBounds(node)) {
      return;
    }

    if (node.isMesh) {
      expandBoxByMesh(targetBox, node, scratch);
    }

    for (const child of node.children) {
      visit(child);
    }
  }

  visit(root);
  return targetBox;
}

export function createCameraController({ camera, canvas }) {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.rotateSpeed = 0.72;
  controls.zoomSpeed = 1.18;
  controls.zoomToCursor = true;
  controls.minDistance = 0.08;
  controls.maxDistance = 8;
  controls.target.set(0, 1.1, 0);
  // A single touch is handled below so vertical drags track along the body
  // instead of changing the camera's polar angle. OrbitControls still owns
  // mouse input and two-finger dolly/pan gestures.
  controls.touches.ONE = null;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  const scratch = {
    meshBox: new THREE.Box3(),
    instanceMatrix: new THREE.Matrix4(),
    worldMatrix: new THREE.Matrix4(),
  };

  let framingTween = null;
  const activeTouchPointers = new Map();
  let touchDrag = null;
  let panEnabledBeforeMultiTouch = null;

  function cancelFramingTween() {
    framingTween = null;
  }

  controls.addEventListener("start", cancelFramingTween);

  function restorePanAfterMultiTouch() {
    if (panEnabledBeforeMultiTouch === null) {
      return;
    }

    controls.enablePan = panEnabledBeforeMultiTouch;
    panEnabledBeforeMultiTouch = null;
  }

  function cancelTouchDrag({ dispatchEnd = false } = {}) {
    if (dispatchEnd && touchDrag?.started) {
      controls.dispatchEvent({ type: "end" });
    }
    touchDrag = null;
  }

  function getCanvasHeight() {
    const boundsHeight = canvas.getBoundingClientRect?.().height;
    return Math.max(1, canvas.clientHeight || boundsHeight || 1);
  }

  function getWorldYTrackDelta(deltaY) {
    const common = {
      deltaY,
      viewportHeight: getCanvasHeight(),
      speed: controls.panSpeed,
    };

    if (camera.isOrthographicCamera) {
      return calculateWorldYTrackDelta({
        ...common,
        orthographicHeight: camera.top - camera.bottom,
        zoom: camera.zoom,
      });
    }

    return calculateWorldYTrackDelta({
      ...common,
      cameraDistance: camera.position.distanceTo(controls.target),
      verticalFovDegrees: camera.fov,
    });
  }

  function rotateAroundWorldY(deltaX) {
    const canvasHeight = getCanvasHeight();
    const angle = (FULL_TURN_RADIANS * deltaX * controls.rotateSpeed) / canvasHeight;
    const offset = camera.position.clone().sub(controls.target).applyAxisAngle(WORLD_UP, -angle);
    camera.position.copy(controls.target).add(offset);
    controls.update();
  }

  function trackAlongWorldY(deltaY) {
    const worldDeltaY = getWorldYTrackDelta(deltaY);
    camera.position.y += worldDeltaY;
    controls.target.y += worldDeltaY;
    controls.update();
  }

  function handleTouchPointerDown(event) {
    if (event.pointerType !== "touch") {
      return;
    }

    cancelFramingTween();
    activeTouchPointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (activeTouchPointers.size === 1) {
      touchDrag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        axis: null,
        started: false,
      };
      return;
    }

    // Once another finger joins, the one-finger intent stays cancelled until
    // every active touch has ended. This prevents a pinch from becoming a
    // vertical track when one finger is released first.
    cancelTouchDrag({ dispatchEnd: true });
    if (activeTouchPointers.size === 2 && panEnabledBeforeMultiTouch === null) {
      panEnabledBeforeMultiTouch = controls.enablePan;
      controls.enablePan = true;
    }
  }

  function handleTouchPointerMove(event) {
    if (event.pointerType !== "touch" || !activeTouchPointers.has(event.pointerId)) {
      return;
    }

    activeTouchPointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (
      activeTouchPointers.size !== 1 ||
      !touchDrag ||
      touchDrag.pointerId !== event.pointerId
    ) {
      return;
    }

    if (!touchDrag.axis) {
      touchDrag.axis = resolveTouchDragAxis(
        event.clientX - touchDrag.startX,
        event.clientY - touchDrag.startY,
      );
      if (!touchDrag.axis) {
        return;
      }

      touchDrag.started = true;
      controls.dispatchEvent({ type: "start" });
    }

    const deltaX = event.clientX - touchDrag.lastX;
    const deltaY = event.clientY - touchDrag.lastY;
    touchDrag.lastX = event.clientX;
    touchDrag.lastY = event.clientY;

    if (touchDrag.axis === "horizontal") {
      rotateAroundWorldY(deltaX);
    } else {
      trackAlongWorldY(deltaY);
    }
  }

  function handleTouchPointerEnd(event) {
    if (event.pointerType !== "touch" || !activeTouchPointers.has(event.pointerId)) {
      return;
    }

    const endedCustomDrag = touchDrag?.pointerId === event.pointerId;
    activeTouchPointers.delete(event.pointerId);
    if (endedCustomDrag) {
      // OrbitControls dispatches its normal end event when its final tracked
      // pointer ends, including for our custom one-finger gesture.
      cancelTouchDrag();
    }

    if (activeTouchPointers.size < 2) {
      restorePanAfterMultiTouch();
    }

    if (activeTouchPointers.size === 0) {
      cancelTouchDrag();
    }
  }

  const pointerDocument = canvas.ownerDocument;
  canvas.addEventListener("pointerdown", handleTouchPointerDown, {
    capture: true,
    passive: true,
  });
  pointerDocument.addEventListener("pointermove", handleTouchPointerMove, {
    capture: true,
    passive: true,
  });
  pointerDocument.addEventListener("pointerup", handleTouchPointerEnd, {
    capture: true,
    passive: true,
  });
  pointerDocument.addEventListener("pointercancel", handleTouchPointerEnd, {
    capture: true,
    passive: true,
  });
  canvas.addEventListener("lostpointercapture", handleTouchPointerEnd, {
    capture: true,
    passive: true,
  });

  function update(now = performance.now()) {
    if (framingTween) {
      const elapsed = Math.max(0, now - framingTween.startedAt);
      const progress = THREE.MathUtils.clamp(elapsed / framingTween.durationMs, 0, 1);
      const easedProgress = easeOutCubic(progress);

      camera.position.lerpVectors(framingTween.fromPosition, framingTween.toPosition, easedProgress);
      controls.target.lerpVectors(framingTween.fromTarget, framingTween.toTarget, easedProgress);

      if (progress >= 1) {
        framingTween = null;
      }
    }

    controls.update();
  }

  function setMirrored(mirrored) {
    controls.rotateSpeed = mirrored ? -Math.abs(controls.rotateSpeed) : Math.abs(controls.rotateSpeed);
  }

  function fitToObject(object, options = {}, smooth = true) {
    if (!object) {
      return;
    }

    let config = {};
    let smoothMove = smooth;

    if (typeof options === "number") {
      config.margin = options;
    } else if (typeof options === "object" && options !== null) {
      config = options;
      smoothMove = typeof options.smooth === "boolean" ? options.smooth : smooth;
    }

    const margin = config.margin ?? 1;
    const targetHeightRatio = THREE.MathUtils.clamp(config.targetHeightRatio ?? 0.72, 0.1, 0.96);
    const targetWidthRatio = THREE.MathUtils.clamp(config.targetWidthRatio ?? 0.72, 0.1, 0.96);
    const yOffsetRatio = config.yOffsetRatio ?? 0;
    const viewDirection = Array.isArray(config.direction)
      ? new THREE.Vector3(...config.direction)
      : new THREE.Vector3(0.62, 0.12, 1);
    if (viewDirection.lengthSq() <= 0.0001) {
      viewDirection.set(0.62, 0.12, 1);
    }

    computeVisibleBounds(object, box, scratch);
    if (box.isEmpty()) {
      return;
    }

    box.getSize(size);
    box.getCenter(center);

    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(0.1, camera.aspect));
    const heightDistance = size.y / (2 * Math.tan(verticalFov / 2) * targetHeightRatio);
    const widthDistance = size.x / (2 * Math.tan(horizontalFov / 2) * targetWidthRatio);
    const depthDistance = size.z * 1.15;
    let distance = Math.max(heightDistance, widthDistance, depthDistance) * margin;

    if (config.constrainZoom) {
      controls.maxDistance = Math.max(distance * 1.3, controls.minDistance + 0.8);
    }

    distance = THREE.MathUtils.clamp(distance, controls.minDistance + 0.05, controls.maxDistance - 0.2);

    center.y += size.y * yOffsetRatio;
    const targetPosition = center.clone().add(viewDirection.normalize().multiplyScalar(distance));

    const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const durationMs = Math.max(1, config.durationMs ?? DEFAULT_TWEEN_DURATION_MS);

    cancelFramingTween();
    if (smoothMove && !reduceMotion) {
      framingTween = {
        fromPosition: camera.position.clone(),
        toPosition: targetPosition,
        fromTarget: controls.target.clone(),
        toTarget: center.clone(),
        startedAt: performance.now(),
        durationMs,
      };
    } else {
      camera.position.copy(targetPosition);
      controls.target.copy(center);
      controls.update();
    }

    camera.near = Math.max(0.01, distance / 200);
    camera.far = Math.max(120, distance * 30);
    camera.updateProjectionMatrix();
  }

  function focusOnObject(object) {
    fitToObject(object, {
      margin: 0.92,
      targetHeightRatio: 0.62,
      targetWidthRatio: 0.56,
      yOffsetRatio: 0,
      durationMs: 380,
      smooth: true,
    });
  }

  function frameCharacter(object, smooth = true) {
    fitToObject(object, {
      margin: 1,
      targetHeightRatio: 0.8,
      targetWidthRatio: 0.76,
      yOffsetRatio: -0.06,
      constrainZoom: true,
      direction: [0.62, 0.1, 1],
      durationMs: DEFAULT_TWEEN_DURATION_MS,
      smooth,
    });
  }

  function dispose() {
    cancelFramingTween();
    cancelTouchDrag({ dispatchEnd: true });
    activeTouchPointers.clear();
    restorePanAfterMultiTouch();
    canvas.removeEventListener("pointerdown", handleTouchPointerDown, true);
    pointerDocument.removeEventListener("pointermove", handleTouchPointerMove, true);
    pointerDocument.removeEventListener("pointerup", handleTouchPointerEnd, true);
    pointerDocument.removeEventListener("pointercancel", handleTouchPointerEnd, true);
    canvas.removeEventListener("lostpointercapture", handleTouchPointerEnd, true);
    controls.removeEventListener("start", cancelFramingTween);
    controls.dispose();
  }

  return {
    controls,
    update,
    fitToObject,
    focusOnObject,
    frameCharacter,
    setMirrored,
    dispose,
  };
}
