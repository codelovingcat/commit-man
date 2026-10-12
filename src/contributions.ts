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
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 364);

  const response = await requestContributionCalendar(username, token, {
    query: CONTRIBUTION_QUERY,
    variables: {
      username,
      from: from.toISOString(),
      to: to.toISOString(),
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

  return flattenContributionWeeks(weeks);
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
