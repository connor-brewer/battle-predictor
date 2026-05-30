import styles from './OddsDisplay.module.css';

interface OddsDisplayProps {
  odds1: number;
  odds2: number;
}

export function OddsDisplay({ odds1, odds2 }: OddsDisplayProps) {
  return (
    <div className={styles.container}>
      <div className={styles.label}>Odds</div>
      <div className={styles.value}>{odds1.toFixed(1)} : {odds2.toFixed(1)}</div>
    </div>
  );
}