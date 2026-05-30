import styles from './WinnerSelector.module.css';

interface WinnerSelectorProps {
  pokemon1Id: number;
  pokemon2Id: number;
  selectedId: number | null;
  onSelect: (pokemonId: number) => void;
}

export function WinnerSelector({
  pokemon1Id,
  pokemon2Id,
  selectedId,
  onSelect,
}: WinnerSelectorProps) {
  return (
    <div className={styles.row}>
      <button
        type="button"
        aria-label="Pick left Pokemon to win"
        className={`${styles.checkbox} ${selectedId === pokemon1Id ? styles.checked : ''}`}
        onClick={() => onSelect(pokemon1Id)}
      >
        {selectedId === pokemon1Id && <span className={styles.mark}>✓</span>}
      </button>
      <span className={styles.label}>Who will win?</span>
      <button
        type="button"
        aria-label="Pick right Pokemon to win"
        className={`${styles.checkbox} ${selectedId === pokemon2Id ? styles.checked : ''}`}
        onClick={() => onSelect(pokemon2Id)}
      >
        {selectedId === pokemon2Id && <span className={styles.mark}>✓</span>}
      </button>
    </div>
  );
}
