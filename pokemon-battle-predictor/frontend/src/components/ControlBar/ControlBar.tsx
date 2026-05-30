import styles from './ControlBar.module.css';

interface ControlBarProps {
  points: number;
  wager: number;
  // Maximum allowed wager — capped at the user's current points so they
  // can never bet more than they have.
  maxWager: number;
  onWagerChange: (next: number) => void;
  onSimulate: () => void;
  onToggleFilters: () => void;
  filtersOpen: boolean;
  simulateDisabled: boolean;
}

export function ControlBar({
  points,
  wager,
  maxWager,
  onWagerChange,
  onSimulate,
  onToggleFilters,
  filtersOpen,
  simulateDisabled,
}: ControlBarProps) {
  const handleWagerChange = (raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      onWagerChange(0);
      return;
    }
    // Clamp to [0, maxWager] so the input physically cannot represent a
    // wager the user can't afford.
    const clamped = Math.max(0, Math.min(parsed, maxWager));
    onWagerChange(clamped);
  };

  const overBudget = wager > maxWager;

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <button
          type="button"
          className={styles.filtersToggle}
          onClick={onToggleFilters}
          aria-expanded={filtersOpen}
        >
          Filters {filtersOpen ? '▼' : '▶'}
        </button>
        <div className={styles.points}>Points: {points}</div>
      </div>

      <button
        type="button"
        className={styles.simulate}
        onClick={onSimulate}
        disabled={simulateDisabled}
      >
        Simulate
      </button>

      <label className={`${styles.bet} ${overBudget ? styles.betOver : ''}`}>
        <span className={styles.betLabel}>Bet:</span>
        <input
          type="number"
          min={1}
          max={maxWager}
          value={wager}
          onChange={e => handleWagerChange(e.target.value)}
          className={styles.betInput}
        />
      </label>
    </div>
  );
}
