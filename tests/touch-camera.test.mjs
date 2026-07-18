import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  calculateWorldYTrackDelta,
  resolveTouchDragAxis,
  TOUCH_DRAG_THRESHOLD_PX,
} from "../src/engine/cameraController.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("touch drag intent locks only after the shared 12 px slop", () => {
  assert.equal(TOUCH_DRAG_THRESHOLD_PX, 12);
  assert.equal(resolveTouchDragAxis(12, 0), null);
  assert.equal(resolveTouchDragAxis(13, 0), "horizontal");
  assert.equal(resolveTouchDragAxis(0, -13), "vertical");
  assert.equal(resolveTouchDragAxis(13, 13), "horizontal");
  assert.equal(resolveTouchDragAxis(Number.NaN, 20), null);
});

test("world-Y tracking follows the visible perspective height and finger direction", () => {
  const delta = calculateWorldYTrackDelta({
    deltaY: 100,
    viewportHeight: 500,
    cameraDistance: 2,
    verticalFovDegrees: 90,
  });
  assert.ok(Math.abs(delta - 0.8) < 1e-12);
  assert.equal(
    calculateWorldYTrackDelta({
      deltaY: -100,
      viewportHeight: 500,
      cameraDistance: 2,
      verticalFovDegrees: 90,
    }),
    -delta,
  );
});

test("world-Y tracking supports orthographic zoom and rejects invalid viewports", () => {
  assert.equal(
    calculateWorldYTrackDelta({
      deltaY: 50,
      viewportHeight: 100,
      orthographicHeight: 10,
      zoom: 2,
    }),
    2.5,
  );
  assert.equal(calculateWorldYTrackDelta({ deltaY: 20, viewportHeight: 0 }), 0);
  assert.equal(calculateWorldYTrackDelta({ deltaY: Number.NaN, viewportHeight: 100 }), 0);
});

test("camera and canvas source contracts keep mouse, pinch and tap separation stable", () => {
  const cameraSource = fs.readFileSync(path.join(root, "src/engine/cameraController.js"), "utf8");
  const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");

  assert.match(cameraSource, /controls\.enablePan = false/);
  assert.match(cameraSource, /controls\.touches\.ONE = null/);
  assert.match(cameraSource, /controls\.touches\.TWO = THREE\.TOUCH\.DOLLY_PAN/);
  assert.match(cameraSource, /camera\.position\.y \+= worldDeltaY/);
  assert.match(cameraSource, /controls\.target\.y \+= worldDeltaY/);
  assert.match(appSource, /pointerType === "touch" \? TOUCH_DRAG_THRESHOLD_PX : 8/);
  assert.match(appSource, /pointerDown\.maxDistance/);
});
