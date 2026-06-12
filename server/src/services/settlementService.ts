import type { LegResult, ParlayStatus, StoredParlay, StoredParlayLeg } from "../types.js";
import { calculateParlayStatus, describeParlayResult } from "../scoring/parlayResults.js";
import { getLiveFeed, type LiveFeedResponse } from "./mlbOfficialApi.js";
import { getParlaysForDate, updateParlaysForDate } from "./parlayStore.js";

// ---- Normalized final-game data (pure settle functions run on this) ----------

export interface GameResultData {
  gamePk: number;
  state: "final" | "live" | "preview" | "postponed";
  homeRuns: number;
  awayRuns: number;
  /** Runs through 5 innings; null until 5 innings are in the book */
  f5HomeRuns: number | null;
  f5AwayRuns: number | null;
  batting: Map<number, { hits: number; totalBases: number; atBats: number }>;
  pitching: Map<number, { strikeOuts: number }>;
}

export function extractGameResult(gamePk: number, feed: LiveFeedResponse): GameResultData {
  const detailed = feed.gameData.status.detailedState.toLowerCase();
  const abstract = feed.gameData.status.abstractGameState;
  const state: GameResultData["state"] =
    detailed.includes("postponed") || detailed.includes("cancelled") || detailed.includes("suspended")
      ? "postponed"
      : abstract === "Final"
        ? "final"
        : abstract === "Live"
          ? "live"
          : "preview";

  const linescore = feed.liveData.linescore;
  const innings = linescore?.innings ?? [];
  const first5 = innings.filter((i) => i.num <= 5);
  const f5Complete = first5.length >= 5;
  const sum = (side: "home" | "away") => first5.reduce((a, i) => a + (i[side].runs ?? 0), 0);

  const batting = new Map<number, { hits: number; totalBases: number; atBats: number }>();
  const pitching = new Map<number, { strikeOuts: number }>();
  const box = feed.liveData.boxscore;
  for (const side of ["home", "away"] as const) {
    const players = box?.teams?.[side]?.players ?? {};
    for (const player of Object.values(players)) {
      const bat = player.stats?.batting;
      if (bat && (bat.plateAppearances ?? bat.atBats ?? 0) > 0) {
        const hits = bat.hits ?? 0;
        const doubles = bat.doubles ?? 0;
        const triples = bat.triples ?? 0;
        const homeRuns = bat.homeRuns ?? 0;
        batting.set(player.person.id, {
          hits,
          atBats: bat.atBats ?? 0,
          totalBases: hits + doubles + 2 * triples + 3 * homeRuns,
        });
      }
      const pit = player.stats?.pitching;
      if (pit && pit.inningsPitched !== undefined) {
        pitching.set(player.person.id, { strikeOuts: pit.strikeOuts ?? 0 });
      }
    }
  }

  return {
    gamePk,
    state,
    homeRuns: linescore?.teams?.home?.runs ?? 0,
    awayRuns: linescore?.teams?.away?.runs ?? 0,
    f5HomeRuns: f5Complete ? sum("home") : null,
    f5AwayRuns: f5Complete ? sum("away") : null,
    batting,
    pitching,
  };
}

// ---- Per-market settlement (pure) ---------------------------------------------

function overUnderResult(actual: number, line: number, side: "Over" | "Under"): LegResult {
  if (actual === line) return "void"; // push on whole-number lines
  const overHit = actual > line;
  return (side === "Over") === overHit ? "won" : "lost";
}

export function settleMoneylinePick(leg: StoredParlayLeg, data: GameResultData): LegResult {
  if (data.state === "postponed") return "void";
  if (data.state !== "final") return "pending";
  if (data.homeRuns === data.awayRuns) return "void";
  const homeWon = data.homeRuns > data.awayRuns;
  if (!leg.teamSide) return "void";
  return (leg.teamSide === "home") === homeWon ? "won" : "lost";
}

export function settleBatterHitPick(leg: StoredParlayLeg, data: GameResultData): LegResult {
  if (data.state === "postponed") return "void";
  if (data.state !== "final") return "pending";
  const line = leg.playerId ? data.batting.get(leg.playerId) : undefined;
  if (!line || line.atBats === 0) return "void"; // never played / no official AB
  return line.hits >= 1 ? "won" : "lost";
}

export function settleBatterTotalBasesPick(leg: StoredParlayLeg, data: GameResultData): LegResult {
  if (data.state === "postponed") return "void";
  if (data.state !== "final") return "pending";
  const line = leg.playerId ? data.batting.get(leg.playerId) : undefined;
  if (!line || line.atBats === 0) return "void";
  return line.totalBases >= 2 ? "won" : "lost";
}

