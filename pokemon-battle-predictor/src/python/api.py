"""Pokémon Battle Predictor — FastAPI backend.

Run locally:
    uvicorn api:app --reload --port 8000

Swagger UI:
    http://localhost:8000/api/docs
"""

from __future__ import annotations

import random
from contextlib import contextmanager

import mysql.connector
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from battle import simulate
from database import get_db_connection
from models import (
    BattleHistoryOut,
    BattleResultOut,
    BattleSimulateRequest,
    DonationOut,
    DonationRequest,
    DonationUpdateRequest,
    FilterRequest,
    LoginRequest,
    MatchupOut,
    MoveOut,
    PokemonOut,
    PokemonTypeOut,
    SignupRequest,
    TypeEffectivenessOut,
    UserOut,
)
from query_builder import Filter, generate_pokemon_query

# ── App setup ────────────────────────────────────────────────────────────

app = FastAPI(
    title="Pokémon Battle Predictor API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Blacklist moves by ID
BLACKLISTED_MOVES = {
                      # 0 power moves (i know that i couldve just filtered power = 0, however not all power = 0 moves we should get rid of, so in the future we need a blacklist)
                      12, 14, 18, 28, 32, 39, 43, 45, 46, 47, 48, 49, 50, 54, 67, 68, 69, 73, 74, 77, 78, 79, 81, 82, 86, 90, 92, 95, 96, 97, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 133,
                      134, 135, 137, 139, 142, 144, 147, 148, 149, 150, 151, 156, 159, 160, 162, 164, 166, 169, 170, 171, 174, 175, 176, 178, 179, 180, 182, 184, 186, 187, 191, 193, 194, 195, 197, 199, 201, 203, 204, 207, 208, 212, 213, 214, 215,
                      216, 217, 218, 219, 220, 222, 226, 227, 230, 234, 235, 236, 240, 241, 243, 244, 251, 254, 255, 256, 258, 259, 260, 261, 262, 266, 267, 268, 269, 270, 271, 272, 273, 274, 275, 277, 278, 281, 283, 285, 286, 287, 288, 289, 293, 
                      312, 313, 316, 319, 320, 321, 322, 329, 334, 335, 336, 339, 346, 347, 349, 355, 356, 357, 360, 361, 363, 366, 367, 368, 373, 374, 375, 376, 377, 378, 379, 380, 381, 382, 383, 384, 385, 386, 388, 390, 391, 392, 393, 397, 415,
                      417, 432, 433, 445, 446, 447, 455, 456, 461, 462, 464, 468, 469, 470, 471, 472, 475, 476, 477, 478, 483, 484, 486, 487, 489, 493, 494, 495, 501, 502, 504, 505, 508, 511, 513, 515, 516, 526, 535, 538, 561, 563, 564, 567, 568,
                      569, 571, 575, 576, 578, 579, 580, 581, 582, 587, 588, 589, 590, 596, 597, 598, 599, 600, 601, 602, 603, 604, 606, 607, 608, 622, 623, 624, 625, 626, 627, 628, 629, 630, 631, 632, 633, 634, 635, 636, 637, 638, 639, 640, 641,
                      642, 643, 644, 645, 646, 647, 648, 649, 650, 651, 652, 653, 654, 655, 656, 657, 659, 661, 666, 668, 671, 672, 673, 674, 678, 683, 685, 689, 694, 698, 702, 715, 717, 732, 741, 743, 747, 748, 749, 750, 752, 753, 756, 775, 777,
                      791, 792, 810, 811, 816, 829, 837, 842, 849, 850, 852, 858, 863, 867, 868, 880, 881, 882, 883, 908, 912, 913, 10012, 10013, 10014, 10015, 10016, 10017, 10018, 294, 297, 298, 300, 303,
                      # obscure multihit moves
                      818, 742, 751, 911, 865, 594, 860, 799,
                      198, 41, 333, 167,
                      292, 140, 131, 155, 544, 813
                      }


# ── DB helper ────────────────────────────────────────────────────────────

@contextmanager
def db():
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()


# ── Data-fetching helpers ────────────────────────────────────────────────

def _fetch_types_for_pokemon(cur, pokemon_id: int) -> list[PokemonTypeOut]:
    cur.execute(
        "SELECT t.TypeID, t.TypeName "
        "FROM PokemonType pt "
        "JOIN Type t ON pt.TypeID = t.TypeID "
        "WHERE pt.PokemonID = %s",
        (pokemon_id,),
    )
    return [PokemonTypeOut(typeId=r[0], typeName=r[1]) for r in cur.fetchall()]


def _fetch_moves_for_pokemon(
    cur, pokemon_id: int, limit: int | None = None, move_ids: list[int] | None = None
) -> list[MoveOut]:
    """Fetch non-blacklisted moves for a Pokemon.
    
    Args:
        cur: Database cursor
        pokemon_id: The Pokemon's ID
        limit: Number of random non-blacklisted moves to return (default 4 if None)
    
    Returns:
        List of MoveOut objects with complete move data (all non-blacklisted)
    """
    if limit is None:
        limit = 4
    
    if move_ids:
        ids_placeholder = ",".join(str(mid) for mid in move_ids)
        sql = (
            f"SELECT m.MoveID, m.MoveName, m.Power, m.Accuracy, "
            f"       t.TypeID, t.TypeName "
            f"FROM Move m "
            f"LEFT JOIN Type t ON m.TypeID = t.TypeID "
            f"WHERE m.MoveID IN ({ids_placeholder})"
        )
        cur.execute(sql)
    else:
        # Original random fetch
        blacklist_ids = ",".join(str(mid) for mid in BLACKLISTED_MOVES)
        sql = (
            f"SELECT m.MoveID, m.MoveName, m.Power, m.Accuracy, "
            f"       t.TypeID, t.TypeName "
            f"FROM LearnSet ls "
            f"JOIN Move m ON ls.MoveID = m.MoveID "
            f"LEFT JOIN Type t ON m.TypeID = t.TypeID "
            f"WHERE ls.PokemonID = %s AND m.MoveID NOT IN ({blacklist_ids}) "
            f"ORDER BY RAND() LIMIT %s"
        )
        cur.execute(sql, (pokemon_id, limit))
    
    moves = []
    for r in cur.fetchall():
        move_type = PokemonTypeOut(typeId=r[4], typeName=r[5]) if r[4] else None
        moves.append(MoveOut(
            moveId=r[0], moveName=r[1], power=r[2], accuracy=r[3], type=move_type,
        ))
    
    return moves


def _row_to_pokemon(row: tuple) -> PokemonOut:
    """Map a ``SELECT * FROM Pokemon`` row to a PokemonOut (no types/moves yet)."""
    return PokemonOut(
        pokemonId=row[0],
        pokemonName=row[1],
        height=row[2],
        weight=row[3],
        attack=row[4],
        defense=row[5],
        hp=row[6],
        specialAttack=row[7],
        specialDefense=row[8],
        speed=row[9],
    )


def _fetch_full_pokemon(cur, pokemon_id: int, n_moves: int = 4,  move_ids: list[int] | None = None) -> PokemonOut:
    cur.execute("SELECT * FROM Pokemon WHERE PokemonID = %s", (pokemon_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, f"Pokemon {pokemon_id} not found")
    poke = _row_to_pokemon(row)
    poke.types = _fetch_types_for_pokemon(cur, pokemon_id)
    poke.moves = _fetch_moves_for_pokemon(cur, pokemon_id, limit=n_moves, move_ids=move_ids)
    return poke


def _pokemon_to_battle_dict(p: PokemonOut) -> dict:
    """Convert a PokemonOut to the dict shape battle.simulate() expects."""
    return {
        "pokemonId": p.pokemonId,
        "pokemonName": p.pokemonName,
        "hp": p.hp,
        "attack": p.attack,
        "defense": p.defense,
        "specialAttack": p.specialAttack,
        "specialDefense": p.specialDefense,
        "speed": p.speed,
        "types": [{"typeId": t.typeId} for t in p.types],
        "moves": [
            {
                "moveId": m.moveId,
                "moveName": m.moveName,
                "power": m.power,
                "accuracy": m.accuracy,
                "type": {"typeId": m.type.typeId} if m.type else None,
            }
            for m in p.moves
        ],
    }


def _load_type_effectiveness(cur) -> dict[tuple[int, int], float]:
    cur.execute("SELECT AttackingTypeID, DefendingTypeID, Multiplier FROM TypeEffectiveness")
    return {(r[0], r[1]): float(r[2]) for r in cur.fetchall()}


# User row helpers — placed up here because both /api/battle/* and
# /api/auth/* below need them, and we want a single source of truth for
# which UserInfo columns are safe to expose (Password is intentionally
# excluded).
_USER_COLUMNS = (
    "UserID, Username, TotalPoints, CorrectPredictions, IncorrectPredictions"
)


def _row_to_user(row: tuple) -> UserOut:
    return UserOut(
        userId=row[0],
        username=row[1],
        totalPoints=row[2],
        correctPredictions=row[3],
        incorrectPredictions=row[4],
    )


def _compute_odds(p1: PokemonOut, p2: PokemonOut, cur) -> float:
    """BST-ratio based placeholder odds.  The real formula using
    TournamentStandings (``(2x/y)+1``) can be added later."""
    bst = lambda p: p.hp + p.attack + p.defense + p.specialAttack + p.specialDefense + p.speed

    #raw BST
    s1 = float(bst(p1))
    s2 = float(bst(p2))

    #Type effectiveness
    # Fire vs Grass = 2.0, Fire vs Water = 0.5
    #multipliers stack (Water vs Fire/Rock = 2.0 * 2.0 = 4.0).
    #The attacker's best type matchup is multiplied it into their score.
    #Clamped between 0.25 and 4.0 
    te = _load_type_effectiveness(cur)
    for attacker, defender, i in [(p1, p2, 1), (p2, p1, 2)]:
        atk_types = [t.typeId for t in attacker.types]
        def_types = [t.typeId for t in defender.types]
        best = 1.0
        if atk_types and def_types:
            best = 0.0
            for at in atk_types:
                mult = 1.0
                for dt in def_types:
                    mult *= te.get((at, dt), 1.0)
                best = max(best, mult)
            best = max(0.25, min(best, 4.0))
        if i == 1:
            s1 *= best
        else:
            s2 *= best

    #Battle history win rate (Get each Pokémon's win count and total battles from BattleHistory)
    cur.execute(
        "SELECT PokemonID, Wins, Total FROM ("
        "  SELECT p.PokemonID, "
        "    COALESCE(w.wins, 0) AS Wins, "
        "    COALESCE(a.total, 0) AS Total "
        "  FROM Pokemon p "
        "  LEFT JOIN ("
        "    SELECT WinnerPokemonID AS PokemonID, COUNT(*) AS wins "
        "    FROM BattleHistory GROUP BY WinnerPokemonID"
        "  ) w ON p.PokemonID = w.PokemonID "
        "  LEFT JOIN ("
        "    SELECT PokemonID, COUNT(*) AS total FROM ("
        "      SELECT Pokemon1ID AS PokemonID FROM BattleHistory "
        "      UNION ALL "
        "      SELECT Pokemon2ID AS PokemonID FROM BattleHistory"
        "    ) combined GROUP BY PokemonID"
        "  ) a ON p.PokemonID = a.PokemonID"
        ") stats WHERE Total > 0"
    )
    battle_stats = {r[0]: (int(r[1]), int(r[2])) for r in cur.fetchall()}

 

    for pid, s_ref in [(p1.pokemonId, 1), (p2.pokemonId, 2)]:
        wins, total = battle_stats.get(pid, (0, 0))
        if total == 0:
            factor = 1.0 #no effect for no battles
        elif total < 5: #Fewer than 5 battles have blend toward 50% so small samples don't skew
            confidence = total / 5.0
            win_rate = 0.5 + confidence * (wins / total - 0.5)
            factor = 1.0 + 0.6 * (win_rate - 0.5)
        else: #.6 for dampening control, so for example, a 70% win rate gives ~1.12x boost.
            factor = 1.0 + 0.6 * (wins / total - 0.5) 
        if s_ref == 1:
            s1 *= factor
        else:
            s2 *= factor

    #Tournament appearances
    #normalize by most popular pokemon (capped at 15% )
    cur.execute("SELECT PokemonID, Appearances FROM TournamentStandings")
    apps = {r[0]: int(r[1]) for r in cur.fetchall()}
    max_apps = max(apps.values()) if apps else 1
    s1 *= 1 + 0.15 * (apps.get(p1.pokemonId, 0) / max(max_apps, 1))
    s2 *= 1 + 0.15 * (apps.get(p2.pokemonId, 0) / max(max_apps, 1))

    #Convert to odds — favourite = 1, normalize to 1
    prob1 = s1 / max(s1 + s2, 0.01)
    raw1 = 1 / max(prob1, 0.01)
    raw2 = 1 / max(1 - prob1, 0.01)
    minimum = min(raw1, raw2)
    return round(raw1 / minimum, 1), round(raw2 / minimum, 1)


# ── Health ───────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok"}


# ── Types ────────────────────────────────────────────────────────────────

@app.get("/api/types", response_model=list[PokemonTypeOut], tags=["types"])
def list_types():
    with db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT TypeID, TypeName FROM Type ORDER BY TypeID")
        rows = cur.fetchall()
        cur.close()
    return [PokemonTypeOut(typeId=r[0], typeName=r[1]) for r in rows]


@app.get(
    "/api/types/effectiveness",
    response_model=list[TypeEffectivenessOut],
    tags=["types"],
)
def list_type_effectiveness():
    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT AttackingTypeID, DefendingTypeID, Multiplier "
            "FROM TypeEffectiveness"
        )
        rows = cur.fetchall()
        cur.close()
    return [
        TypeEffectivenessOut(
            attackingTypeId=r[0], defendingTypeId=r[1], multiplier=float(r[2]),
        )
        for r in rows
    ]


# ── Pokémon ──────────────────────────────────────────────────────────────

@app.get("/api/pokemon", response_model=list[PokemonOut], tags=["pokemon"])
def list_pokemon():
    with db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM Pokemon ORDER BY PokemonID")
        rows = cur.fetchall()
        pokemons = [_row_to_pokemon(r) for r in rows]
        for p in pokemons:
            p.types = _fetch_types_for_pokemon(cur, p.pokemonId)
        cur.close()
    return pokemons


@app.get("/api/pokemon/{pokemon_id}", response_model=PokemonOut, tags=["pokemon"])
def get_pokemon(pokemon_id: int):
    with db() as conn:
        cur = conn.cursor()
        poke = _fetch_full_pokemon(cur, pokemon_id)
        cur.close()
    return poke


@app.post("/api/pokemon/search", response_model=list[PokemonOut], tags=["pokemon"])
def search_pokemon(body: FilterRequest):
    """Filter Pokémon using the same shape as ``query_builder.Filter``."""
    f = Filter(
        type=body.type or [],
        generation=body.generation or [],
        min_attack=body.min_attack,
        max_attack=body.max_attack,
        min_defense=body.min_defense,
        max_defense=body.max_defense,
        min_hp=body.min_hp,
        max_hp=body.max_hp,
        min_special_attack=body.min_special_attack,
        max_special_attack=body.max_special_attack,
        min_special_defense=body.min_special_defense,
        max_special_defense=body.max_special_defense,
        min_speed=body.min_speed,
        max_speed=body.max_speed,
        user=body.user,
        name=body.name,
    )
    sql, params = generate_pokemon_query(f)
    with db() as conn:
        cur = conn.cursor()
        cur.execute(sql, params)
        rows = cur.fetchall()
        pokemons = [_row_to_pokemon(r) for r in rows]
        for p in pokemons:
            p.types = _fetch_types_for_pokemon(cur, p.pokemonId)
        cur.close()
    return pokemons


# ── Matchup ──────────────────────────────────────────────────────────────

@app.post("/api/matchup", response_model=MatchupOut, tags=["battle"])
def get_matchup(body: FilterRequest | None = None):
    """Pick two random Pokémon (optionally filtered) and compute odds."""
    with db() as conn:
        cur = conn.cursor()

        if body and any([
            body.type, body.generation,
            body.min_attack, body.max_attack,
            body.min_defense, body.max_defense,
            body.min_hp, body.max_hp,
            body.min_special_attack, body.max_special_attack,
            body.min_special_defense, body.max_special_defense,
            body.min_speed, body.max_speed,
            body.user, body.name,
        ]):
            f = Filter(
                type=body.type or [],
                generation=body.generation or [],
                min_attack=body.min_attack,
                max_attack=body.max_attack,
                min_defense=body.min_defense,
                max_defense=body.max_defense,
                min_hp=body.min_hp,
                max_hp=body.max_hp,
                min_special_attack=body.min_special_attack,
                max_special_attack=body.max_special_attack,
                min_special_defense=body.min_special_defense,
                max_special_defense=body.max_special_defense,
                min_speed=body.min_speed,
                max_speed=body.max_speed,
                user=body.user,
            )
            sql, params = generate_pokemon_query(f)
            cur.execute(sql, params)
        else:
            cur.execute("SELECT * FROM Pokemon")

        rows = cur.fetchall()
        if len(rows) < 2:
            raise HTTPException(400, "Not enough Pokémon match the filters (need at least 2)")

        r1, r2 = random.sample(rows, 2)
        p1_id, p2_id = r1[0], r2[0]

        p1 = _fetch_full_pokemon(cur, p1_id)
        p2 = _fetch_full_pokemon(cur, p2_id)

        odds1, odds2 = _compute_odds(p1, p2, cur)
        cur.close()
    return MatchupOut(pokemon1=p1, pokemon2=p2, odds1=odds1, odds2=odds2)




# ── Battle ───────────────────────────────────────────────────────────────

@app.post("/api/battle/simulate", response_model=BattleResultOut, tags=["battle"])
def simulate_battle(body: BattleSimulateRequest):
    """Simulate a battle, record it in BattleHistory, and update the user.

    Validates that the user can actually afford the wager — without this
    check, a stale or hand-crafted client could submit a wager larger than
    the user's balance and the trigger floor at 10 would silently override
    the deduction, leaving the response's pointsDelta out of sync with the
    actual points lost.
    """
    if body.wager <= 0:
        raise HTTPException(400, "Wager must be positive")

    with db() as conn:
        cur = conn.cursor()

        cur.execute(
            "SELECT TotalPoints FROM UserInfo WHERE UserID = %s",
            (body.userId,),
        )
        user_row = cur.fetchone()
        if not user_row:
            cur.close()
            raise HTTPException(404, f"User {body.userId} not found")
        current_points = int(user_row[0])
        if body.wager > current_points:
            cur.close()
            raise HTTPException(
                400,
                f"Cannot wager {body.wager} — you only have {current_points} points.",
            )

        p1 = _fetch_full_pokemon(cur, body.pokemon1Id, move_ids=body.pokemon1MoveIds)
        p2 = _fetch_full_pokemon(cur, body.pokemon2Id, move_ids=body.pokemon2MoveIds)

        te = _load_type_effectiveness(cur)

        winner_id, battle_log, health_history = simulate(
            _pokemon_to_battle_dict(p1),
            _pokemon_to_battle_dict(p2),
            te,
        )

        odds1, odds2 = _compute_odds(p1, p2, cur)
        if body.predictedWinnerId == body.pokemon1Id:
            odds = odds1
        else:
            odds = odds2

        correct = winner_id == body.predictedWinnerId
        points_delta = round(body.wager * odds) if correct else -body.wager

        # Record in BattleHistory.
        cur.execute(
            "INSERT INTO BattleHistory "
            "(UserID, Pokemon1ID, Pokemon2ID, Odds, PredictedWinnerID, WinnerPokemonID) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (body.userId, body.pokemon1Id, body.pokemon2Id,
             odds, body.predictedWinnerId, winner_id),
        )
        battle_id = cur.lastrowid

        # Update user stats.
        if correct:
            cur.execute(
                "UPDATE UserInfo SET TotalPoints = TotalPoints + %s, "
                "CorrectPredictions = CorrectPredictions + 1 "
                "WHERE UserID = %s",
                (points_delta, body.userId),
            )
        else:
            cur.execute(
                "UPDATE UserInfo SET TotalPoints = TotalPoints + %s, "
                "IncorrectPredictions = IncorrectPredictions + 1 "
                "WHERE UserID = %s",
                (points_delta, body.userId),
            )

        conn.commit()
        cur.close()

    return BattleResultOut(
        battleId=battle_id,
        pokemon1Id=body.pokemon1Id,
        pokemon2Id=body.pokemon2Id,
        predictedWinnerId=body.predictedWinnerId,
        winnerPokemonId=winner_id,
        odds=odds,
        wager=body.wager,
        pointsDelta=points_delta,
        battleLog=battle_log,
        # Convert tuple snapshots to lists for clean JSON.
        healthHistory=[list(t) for t in health_history],
    )


