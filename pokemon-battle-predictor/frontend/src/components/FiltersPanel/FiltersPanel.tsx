import type { MatchupFilters, StatKey } from '../../types/pokemon';
import { TYPES } from '../../data/mockData';
import styles from './FiltersPanel.module.css';

interface FiltersPanelProps {
  open: boolean;
  filters: MatchupFilters;
  onChange: (next: MatchupFilters) => void;
  onClose: () => void;
}

const ALL_TYPES = Object.values(TYPES).filter(t => t.typeName !== 'Unknown');

// Stat rows shown in the panel — keys match query_builder.Filter exactly.
const STAT_ROWS: Array<{ key: StatKey; label: string }> = [
  { key: 'hp',              label: 'HP' },
  { key: 'attack',          label: 'Attack' },
  { key: 'defense',         label: 'Defense' },
  { key: 'special_attack',  label: 'Sp. Atk' },
  { key: 'special_defense', label: 'Sp. Def' },
  { key: 'speed',           label: 'Speed' },
];

// Helper to read/write the dynamically-named min_X / max_X fields without
// losing TypeScript's structural checks on MatchupFilters.
const minKey = (k: StatKey) => `min_${k}` as const;
const maxKey = (k: StatKey) => `max_${k}` as const;

export function FiltersPanel({ open, filters, onChange, onClose }: FiltersPanelProps) {
  if (!open) return null;

  const toggleType = (typeName: string) => {
    const current = new Set(filters.type ?? []);
    const lower = typeName.toLowerCase();
    if (current.has(lower)) current.delete(lower);
    else current.add(lower);
    onChange({ ...filters, type: Array.from(current) });
  };

  const setStatBound = (
    key: StatKey,
    bound: 'min' | 'max',
    value: string,
  ) => {
    const fieldName = bound === 'min' ? minKey(key) : maxKey(key);
    onChange({
      ...filters,
      [fieldName]: value === '' ? undefined : Number(value),
    });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <aside className={styles.panel} onClick={e => e.stopPropagation()}>
        <header className={styles.header}>
          <h3 className={styles.title}>Filters</h3>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close filters">
            ×
          </button>
        </header>

        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Type</h4>
          <div className={styles.types}>
            {ALL_TYPES.map(t => {
              const active = filters.type?.includes(t.typeName.toLowerCase());
              return (
                <button
                  type="button"
                  key={t.typeId}
                  className={`${styles.typeChip} ${active ? styles.typeChipActive : ''}`}
                  onClick={() => toggleType(t.typeName)}
                >
                  {t.typeName}
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Base stats</h4>
          <div className={styles.statsGrid}>
            {STAT_ROWS.map(({ key, label }) => (
              <div key={key} className={styles.statRow}>
                <span className={styles.statLabel}>{label}</span>
                <input
                  type="number"
                  placeholder="Min"
                  value={filters[minKey(key)] ?? ''}
                  onChange={e => setStatBound(key, 'min', e.target.value)}
                  className={styles.numberInput}
                />
                <span className={styles.rangeDash}>—</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters[maxKey(key)] ?? ''}
                  onChange={e => setStatBound(key, 'max', e.target.value)}
                  className={styles.numberInput}
                />
              </div>
            ))}
          </div>
        </section>

        <button type="button" className={styles.clear} onClick={() => onChange({})}>
          Clear filters
        </button>
      </aside>
    </div>
  );
}
