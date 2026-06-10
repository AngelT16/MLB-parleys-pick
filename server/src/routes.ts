import { Router } from "express";
import { z } from "zod";
import {
  gamesToday,
  modelPerformance,
  oddsToday,
  settings,
  stadiumSplits,
  topTwoHitCandidates
} from "./mockData.js";
import { generatePickPool } from "./scoring/probabilityEngine.js";
import { generateDailyParlays } from "./scoring/parlayGenerator.js";

export const mlbRouter = Router();

let currentSettings = { ...settings };
let currentPickPool = generatePickPool();
let currentParlays = generateDailyParlays(currentPickPool);

const settingsSchema = z.object({
  mockMode: z.boolean().optional(),
  maxLegs: z.number().int().min(6).max(10).optional(),
  minEdge: z.number().min(0).max(0.25).optional(),
  sportsbooks: z.array(z.string()).optional()
});

mlbRouter.get("/games/today", (_req, res) => {
  res.json(gamesToday);
});

mlbRouter.get("/odds/today", (_req, res) => {
  res.json(oddsToday);
});

mlbRouter.post("/parlays/generate", (_req, res) => {
  currentPickPool = generatePickPool();
  currentParlays = generateDailyParlays(currentPickPool);
  res.json(currentParlays);
});

mlbRouter.get("/parlays/generate", (_req, res) => {
  currentPickPool = generatePickPool();
  currentParlays = generateDailyParlays(currentPickPool);
  res.json(currentParlays);
});

mlbRouter.get("/parlays/today", (_req, res) => {
  res.json(currentParlays);
});

mlbRouter.get("/picks/top", (_req, res) => {
  res.json(currentPickPool.filter((pick) => pick.confidenceLabel !== "Avoid / No Bet").slice(0, 20));
});

mlbRouter.get("/picks/top-2-hit-candidates", (_req, res) => {
  res.json(topTwoHitCandidates);
});

mlbRouter.get("/player/:id/matchup", (req, res) => {
  const pick = currentPickPool.find((candidate) => candidate.playerId === req.params.id || candidate.id === req.params.id);
  if (!pick) {
    res.status(404).json({ error: "Player matchup not found in mock slate" });
    return;
  }

  res.json({
    playerId: req.params.id,
    player: pick.player,
    market: pick.market,
    matchupScore: pick.confidenceScore,
    batterVsPitcher: pick.dataPointsUsed.find((point) => point.includes("BvP")) ?? "No direct BvP penalty",
    handedness: pick.dataPointsUsed.find((point) => point.includes("split")) ?? "Neutral split",
    pitchTypeMatchup: "Positive fastball and sweeper contact profile",
    reason: pick.reason,
    riskNotes: pick.riskNotes
  });
});

mlbRouter.get("/stadium/:id/splits", (req, res) => {
  const split = stadiumSplits.find((stadium) => stadium.id === req.params.id);
  if (!split) {
    res.status(404).json({ error: "Stadium split not found" });
    return;
  }

  res.json(split);
});

mlbRouter.get("/settings", (_req, res) => {
  res.json({ ...currentSettings, modelPerformance });
});

mlbRouter.post("/settings", (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  currentSettings = { ...currentSettings, ...parsed.data };
  res.json(currentSettings);
});
