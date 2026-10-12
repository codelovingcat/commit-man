import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fetchGitHubContributions } from "./contributions.js";
import { renderCommitManGif } from "./animation.js";

async function main(): Promise<void> {
  const username = process.env.GITHUB_USERNAME;
  const token = process.env.GITHUB_TOKEN;
  if (!username || !token) {
    throw new Error("Set GITHUB_USERNAME and GITHUB_TOKEN before generating the Commit-Man GIF.");
  }

  const outputPath = process.env.GIF_OUTPUT_PATH ?? "output/commit-man.gif";
  const days = await fetchGitHubContributions(username, token);
  const gif = renderCommitManGif(days);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, gif);
  console.log(`Wrote Commit-Man animation for ${days.length} contribution days to ${outputPath} (${gif.byteLength} bytes).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
