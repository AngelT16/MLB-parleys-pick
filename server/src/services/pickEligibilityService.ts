import type { LineupStatus, PlayerEligibility } from "../types.js";

/** Minimum season plate appearances to call someone a regular without recent-game data. */
const MIN_SEASON_PA = 100;

export interface EligibilityInput {
  playerId: number;
  playerName: string;
  teamId: number;
  teamAbbr: string;
  position: string;
  activeRoster: boolean;
  injured: boolean;
  /** True when the team's official 9-man lineup is posted */
  lineupConfirmed: boolean;
  /** 1-9 if the player is in the posted lineup, null otherwise */
  battingOrderSpot: number | null;
  gamesPlayedLast5: number;
  gamesPlayedLast10: number;
  seasonPlateAppearances: number;
  /** True when recent-game data could not be fetched */
  statsUnavailable?: boolean;
  last5Games?: string;
}

/**
 * Core eligibility rules:
 * - CONFIRMED: player appears in the official posted lineup.
 * - PROJECTED_REGULAR: lineup not posted yet, but the player is an active,
 *   healthy regular (>=3 of last 5 team games, or >=7 of last 10, or enough
 *   season PA while on the active roster).
 * - PENDING: on the roster but we lack the data to project them.
 * - EXCLUDED: inactive, injured, or a bench piece - never used in parlays.
 */
export function evaluatePlayerEligibility(input: EligibilityInput): PlayerEligibility {
  let lineupStatus: LineupStatus;
  let reason: string;

  if (input.lineupConfirmed && input.battingOrderSpot !== null) {
    lineupStatus = "CONFIRMED";
    reason = `In today's official lineup, batting #${input.battingOrderSpot}`;
  } else if (input.lineupConfirmed && input.battingOrderSpot === null) {
    lineupStatus = "EXCLUDED";
    reason = "Official lineup is posted and the player is not in it";
  } else if (!input.activeRoster) {
    lineupStatus = "EXCLUDED";
    reason = "Not on the active roster";
  } else if (input.injured) {
    lineupStatus = "EXCLUDED";
    reason = "Listed as injured/inactive";
  } else if (input.statsUnavailable) {
    lineupStatus = "PENDING";
    reason = "Lineup not posted and recent-game data unavailable";
  } else if (input.gamesPlayedLast5 >= 3) {
    lineupStatus = "PROJECTED_REGULAR";
    reason = `Played ${input.gamesPlayedLast5} of the team's last 5 games`;
  } else if (input.gamesPlayedLast10 >= 7) {
    lineupStatus = "PROJECTED_REGULAR";
    reason = `Played ${input.gamesPlayedLast10} of the team's last 10 games`;
  } else if (input.seasonPlateAppearances >= MIN_SEASON_PA) {
    lineupStatus = "PROJECTED_REGULAR";
    reason = `${input.seasonPlateAppearances} PA this season on the active roster`;
  } else {
    lineupStatus = "EXCLUDED";
    reason = `Not playing regularly (${input.gamesPlayedLast10} of last 10 team games, ${input.seasonPlateAppearances} PA)`;
  }

  return {
    playerId: input.playerId,
    playerName: input.playerName,
    teamId: input.teamId,
    teamAbbr: input.teamAbbr,
    position: input.position,
    activeRoster: input.activeRoster,
    injured: input.injured,
    lineupStatus,
    battingOrderSpot: input.battingOrderSpot,
    recentGamesPlayed: input.gamesPlayedLast10,
    gamesPlayedLast5: input.gamesPlayedLast5,
    gamesPlayedLast10: input.gamesPlayedLast10,
    seasonPlateAppearances: input.seasonPlateAppearances,
    last5Games: input.last5Games ?? "",
    reason,
    eligibleForPicks: lineupStatus === "CONFIRMED" || lineupStatus === "PROJECTED_REGULAR",
  };
}

/** Count how many of the team's recent game dates the player appeared in. */
export function countGamesPlayed(playerGameDates: string[], teamGameDates: string[]): number {
  const played = new Set(playerGameDates);
  return teamGameDates.filter((d) => played.has(d)).length;
}
