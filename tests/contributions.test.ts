import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTRIBUTION_HISTORY_START_DATE,
  fetchGitHubContributions,
} from "../src/contributions.js";

const payload = {
  data: {
    user: {
      contributionsCollection: {
        contributionCalendar: {
          weeks: [
            {
              contributionDays: [
                {
                  date: "2026-10-12",
                  contributionCount: 2,
                  contributionLevel: "FIRST_QUARTILE",
                },
              ],
            },
          ],
        },
      },
    },
  },
};

test("uses a fixed history start date and extends through the requested current date", async () => {
  const originalFetch = globalThis.fetch;
  let requestedVariables: { from: string; to: string } | undefined;

  globalThis.fetch = (async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      variables: { from: string; to: string };
    };
    requestedVariables = body.variables;

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const now = new Date("2026-10-15T12:34:56.000Z");

  try {
    await fetchGitHubContributions("codelovingcat", "test-token", now);

    assert.equal(
      requestedVariables?.from,
      `${CONTRIBUTION_HISTORY_START_DATE}T00:00:00.000Z`,
    );
    assert.equal(requestedVariables?.to, now.toISOString());
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("retries a temporary 502 response and then returns contribution data", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = (async () => {
    calls += 1;
    if (calls < 3) return new Response("temporary gateway error", { status: 502 });
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const days = await fetchGitHubContributions("codelovingcat", "test-token", new Date("2026-10-12T12:00:00Z"));
    assert.equal(calls, 3);
    assert.equal(days.length, 1);
    assert.equal(days[0]?.date, "2026-10-12");
    assert.equal(days[0]?.contributionCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not retry permanent client errors such as unauthorized", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("unauthorized", { status: 401 });
  }) as typeof fetch;

  try {
    await assert.rejects(
      fetchGitHubContributions("codelovingcat", "invalid-token", new Date("2026-10-12T12:00:00Z")),
      /\\(401\\) after 1 attempt/,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
