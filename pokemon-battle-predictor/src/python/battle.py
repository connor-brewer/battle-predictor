"""Simplified turn-based battle simulator.

Uses base stats, type effectiveness, STAB, and a random factor to produce
a realistic-feeling result. Every Pokémon randomly picks one of its four
moves each turn (1/4 chance per move, matching the proposal).

The simulator intentionally does NOT model abilities, items, critical hits,
stat changes, or status conditions — this keeps the codebase small while
still making type matchups and stats matter for predictions.
"""

from __future__ import annotations

import random
import time
from typing import Any

# ── Constants ────────────────────────────────────────────────────────────

_LEVEL = 50
_MAX_TURNS = 100

_HP_SCALE = 3

_TRIPLE_HITTERS = {331, 42, 4, 350, 31, 541}
_DOUBLE_HITTERS = {3, 24, 458, 530, 814}


# ── Public API ───────────────────────────────────────────────────────────



def simulate(
    pokemon1: dict[str, Any],
    pokemon2: dict[str, Any],
    type_effectiveness: dict[tuple[int, int], float],
) -> int:

    hp1 = pokemon1["hp"] * _HP_SCALE
    hp2 = pokemon2["hp"] * _HP_SCALE

    initial_hp1 = pokemon1["hp"] * _HP_SCALE
    initial_hp2 = pokemon2["hp"] * _HP_SCALE


    battle_log = []   #list of strings, each string is one line of the battle text
    health_history = []    #list of health updates for easy access for frontend display
    game_finished = False
    winner = pokemon1["pokemonId"]

    
    battle_log.append("Starting battle...")
    str0 = str(pokemon1.get("pokemonName")) + "'s HP: " + str(hp1) + "/" + str(initial_hp1) + "     " + str(pokemon2.get("pokemonName")) + "'s HP: " + str(hp2) + "/" + str(initial_hp2)
    battle_log.append(str0)
    health_history.append((int(hp1),int(hp2)))

    for _ in range(_MAX_TURNS):
        # Faster Pokémon attacks first; coin-flip on tie.
        if pokemon1["speed"] > pokemon2["speed"]:
            order = [(pokemon1, pokemon2, 1), (pokemon2, pokemon1, 2)]
        elif pokemon2["speed"] > pokemon1["speed"]:
            order = [(pokemon2, pokemon1, 2), (pokemon1, pokemon2, 1)]
        else:
            order = [(pokemon1, pokemon2, 1), (pokemon2, pokemon1, 2)]
            random.shuffle(order)

        for attacker, defender, attacker_num in order:

            

            moves = attacker.get("moves") or []

            damaging = [m for m in moves if m.get("power")]

            if not damaging:
                continue

            move = random.choice(damaging)

            str1 = str(attacker.get("pokemonName")) + " used " + str(move.get("moveName")) + "."
            battle_log.append(str1)

            # if accuracy is 0, its actually 100 (never miss non-damaging moves are listed as accraucy 0 or null)
            accuracy = move.get("accuracy")
            if accuracy is None or accuracy == 0:
                accuracy = 1.0  # 100% hit rate as decimal
            else:
                accuracy = float(accuracy) / 100

            move_hits = (random.uniform(0.0, 1.0) < accuracy)
            
            dmg = 0.0

            if move_hits:

                modifier = 1.0
                move_type_id = (move.get("type") or {}).get("typeId")
                if move_type_id is not None:
                    for def_type in defender.get("types", []):
                        mult = type_effectiveness.get((move_type_id, def_type["typeId"]), 1.0)
                        modifier *= mult
                
                if modifier > 1.0:
                    battle_log.append("It was super effective!")
                elif modifier < 1.0:
                    battle_log.append("It was not very effective...")



                crit_result = (random.randint(1, 12) == 1)  #boosted crit rate for FUN!
                if crit_result:
                    battle_log.append("A critical hit!")

                dmg = _calc_damage(attacker, defender, move, type_effectiveness, crit_result)
                
            else:
                battle_log.append("But it failed!")

            if attacker_num == 1:
                hp2 -= dmg
                if hp2 <= 0:
                    hp2 = 0
                    battle_log.append(str(pokemon2.get("pokemonName")) + " fainted, " + str(pokemon1.get("pokemonName")) + " wins!")
                    game_finished = True
                    winner = pokemon1["pokemonId"]
            else:
                hp1 -= dmg
                if hp1 <= 0:
                    hp1 = 0
                    battle_log.append(str(pokemon1.get("pokemonName")) + " fainted, " + str(pokemon2.get("pokemonName")) + " wins!")
                    game_finished = True
                    winner = pokemon2["pokemonId"]
        
            # str1 = str(attacker.get("pokemonName")) + " used " + str(move.get("moveName")) + "."
            str3 = str(pokemon1.get("pokemonName")) + "'s HP: " + str(int(hp1)) + "/" + str(initial_hp1) + "     " + str(pokemon2.get("pokemonName")) + "'s HP: " + str(int(hp2)) + "/" + str(initial_hp2)
            battle_log.append(str3)
            health_history.append((int(hp1),int(hp2)))

            if game_finished == True:
                return winner, battle_log, health_history

    # If nobody fainted, the one with more remaining HP wins.
    battle_log.append("Too many turns! Winner is decided by remaining HP.")
    if hp1 > hp2:
        battle_log.append(str(pokemon1.get("pokemonName")) + " has more HP, " + str(pokemon1.get("pokemonName")) + " wins!")
        return pokemon1["pokemonId"], battle_log, health_history
    if hp2 > hp1:
        battle_log.append(str(pokemon2.get("pokemonName")) + " has more HP, " + str(pokemon2.get("pokemonName")) + " wins!")
        return pokemon2["pokemonId"], battle_log, health_history
    
    battle_log.append("Both Pokemon have the same HP value, winner is decided randomly.")
    randchoicewinnertie = random.choice(["p1", "p2"])
    if randchoicewinnertie == "p1":
        battle_log.append(str(pokemon1.get("pokemonName")) + " wins!")
        return pokemon1["pokemonId"], battle_log, health_history
    else:
        battle_log.append(str(pokemon2.get("pokemonName")) + " wins!")
        return pokemon2["pokemonId"], battle_log, health_history











