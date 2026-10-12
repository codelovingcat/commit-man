import type { ContributionDay, ContributionLevel } from "./contributions.js";

export interface GardenOptions {
  cellSize?: number;
  gap?: number;
  padding?: number;
  label?: string;
}

const LEVEL_COLORS: Record<ContributionLevel, string> = {
  NONE: "#161b22",
  FIRST_QUARTILE: "#0e4429",
  SECOND_QUARTILE: "#006d32",
  THIRD_QUARTILE: "#26a641",
  FOURTH_QUARTILE: "#39d353",
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderContributionGarden(
  days: ContributionDay[],
  options: GardenOptions = {},
): string {
  if (days.length === 0) throw new Error("At least one contribution day is required.");

  const cellSize = options.cellSize ?? 11;
  const gap = options.gap ?? 3;
  const padding = options.padding ?? 12;
  if (!Number.isFinite(cellSize) || cellSize <= 0) throw new Error("cellSize must be greater than zero.");
  if (!Number.isFinite(gap) || gap < 0) throw new Error("gap cannot be negative.");
  if (!Number.isFinite(padding) || padding < 0) throw new Error("padding cannot be negative.");

  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const firstDate = new Date(`${sorted[0]!.date}T00:00:00Z`);
  if (Number.isNaN(firstDate.getTime())) throw new Error("Contribution dates must use YYYY-MM-DD format.");

  const firstWeekday = firstDate.getUTCDay();
  const columnCount = Math.ceil((firstWeekday + sorted.length) / 7);
  const step = cellSize + gap;
  const width = padding * 2 + columnCount * step - gap;
  const height = padding * 2 + 7 * step - gap;
  const title = escapeXml(options.label ?? "GitHub contribution garden");

  const cells = sorted.map((day) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date)) {
      throw new Error(`Invalid contribution date: ${day.date}`);
    }
    if (!Number.isFinite(day.contributionCount) || day.contributionCount < 0) {
      throw new Error(`Invalid contribution count for ${day.date}`);
    }

    const date = new Date(`${day.date}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) throw new Error(`Invalid contribution date: ${day.date}`);
    const dayOffset = Math.round((date.getTime() - firstDate.getTime()) / 86_400_000);
    const index = firstWeekday + dayOffset;
    const column = Math.floor(index / 7);
    const row = date.getUTCDay();
    const x = padding + column * step;
    const y = padding + row * step;
    const color = LEVEL_COLORS[day.contributionLevel];
    if (!color) throw new Error(`Unknown contribution level for ${day.date}`);

    return `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${color}"><title>${escapeXml(day.date)}: ${day.contributionCount} contributions</title></rect>`;
  }).join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">`,
    `<title>${title}</title>`,
    `<rect width="${width}" height="${height}" rx="6" fill="#0d1117"/>`,
    cells,
    "</svg>",
  ].join("");
}

export { LEVEL_COLORS };
