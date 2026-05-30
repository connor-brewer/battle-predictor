// Type definitions mirroring the PokemonDB schema in sql/schema.sql.
// These shapes are what the backend will eventually return — for now they
// describe the mock data we use locally.

export interface PokemonType {
  typeId: number;
  typeName: string;
}

export interface Move {
  moveId: number;
  moveName: string;
  type: PokemonType;
  power: number | null;
  accuracy: number | null;
}

export interface Pokemon {
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
  types: PokemonType[];
  // Sprite path is a UI-only convenience field — backend will likely return a URL.
  spriteUrl: string;
  // A representative moveset of 4 moves shown in the battle UI.
  moves: Move[];
}

export interface UserInfo {
  userId: number;
  username: string;
  totalPoints: number;
  correctPredictions: number;
  incorrectPredictions: number;
}

export interface Matchup {
  pokemon1: Pokemon;
  pokemon2: Pokemon;
  odds1: number;
  odds2: number;
}

export interface BattleResult {
  battleId: number;
  pokemon1Id: number;
  pokemon2Id: number;
  predictedWinnerId: number;
  winnerPokemonId: number;
  odds: number;
  wager: number;
  pointsDelta: number;
  // Per-turn narration (e.g. "Pikachu used Thunderbolt", "It was super
  // effective!", "Charizard fainted, Pikachu wins!"). Driven by battle.simulate.
  battleLog: string[];
  // HP snapshots [hp1, hp2] recorded after every move resolution.
  // Frontend animates HP bars in step with the log.
  healthHistory: [number, number][];
}

// Shape returned by /api/battle/history/{userId} — includes Pokémon names
// so the frontend can render without additional fetches.
export interface BattleHistoryEntry {
  battleId: number;
  pokemon1Id: number;
  pokemon1Name: string;
  pokemon2Id: number;
  pokemon2Name: string;
  predictedWinnerId: number;
  predictedWinnerName: string;
  winnerPokemonId: number;
  winnerPokemonName: string;
  odds: number;
  correct: boolean;
}

// Stat keys the backend's query_builder.Filter accepts min/max ranges for.
export type StatKey =
  | 'attack'
  | 'defense'
  | 'hp'
  | 'special_attack'
  | 'special_defense'
  | 'speed';

// Mirrors src/python/query_builder.py:Filter exactly.
//
// The backend accepts type *names* (strings) and converts them to TypeIDs
// via its TYPE_MAP, so we send strings here too. All fields are optional on
// the wire — when an entry is omitted the corresponding clause is dropped
// from the generated SQL.
export interface MatchupFilters {
  type?: string[];
  generation?: number[];
  min_attack?: number;
  max_attack?: number;
  min_defense?: number;
  max_defense?: number;
  min_hp?: number;
  max_hp?: number;
  min_special_attack?: number;
  max_special_attack?: number;
  min_special_defense?: number;
  max_special_defense?: number;
  min_speed?: number;
  max_speed?: number;
  // When set, restricts the pool to Pokemon that appear in this user's
  // BattleHistory (Pokemon1ID UNION Pokemon2ID).
  user?: number;
  // Free-text substring search on PokemonName.
  name?: string;
}

// ── Awards (stored procedures) ─────────────────────────────────────────

export interface StreakAward {
  userId: number | null;
  username: string | null;
  longestWinStreak?: number;
  longestLoseStreak?: number;
}

export interface RankAchievement {
  rank: number;
  username: string;
  points: number;
  achievementTitle: string;
}

// ── Donations ──────────────────────────────────────────────────────────

export interface Donation {
  donationId: number;
  userId: number;
  username: string;
  amount: number;
  donatedAt: string;
  // True once the daily distribution has credited this donation.
  // Distributed donations are never paid out twice.
  distributed: boolean;
}

export interface DistributionResult {
  status: string;
  message: string;
  summary: {
    distributedTotal: number;
    donorCount: number;
    perUserAmount: number;
    recipientCount: number;
  };
  affectedUsers: Array<{
    userId: number;
    username: string;
    newTotalPoints: number;
  }>;
}