@app.get(
    "/api/battle/history/{user_id}",
    response_model=list[BattleHistoryOut],
    tags=["battle"],
)
def get_battle_history(user_id: int):
    """Return one row per battle, with Pokémon names joined in so the
    frontend can render a card without another request."""
    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT bh.BattleID, "
            "       bh.Pokemon1ID,       p1.PokemonName, "
            "       bh.Pokemon2ID,       p2.PokemonName, "
            "       bh.PredictedWinnerID, pp.PokemonName, "
            "       bh.WinnerPokemonID,   pw.PokemonName, "
            "       bh.Odds "
            "FROM BattleHistory bh "
            "JOIN Pokemon p1 ON bh.Pokemon1ID        = p1.PokemonID "
            "JOIN Pokemon p2 ON bh.Pokemon2ID        = p2.PokemonID "
            "JOIN Pokemon pp ON bh.PredictedWinnerID = pp.PokemonID "
            "JOIN Pokemon pw ON bh.WinnerPokemonID   = pw.PokemonID "
            "WHERE bh.UserID = %s "
            "ORDER BY bh.BattleID DESC",
            (user_id,),
        )
        rows = cur.fetchall()
        cur.close()
    return [
        BattleHistoryOut(
            battleId=r[0],
            pokemon1Id=r[1],        pokemon1Name=r[2],
            pokemon2Id=r[3],        pokemon2Name=r[4],
            predictedWinnerId=r[5], predictedWinnerName=r[6],
            winnerPokemonId=r[7],   winnerPokemonName=r[8],
            odds=float(r[9]),
            correct=(r[5] == r[7]),
        )
        for r in rows
    ]


