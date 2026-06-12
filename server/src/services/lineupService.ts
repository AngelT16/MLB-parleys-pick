import {
  getActiveRoster,
  getBoxscore,
  type BoxscorePlayer,
  type BoxscoreTeam,
  type RosterEntry,
} from "./mlbOfficialApi.js";

export interface LineupSlot {
  personId: number;
  name: string;
  position: string;
  battingOrderSpot: number;
}

export interface TeamLineup {
  teamId: number;
  confirmed: boolean;
  slots: LineupSlot[];
}

export interface GameLineups {
  gamePk: number;
  home: TeamLineup;
  away: TeamLineup;
}

function parseTeamLineup(team: BoxscoreTeam): TeamLineup {
  const slots: LineupSlot[] = [];
  const order = team.battingOrder ?? [];

  if (order.length >= 9) {
    order.slice(0, 9).forEach((personId, i) => {
      const player = team.players[`ID${personId}`];
      slots.push({
        personId,
        name: player?.person.fullName ?? `Player ${personId}`,
        position: player?.position?.abbreviation ?? "—",
        battingOrderSpot: i + 1,
      });
    });
  } else {
    // Pre-game boxscores often expose batting order per player ("100".."900")
    // before the team-level array is populated.
    const withOrder = Object.values(team.players)
      .filter((p): p is BoxscorePlayer & { battingOrder: string } => Boolean(p.battingOrder))
      .map((p) => ({ p, order: Number.parseInt(p.battingOrder, 10) }))
      .filter(({ order }) => Number.isFinite(order) && order % 100 === 0)
      .sort((a, b) => a.order - b.order);
    withOrder.slice(0, 9).forEach(({ p, order }) => {
      slots.push({
        personId: p.person.id,
        name: p.person.fullName,
        position: p.position?.abbreviation ?? "—",
        battingOrderSpot: order / 100,
      });
    });
  }

  return { teamId: team.team.id, confirmed: slots.length >= 9, slots };
}

/** Official lineups for a game from the boxscore. `confirmed` means a full 9-man order is posted. */
export async function getGameLineups(gamePk: number): Promise<GameLineups> {
  const box = await getBoxscore(gamePk);
  return {
    gamePk,
    home: parseTeamLineup(box.teams.home),
    away: parseTeamLineup(box.teams.away),
  };
}

const INACTIVE_STATUS_CODES = new Set(["D7", "D10", "D15", "D60", "SU", "RM", "BRV", "NRI", "MIN"]);

export interface RosterInfo {
  byId: Map<number, RosterEntry>;
  activeIds: Set<number>;
}

/** Active roster for a team, with injured/inactive players flagged out. */
export async function getTeamRosterInfo(teamId: number): Promise<RosterInfo> {
  const roster = await getActiveRoster(teamId);
  const byId = new Map<number, RosterEntry>();
  const activeIds = new Set<number>();
  for (const entry of roster) {
    byId.set(entry.person.id, entry);
    if (!INACTIVE_STATUS_CODES.has(entry.status.code)) {
      activeIds.add(entry.person.id);
    }
  }
  return { byId, activeIds };
}
