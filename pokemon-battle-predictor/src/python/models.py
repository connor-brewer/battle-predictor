"""Pydantic models for the Pokemon Battle Predictor API.

Request/response shapes mirror the frontend TypeScript types in
frontend/src/types/pokemon.ts and the Filter dataclass in query_builder.py.
"""

from __future__ import annotations
from pydantic import BaseModel


# ── Response models ──────────────────────────────────────────────────────

class PokemonTypeOut(BaseModel):
    typeId: int
    typeName: str


class MoveOut(BaseModel):
    moveId: int
    moveName: str
    type: PokemonTypeOut | None = None
    power: float | None = None
    accuracy: float | None = None


class PokemonOut(BaseModel):
    pokemonId: int
    pokemonName: str
    height: int
    weight: int
    hp: int
    attack: int
    defense: int
    specialAttack: int
    specialDefense: int
    speed: int
    types: list[PokemonTypeOut] = []
    moves: list[MoveOut] = []


class MatchupOut(BaseModel):
    pokemon1: PokemonOut
    pokemon2: PokemonOut
    odds1: float
    odds2: float


class BattleResultOut(BaseModel):
    battleId: int
    pokemon1Id: int
    pokemon2Id: int
    predictedWinnerId: int
    winnerPokemonId: int
    odds: float
    wager: int
    pointsDelta: int
    # Per-turn narration produced by battle.simulate(). The frontend plays
    # these lines back over a few seconds in BattleAnimation.
    battleLog: list[str] = []
    # HP snapshots (hp1, hp2) recorded after every move resolution. Used to
    # animate the HP bars in sync with the log lines.
    healthHistory: list[list[int]] = []


class BattleHistoryOut(BaseModel):
    """Richer shape for /api/battle/history — includes Pokemon names so the
    frontend can render a card without a second round-trip."""
    battleId: int
    pokemon1Id: int
    pokemon1Name: str
    pokemon2Id: int
    pokemon2Name: str
    predictedWinnerId: int
    predictedWinnerName: str
    winnerPokemonId: int
    winnerPokemonName: str
    odds: float
    correct: bool


class UserOut(BaseModel):
    userId: int
    username: str
    totalPoints: int
    correctPredictions: int
    incorrectPredictions: int


class TypeEffectivenessOut(BaseModel):
    attackingTypeId: int
    defendingTypeId: int
    multiplier: float


# ── Request models ───────────────────────────────────────────────────────

class FilterRequest(BaseModel):
    """Mirrors query_builder.Filter.

    All fields optional — omitted fields are not included in the WHERE clause.
    Type names are lowercase strings (e.g. 'fire', 'water') because the backend
    TYPE_MAP converts them to TypeIDs internally.
    """
    type: list[str] | None = None
    generation: list[int] | None = None
    min_attack: int | None = None
    max_attack: int | None = None
    min_defense: int | None = None
    max_defense: int | None = None
    min_hp: int | None = None
    max_hp: int | None = None
    min_special_attack: int | None = None
    max_special_attack: int | None = None
    min_special_defense: int | None = None
    max_special_defense: int | None = None
    min_speed: int | None = None
    max_speed: int | None = None
    user: int | None = None
    # Free-text substring search on PokemonName.
    name: str | None = None


class BattleSimulateRequest(BaseModel):
    pokemon1Id: int
    pokemon2Id: int
    predictedWinnerId: int
    wager: int
    userId: int
    pokemon1MoveIds: list[int] | None = None
    pokemon2MoveIds: list[int] | None = None


class CreateUserRequest(BaseModel):
    username: str


class LoginRequest(BaseModel):
    username: str
    password: str


class SignupRequest(BaseModel):
    username: str
    password: str


class DonationRequest(BaseModel):
    userId: int
    amount: int


class DonationUpdateRequest(BaseModel):
    amount: int


class DonationOut(BaseModel):
    donationId: int
    userId: int
    username: str
    amount: int
    donatedAt: str
    # True once ExecuteDailyCharityDistribution has credited this donation
    # to recipients. Distributed donations are not counted again.
    distributed: bool = False
