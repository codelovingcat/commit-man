import { setTimeout as delay } from "node:timers/promises";

export type ContributionLevel =
  | "NONE"
  | "FIRST_QUARTILE"
  | "SECOND_QUARTILE"
  | "THIRD_QUARTILE"
  | "FOURTH_QUARTILE";

export interface ContributionDay {
  date: string;
  contributionCount: number;
  contributionLevel: ContributionLevel;
}

export interface ContributionWeek {
  contributionDays: ContributionDay[];
}

interface ContributionCalendarResponse {
  data?: {
    user?: {
      contributionsCollection?: {
        contributionCalendar?: {
          weeks?: ContributionWeek[];
        };
      };
    } | null;
  };
  errors?: Array<{ message: string }>;
}

const CONTRIBUTION_QUERY = `
  query ContributionCalendar($username: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $username) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
              contributionLevel
            }
          }
        }
      }
    }
  }
`;

const MAX_REQUEST_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [250, 500] as const;
// Keep each request comfortably under GitHub's one-year contribution-range limit.
const MAX_RANGE_DAYS_PER_REQUEST = 364;

/**
 * The first Sunday at or before the start of the originally displayed window.
 * Keep this fixed so existing contribution cells never fall off the left side.
 * The garden grows horizontally as newer dates are added.
 */
export const CONTRIBUTION_HISTORY_START_DATE = "2025-10-12";

export function flattenContributionWeeks(weeks: ContributionWeek[]): ContributionDay[] {
  return weeks.flatMap((week) => week.contributionDays).sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchGitHubContributions(
  username: string,
  token: string,
  now = new Date(),
): Promise<ContributionDay[]> {
  if (!username.trim()) throw new Error("A GitHub username is required.");
  if (!token.trim()) throw new Error("A GitHub token is required.");

  const to = new Date(now);
  const historyStart = new Date(`${CONTRIBUTION_HISTORY_START_DATE}T00:00:00.000Z`);
  if (to.getTime() < historyStart.getTime()) {
    throw new Error("The requested end date is earlier than the contribution history start date.");
  }

  const contributionDays = new Map<string, ContributionDay>();
  const endDate = to.toISOString().slice(0, 10);
  let chunkFrom = historyStart;

  while (chunkFrom.getTime() <= to.getTime()) {
    const maxChunkTo = new Date(chunkFrom);
    maxChunkTo.setUTCDate(maxChunkTo.getUTCDate() + MAX_RANGE_DAYS_PER_REQUEST);
    maxChunkTo.setUTCHours(23, 59, 59, 999);
    const chunkTo = maxChunkTo.getTime() < to.getTime() ? maxChunkTo : to;

    const response = await requestContributionCalendar(username, token, {
      query: CONTRIBUTION_QUERY,
      variables: {
        username,
        from: chunkFrom.toISOString(),
        to: chunkTo.toISOString(),
      },
    });

    const payload = (await response.json()) as ContributionCalendarResponse;
    if (payload.errors?.length) {
      throw new Error(`GitHub GraphQL error: ${payload.errors.map((error) => error.message).join("; ")}`);
    }

    const weeks = payload.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
    if (!weeks) {
      throw new Error(`Could not read a contribution calendar for GitHub user "${username}". Check that the username exists and is accessible.`);
    }

    for (const day of flattenContributionWeeks(weeks)) {
      // GraphQL may return complete calendar weeks around a requested range.
      // Keep only the fixed history window, then de-duplicate overlapping weeks.
      if (day.date >= CONTRIBUTION_HISTORY_START_DATE && day.date <= endDate) {
        contributionDays.set(day.date, day);
      }
    }

    if (chunkTo.getTime() >= to.getTime()) break;

    chunkFrom = new Date(chunkTo);
    chunkFrom.setUTCDate(chunkFrom.getUTCDate() + 1);
    chunkFrom.setUTCHours(0, 0, 0, 0);
  }

  return [...contributionDays.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function requestContributionCalendar(
  username: string,
  token: string,
  requestBody: { query: string; variables: { username: string; from: string; to: string } },
): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
    let response: Response;

    try {
      response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "commit-man",
        },
        body: JSON.stringify(requestBody),
      });
    } catch (error) {
      if (attempt === MAX_REQUEST_ATTEMPTS) {
        const detail = error instanceof Error ? error.message : "Unknown network error";
        throw new Error(`GitHub GraphQL request failed after ${attempt} attempts due to a network error: ${detail}`);
      }

      await delay(RETRY_DELAYS_MS[attempt - 1]!);
      continue;
    }

    if (response.ok) return response;

    const isTransient = response.status === 429 || response.status >= 500;
    if (!isTransient || attempt === MAX_REQUEST_ATTEMPTS) {
      throw new Error(
        `GitHub GraphQL request failed (${response.status}) after ${attempt} attempt(s). Check the username, token, and API access.`,
      );
    }

    await delay(RETRY_DELAYS_MS[attempt - 1]!);
  }

  throw new Error("GitHub GraphQL request failed after exhausting retry attempts.");
}