@app.delete(
    "/api/battle/history/{user_id}",
    response_model=UserOut,
    tags=["battle"],
)
def clear_battle_history(user_id: int):
    """Delete every BattleHistory row for the user and reset their
    correct/incorrect prediction counters — TotalPoints is preserved.

    Returns the refreshed UserOut so the frontend can update state without
    a second round-trip.
    """
    with db() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM BattleHistory WHERE UserID = %s", (user_id,))
        cur.execute(
            "UPDATE UserInfo "
            "SET CorrectPredictions = 0, IncorrectPredictions = 0 "
            "WHERE UserID = %s",
            (user_id,),
        )
        conn.commit()

        cur.execute(
            f"SELECT {_USER_COLUMNS} FROM UserInfo WHERE UserID = %s",
            (user_id,),
        )
        row = cur.fetchone()
        cur.close()

    if not row:
        raise HTTPException(404, f"User {user_id} not found")
    return _row_to_user(row)


# ── Users ────────────────────────────────────────────────────────────────

@app.get("/api/users/{user_id}", response_model=UserOut, tags=["users"])
def get_user(user_id: int):
    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT {_USER_COLUMNS} FROM UserInfo WHERE UserID = %s",
            (user_id,),
        )
        row = cur.fetchone()
        cur.close()
    if not row:
        raise HTTPException(404, f"User {user_id} not found")
    return _row_to_user(row)


