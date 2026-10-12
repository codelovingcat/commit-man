# Commit-Man

> **Your contributions. His appetite.**

Turn your GitHub contribution graph into a playful, Pac-Man-inspired animation. Commit-Man chomps its way through your contribution garden, bringing your coding activity to life.

**Commit-Man is a standalone project.** It is inspired by the visual idea of GitHub contribution animations, but it has its own character, implementation, and roadmap.

## Project status

🚧 **Early development — the contribution garden, character, animated GIF generator, and publishing workflow are implemented; profile presentation is being polished.**

The initial goal is intentionally small: render a GitHub-style contribution garden, animate a yellow Pac-Man-inspired character with an opening and closing mouth, move it across the garden, and export the animation as a GIF.

There is no maze, ghosts, lives, collision system, or restart mechanic in the first version. Those ideas may be explored later, after the core experience works well.

## Planned first version

- [x] Render a GitHub-style contribution garden.
- [x] Retrieve contribution data from GitHub GraphQL when credentials are configured.
- [x] Draw a recognizable yellow Commit-Man character as an SVG.
- [x] Generate repeatable open/close mouth frames.
- [x] Move the character along a continuous path through the contribution cells.
- [x] Export an animated GIF suitable for a GitHub profile README.
- [x] Document setup, configuration, and profile usage.

## Current implementation

The contribution garden is generated as SVG, with one cell per day and GitHub-inspired contribution intensity colors. Data retrieval and rendering are separate modules.

The Commit-Man sprite can be generated as a transparent SVG with configurable size, mouth opening, label, and direction. The GIF renderer moves the character along a continuous serpentine path through the garden, animates its mouth, and removes visited cells to create an eating effect.

This project is a generator, not a browser-based game UI. Opening the repository files directly in a browser may show the file listing; the generated GIF is the profile-ready result.

### Requirements

- Node.js 20 or newer
- npm
- A GitHub username
- A GitHub token with access to the GitHub GraphQL API

### Setup

```bash
npm install
npm test
npm run build
```

### Generate a contribution garden SVG

Set the following environment variables before running the generator:

- `GITHUB_USERNAME` — GitHub account whose contribution calendar should be rendered.
- `GITHUB_TOKEN` — token used to query GitHub GraphQL. Keep it private; never commit it.
- `OUTPUT_PATH` — optional SVG output path. Defaults to `commit-man-garden.svg`.

PowerShell example:

```powershell
$env:GITHUB_USERNAME = "your-github-username"
$env:GITHUB_TOKEN = "your-token"
$env:OUTPUT_PATH = "commit-man-garden.svg"
npm run build
npm run generate:garden
```

Bash example:

```bash
GITHUB_USERNAME="your-github-username" \
GITHUB_TOKEN="your-token" \
OUTPUT_PATH="commit-man-garden.svg" \
npm run build && npm run generate:garden
```

### Generate the animated Commit-Man GIF

Use the same GitHub credentials. The GIF defaults to `output/commit-man.gif`; set `GIF_OUTPUT_PATH` to choose another path.

PowerShell example:

```powershell
$env:GITHUB_USERNAME = "codelovingcat"
$env:GITHUB_TOKEN = "your-token"
$env:GIF_OUTPUT_PATH = "output/commit-man.gif"
npm run build
npm run generate:gif
```

Bash example:

```bash
GITHUB_USERNAME="codelovingcat" \
GITHUB_TOKEN="your-token" \
GIF_OUTPUT_PATH="output/commit-man.gif" \
npm run build && npm run generate:gif
```

Never commit or paste access tokens into issues, commits, or README files. The generator requests the most recent 365 days of contribution data; the available information depends on the token and contribution visibility.

### Publish and embed the GIF on your profile

The `Generate Commit-Man GIF` GitHub Actions workflow runs manually, on pushes to `main`, and on a weekly schedule. It generates the animation and publishes it to the `output` branch at:

`https://raw.githubusercontent.com/codelovingcat/commit-man/output/commit-man.gif`

After the workflow has successfully published the first GIF, embed it in your profile README with:

```html
<p align="center">
  <a href="https://github.com/codelovingcat/commit-man">
    <img src="https://raw.githubusercontent.com/codelovingcat/commit-man/output/commit-man.gif" alt="Commit-Man eating the GitHub contribution garden" />
  </a>
</p>
```

## The idea

GitHub contribution graphs are usually static grids of colored squares. Commit-Man turns that familiar grid into a tiny arcade scene: the character travels through the garden and eats its contribution cells.

The visual language should stay close to the familiar contribution graph, while the character and animation give the project its own personality.

## Roadmap

### Phase 1 — Contribution garden and character
- Build the contribution-grid foundation.
- Create the Commit-Man sprite.
- Animate its mouth.
- Establish the movement and eating animation.
- Export a working GIF.

### Phase 2 — Polish and profile integration
- Improve animation smoothness and visual consistency.
- Make GIF generation reliable and easy to configure.
- Add clear examples and profile README instructions.
- Document customization options.

### Future ideas — exploratory

These are ideas, not promises for the first release:

- Turn empty days or selected cells into maze-like paths.
- Add ghost characters and simple chase behavior.
- Explore collision, losing, and restart animations.
- Add configurable visual themes or animation options.

## Development approach

The project will be developed incrementally through focused GitHub issues and pull requests. Each change should have a clear scope and appropriate tests or validation. Pull requests are reviewed before they are merged.

## Contributing

Ideas, bug reports, and improvements are welcome! If you open an issue, please describe the expected behavior and the problem or idea clearly. Small, focused contributions are easier to review and build on.

Contribution guidelines and development instructions will be added as the project structure and tooling are established.

## License

The license has not been selected yet. A license will be added before the project is presented as open source for reuse.
