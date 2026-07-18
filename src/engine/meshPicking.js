import * as THREE from "three";

export const TOUCH_PICK_RADIUS_PX = 30;
export const FINE_PICK_RADIUS_PX = 16;

const SAMPLE_RINGS = [
  { radius: 0.22, count: 4, phase: 0 },
  { radius: 0.48, count: 8, phase: Math.PI / 8 },
  { radius: 0.76, count: 4, phase: Math.PI / 4 },
  { radius: 1, count: 8, phase: Math.PI / 8 },
];

export function createMagneticPickSamples(
  pointerNdc,
  viewportWidth,
  viewportHeight,
  radiusPx,
) {
  const width = Math.max(1, viewportWidth);
  const height = Math.max(1, viewportHeight);
  const radius = Math.max(1, radiusPx);
  const samples = [];

  for (const ring of SAMPLE_RINGS) {
    for (let index = 0; index < ring.count; index += 1) {
      const angle = ring.phase + (index / ring.count) * Math.PI * 2;
      const dxPx = Math.cos(angle) * radius * ring.radius;
      const dyPx = Math.sin(angle) * radius * ring.radius;
      samples.push({
        ndc: new THREE.Vector2(
          pointerNdc.x + (dxPx / width) * 2,
          pointerNdc.y - (dyPx / height) * 2,
        ),
        distancePx: Math.hypot(dxPx, dyPx),
      });
    }
  }

  return samples;
}

export function collectMagneticPickCandidates({
  meshes,
  camera,
  raycaster,
  pointerNdc,
  viewportWidth,
  viewportHeight,
  radiusPx = TOUCH_PICK_RADIUS_PX,
  identityForMesh = (mesh) => mesh?.uuid || mesh?.id,
}) {
  const candidatesByIdentity = new Map();
  const samples = createMagneticPickSamples(
    pointerNdc,
    viewportWidth,
    viewportHeight,
    radiusPx,
  );

  for (const sample of samples) {
    raycaster.setFromCamera(sample.ndc, camera);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (!hit?.object) {
      continue;
    }

    const identity = identityForMesh(hit.object) || hit.object.uuid || String(hit.object.id);
    const current = candidatesByIdentity.get(identity);
    if (!current) {
      candidatesByIdentity.set(identity, {
        identity,
        mesh: hit.object,
        minSampleDistancePx: sample.distancePx,
        nearestHitDistance: hit.distance,
        hitCount: 1,
      });
      continue;
    }

    current.hitCount += 1;
    if (sample.distancePx < current.minSampleDistancePx) {
      current.minSampleDistancePx = sample.distancePx;
      current.mesh = hit.object;
    }
    current.nearestHitDistance = Math.min(current.nearestHitDistance, hit.distance);
  }

  return Array.from(candidatesByIdentity.values())
    .map((candidate) => ({
      ...candidate,
      score:
        candidate.minSampleDistancePx -
        Math.min(4, Math.max(0, candidate.hitCount - 1)) * 1.5,
    }))
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.nearestHitDistance - right.nearestHitDistance ||
        right.hitCount - left.hitCount,
    );
}

export function areMagneticCandidatesAmbiguous(candidates) {
  const best = candidates[0];
  const runnerUp = candidates[1];
  if (!best || !runnerUp) {
    return false;
  }

  const requiredGap = Math.max(5, best.minSampleDistancePx * 0.28);
  return runnerUp.score - best.score < requiredGap;
}
