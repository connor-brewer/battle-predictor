"""Build parameterised SQL for the Pokémon search endpoint.

Generates a ``(query, params)`` tuple that can be passed straight to
``cursor.execute(query, params)`` with ``mysql-connector-python``'s
``%(name)s`` placeholder syntax.

Fixes vs. original version
--------------------------
* Placeholder syntax changed from ``:name`` → ``%(name)s`` (mysql-connector).
* ``WHERE`` / ``AND`` ordering fixed — ``AND`` no longer appears without a
  preceding ``WHERE``.
* BattleHistory subquery references ``UserID`` (matching schema.sql),
  not ``user``.
* ``generation`` filter kept in the model for forward-compatibility but
  excluded from SQL because the ``Pokemon`` table in the current DDL does
  not have a ``generation`` column.
"""

from __future__ import annotations

from dataclasses import dataclass, field

TYPE_MAP: dict[str, int] = {
    "normal": 1, "fighting": 2, "flying": 3, "poison": 4, "ground": 5,
    "rock": 6, "bug": 7, "ghost": 8, "steel": 9, "fire": 10,
    "water": 11, "grass": 12, "electric": 13, "psychic": 14, "ice": 15,
    "dragon": 16, "dark": 17, "fairy": 18, "stellar": 19, "unknown": 10001,
}


@dataclass
class Filter:
    type: list[str] = field(default_factory=list)
    generation: list[int] = field(default_factory=list)
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
    # Free-text keyword applied to PokemonName (case-insensitive substring).
    name: str | None = None


def generate_pokemon_query(filter_obj: Filter) -> tuple[str, dict]:
    """Return ``(sql, params)`` for a filtered Pokémon search."""

    query_base = (
        "SELECT DISTINCT p.* "
        "FROM `Pokemon` p "
        "JOIN `PokemonType` pt ON p.PokemonID = pt.PokemonID"
    )
    conditions: list[str] = []
    params: dict = {}

    # ── Type filter ──────────────────────────────────────────────────
    if filter_obj.type:
        type_ids = [
            TYPE_MAP[t.lower()]
            for t in filter_obj.type
            if t.lower() in TYPE_MAP
        ]
        if type_ids:
            placeholders = ", ".join(f"%(t{i})s" for i in range(len(type_ids)))
            conditions.append(f"pt.TypeID IN ({placeholders})")
            for i, tid in enumerate(type_ids):
                params[f"t{i}"] = tid

    # ── Generation filter (no-op: column not in current DDL) ─────────
    # Kept here so callers can pass the value without error.  Uncomment
    # the block below once ``generation INT`` is added to the Pokemon table.
    #
    # if filter_obj.generation:
    #     placeholders = ", ".join(f"%(g{i})s" for i in range(len(filter_obj.generation)))
    #     conditions.append(f"p.generation IN ({placeholders})")
    #     for i, gen in enumerate(filter_obj.generation):
    #         params[f"g{i}"] = gen

    # ── Per-stat range filters ───────────────────────────────────────
    stats = ["attack", "defense", "hp", "special_attack", "special_defense", "speed"]
    for stat in stats:
        lo = getattr(filter_obj, f"min_{stat}")
        hi = getattr(filter_obj, f"max_{stat}")
        if lo is not None and hi is not None:
            conditions.append(f"p.{stat} BETWEEN %(min_{stat})s AND %(max_{stat})s")
            params[f"min_{stat}"] = lo
            params[f"max_{stat}"] = hi
        elif lo is not None:
            conditions.append(f"p.{stat} >= %(min_{stat})s")
            params[f"min_{stat}"] = lo
        elif hi is not None:
            conditions.append(f"p.{stat} <= %(max_{stat})s")
            params[f"max_{stat}"] = hi

    # ── Keyword filter on PokemonName ────────────────────────────────
    if filter_obj.name:
        conditions.append("p.PokemonName LIKE %(name_kw)s")
        params["name_kw"] = f"%{filter_obj.name}%"

    # ── User battle-history filter ───────────────────────────────────
    if filter_obj.user is not None:
        sub_sql = (
            "SELECT Pokemon1ID FROM `BattleHistory` WHERE UserID = %(bh_user)s "
            "UNION "
            "SELECT Pokemon2ID FROM `BattleHistory` WHERE UserID = %(bh_user)s"
        )
        conditions.append(f"p.PokemonID IN ({sub_sql})")
        params["bh_user"] = filter_obj.user

    # ── Assemble ─────────────────────────────────────────────────────
    if conditions:
        final_query = f"{query_base} WHERE {' AND '.join(conditions)}"
    else:
        final_query = query_base

    return final_query, params
