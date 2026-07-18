import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as THREE from "three";

import {
  areMagneticCandidatesAmbiguous,
  collectMagneticPickCandidates,
  createMagneticPickSamples,
  FINE_PICK_RADIUS_PX,
  TOUCH_PICK_RADIUS_PX,
} from "../src/engine/meshPicking.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("magnetic picking samples a bounded 24-point touch halo in screen space", () => {
  const pointer = new THREE.Vector2(0.1, -0.2);
  const samples = createMagneticPickSamples(pointer, 200, 100, 20);

  assert.equal(samples.length, 24);
  assert.ok(samples.every((sample) => sample.distancePx <= 20 + Number.EPSILON));
  assert.ok(Math.abs(samples[0].ndc.x - 0.144) < 1e-12);
  assert.equal(samples[0].ndc.y, -0.2);
  assert.ok(samples.some((sample) => sample.ndc.y < pointer.y), "screen-down samples must lower NDC y");
  assert.equal(TOUCH_PICK_RADIUS_PX, 30);
  assert.equal(FINE_PICK_RADIUS_PX, 16);
});

test("magnetic candidates collapse repeated mesh identities and only count the front hit", () => {
  const meshA1 = { uuid: "a1", userData: { structureId: "a" } };
  const meshA2 = { uuid: "a2", userData: { structureId: "a" } };
  const meshB = { uuid: "b", userData: { structureId: "b" } };
  let sampleIndex = 0;
  const raycaster = {
    setFromCamera() {},
    intersectObjects(meshes) {
      assert.deepEqual(meshes, [meshA1, meshA2, meshB]);
      sampleIndex += 1;
      if (sampleIndex <= 3) {
        return [{ object: sampleIndex === 1 ? meshA1 : meshA2, distance: 2 }];
      }
      if (sampleIndex === 4) {
        return [
          { object: meshB, distance: 1 },
          { object: meshA1, distance: 2 },
        ];
      }
      return [];
    },
  };

  const candidates = collectMagneticPickCandidates({
    meshes: [meshA1, meshA2, meshB],
    camera: {},
    raycaster,
    pointerNdc: new THREE.Vector2(),
    viewportWidth: 390,
    viewportHeight: 844,
    radiusPx: 30,
    identityForMesh: (mesh) => mesh.userData.structureId,
  });

  assert.equal(candidates.length, 2);
  const structureA = candidates.find((candidate) => candidate.identity === "a");
  const structureB = candidates.find((candidate) => candidate.identity === "b");
  assert.equal(structureA.hitCount, 3);
  assert.equal(structureB.hitCount, 1);
  assert.equal(structureA.mesh, meshA1);
  assert.ok(candidates.indexOf(structureA) < candidates.indexOf(structureB));
});

test("magnetic ambiguity is deterministic at the minimum score gap", () => {
  const best = { score: 10, minSampleDistancePx: 10 };
  assert.equal(areMagneticCandidatesAmbiguous([best, { score: 14.99 }]), true);
  assert.equal(areMagneticCandidatesAmbiguous([best, { score: 15 }]), false);
  assert.equal(areMagneticCandidatesAmbiguous([best]), false);
});

test("runtime preserves exact-hit priority and visibility filtering", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const exactHit = app.indexOf("const exactMesh = hits[0]?.object || null");
  const magneticFallback = app.indexOf("collectMagneticPickCandidates({");

  assert.ok(exactHit >= 0);
  assert.ok(magneticFallback > exactHit);
  assert.match(app, /getActiveSelectables\(\)\.filter\(isSelectableVisible\)/);
  assert.match(app, /showPickCandidateMenu\(candidates\.slice\(0, 4\), event\)/);
  assert.match(app, /state\.experienceMode === "explore"/);
});
