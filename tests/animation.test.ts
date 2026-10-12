import assert from "node:assert/strict";
import test from "node:test";
import type { ContributionDay } from "../src/contributions.js";
import {
  buildZigzagPath,
  getCommitManEyePosition,
  getContributionLevelForFrame,
  renderCommitManGif,
} from "../src/animation.js";

const sampleDays: ContributionDay[] = [
  { date: "2026-10-11", contributionCount: 0, contributionLevel: "NONE" },
  { date: "2026-10-12", contributionCount: 2, contributionLevel: "FIRST_QUARTILE" },
  { date: "2026-10-13", contributionCount: 5, contributionLevel: "SECOND_QUARTILE" },
];

test("creates a continuous serpentine path through every grid cell", () => {
  const path = buildZigzagPath(3);
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

test("builds a deterministic zigzag with varied run lengths", () => {
  const columns = 17;
  const seed = 20261012;
  const path = buildZigzagPath(columns, seed);

  assert.deepEqual(path, buildZigzagPath(columns, seed));
  assert.equal(path.length, columns * 7);
  assert.deepEqual(path[0], { column: 0, row: 0 });
  assert.equal(
    new Set(path.map(({ column, row }) => `${column}:${row}`)).size,
    columns * 7,
  );

  for (const position of path) {
    assert.ok(position.column >= 0 && position.column < columns);
    assert.ok(position.row >= 0 && position.row < 7);
  }

  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1]!;
    const current = path[index]!;
    assert.equal(
      Math.abs(current.column - previous.column) + Math.abs(current.row - previous.row),
      1,
      `path jumps between ${previous.column}:${previous.row} and ${current.column}:${current.row}`,
    );
  }

  const firstHorizontalRunLength = path.findIndex((position) => position.row !== 0);
  assert.ok(firstHorizontalRunLength >= 8 && firstHorizontalRunLength <= 14);
  assert.ok(firstHorizontalRunLength < columns, "the first run should end before crossing the entire garden");

  const normalGridPath = buildZigzagPath(53, seed);
  const horizontalRunLengths: number[] = [];
  let horizontalRunLength = 1;

  for (let index = 1; index < normalGridPath.length; index += 1) {
    const previous = normalGridPath[index - 1]!;
    const current = normalGridPath[index]!;

    if (previous.row === current.row) {
      horizontalRunLength += 1;
    } else {
      horizontalRunLengths.push(horizontalRunLength);
      horizontalRunLength = 1;
    }
  }
  horizontalRunLengths.push(horizontalRunLength);

  assert.ok(
    horizontalRunLengths.every((length) => length >= 8),
    `normal-grid path contains a short horizontal run: ${horizontalRunLengths.join(", ")}`,
  );
});

test("keeps empty contribution cells gray throughout the animation", () => {
  const emptyDay = sampleDays[0]!;
  assert.equal(emptyDay.contributionLevel, "NONE");
  assert.equal(getContributionLevelForFrame(emptyDay, 0, 1), "NONE");
  assert.equal(getContributionLevelForFrame(emptyDay, 0, 20), "NONE");
  assert.equal(getContributionLevelForFrame(emptyDay, undefined, 1), undefined);
});

test("turns an eaten green contribution cell gray without removing its square", () => {
  const greenDay = sampleDays[1]!;
  assert.notEqual(greenDay.contributionLevel, "NONE");
  assert.equal(getContributionLevelForFrame(greenDay, 2, 1), "FIRST_QUARTILE");
  assert.equal(getContributionLevelForFrame(greenDay, 2, 2), "FIRST_QUARTILE");
  assert.equal(getContributionLevelForFrame(greenDay, 2, 3), "NONE");
});

test("keeps Commit-Man's eye upright when moving left or right", () => {
  const centerX = 50;
  const centerY = 50;
  const radius = 10;

  const movingRight = getCommitManEyePosition(centerX, centerY, radius, 0);
  const movingLeft = getCommitManEyePosition(centerX, centerY, radius, Math.PI);

  assert.ok(movingRight.y < centerY);
  assert.equal(movingLeft.y, movingRight.y);
  assert.ok(movingRight.x > centerX);
  assert.ok(movingLeft.x < centerX);
});

test("keeps Commit-Man's eye above its center while moving vertically", () => {
  const centerX = 50;
  const centerY = 50;
  const radius = 10;

  for (const heading of [Math.PI / 2, -Math.PI / 2]) {
    const eye = getCommitManEyePosition(centerX, centerY, radius, heading);
    assert.equal(eye.y, Math.round(centerY - radius * 0.43));
    assert.ok(eye.y < centerY);
    assert.equal(eye.x, centerX);
  }
});

test("renders a valid, looping GIF with the expected dimensions", () => {
  const gif = renderCommitManGif(sampleDays);
  assert.equal(Buffer.from(gif.slice(0, 6)).toString("ascii"), "GIF89a");

  const width = gif[6]! | (gif[7]! << 8);
  const height = gif[8]! | (gif[9]! << 8);
  assert.equal(width, 44);
  assert.equal(height, 134);
  assert.ok(gif.byteLength > 100);
  assert.equal(gif[gif.length - 1], 0x3b);
});

test("defaults to the same 12px cell size and 3px gap as Snake", () => {
  const defaultGif = renderCommitManGif(sampleDays);
  const snakeSizedGif = renderCommitManGif(sampleDays, {
    cellSize: 12,
    gap: 3,
    padding: 16,
  });

  assert.deepEqual(defaultGif, snakeSizedGif);
});

test("uses a slower default frame delay of 70ms", () => {
  const defaultTiming = renderCommitManGif(sampleDays);
  const explicitTiming = renderCommitManGif(sampleDays, { frameDelayMs: 70 });
  assert.deepEqual(defaultTiming, explicitTiming);
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
  assert.throws(() => buildZigzagPath(0), /positive integer/);
  assert.throws(() => buildZigzagPath(3, Number.NaN), /safe integer/);
});