export function settlePitcherStrikeoutPick(leg: StoredParlayLeg, data: GameResultData): LegResult {
  if (data.state === "postponed") return "void";
  if (data.state !== "final") return "pending";
  const line = leg.playerId ? data.pitching.get(leg.playerId) : undefined;
  if (!line || leg.line === undefined || !leg.overUnder) return "void"; // never pitched
  return overUnderResult(line.strikeOuts, leg.line, leg.overUnder);
}

export function settleFirstFiveTotalPick(leg: StoredParlayLeg, data: GameResultData): LegResult {
  if (data.state === "postponed") return "void";
  if (data.f5HomeRuns === null || data.f5AwayRuns === null) {
    return data.state === "final" ? "void" : "pending";
  }
  if (leg.line === undefined || !leg.overUnder) return "void";
  return overUnderResult(data.f5HomeRuns + data.f5AwayRuns, leg.line, leg.overUnder);
}

export function settleFullGameTotalPick(leg: StoredParlayLeg, data: GameResultData): LegResult {
  if (data.state === "postponed") return "void";
  if (data.state !== "final") return "pending";
  if (leg.line === undefined || !leg.overUnder) return "void";
  return overUnderResult(data.homeRuns + data.awayRuns, leg.line, leg.overUnder);
}

export function settleLeg(leg: StoredParlayLeg, data: GameResultData): LegResult {
  switch (leg.market) {
    case "Moneyline":
      return settleMoneylinePick(leg, data);
    case "Batter to record a hit":
      return settleBatterHitPick(leg, data);
    case "Batter 2+ total bases":
      return settleBatterTotalBasesPick(leg, data);
    case "Pitcher strikeouts over/under":
      return settlePitcherStrikeoutPick(leg, data);
    case "First 5 innings over/under":
      return settleFirstFiveTotalPick(leg, data);
    case "Full game total over/under":
      return settleFullGameTotalPick(leg, data);
    default:
      return "void";
  }
}

// ---- Mock settlement (demo mode only) -------------------------------------------

function hashNoise(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** Deterministic simulated result so mock mode can demo the full settle flow. */
export function simulateLegResult(leg: StoredParlayLeg, date: string): LegResult {
  const roll = hashNoise(`settle:${leg.id}:${date}`);
  if (roll < 0.03) return "void";
  return roll < 0.03 + leg.modelProbability ? "won" : "lost";
}

// ---- Daily settlement orchestrator ------------------------------------------------

export interface SettleSummary {
  date: string;
  settled: number;
  parlays: StoredParlay[];
  mode: "official" | "mock";
}

export function applySettlement(
  parlays: StoredParlay[],
  resolveLeg: (leg: StoredParlayLeg) => LegResult
): StoredParlay[] {
  const now = new Date().toISOString();
  return parlays.map((parlay) => {
    const legs = parlay.legs.map((leg) => {
      if (leg.result !== "pending") return leg;
      const result = resolveLeg(leg);
      return { ...leg, result, settledAt: result === "pending" ? null : now };
    });
    const status: ParlayStatus = calculateParlayStatus(legs);
    return {
      ...parlay,
      legs,
      status,
      settledAt: status === "PENDING" ? null : parlay.settledAt ?? now,
      resultReason: describeParlayResult(status, legs),
    };
  });
}

/**
 * Settle every official parlay stored for a date against MLB final results.
 * Legs from mock games (no gamePk) are simulated deterministically so the
 * flow still works in mock mode.
 */
export async function settleDailyParlays(date: string): Promise<SettleSummary> {
  const stored = getParlaysForDate(date);
  if (stored.length === 0) {
    return { date, settled: 0, parlays: [], mode: "official" };
  }

  const gamePks = [
    ...new Set(
      stored.flatMap((p) => p.legs.map((l) => l.gamePk)).filter((pk): pk is number => Boolean(pk))
    ),
  ];

  const results = new Map<number, GameResultData>();
  await Promise.all(
    gamePks.map(async (pk) => {
      try {
        results.set(pk, extractGameResult(pk, await getLiveFeed(pk)));
      } catch (err) {
        console.error(`[settle] Could not fetch results for game ${pk}:`, err);
      }
    })
  );

  const anyOfficial = gamePks.length > 0;
  const updated = applySettlement(stored, (leg) => {
    if (leg.gamePk) {
      const data = results.get(leg.gamePk);
      return data ? settleLeg(leg, data) : "pending";
    }
    return simulateLegResult(leg, date);
  });

  updateParlaysForDate(date, updated);
  const settledLegs = updated.reduce(
    (a, p) => a + p.legs.filter((l) => l.result !== "pending").length,
    0
  );
  return { date, settled: settledLegs, parlays: updated, mode: anyOfficial ? "official" : "mock" };
}
