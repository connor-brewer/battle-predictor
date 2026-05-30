import type { Move } from '../../types/pokemon';
import { colorForType } from '../../utils/typeColors';
import styles from './MovesGrid.module.css';

interface MovesGridProps {
  moves: Move[];
}

export function MovesGrid({ moves }: MovesGridProps) {
  return (
    <div className={styles.grid}>
      {moves.map(move => (
        <button
          key={move.moveId}
          type="button"
          className={styles.moveButton}
          style={{ backgroundColor: colorForType(move.type.typeName) }}
          // Buttons are non-interactive in the prediction screen — moves
          // are auto-selected during simulation. Disabled visually so it's
          // clear they're informational.
          disabled
        >
          {move.moveName}
        </button>
      ))}
    </div>
  );
}
