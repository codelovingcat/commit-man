import { writeFile } from "node:fs/promises";
import { fetchGitHubContributions } from "./contributions.js";
import { renderContributionGarden } from "./garden.js";

async function main(): Promise<void> {
  const username = process.env.GITHUB_USERNAME;
  const token = process.env.GITHUB_TOKEN;
  if (!username || !token) {
    throw new Error("Set GITHUB_USERNAME and GITHUB_TOKEN before generating a live contribution garden.");
  }

  const days = await fetchGitHubContributions(username, token);
  const svg = renderContributionGarden(days, { label: `${username}'s GitHub contribution garden` });
  const outputPath = process.env.OUTPUT_PATH ?? "commit-man-garden.svg";
  await writeFile(outputPath, svg, "utf8");
  console.log(`Wrote ${days.length} contribution days to ${outputPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