# ── Auth ─────────────────────────────────────────────────────────────────

_MIN_PASSWORD_LEN = 8


@app.post(
    "/api/auth/signup",
    response_model=UserOut,
    status_code=201,
    tags=["auth"],
    responses={
        400: {"description": "Password too short"},
        409: {"description": "Username taken"},
    },
)
def signup(body: SignupRequest):
    """Create a new account.

    Passwords are stored as plaintext strings per the project requirements.
    The Username column has a UNIQUE constraint, so duplicate signups are
    caught by the DB and surfaced as HTTP 409.
    """
    if len(body.password) < _MIN_PASSWORD_LEN:
        raise HTTPException(
            400,
            f"Password must be at least {_MIN_PASSWORD_LEN} characters",
        )

    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT 1 FROM UserInfo WHERE Username = %s",
            (body.username,),
        )
        if cur.fetchone():
            cur.close()
            raise HTTPException(409, "Username taken")

        cur.execute("SELECT COALESCE(MAX(UserID), 0) + 1 FROM UserInfo")
        next_id = cur.fetchone()[0]
        try:
            cur.execute(
                "INSERT INTO UserInfo "
                "(UserID, Username, Password, TotalPoints, "
                " CorrectPredictions, IncorrectPredictions) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (next_id, body.username, body.password, 500, 0, 0),
            )
            conn.commit()
        except mysql.connector.errors.IntegrityError:
            # Race-condition safety net: another signup grabbed the name
            # between our SELECT and INSERT.
            cur.close()
            raise HTTPException(409, "Username taken")
        cur.close()

    return UserOut(
        userId=next_id,
        username=body.username,
        totalPoints=500,
        correctPredictions=0,
        incorrectPredictions=0,
    )


