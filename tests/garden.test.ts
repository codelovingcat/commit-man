import assert from "node:assert/strict";
import test from "node:test";
import { renderContributionGarden } from "../src/garden.js";
import type { ContributionDay } from "../src/contributions.js";

const sampleDays: ContributionDay[] = [
  { date: "2026-10-11", contributionCount: 0, contributionLevel: "NONE" },
  { date: "2026-10-12", contributionCount: 2, contributionLevel: "FIRST_QUARTILE" },
  { date: "2026-10-13", contributionCount: 5, contributionLevel: "SECOND_QUARTILE" },
];

test("renders an SVG contribution garden with accessible title and cells", () => {
  const svg = renderContributionGarden(sampleDays);
  assert.match(svg, /^<svg /);
  assert.match(svg, /aria-label="GitHub contribution garden"/);
  assert.match(svg, /2026-10-12: 2 contributions/);
  assert.match(svg, /fill="#0e4429"/);
  assert.equal((svg.match(/<rect x=/g) ?? []).length, 3);
});

test("sorts days by date before rendering", () => {
  const svg = renderContributionGarden([...sampleDays].reverse());
  assert.ok(svg.indexOf("2026-10-11: 0 contributions") < svg.indexOf("2026-10-12: 2 contributions"));
});

test("escapes user-provided labels for safe SVG output", () => {
  const svg = renderContributionGarden(sampleDays, { label: 'A <garden> & "friends"' });
  assert.match(svg, /aria-label="A &lt;garden&gt; &amp; &quot;friends&quot;"/);
});

test("rejects empty data and invalid layout settings", () => {
  assert.throws(() => renderContributionGarden([]), /At least one contribution day/);
  assert.throws(() => renderContributionGarden(sampleDays, { cellSize: 0 }), /cellSize/);
  assert.throws(() => renderContributionGarden(sampleDays, { gap: -1 }), /gap/);
});
