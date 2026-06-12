import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Parlay, StoredParlay, StoredParlayLeg } from "../types.js";

/**
 * JSON-file persistence for the 3 official daily parlays so they survive
 * restarts and can be settled at the end of the day.
 */

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "parlays.json");

interface StoreShape {
  days: Record<string, StoredParlay[]>;
}

let store: StoreShape | null = null;

function load(): StoreShape {
  if (store) return store;
  try {
    store = JSON.parse(readFileSync(STORE_FILE, "utf8")) as StoreShape;
  } catch {
    store = { days: {} };
  }
  if (!store.days) store.days = {};
  return store;
}

function persist(): void {
  if (!store) return;
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

export function toStoredParlay(parlay: Parlay, date: string): StoredParlay {
  const legs: StoredParlayLeg[] = parlay.legs.map((leg) => ({
    ...leg,
    result: "pending",
    settledAt: null,
  }));
  return {
    id: parlay.id,
    date,
    type: parlay.type,
    name: parlay.name,
    legs,
    combinedOdds: parlay.combinedOdds,
    combinedDecimal: parlay.combinedDecimal,
    modelProbability: parlay.modelProbability,
    impliedProbability: parlay.impliedProbability,
    edge: parlay.edge,
    generatedAt: parlay.generatedAt,
    status: "PENDING",
    settledAt: null,
    resultReason: null,
  };
}

/**
 * Save the official daily parlays for a date. Replaces any unsettled set for
 * that day (regenerating is allowed until results start coming in).
 */
export function saveDailyParlays(date: string, parlays: Parlay[]): StoredParlay[] {
  const s = load();
  const existing = s.days[date] ?? [];
  const anySettled = existing.some((p) => p.status !== "PENDING" || p.legs.some((l) => l.result !== "pending"));
  if (anySettled) return existing;

  s.days[date] = parlays.filter((p) => p.legs.length > 0).map((p) => toStoredParlay(p, date));
  persist();
  return s.days[date];
}

export function getParlaysForDate(date: string): StoredParlay[] {
  return load().days[date] ?? [];
}

export function updateParlaysForDate(date: string, parlays: StoredParlay[]): void {
  const s = load();
  s.days[date] = parlays;
  persist();
}

/** All stored days, newest first. */
export function getParlayHistory(): Array<{ date: string; parlays: StoredParlay[] }> {
  const s = load();
  return Object.keys(s.days)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((date) => ({ date, parlays: s.days[date] }));
}

export function getAllParlays(): StoredParlay[] {
  return getParlayHistory().flatMap((d) => d.parlays);
}

/** Test helper - reset in-memory state (does not touch disk). */
export function __resetStoreForTests(data?: StoreShape): void {
  store = data ?? { days: {} };
}
