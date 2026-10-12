import gifenc from "gifenc";

const { applyPalette, GIFEncoder } = gifenc;
import type { ContributionDay } from "./contributions.js";
import { LEVEL_COLORS } from "./garden.js";

export interface CommitManAnimationOptions {
  cellSize?: number;
  gap?: number;
  padding?: number;
  frameDelayMs?: number;
}

export interface GridPosition {
  column: number;
  row: number;
}

const BACKGROUND = "#0d1117";
const CHARACTER = "#ffdf00";
const EYE = "#242424";
const PALETTE: number[][] = [
  [13, 17, 23],
  [22, 27, 34],
  [14, 68, 41],
  [0, 109, 50],
  [38, 166, 65],
  [57, 211, 83],
  [255, 223, 0],
  [36, 36, 36],
];

const MOUTH_SEQUENCE = [0.06, 0.24, 0.48, 0.24];
const DEFAULT_FRAME_DELAY_MS = 70;

const DEFAULT_ZIGZAG_SEED = 0xC0FFEE;
const CONTRIBUTION_ROWS = 7;
const MIN_ZIGZAG_RUN = 2;
const MAX_ZIGZAG_RUN = 5;

/**
 * Build a deterministic, connected path through every contribution cell.
 * The route snakes through short column bands of varying widths instead of
 * crossing the entire garden before changing rows. Odd/even bands alternate
 * between descending and ascending through the seven rows.
 */
export function buildZigzagPath(
  columns: number,
  seed = DEFAULT_ZIGZAG_SEED,
): GridPosition[] {
  if (!Number.isInteger(columns) || columns < 1) {
    throw new Error("columns must be a positive integer.");
  }
  if (!Number.isSafeInteger(seed)) {
    throw new Error("seed must be a safe integer.");
  }

  const random = createSeededRandom(seed);
  const bands: Array<{ startColumn: number; width: number }> = [];
  let nextColumn = 0;

  while (nextColumn < columns) {
    const remaining = columns - nextColumn;
    const width = remaining <= MAX_ZIGZAG_RUN
      ? remaining
      : MIN_ZIGZAG_RUN + Math.floor(random() * (MAX_ZIGZAG_RUN - MIN_ZIGZAG_RUN + 1));

    bands.push({ startColumn: nextColumn, width });
    nextColumn += width;
  }

  const path: GridPosition[] = [];
  let startsAtTop = true;

  for (const band of bands) {
    const endColumn = band.startColumn + band.width - 1;

    for (let rowOffset = 0; rowOffset < CONTRIBUTION_ROWS; rowOffset += 1) {
      const row = startsAtTop ? rowOffset : CONTRIBUTION_ROWS - 1 - rowOffset;

      if (rowOffset % 2 === 0) {
        for (let column = band.startColumn; column <= endColumn; column += 1) {
          path.push({ column, row });
        }
      } else {
        for (let column = endColumn; column >= band.startColumn; column -= 1) {
          path.push({ column, row });
        }
      }
    }

    startsAtTop = !startsAtTop;
  }

  return path;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Return the color level for a contribution cell in the current frame.
 * Once a green cell has been eaten, preserve the square as an empty gray cell.
 */
export function getContributionLevelForFrame(
  day: ContributionDay,
  visitedAt: number | undefined,
  frameIndex: number,
): ContributionDay["contributionLevel"] | undefined {
  if (visitedAt === undefined) return undefined;
  if (day.contributionLevel === "NONE" || visitedAt >= frameIndex) {
    return day.contributionLevel;
  }
  return "NONE";
}

/**
 * Render an animated GIF of Commit-Man travelling through the contribution
 * garden. The character follows a connected, varied-width zigzag path and
 * changes eaten green cells to gray while preserving the grid squares.
 */
export function renderCommitManGif(
  inputDays: ContributionDay[],
  options: CommitManAnimationOptions = {},
): Uint8Array {
  if (inputDays.length === 0) {
    throw new Error("At least one contribution day is required.");
  }

  const cellSize = options.cellSize ?? 10;
  const gap = options.gap ?? 3;
  const padding = options.padding ?? 16;
  const frameDelayMs = options.frameDelayMs ?? DEFAULT_FRAME_DELAY_MS;

  if (!Number.isInteger(cellSize) || cellSize < 4 || cellSize > 24) {
    throw new Error("cellSize must be an integer between 4 and 24.");
  }
  if (!Number.isInteger(gap) || gap < 0 || gap > 12) {
    throw new Error("gap must be an integer between 0 and 12.");
  }
  if (!Number.isInteger(padding) || padding < 0 || padding > 64) {
    throw new Error("padding must be an integer between 0 and 64.");
  }
  if (!Number.isInteger(frameDelayMs) || frameDelayMs < 20 || frameDelayMs > 1000) {
    throw new Error("frameDelayMs must be an integer between 20 and 1000.");
  }

  const days = [...inputDays].sort((a, b) => a.date.localeCompare(b.date));
  const firstDate = parseUtcDate(days[0]!.date);
  const lastDate = parseUtcDate(days[days.length - 1]!.date);
  const firstWeekday = firstDate.getUTCDay();
  const totalDays = Math.floor((lastDate.getTime() - firstDate.getTime()) / 86_400_000) + 1;

  if (totalDays < 1) {
    throw new Error("Contribution dates must be in ascending calendar order.");
  }

  const columns = Math.ceil((firstWeekday + totalDays) / 7);
  const path = buildZigzagPath(columns);
  const pitch = cellSize + gap;
  const width = padding * 2 + columns * pitch - gap;
  const height = padding * 2 + 7 * pitch - gap;
  const cellByKey = new Map<string, ContributionDay>();

  for (const day of days) {
    const date = parseUtcDate(day.date);
    if (!Number.isFinite(day.contributionCount) || day.contributionCount < 0) {
      throw new Error(`Invalid contribution count for ${day.date}.`);
    }
    if (!LEVEL_COLORS[day.contributionLevel]) {
      throw new Error(`Unknown contribution level for ${day.date}.`);
    }

    const dayOffset = Math.floor((date.getTime() - firstDate.getTime()) / 86_400_000);
    const column = Math.floor((firstWeekday + dayOffset) / 7);
    const row = date.getUTCDay();
    cellByKey.set(positionKey({ column, row }), day);
  }

  const visitOrder = new Map(path.map((position, index) => [positionKey(position), index]));
  const encoder = GIFEncoder();
  const radius = Math.max(3, cellSize * 0.66);

  for (let frameIndex = 0; frameIndex < path.length; frameIndex += 1) {
    const pixels = createCanvas(width, height, hexToRgb(BACKGROUND));

    for (const [key, day] of cellByKey) {
      const visitedAt = visitOrder.get(key);
      const level = getContributionLevelForFrame(day, visitedAt, frameIndex);
      if (level === undefined) continue;

      const [columnText, rowText] = key.split(":");
      const column = Number(columnText);
      const row = Number(rowText);
      const color = LEVEL_COLORS[level];
      fillCell(
        pixels,
        width,
        padding + column * pitch,
        padding + row * pitch,
        cellSize,
        hexToRgb(color),
      );
    }

    const current = path[frameIndex]!;
    const next = path[frameIndex + 1];
    const previous = path[frameIndex - 1];
    const heading = next
      ? Math.atan2(next.row - current.row, next.column - current.column)
      : previous
        ? Math.atan2(current.row - previous.row, current.column - previous.column)
        : 0;
    const centerX = padding + current.column * pitch + cellSize / 2;
    const centerY = padding + current.row * pitch + cellSize / 2;
    drawCommitMan(
      pixels,
      width,
      height,
      centerX,
      centerY,
      radius,
      heading,
      MOUTH_SEQUENCE[frameIndex % MOUTH_SEQUENCE.length]!,
    );

    const indexed = applyPalette(pixels, PALETTE);
    encoder.writeFrame(indexed, width, height, {
      palette: PALETTE,
      delay: frameDelayMs,
      ...(frameIndex === 0 ? { repeat: 0 } : {}),
    });
  }

  encoder.finish();
  return encoder.bytes();
}

function parseUtcDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid contribution date: ${value}`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid contribution date: ${value}`);
  }
  return date;
}

