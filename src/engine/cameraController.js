import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const DEFAULT_TWEEN_DURATION_MS = 420;

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
  controls.touches.ONE = THREE.TOUCH.ROTATE;
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

  function cancelFramingTween() {
    framingTween = null;
  }

  controls.addEventListener("start", cancelFramingTween);

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
