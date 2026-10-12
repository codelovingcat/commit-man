export type CharacterDirection = "right" | "down" | "left" | "up";

export interface CharacterFrameOptions {
  size?: number;
  mouthAngleDegrees?: number;
  direction?: CharacterDirection;
  label?: string;
}

const ROTATION: Record<CharacterDirection, number> = {
  right: 0,
  down: 90,
  left: 180,
  up: 270,
};

/**
 * Render one transparent SVG frame of Commit-Man.
 * The mouth angle is the half-angle on each side of the mouth opening.
 */
export function renderCommitManFrame(options: CharacterFrameOptions = {}): string {
  const size = options.size ?? 64;
  const mouthAngle = options.mouthAngleDegrees ?? 28;
  const direction = options.direction ?? "right";
  const label = escapeXml(options.label ?? "Commit-Man");

  if (!Number.isFinite(size) || size < 16) {
    throw new Error("size must be a finite number of at least 16.");
  }
  if (!Number.isFinite(mouthAngle) || mouthAngle < 0 || mouthAngle > 60) {
    throw new Error("mouthAngleDegrees must be between 0 and 60.");
  }
  if (!(direction in ROTATION)) {
    throw new Error("direction must be right, down, left, or up.");
  }

  const center = size / 2;
  const radius = size * 0.43;
  const eyeRadius = Math.max(1.5, size * 0.045);
  const eyeX = center + radius * 0.12;
  const eyeY = center - radius * 0.48;
  const radians = (mouthAngle * Math.PI) / 180;
  const startX = center + radius * Math.cos(radians);
  const startY = center - radius * Math.sin(radians);
  const endX = center + radius * Math.cos(radians);
  const endY = center + radius * Math.sin(radians);

  const mask = mouthAngle === 0
    ? ""
    : `<path d="M ${center} ${center} L ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY} Z" fill="black"/>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${label}">`,
    `<title>${label}</title>`,
    `<defs><mask id="commit-man-mouth"><rect width="${size}" height="${size}" fill="white"/>${mask}</mask></defs>`,
    `<g transform="rotate(${ROTATION[direction]} ${center} ${center})">`,
    `<circle cx="${center}" cy="${center}" r="${radius}" fill="#ffdf00" mask="url(#commit-man-mouth)"/>`,
    `<circle cx="${eyeX}" cy="${eyeY}" r="${eyeRadius}" fill="#242424"/>`,
    `</g>`,
    `</svg>`,
  ].join("");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** A compact, repeatable open-close-open sequence for previews and later animation. */
export function createMouthAnimationFrames(
  options: Omit<CharacterFrameOptions, "mouthAngleDegrees"> = {},
  angles: number[] = [8, 24, 38, 24],
): string[] {
  if (angles.length === 0) throw new Error("At least one mouth angle is required.");
  return angles.map((mouthAngleDegrees) =>
    renderCommitManFrame({ ...options, mouthAngleDegrees }),
  );
}
