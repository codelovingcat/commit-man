import assert from "node:assert/strict";
import test from "node:test";
import type { ContributionDay } from "../src/contributions.js";
import { buildSerpentinePath, renderCommitManGif } from "../src/animation.js";

const sampleDays: ContributionDay[] = [
  { date: "2026-10-11", contributionCount: 0, contributionLevel: "NONE" },
  { date: "2026-10-12", contributionCount: 2, contributionLevel: "FIRST_QUARTILE" },
  { date: "2026-10-13", contributionCount: 5, contributionLevel: "SECOND_QUARTILE" },
];

test("creates a continuous serpentine path through every grid cell", () => {
  const path = buildSerpentinePath(3);
  assert.equal(path.length, 21);
  assert.deepEqual(path.slice(0, 6), [
    { column: 0, row: 0 },
    { column: 1, row: 0 },
    { column: 2, row: 0 },
    { column: 2, row: 1 },
    { column: 1, row: 1 },
    { column: 0, row: 1 },
  ]);

  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1]!;
    const current = path[index]!;
    assert.equal(Math.abs(current.column - previous.column) + Math.abs(current.row - previous.row), 1);
  }
});

test("renders a valid, looping GIF with the expected dimensions", () => {
  const gif = renderCommitManGif(sampleDays);
  assert.equal(Buffer.from(gif.slice(0, 6)).toString("ascii"), "GIF89a");

  const width = gif[6]! | (gif[7]! << 8);
  const height = gif[8]! | (gif[9]! << 8);
  assert.equal(width, 42);
  assert.equal(height, 120);
  assert.ok(gif.byteLength > 100);
  assert.equal(gif[gif.length - 1], 0x3b);
});

test("produces deterministic output for the same contribution data", () => {
  const first = renderCommitManGif(sampleDays, { frameDelayMs: 50 });
  const second = renderCommitManGif(sampleDays, { frameDelayMs: 50 });
  assert.deepEqual(first, second);
});

test("rejects empty contribution data and invalid animation settings", () => {
  assert.throws(() => renderCommitManGif([]), /At least one contribution day/);
  assert.throws(() => renderCommitManGif(sampleDays, { cellSize: 0 }), /cellSize/);
  assert.throws(() => renderCommitManGif(sampleDays, { gap: -1 }), /gap/);
  assert.throws(() => buildSerpentinePath(0), /positive integer/);
});
