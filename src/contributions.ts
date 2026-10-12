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

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "commit-man",
    },
    body: JSON.stringify({
      query: CONTRIBUTION_QUERY,
      variables: {
        username,
        from: from.toISOString(),
        to: to.toISOString(),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed (${response.status}). Check the username, token, and API access.`);
  }

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