@app.post(
    "/api/auth/login",
    response_model=UserOut,
    tags=["auth"],
    responses={401: {"description": "Invalid username or password"}},
)
def login(body: LoginRequest):
    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            f"SELECT {_USER_COLUMNS} FROM UserInfo "
            f"WHERE Username = %s AND Password = %s",
            (body.username, body.password),
        )
        row = cur.fetchone()
        cur.close()
    if not row:
        raise HTTPException(401, "Invalid username or password")
    return _row_to_user(row)

# ── Awards ─────────────────────────────────────────────────────────────────


@app.get("/api/awards/longest-win-streak", tags=["awards"])
def get_longest_win_streak():
    """Get the user with the highest all-time win streak."""
    with db() as conn:
        cur = conn.cursor()
        cur.callproc("GetUserWithLongestWinStreak")
        for result in cur.stored_results():
            row = result.fetchone()
        cur.close()
    if not row:
        return {"userId": None, "username": None, "longestWinStreak": 0}
    return {
        "userId": row[0],
        "username": row[1],
        "longestWinStreak": row[2],
    }


@app.get("/api/awards/longest-lose-streak", tags=["awards"])
def get_longest_lose_streak():
    """Get the user with the highest all-time lose streak."""
    with db() as conn:
        cur = conn.cursor()
        cur.callproc("GetUserWithLongestLoseStreak")
        for result in cur.stored_results():
            row = result.fetchone()
        cur.close()
    if not row:
        return {"userId": None, "username": None, "longestLoseStreak": 0}
    return {
        "userId": row[0],
        "username": row[1],
        "longestLoseStreak": row[2],
    }


