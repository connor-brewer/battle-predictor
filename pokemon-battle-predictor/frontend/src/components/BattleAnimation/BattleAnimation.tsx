import { useEffect, useMemo, useRef, useState } from 'react';
import type { BattleResult, Matchup } from '../../types/pokemon';
import styles from './BattleAnimation.module.css';

interface BattleAnimationProps {
  matchup: Matchup;
  result: BattleResult;
  onClose: () => void;
}

// Time spent on each kind of log line. HP-status lines aren't displayed —
// we use them to bump the health-history pointer so the bars animate at
// the right moment, then move on quickly.
const ACTION_LINE_MS = 600;
const HP_LINE_MS = 220;
const SKIP_MS = 30;

const HP_LINE_PATTERN = "'s HP:";

// HP scaling matches battle.py:_HP_SCALE — each Pokémon enters the fight
// with `hp * 3` so battles last a reasonable number of turns.
const HP_SCALE = 3;

function isHPLine(line: string): boolean {
  return line.includes(HP_LINE_PATTERN);
}

export function BattleAnimation({ matchup, result, onClose }: BattleAnimationProps) {
  const log = result.battleLog;
  const healthHistory = result.healthHistory;

  // Index of the next line we haven't shown yet. When this reaches
  // log.length the animation is finished.
  const [logIdx, setLogIdx] = useState(0);
  // How many HP-status lines we've consumed so far. Drives which entry of
  // healthHistory the HP bars currently reflect.
  const [healthIdx, setHealthIdx] = useState(-1);
  const [skipping, setSkipping] = useState(false);

  // Auto-scroll the log box as new lines appear.
  const logBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = logBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logIdx]);

  // Drive the animation forward one line at a time.
  useEffect(() => {
    if (logIdx >= log.length) return;
    const currentLine = log[logIdx];
    const isHP = isHPLine(currentLine);

    const delay = skipping ? SKIP_MS : isHP ? HP_LINE_MS : ACTION_LINE_MS;
    const timer = setTimeout(() => {
      if (isHP) setHealthIdx(idx => idx + 1);
      setLogIdx(idx => idx + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [logIdx, log, skipping]);

  const maxHP1 = matchup.pokemon1.hp * HP_SCALE;
  const maxHP2 = matchup.pokemon2.hp * HP_SCALE;

  const [hp1, hp2] = useMemo<[number, number]>(() => {
    if (healthIdx < 0) return [maxHP1, maxHP2];
    const snapshot = healthHistory[healthIdx];
    if (!snapshot) return [maxHP1, maxHP2];
    return [snapshot[0], snapshot[1]];
  }, [healthIdx, healthHistory, maxHP1, maxHP2]);

  // Lines visible to the user — HP status lines are filtered out (HP bars
  // already convey that information). We only render up to logIdx so the
  // box fills in over time.
  const visibleLines = useMemo(
    () => log.slice(0, logIdx + 1).filter(line => !isHPLine(line)),
    [log, logIdx],
  );

  const finished = logIdx >= log.length;

  // Once the final action line has rendered, also surface the points delta
  // and a clear winner banner inside the overlay.
  const winnerName =
    result.winnerPokemonId === matchup.pokemon1.pokemonId
      ? matchup.pokemon1.pokemonName
      : matchup.pokemon2.pokemonName;
  const correct = result.predictedWinnerId === result.winnerPokemonId;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.arena}>
        <div className={styles.combatants}>
          <Combatant
            spriteUrl={matchup.pokemon1.spriteUrl}
            name={matchup.pokemon1.pokemonName}
            currentHP={hp1}
            maxHP={maxHP1}
            side="left"
          />
          <div className={styles.vs}>VS</div>
          <Combatant
            spriteUrl={matchup.pokemon2.spriteUrl}
            name={matchup.pokemon2.pokemonName}
            currentHP={hp2}
            maxHP={maxHP2}
            side="right"
          />
        </div>

        <div ref={logBoxRef} className={styles.logBox}>
          {visibleLines.map((line, i) => (
            <p key={i} className={styles.logLine}>
              {line}
            </p>
          ))}
        </div>

        <div className={styles.footer}>
          {finished ? (
            <div className={styles.finishedRow}>
              <div className={styles.outcome}>
                <span className={styles.winnerName}>{winnerName}</span>
                <span className={styles.outcomeWon}> won the battle!</span>
                <span className={correct ? styles.delta : styles.deltaNeg}>
                  {result.pointsDelta >= 0 ? '+' : ''}
                  {result.pointsDelta} pts
                </span>
              </div>
              <button
                type="button"
                className={styles.continueButton}
                onClick={onClose}
              >
                Continue →
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={styles.skipButton}
              onClick={() => setSkipping(true)}
              disabled={skipping}
            >
              {skipping ? 'Skipping…' : 'Skip ▶▶'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface CombatantProps {
  spriteUrl: string;
  name: string;
  currentHP: number;
  maxHP: number;
  side: 'left' | 'right';
}

function Combatant({ spriteUrl, name, currentHP, maxHP, side }: CombatantProps) {
  const pct = Math.max(0, Math.min(100, (currentHP / Math.max(1, maxHP)) * 100));
  // Classic Pokémon color thresholds.
  const colorClass =
    pct > 50 ? styles.hpHigh : pct > 20 ? styles.hpMid : styles.hpLow;
  const fainted = currentHP <= 0;

  return (
    <div
      className={`${styles.combatant} ${styles[side]} ${
        fainted ? styles.fainted : ''
      }`}
    >
      <img className={styles.sprite} src={spriteUrl} alt={name} />
      <div className={styles.name}>{name}</div>
      <div className={styles.hpRow}>
        <div className={styles.hpTrack}>
          <div
            className={`${styles.hpFill} ${colorClass}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className={styles.hpText}>
          {Math.max(0, currentHP)} / {maxHP}
        </div>
      </div>
    </div>
  );
}