# ── Internal helpers ─────────────────────────────────────────────────────









def _calc_damage(
    attacker: dict,
    defender: dict,
    move: dict,
    effectiveness: dict[tuple[int, int], float],
    crit_result,
) -> int:
    power = move.get("power") or 0
    if power == 0:
        return 0
    
    if str(move.get("moveId")) in _DOUBLE_HITTERS:
        power = power * 2 
    elif str(move.get("moveId")) in _TRIPLE_HITTERS:
        power = power * 3 

    # Use the higher of physical / special on each side.
    a = max(attacker["attack"], attacker["specialAttack"])
    a = max(a, 1)
    d = max(defender["defense"], defender["specialDefense"])
    d = max(d, 1)

    crit_multiplier = 1
    if crit_result == True:
        crit_multiplier = 2

    base = (((2 * _LEVEL * crit_multiplier) / 5 + 2) * power * (a / d)) / 50 + 2

    # Type effectiveness (stacks for dual-type defenders).
    move_type_id = (move.get("type") or {}).get("typeId")
    modifier = 1.0
    if move_type_id is not None:
        for def_type in defender.get("types", []):
            mult = effectiveness.get((move_type_id, def_type["typeId"]), 1.0)
            modifier *= mult

    # STAB (Same Type Attack Bonus).
    atk_type_ids = {t["typeId"] for t in attacker.get("types", [])}
    if move_type_id in atk_type_ids:
        modifier *= 1.5

    # More variance in highroll-lowroll random factor for FUN!
    modifier = modifier * (random.randint(200, 255) / 255)
    

    return max(1, int(base * modifier))