@app.get("/api/awards/rank-achievements", tags=["awards"])
def get_rank_achievements():
    """Get rank-based achievements for all users."""
    with db() as conn:
        cur = conn.cursor()
        cur.callproc("GenerateRankAchievements")
        results = []
        for result in cur.stored_results():
            for row in result.fetchall():
                results.append({
                    "rank": row[0],
                    "username": row[1],
                    "points": row[2],
                    "achievementTitle": row[3],
                })
        cur.close()
    return results


# ── Donations ────────────────────────────────────────────────────────────

@app.post("/api/donations", response_model=DonationOut, tags=["donations"], status_code=201)
def make_donation(body: DonationRequest):
    """Make a donation.

    Deducts ``amount`` from the donor's ``TotalPoints`` immediately so the
    donation actually costs the donor — distribution later credits the same
    amount to the bottom-5 recipients, so net flow is donor → low-point users.

    The donor can donate up to their full balance; the
    ``Before_UserInfo_Update_Points`` trigger then floors ``TotalPoints``
    at 10 so they can keep playing. We only reject donations that exceed
    what the user actually has.

    The SELECT/UPDATE/INSERT all run inside a single transaction with a row
    lock on the user, so the balance check and the deduction are consistent
    under concurrent donations.
    """
    if body.amount <= 0:
        raise HTTPException(400, "Amount must be positive")

    with db() as conn:
        cur = conn.cursor()
        try:
            # Lock the donor row for the rest of the transaction so the
            # balance check and the deduction can't be interleaved with
            # another donation by the same user.
            cur.execute(
                "SELECT TotalPoints, Username FROM UserInfo "
                "WHERE UserID = %s FOR UPDATE",
                (body.userId,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, f"User {body.userId} not found")
            current_points, username = int(row[0]), row[1]

            if body.amount > current_points:
                raise HTTPException(
                    400,
                    f"Cannot donate {body.amount} — you only have "
                    f"{current_points} points.",
                )

            cur.execute(
                "UPDATE UserInfo SET TotalPoints = TotalPoints - %s WHERE UserID = %s",
                (body.amount, body.userId),
            )
            cur.execute(
                "INSERT INTO Donation (UserID, Amount, DonationDate) "
                "VALUES (%s, %s, NOW())",
                (body.userId, body.amount),
            )
            donation_id = cur.lastrowid

            cur.execute(
                "SELECT DonationDate FROM Donation WHERE DonationID = %s",
                (donation_id,),
            )
            donated_at = cur.fetchone()[0]

            conn.commit()
        except HTTPException:
            conn.rollback()
            raise
        except mysql.connector.Error as err:
            conn.rollback()
            raise HTTPException(500, f"Database error: {err}")
        finally:
            cur.close()

    return DonationOut(
        donationId=donation_id,
        userId=body.userId,
        username=username,
        amount=body.amount,
        donatedAt=str(donated_at),
        distributed=False,
    )


@app.get("/api/donations", response_model=list[DonationOut], tags=["donations"])
def get_donations():
    """Get all donations."""
    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT d.DonationID, d.UserID, u.Username, d.Amount, "
            "       d.DonationDate, d.Distributed "
            "FROM Donation d "
            "JOIN UserInfo u ON d.UserID = u.UserID "
            "ORDER BY d.DonationDate DESC"
        )
        rows = cur.fetchall()
        cur.close()
    return [
        DonationOut(
            donationId=r[0],
            userId=r[1],
            username=r[2],
            amount=r[3],
            donatedAt=str(r[4]),
            distributed=bool(r[5]),
        )
        for r in rows
    ]


