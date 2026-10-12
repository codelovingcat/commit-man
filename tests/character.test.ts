import assert from "node:assert/strict";
import test from "node:test";
import { createMouthAnimationFrames, renderCommitManFrame } from "../src/character.js";

test("renders a crisp, transparent SVG character at the requested dimensions", () => {
  const svg = renderCommitManFrame({ size: 48 });
  assert.match(svg, /width="48" height="48"/);
  assert.match(svg, /fill="#ffdf00"/);
  assert.match(svg, /<mask id="commit-man-mouth">/);
  assert.doesNotMatch(svg, /<rect width="48" height="48" fill="#[0-9a-f]{3,8}"/i);
});

test("changes the mouth opening and supports all four directions", () => {
  const closed = renderCommitManFrame({ mouthAngleDegrees: 0 });
  const open = renderCommitManFrame({ mouthAngleDegrees: 35 });
  const facingUp = renderCommitManFrame({ direction: "up" });
  assert.doesNotMatch(closed, /<path d="M 32 32 L/);
  assert.match(open, /<path d="M 32 32 L/);
  assert.match(facingUp, /rotate\(270 32 32\)/);
});

test("creates a consistent, repeatable sequence of animation frames", () => {
  const frames = createMouthAnimationFrames({ size: 40 }, [8, 30, 8]);
  assert.equal(frames.length, 3);
  assert.ok(frames.every((frame) => frame.includes('width="40" height="40"')));
  assert.equal(frames[0], frames[2]);
});

test("escapes labels and rejects invalid configuration", () => {
  assert.match(renderCommitManFrame({ label: "A <B> & C" }), /aria-label="A &lt;B&gt; &amp; C"/);
  assert.throws(() => renderCommitManFrame({ size: 10 }), /size/);
  assert.throws(() => renderCommitManFrame({ mouthAngleDegrees: 70 }), /mouthAngleDegrees/);
  assert.throws(() => createMouthAnimationFrames({}, []), /At least one mouth angle/);
});