function positionKey(position: GridPosition): string {
  return `${position.column}:${position.row}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function createCanvas(
  width: number,
  height: number,
  color: [number, number, number],
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = 255;
  }
  return pixels;
}

function setPixel(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  color: [number, number, number],
): void {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const offset = (y * width + x) * 4;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
  pixels[offset + 3] = 255;
}

function fillCell(
  pixels: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  size: number,
  color: [number, number, number],
): void {
  for (let offsetY = 0; offsetY < size; offsetY += 1) {
    for (let offsetX = 0; offsetX < size; offsetX += 1) {
      if (
        (offsetX === 0 || offsetX === size - 1) &&
        (offsetY === 0 || offsetY === size - 1)
      ) {
        continue;
      }
      const offset = ((y + offsetY) * width + (x + offsetX)) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = 255;
    }
  }
}

/**
 * Keep the eye on the character's upper side regardless of travel direction.
 * Only let it shift slightly left/right; rotating it with the heading made
 * Commit-Man look upside down whenever it travelled left.
 */
export function getCommitManEyePosition(
  centerX: number,
  centerY: number,
  radius: number,
  heading: number,
): { x: number; y: number } {
  return {
    x: Math.round(centerX + Math.cos(heading) * radius * 0.1),
    y: Math.round(centerY - radius * 0.43),
  };
}

function drawCommitMan(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number,
  heading: number,
  mouthAngle: number,
): void {
  const yellow = hexToRgb(CHARACTER);
  const eye = hexToRgb(EYE);
  const left = Math.floor(centerX - radius);
  const right = Math.ceil(centerX + radius);
  const top = Math.floor(centerY - radius);
  const bottom = Math.ceil(centerY + radius);
  const squaredRadius = radius * radius;

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const dx = x + 0.5 - centerX;
      const dy = y + 0.5 - centerY;
      if (dx * dx + dy * dy > squaredRadius) continue;

      const pixelAngle = Math.atan2(dy, dx);
      const angleDifference = Math.atan2(
        Math.sin(pixelAngle - heading),
        Math.cos(pixelAngle - heading),
      );
      if (Math.abs(angleDifference) < mouthAngle && dx * dx + dy * dy > squaredRadius * 0.12) {
        continue;
      }
      setPixel(pixels, width, height, x, y, yellow);
    }
  }

  const eyePosition = getCommitManEyePosition(centerX, centerY, radius, heading);
  const eyeX = eyePosition.x;
  const eyeY = eyePosition.y;
  const eyeRadius = Math.max(1, Math.floor(radius * 0.18));
  for (let y = eyeY - eyeRadius; y <= eyeY + eyeRadius; y += 1) {
    for (let x = eyeX - eyeRadius; x <= eyeX + eyeRadius; x += 1) {
      const dx = x - eyeX;
      const dy = y - eyeY;
      if (dx * dx + dy * dy <= eyeRadius * eyeRadius) {
        setPixel(pixels, width, height, x, y, eye);
      }
    }
  }
}
