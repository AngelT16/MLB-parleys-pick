import type {
  Batter,
  BatterWindow,
  Game,
  ModelPerformance,
  Pitcher,
  Stadium,
  Team,
  TrackedBet,
  Weather,
} from "./types.js";

/** Mulberry32 seeded PRNG - mock data is stable for a given day. */
function createRng(seed: number) {
  let a = seed >>> 0;
  return function rng(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(s: string): number {
  let h = 1779033703;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

type Rng = () => number;
const pick = <T>(rng: Rng, arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
const r3 = (n: number) => Math.round(n * 1000) / 1000;

interface TeamSeed {
  abbr: string;
  city: string;
  name: string;
  stadium: string;
  hitFactor: number;
  runFactor: number;
  hrFactor: number;
  roof: Stadium["roof"];
}

const TEAM_SEEDS: TeamSeed[] = [
  { abbr: "NYY", city: "New York", name: "Yankees", stadium: "Yankee Stadium", hitFactor: 0.99, runFactor: 1.05, hrFactor: 1.18, roof: "open" },
  { abbr: "BOS", city: "Boston", name: "Red Sox", stadium: "Fenway Park", hitFactor: 1.08, runFactor: 1.06, hrFactor: 0.97, roof: "open" },
  { abbr: "LAD", city: "Los Angeles", name: "Dodgers", stadium: "Dodger Stadium", hitFactor: 0.97, runFactor: 0.98, hrFactor: 1.1, roof: "open" },
  { abbr: "SD", city: "San Diego", name: "Padres", stadium: "Petco Park", hitFactor: 0.95, runFactor: 0.93, hrFactor: 0.94, roof: "open" },
  { abbr: "ATL", city: "Atlanta", name: "Braves", stadium: "Truist Park", hitFactor: 1.01, runFactor: 1.02, hrFactor: 1.06, roof: "open" },
  { abbr: "NYM", city: "New York", name: "Mets", stadium: "Citi Field", hitFactor: 0.96, runFactor: 0.94, hrFactor: 0.95, roof: "open" },
  { abbr: "HOU", city: "Houston", name: "Astros", stadium: "Minute Maid Park", hitFactor: 1.0, runFactor: 1.01, hrFactor: 1.08, roof: "retractable" },
  { abbr: "TEX", city: "Texas", name: "Rangers", stadium: "Globe Life Field", hitFactor: 0.98, runFactor: 0.99, hrFactor: 1.02, roof: "retractable" },
  { abbr: "CHC", city: "Chicago", name: "Cubs", stadium: "Wrigley Field", hitFactor: 1.02, runFactor: 1.04, hrFactor: 1.05, roof: "open" },
  { abbr: "STL", city: "St. Louis", name: "Cardinals", stadium: "Busch Stadium", hitFactor: 0.98, runFactor: 0.95, hrFactor: 0.9, roof: "open" },
  { abbr: "PHI", city: "Philadelphia", name: "Phillies", stadium: "Citizens Bank Park", hitFactor: 1.01, runFactor: 1.04, hrFactor: 1.15, roof: "open" },
  { abbr: "MIA", city: "Miami", name: "Marlins", stadium: "loanDepot park", hitFactor: 0.97, runFactor: 0.92, hrFactor: 0.88, roof: "retractable" },
];

const FIRST_NAMES = [
  "Marcus", "Luis", "Jake", "Carlos", "Tyler", "Rafael", "Aaron", "Jose", "Brandon", "Victor",
  "Andre", "Miguel", "Cody", "Juan", "Trevor", "Bobby", "Adley", "Yandy", "Gunnar", "Wyatt",
  "Spencer", "Bryan", "Nolan", "Ketel", "Christian", "Ezequiel", "Dansby", "Austin", "Riley", "Oneil",
];

const LAST_NAMES = [
  "Ramirez", "Thompson", "Castillo", "Rodriguez", "Bennett", "Devers", "Hayes", "Martinez", "Cole", "Suarez",
  "Walker", "Alvarez", "Greene", "Soto", "Bregman", "Turner", "Chapman", "Reyes", "Henderson", "Carroll",
  "Strider", "Olson", "Arenado", "Marte", "Yelich", "Tovar", "Swanson", "Wells", "Adames", "Cruz",
];

const PITCHER_FIRST = ["Logan", "Zac", "Hunter", "Framber", "Pablo", "Tarik", "Dylan", "Garrett", "Kevin", "Joe", "Max", "Sonny"];
const PITCHER_LAST = ["Webb", "Gallen", "Brown", "Valdez", "Lopez", "Skubal", "Cease", "Crochet", "Gausman", "Ryan", "Fried", "Gray"];

const POSITIONS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];

function makeWindow(rng: Rng, baseAvg: number, games: number): BatterWindow {
  const atBats = Math.round(games * between(rng, 3.4, 4.3));
  const avg = Math.max(0.1, Math.min(0.48, baseAvg + between(rng, -0.07, 0.09)));
  const hits = Math.round(atBats * avg);
  const totalBases = Math.round(hits * between(rng, 1.3, 1.85));
  return { games, hits, atBats, avg: r3(hits / atBats), totalBases };
}

function makeBatter(rng: Rng, teamAbbr: string, lineupSpot: number, usedNames: Set<string>): Batter {
  let name = "";
  do {
    name = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
  } while (usedNames.has(name));
  usedNames.add(name);

  // Top of the lineup skews toward better hitters.
  const quality = lineupSpot <= 4 ? between(rng, 0.27, 0.33) : between(rng, 0.235, 0.285);
  const avg = r3(quality);
  const iso = r3(between(rng, 0.12, lineupSpot <= 5 ? 0.28 : 0.2));
  const vsAb = Math.floor(between(rng, 0, 24));
  const vsHits = Math.round(vsAb * Math.max(0, Math.min(0.6, avg + between(rng, -0.12, 0.15))));

  return {
    id: `${teamAbbr.toLowerCase()}-b${lineupSpot}`,
    name,
    teamAbbr,
    bats: pick(rng, ["L", "R", "R", "R", "S"] as const),
    position: POSITIONS[(lineupSpot - 1) % POSITIONS.length],
    lineupSpot,
    avg,
    obp: r3(avg + between(rng, 0.05, 0.1)),
    slg: r3(avg + iso),
    iso,
    xba: r3(avg + between(rng, -0.02, 0.025)),
    xslg: r3(avg + iso + between(rng, -0.03, 0.04)),
    contactRate: r3(between(rng, 0.68, 0.88)),
    kRate: r3(between(rng, 0.13, 0.31)),
    hardHitPct: r3(between(rng, 0.3, 0.52)),
    barrelPct: r3(between(rng, 0.04, 0.16)),
    last5: makeWindow(rng, avg, 5),
    last10: makeWindow(rng, avg, 10),
    last15: makeWindow(rng, avg, 15),
    vsPitcher: {
      atBats: vsAb,
      hits: vsHits,
      avg: vsAb > 0 ? r3(vsHits / vsAb) : 0,
      homeRuns: vsAb >= 10 ? Math.floor(between(rng, 0, 2.4)) : 0,
    },
    stadiumAvg: r3(Math.max(0.15, avg + between(rng, -0.06, 0.08))),
    stadiumGames: Math.floor(between(rng, 4, 40)),
  };
}

function makePitcher(rng: Rng, teamAbbr: string, index: number): Pitcher {
  const first = PITCHER_FIRST[index % PITCHER_FIRST.length];
  const last = PITCHER_LAST[(index * 7 + 3) % PITCHER_LAST.length];
  const kRate = r3(between(rng, 0.18, 0.33));
  const era = r3(between(rng, 2.6, 4.9));
  const expectedKs = kRate * between(rng, 22, 26);
  return {
    id: `${teamAbbr.toLowerCase()}-sp`,
    name: `${first} ${last}`,
    teamAbbr,
    throws: pick(rng, ["L", "R", "R"] as const),
    era,
    whip: r3(between(rng, 0.95, 1.45)),
    kRate,
    kPer9: r3(kRate * 38),
    avgAllowed: r3(between(rng, 0.21, 0.275)),
    slgAllowed: r3(between(rng, 0.34, 0.46)),
    whiffRate: r3(between(rng, 0.2, 0.34)),
    avgPitchCount: Math.round(between(rng, 84, 102)),
    projectedInnings: r3(between(rng, 5, 6.6)),
    last3KCounts: [0, 0, 0].map(() => Math.max(1, Math.round(expectedKs + between(rng, -2.5, 2.5)))),
    kLine: Math.round(expectedKs - 0.3) + 0.5,
  };
}

function makeWeather(rng: Rng, stadium: Stadium): Weather {
  if (stadium.roof !== "open" && rng() < 0.75) {
    return { tempF: 72, windMph: 0, windDirection: "calm", condition: "Dome", impact: "neutral" };
  }
  const tempF = Math.round(between(rng, 58, 96));
  const windMph = Math.round(between(rng, 2, 18));
  const windDirection = pick(rng, ["out", "in", "cross", "calm"] as const);
  const condition = tempF >= 90 ? "Hot" : pick(rng, ["Clear", "Clear", "Cloudy", "Light Rain"] as const);
  let impact: Weather["impact"] = "neutral";
  if ((windDirection === "out" && windMph >= 10) || tempF >= 90) impact = "boost";
  if ((windDirection === "in" && windMph >= 10) || condition === "Light Rain" || tempF <= 60) impact = "suppress";
  return { tempF, windMph, windDirection, condition, impact };
}

function makeTeam(rng: Rng, seed: TeamSeed): Team {
  return {
    id: seed.abbr.toLowerCase(),
    abbr: seed.abbr,
    name: `${seed.city} ${seed.name}`,
    city: seed.city,
    offenseLast7: r3(between(rng, 3.2, 6.2)),
    offenseLast14: r3(between(rng, 3.5, 5.8)),
    bullpenEra: r3(between(rng, 3.0, 4.8)),
    teamKRate: r3(between(rng, 0.19, 0.27)),
    restDays: rng() < 0.25 ? 1 : 0,
  };
}

function mlPairFromProbability(rng: Rng, pHome: number): { homeML: number; awayML: number } {
  const vig = 0.022;
  const ph = Math.min(0.78, Math.max(0.22, pHome + vig));
  const pa = Math.min(0.78, Math.max(0.22, 1 - pHome + vig));
  const toMl = (p: number) => (p >= 0.5 ? -Math.round((p / (1 - p)) * 100) : Math.round(((1 - p) / p) * 100));
  return { homeML: toMl(ph), awayML: toMl(pa) };
}

export interface MockDay {
  date: string;
  games: Game[];
  stadiums: Stadium[];
  trackedBets: TrackedBet[];
  modelPerformance: ModelPerformance;
}

export function buildMockDay(date: string): MockDay {
  const rng = createRng(seedFromString(`mlb-parleys:${date}`));

  const stadiums: Stadium[] = TEAM_SEEDS.map((s) => ({
    id: s.abbr.toLowerCase(),
    name: s.stadium,
    teamAbbr: s.abbr,
    hitFactor: s.hitFactor,
    runFactor: s.runFactor,
    hrFactor: s.hrFactor,
    roof: s.roof,
  }));

  // Shuffle team seeds into 6 matchups.
  const order = [...TEAM_SEEDS].sort(() => rng() - 0.5);
  const usedNames = new Set<string>();
  const times = ["1:05 PM", "4:10 PM", "6:40 PM", "7:05 PM", "7:45 PM", "9:40 PM"];

  const games: Game[] = [];
  for (let g = 0; g < 6; g++) {
    const homeSeed = order[g * 2];
    const awaySeed = order[g * 2 + 1];
    const home = makeTeam(rng, homeSeed);
    const away = makeTeam(rng, awaySeed);
    const stadium = stadiums.find((s) => s.teamAbbr === homeSeed.abbr)!;
    const weather = makeWeather(rng, stadium);
    const homePitcher = makePitcher(rng, homeSeed.abbr, g * 2);
    const awayPitcher = makePitcher(rng, awaySeed.abbr, g * 2 + 1);
    const homeLineup = Array.from({ length: 9 }, (_, i) => makeBatter(rng, homeSeed.abbr, i + 1, usedNames));
    const awayLineup = Array.from({ length: 9 }, (_, i) => makeBatter(rng, awaySeed.abbr, i + 1, usedNames));

    const pHome = 0.5 + (awayPitcher.era - homePitcher.era) * 0.04 + (home.offenseLast14 - away.offenseLast14) * 0.015 + 0.035 + between(rng, -0.03, 0.03);
    const { homeML, awayML } = mlPairFromProbability(rng, pHome);
    const baseTotal = (home.offenseLast14 + away.offenseLast14) * 0.5 * stadium.runFactor + (homePitcher.era + awayPitcher.era) * 0.45;
    const total = Math.round(baseTotal) + 0.5;

    games.push({
      id: `g${g + 1}-${date}`,
      date,
      startTimeET: times[g],
      home,
      away,
      stadium,
      weather,
      homePitcher,
      awayPitcher,
      homeLineup,
      awayLineup,
      lineupsConfirmed: rng() < 0.7,
      odds: {
        homeML,
        awayML,
        total,
        overOdds: -110,
        underOdds: -110,
        f5Total: Math.round(total * 0.55) - 0.5,
        f5OverOdds: -112,
        f5UnderOdds: -108,
      },
    });
  }

  const trackedBets = buildTrackedBets(rng, date);
  const modelPerformance = buildModelPerformance(rng, trackedBets, date);

  return { date, games, stadiums, trackedBets, modelPerformance };
}

const TRACK_MARKETS = [
  "Batter to record a hit",
  "Batter 2+ total bases",
  "Moneyline",
  "Pitcher strikeouts over/under",
  "Full game total over/under",
  "First 5 innings over/under",
] as const;

function buildTrackedBets(rng: Rng, date: string): TrackedBet[] {
  const bets: TrackedBet[] = [];
  const base = new Date(`${date}T12:00:00Z`);
  const names = ["M. Ramirez hit", "L. Castillo 2+ TB", "Yankees ML", "F. Valdez Over 6.5 K", "Over 8.5 runs", "First 5 Under 4.5", "C. Bennett hit", "Dodgers ML", "T. Skubal Over 7.5 K", "Under 9.5 runs"];
  for (let i = 0; i < 28; i++) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - Math.floor(i / 3) - (i % 3 === 0 ? 0 : 1));
    const odds = rng() < 0.55 ? -Math.round(between(rng, 110, 260)) : Math.round(between(rng, 100, 190));
    const closingMove = Math.round(between(rng, -18, 22));
    const closingOdds = odds + closingMove;
    const isToday = i < 3;
    const roll = rng();
    const result: TrackedBet["result"] = isToday ? "pending" : roll < 0.62 ? "won" : roll < 0.95 ? "lost" : "void";
    bets.push({
      id: `bet-${i + 1}`,
      date: d.toISOString().slice(0, 10),
      market: TRACK_MARKETS[i % TRACK_MARKETS.length],
      selection: names[i % names.length],
      game: "—",
      odds,
      closingOdds,
      clv: Math.round(closingMove * -0.4 * 10) / 10,
      result,
    });
  }
  return bets;
}

function buildModelPerformance(rng: Rng, bets: TrackedBet[], date: string): ModelPerformance {
  const settled = bets.filter((b) => b.result === "won" || b.result === "lost");
  const wins = settled.filter((b) => b.result === "won").length;
  const losses = settled.length - wins;
  const pending = bets.filter((b) => b.result === "pending").length;
  const voids = bets.filter((b) => b.result === "void").length;

  const byMarket = TRACK_MARKETS.map((market) => {
    const mBets = bets.filter((b) => b.market === market);
    const mWins = mBets.filter((b) => b.result === "won").length;
    const mLosses = mBets.filter((b) => b.result === "lost").length;
    const total = mWins + mLosses;
    return {
      market,
      wins: mWins,
      losses: mLosses,
      pending: mBets.filter((b) => b.result === "pending").length,
      winRate: total > 0 ? Math.round((mWins / total) * 1000) / 10 : 0,
      roi: Math.round(between(rng, -6, 14) * 10) / 10,
      avgClv: Math.round(between(rng, -1.5, 3.5) * 10) / 10,
    };
  });

  const last30: ModelPerformance["last30"] = [];
  const base = new Date(`${date}T12:00:00Z`);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - i);
    last30.push({ date: d.toISOString().slice(0, 10), winRate: Math.round(between(rng, 42, 74) * 10) / 10 });
  }

  return {
    record: { wins, losses, pending, voids },
    winRate: settled.length > 0 ? Math.round((wins / settled.length) * 1000) / 10 : 0,
    roi: Math.round(between(rng, 4, 11) * 10) / 10,
    avgClv: Math.round(between(rng, 0.5, 2.8) * 10) / 10,
    last30,
    byMarket: byMarket as ModelPerformance["byMarket"],
    lastModelUpdate: `${date}T11:30:00Z`,
  };
}