@app.get(
    "/api/donations/{donation_id}",
    response_model=DonationOut,
    tags=["donations"],
)
def get_donation(donation_id: int):
    """Read a single donation by id."""
    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT d.DonationID, d.UserID, u.Username, d.Amount, "
            "       d.DonationDate, d.Distributed "
            "FROM Donation d "
            "JOIN UserInfo u ON d.UserID = u.UserID "
            "WHERE d.DonationID = %s",
            (donation_id,),
        )
        row = cur.fetchone()
        cur.close()
    if not row:
        raise HTTPException(404, f"Donation {donation_id} not found")
    return DonationOut(
        donationId=row[0],
        userId=row[1],
        username=row[2],
        amount=row[3],
        donatedAt=str(row[4]),
        distributed=bool(row[5]),
    )


@app.put(
    "/api/donations/{donation_id}",
    response_model=DonationOut,
    tags=["donations"],
)
def update_donation(donation_id: int, body: DonationUpdateRequest):
    """Update an existing donation's amount.

    Adjusts the donor's ``TotalPoints`` by the difference (charge if the
    amount goes up, refund if it goes down). Distributed donations are
    locked — editing one would create accounting drift because the points
    were already paid out.
    """
    if body.amount <= 0:
        raise HTTPException(400, "Amount must be positive")

    with db() as conn:
        cur = conn.cursor()
        try:
            cur.execute(
                "SELECT UserID, Amount, Distributed FROM Donation "
                "WHERE DonationID = %s FOR UPDATE",
                (donation_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, f"Donation {donation_id} not found")
            user_id, old_amount, distributed = int(row[0]), int(row[1]), bool(row[2])

            if distributed:
                raise HTTPException(
                    400,
                    "Cannot edit a donation that has already been distributed.",
                )

            delta = body.amount - old_amount

            if delta > 0:
                # Donor needs to actually have the extra points to charge.
                # The trigger will still floor them at 10 if the deduction
                # would push below that.
                cur.execute(
                    "SELECT TotalPoints FROM UserInfo "
                    "WHERE UserID = %s FOR UPDATE",
                    (user_id,),
                )
                current_points = int(cur.fetchone()[0])
                if delta > current_points:
                    raise HTTPException(
                        400,
                        f"Cannot increase donation by {delta} — you only have "
                        f"{current_points} points.",
                    )

            if delta != 0:
                # Negative delta becomes a refund (TotalPoints - (-X) = +X).
                cur.execute(
                    "UPDATE UserInfo SET TotalPoints = TotalPoints - %s "
                    "WHERE UserID = %s",
                    (delta, user_id),
                )
            cur.execute(
                "UPDATE Donation SET Amount = %s WHERE DonationID = %s",
                (body.amount, donation_id),
            )

            cur.execute(
                "SELECT d.DonationID, d.UserID, u.Username, d.Amount, "
                "       d.DonationDate, d.Distributed "
                "FROM Donation d "
                "JOIN UserInfo u ON d.UserID = u.UserID "
                "WHERE d.DonationID = %s",
                (donation_id,),
            )
            result_row = cur.fetchone()
            conn.commit()
        except HTTPException:
            conn.rollback()
            raise
        except mysql.connector.Error as err:
            conn.rollback()
            raise HTTPException(500, f"Database error: {err}")
        finally:
            cur.close()

    return DonationOut(
        donationId=result_row[0],
        userId=result_row[1],
        username=result_row[2],
        amount=result_row[3],
        donatedAt=str(result_row[4]),
        distributed=bool(result_row[5]),
    )


@app.delete("/api/donations/{donation_id}", tags=["donations"])
def delete_donation(donation_id: int):
    """Delete a donation and refund the amount to the donor.

    Distributed donations cannot be deleted — the points were already paid
    out to recipients, so removing the row would not be reversible.
    """
    with db() as conn:
        cur = conn.cursor()
        try:
            cur.execute(
                "SELECT UserID, Amount, Distributed FROM Donation "
                "WHERE DonationID = %s FOR UPDATE",
                (donation_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, f"Donation {donation_id} not found")
            user_id, amount, distributed = int(row[0]), int(row[1]), bool(row[2])

            if distributed:
                raise HTTPException(
                    400,
                    "Cannot delete a donation that has already been distributed.",
                )

            cur.execute(
                "UPDATE UserInfo SET TotalPoints = TotalPoints + %s "
                "WHERE UserID = %s",
                (amount, user_id),
            )
            cur.execute("DELETE FROM Donation WHERE DonationID = %s", (donation_id,))
            conn.commit()
        except HTTPException:
            conn.rollback()
            raise
        except mysql.connector.Error as err:
            conn.rollback()
            raise HTTPException(500, f"Database error: {err}")
        finally:
            cur.close()
    return {"status": "deleted", "donationId": donation_id}


@app.post("/api/donations/distribute-daily-pool", tags=["donations"])
def distribute_daily_pool():
    """
    Triggers the daily charity distribution transaction.
    Sums today's donations and distributes the total (rounded down) 
    equally among the 5 users with the lowest points.
    """
    with db() as conn:
        cur = conn.cursor()
        try:
            # The procedure runs its own START TRANSACTION / COMMIT and emits
            # a single result-set summarising the distribution.
            cur.callproc("ExecuteDailyCharityDistribution")
            summary = {
                "distributedTotal": 0,
                "donorCount": 0,
                "perUserAmount": 0,
                "recipientCount": 0,
            }
            for result in cur.stored_results():
                row = result.fetchone()
                if row:
                    summary = {
                        "distributedTotal": int(row[0]),
                        "donorCount": int(row[1]),
                        "perUserAmount": int(row[2]),
                        "recipientCount": int(row[3]),
                    }

            cur.execute(
                "SELECT UserID, Username, TotalPoints "
                "FROM UserInfo "
                "ORDER BY TotalPoints ASC LIMIT 5"
            )
            recipients = [
                {"userId": r[0], "username": r[1], "newTotalPoints": r[2]}
                for r in cur.fetchall()
            ]

        except mysql.connector.Error as err:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Transaction failed: {err}")
        finally:
            cur.close()

    return {
        "status": "success",
        "message": "Daily donation pool has been distributed.",
        "summary": summary,
        "affectedUsers": recipients,
    }
