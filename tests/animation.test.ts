import assert from "node:assert/strict";
import test from "node:test";
import type { ContributionDay } from "../src/contributions.js";
import {
  buildScoreEvents,
  buildZigzagPath,
  getCommitManEyePosition,
  getCommitPauseFramesForFrame,
  getContributionLevelForFrame,
  getScorePopupsForFrame,
  renderCommitManGif,
} from "../src/animation.js";

const sampleDays: ContributionDay[] = [
  { date: "2026-10-11", contributionCount: 0, contributionLevel: "NONE" },
  { date: "2026-10-12", contributionCount: 2, contributionLevel: "FIRST_QUARTILE" },
  { date: "2026-10-13", contributionCount: 5, contributionLevel: "SECOND_QUARTILE" },
];

function directionSegments(path: readonly { column: number; row: number }[]) {
  const segments: Array<{ deltaColumn: number; deltaRow: number; length: number }> = [];

  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1]!;
    const current = path[index]!;
    const deltaColumn = current.column - previous.column;
    const deltaRow = current.row - previous.row;
    const last = segments[segments.length - 1];

    if (
      last &&
      last.deltaColumn === deltaColumn &&
      last.deltaRow === deltaRow
    ) {
      last.length += 1;
    } else {
      segments.push({ deltaColumn, deltaRow, length: 1 });
    }
  }

  return segments;
}

test("builds a connected route that visits every cell, allowing natural revisits", () => {
  const columns = 3;
  const path = buildZigzagPath(columns);
  assert.deepEqual(path[0], { column: 0, row: 0 });
  assert.deepEqual(path, buildZigzagPath(columns));
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
});

test("moves forward across offset runs before turning back", () => {
  const seed = 20261012;
  const path = buildZigzagPath(53, seed);
  assert.deepEqual(path, buildZigzagPath(53, seed));
  assert.deepEqual(path[0], { column: 0, row: 0 });
  assert.equal(
    new Set(path.map(({ column, row }) => `${column}:${row}`)).size,
    53 * 7,
    "the route must eventually visit every contribution cell",
  );

  const segments = directionSegments(path);
  assert.equal(segments[0]!.deltaColumn, 1);
  assert.ok(segments[0]!.length >= 6 && segments[0]!.length <= 7);

  assert.equal(segments[1]!.deltaColumn, 0);
  assert.equal(segments[1]!.length, 2, "the first long run should be followed by a two-cell drop");

  assert.equal(segments[2]!.deltaColumn, 1);
  assert.ok(segments[2]!.length >= 6 && segments[2]!.length <= 7);
  assert.equal(segments[3]!.deltaColumn, 0);
  assert.equal(segments[3]!.length, 1);

  assert.equal(segments[4]!.deltaColumn, 1);
  assert.ok(segments[4]!.length >= 2 && segments[4]!.length <= 4);
  assert.equal(segments[6]!.deltaColumn, -1, "the route reverses after the shorter run rather than after every row");
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

test("awards increasing scores only for green contribution cells", () => {
  const path = [
    { column: 0, row: 0 },
    { column: 1, row: 0 },
    { column: 2, row: 0 },
    { column: 1, row: 0 },
    { column: 0, row: 1 },
  ];
  const cellByKey = new Map([
    ["0:0", sampleDays[0]!],
    ["1:0", sampleDays[1]!],
    ["2:0", sampleDays[2]!],
    ["0:1", sampleDays[0]!],
  ]);

  const events = buildScoreEvents(path, cellByKey);
  assert.deepEqual(
    events.map(({ position, score, eatenAtFrame }) => ({ position, score, eatenAtFrame })),
    [
      { position: { column: 1, row: 0 }, score: 1, eatenAtFrame: 1 },
      { position: { column: 2, row: 0 }, score: 2, eatenAtFrame: 2 },
    ],
  );
});

test("adds a deterministic one- or two-frame pause before eating green cells only", () => {
  const scoreEvents = [
    { position: { column: 1, row: 0 }, score: 1, eatenAtFrame: 1 },
    { position: { column: 2, row: 0 }, score: 2, eatenAtFrame: 3 },
    { position: { column: 4, row: 0 }, score: 3, eatenAtFrame: 6 },
  ];

  assert.equal(getCommitPauseFramesForFrame(scoreEvents, 0), 1);
  assert.equal(getCommitPauseFramesForFrame(scoreEvents, 1), 0);
  assert.equal(getCommitPauseFramesForFrame(scoreEvents, 2), 2);
  assert.equal(getCommitPauseFramesForFrame(scoreEvents, 3), 0);
  assert.equal(getCommitPauseFramesForFrame(scoreEvents, 5), 1);
  assert.equal(getCommitPauseFramesForFrame(scoreEvents, 6), 0);
  assert.equal(getCommitPauseFramesForFrame([], 0), 0);
});

test("shows floating score popups briefly with an increasing score", () => {
  const events = [
    { position: { column: 1, row: 0 }, score: 1, eatenAtFrame: 1 },
    { position: { column: 2, row: 0 }, score: 2, eatenAtFrame: 2 },
    { position: { column: 3, row: 0 }, score: 3, eatenAtFrame: 3 },
  ];

  assert.deepEqual(
    getScorePopupsForFrame(events, 2).map(({ score, age }) => ({ score, age })),
    [{ score: 1, age: 1 }, { score: 2, age: 0 }],
  );
  assert.deepEqual(
    getScorePopupsForFrame(events, 6).map(({ score, age }) => ({ score, age })),
    [{ score: 2, age: 4 }, { score: 3, age: 3 }],
  );
  assert.deepEqual(getScorePopupsForFrame(events, 8), []);
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
