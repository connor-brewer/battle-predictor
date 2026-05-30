// Frontend ↔ backend boundary.
//
// Every function makes a real fetch() call against the FastAPI backend at
// /api/...  In local dev the Vite proxy (vite.config.ts) forwards /api to
// http://localhost:8000.  In Docker, nginx does the same proxying.
//
// If a request fails we throw — the calling component is responsible for
// showing an error state.

import type {
  BattleHistoryEntry,
  BattleResult,
  DistributionResult,
  Donation,
  Matchup,
  MatchupFilters,
  Pokemon,
  RankAchievement,
  StreakAward,
  UserInfo,
} from '../types/pokemon';

// ── Helpers ─────────────────────────────────────────────────────────────

const SPRITE_CDN =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${msg}`);
  }
  return res.json();
}

function filtersToBody(filters?: MatchupFilters): string | undefined {
  if (!filters) return undefined;
  // Strip undefined values so the backend sees clean JSON.
  const clean = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined),
  );
  return Object.keys(clean).length > 0 ? JSON.stringify(clean) : undefined;
}

// ── Pokemon type from backend (no spriteUrl or moves by default) ────────

interface RawPokemon {
  pokemonId: number;
  pokemonName: string;
  height: number;
  weight: number;
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
  types: Array<{ typeId: number; typeName: string }>;
  moves: Array<{
    moveId: number;
    moveName: string;
    type: { typeId: number; typeName: string } | null;
    power: number | null;
    accuracy: number | null;
  }>;
}

function rawToPokemon(r: RawPokemon): Pokemon {
  return {
    ...r,
    spriteUrl: `${SPRITE_CDN}/${r.pokemonId}.png`,
    moves: r.moves.map(m => ({
      ...m,
      type: m.type ?? { typeId: 0, typeName: 'Normal' },
    })),
  };
}

// ── Public API ──────────────────────────────────────────────────────────

export const api = {
  // Auth ───────────────────────────────────────────────────────────────

  async login(username: string, password: string): Promise<UserInfo> {
    return request<UserInfo>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  async signup(username: string, password: string): Promise<UserInfo> {
    return request<UserInfo>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  // Users ──────────────────────────────────────────────────────────────

  async getUser(userId: number): Promise<UserInfo> {
    return request<UserInfo>(`/users/${userId}`);
  },

  // Pokémon ────────────────────────────────────────────────────────────

  async listPokemon(filters?: MatchupFilters): Promise<Pokemon[]> {
    const body = filtersToBody(filters);
    const raws: RawPokemon[] = body
      ? await request('/pokemon/search', { method: 'POST', body })
      : await request('/pokemon');
    return raws.map(rawToPokemon);
  },

  // Matchup & Battle ──────────────────────────────────────────────────

  async getRandomMatchup(filters?: MatchupFilters): Promise<Matchup> {
    const body = filtersToBody(filters) ?? '{}';
    const raw = await request<{
      pokemon1: RawPokemon;
      pokemon2: RawPokemon;
      odds1: number;
      odds2: number;
    }>('/matchup', { method: 'POST', body });
    return {
      pokemon1: rawToPokemon(raw.pokemon1),
      pokemon2: rawToPokemon(raw.pokemon2),
      odds1: raw.odds1,
      odds2: raw.odds2,
    };
  },

  async simulateBattle(args: {
    matchup: Matchup;
    predictedWinnerId: number;
    wager: number;
    userId: number;
  }): Promise<BattleResult> {
    return request<BattleResult>('/battle/simulate', {
      method: 'POST',
      body: JSON.stringify({
        pokemon1Id: args.matchup.pokemon1.pokemonId,
        pokemon2Id: args.matchup.pokemon2.pokemonId,
        predictedWinnerId: args.predictedWinnerId,
        wager: args.wager,
        userId: args.userId,
        pokemon1MoveIds: args.matchup.pokemon1.moves.map(m => m.moveId),
        pokemon2MoveIds: args.matchup.pokemon2.moves.map(m => m.moveId),
      }),
    });
  },

  async getBattleHistory(userId: number): Promise<BattleHistoryEntry[]> {
    return request<BattleHistoryEntry[]>(`/battle/history/${userId}`);
  },

  // Deletes all BattleHistory rows for the user and resets their W/L
  // counters server-side. Returns the refreshed UserInfo.
  async clearBattleHistory(userId: number): Promise<UserInfo> {
    return request<UserInfo>(`/battle/history/${userId}`, { method: 'DELETE' });
  },

  // Awards (stored procedures) ────────────────────────────────────────

  async getLongestWinStreak(): Promise<StreakAward> {
    return request<StreakAward>('/awards/longest-win-streak');
  },

  async getLongestLoseStreak(): Promise<StreakAward> {
    return request<StreakAward>('/awards/longest-lose-streak');
  },

  async getRankAchievements(): Promise<RankAchievement[]> {
    return request<RankAchievement[]>('/awards/rank-achievements');
  },

  // Donations (full CRUD on a non-user table) ─────────────────────────

  async listDonations(): Promise<Donation[]> {
    return request<Donation[]>('/donations');
  },

  async createDonation(userId: number, amount: number): Promise<Donation> {
    return request<Donation>('/donations', {
      method: 'POST',
      body: JSON.stringify({ userId, amount }),
    });
  },

  async updateDonation(donationId: number, amount: number): Promise<Donation> {
    return request<Donation>(`/donations/${donationId}`, {
      method: 'PUT',
      body: JSON.stringify({ amount }),
    });
  },

  async deleteDonation(donationId: number): Promise<void> {
    await request(`/donations/${donationId}`, { method: 'DELETE' });
  },

  async distributeDailyPool(): Promise<DistributionResult> {
    return request<DistributionResult>('/donations/distribute-daily-pool', {
      method: 'POST',
    });
  },
};
