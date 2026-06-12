import { describe, expect, it } from "vitest";
import { countGamesPlayed, evaluatePlayerEligibility, type EligibilityInput } from "./pickEligibilityService.js";

function input(overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  return {
    playerId: 660271,
    playerName: "Test Player",
    teamId: 119,
    teamAbbr: "LAD",
    position: "RF",
    activeRoster: true,
    injured: false,
    lineupConfirmed: false,
    battingOrderSpot: null,
    gamesPlayedLast5: 5,
    gamesPlayedLast10: 10,
    seasonPlateAppearances: 250,
    ...overrides,
  };
}

describe("evaluatePlayerEligibility", () => {
  it("marks players in the posted official lineup as CONFIRMED", () => {
    const result = evaluatePlayerEligibility(input({ lineupConfirmed: true, battingOrderSpot: 2 }));
    expect(result.lineupStatus).toBe("CONFIRMED");
    expect(result.eligibleForPicks).toBe(true);
    expect(result.reason).toContain("official lineup");
  });

  it("excludes players left out of a posted lineup, even regulars", () => {
    const result = evaluatePlayerEligibility(input({ lineupConfirmed: true, battingOrderSpot: null }));
    expect(result.lineupStatus).toBe("EXCLUDED");
    expect(result.eligibleForPicks).toBe(false);
  });

  it("projects regulars who played 3+ of the last 5 team games", () => {
    const result = evaluatePlayerEligibility(
      input({ gamesPlayedLast5: 3, gamesPlayedLast10: 5, seasonPlateAppearances: 40 })
    );
    expect(result.lineupStatus).toBe("PROJECTED_REGULAR");
    expect(result.eligibleForPicks).toBe(true);
  });

  it("projects regulars who played 7+ of the last 10 team games", () => {
    const result = evaluatePlayerEligibility(
      input({ gamesPlayedLast5: 2, gamesPlayedLast10: 7, seasonPlateAppearances: 40 })
    );
    expect(result.lineupStatus).toBe("PROJECTED_REGULAR");
  });

  it("projects active-roster players with enough season plate appearances", () => {
    const result = evaluatePlayerEligibility(
      input({ gamesPlayedLast5: 1, gamesPlayedLast10: 3, seasonPlateAppearances: 150 })
    );
    expect(result.lineupStatus).toBe("PROJECTED_REGULAR");
  });

  it("excludes players not on the active roster", () => {
    const result = evaluatePlayerEligibility(input({ activeRoster: false }));
    expect(result.lineupStatus).toBe("EXCLUDED");
    expect(result.eligibleForPicks).toBe(false);
    expect(result.reason).toContain("active roster");
  });

  it("excludes injured players", () => {
    const result = evaluatePlayerEligibility(input({ injured: true }));
    expect(result.lineupStatus).toBe("EXCLUDED");
    expect(result.eligibleForPicks).toBe(false);
  });

  it("excludes random bench players without recent games or PA", () => {
    const result = evaluatePlayerEligibility(
      input({ gamesPlayedLast5: 1, gamesPlayedLast10: 2, seasonPlateAppearances: 30 })
    );
    expect(result.lineupStatus).toBe("EXCLUDED");
    expect(result.eligibleForPicks).toBe(false);
  });

  it("marks players PENDING when recent-game data is unavailable", () => {
    const result = evaluatePlayerEligibility(input({ statsUnavailable: true }));
    expect(result.lineupStatus).toBe("PENDING");
    expect(result.eligibleForPicks).toBe(false);
  });

  it("carries eligibility metadata through to the result", () => {
    const result = evaluatePlayerEligibility(input({ gamesPlayedLast10: 9 }));
    expect(result.activeRoster).toBe(true);
    expect(result.recentGamesPlayed).toBe(9);
    expect(result.reason.length).toBeGreaterThan(5);
  });
});

describe("countGamesPlayed", () => {
  it("counts only overlap between player and team game dates", () => {
    const team = ["2026-06-11", "2026-06-10", "2026-06-09", "2026-06-08", "2026-06-07"];
    const player = ["2026-06-11", "2026-06-09", "2026-06-07", "2026-06-01"];
    expect(countGamesPlayed(player, team)).toBe(3);
  });

  it("returns 0 when the player has no recent games", () => {
    expect(countGamesPlayed([], ["2026-06-11"])).toBe(0);
  });
});
