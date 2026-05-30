import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import type { BattleHistoryEntry } from '../../types/pokemon';
import styles from './BattleHistoryPage.module.css';

interface BattleHistoryPageProps {
  onBack: () => void;
}

const SPRITE_CDN =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const sprite = (id: number) => `${SPRITE_CDN}/${id}.png`;

export function BattleHistoryPage({ onBack }: BattleHistoryPageProps) {
  const { user, setUserState } = useAuth();
  const [entries, setEntries] = useState<BattleHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!user) return;
    api
      .getBattleHistory(user.userId)
      .then(setEntries)
      .catch(err =>
        setError(err instanceof Error ? err.message : 'Failed to load history'),
      );
  }, [user]);

  const onClear = async () => {
    if (!user) return;
    const ok = window.confirm(
      'Clear all battle history? This will also reset your wins and losses. '
      + 'Your total points will be kept.',
    );
    if (!ok) return;
    setClearing(true);
    try {
      const refreshedUser = await api.clearBattleHistory(user.userId);
      setUserState(refreshedUser);
      setEntries([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear history');
    } finally {
      setClearing(false);
    }
  };

  if (!user) return null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          ← Back
        </button>
        <h2 className={styles.title}>Battle History</h2>
        <div className={styles.stats}>
          <span className={styles.stat}>
            <span className={styles.statLabel}>Wins</span>
            <span className={styles.statValue}>{user.correctPredictions}</span>
          </span>
          <span className={styles.stat}>
            <span className={styles.statLabel}>Losses</span>
            <span className={styles.statValue}>{user.incorrectPredictions}</span>
          </span>
          <span className={styles.stat}>
            <span className={styles.statLabel}>Points</span>
            <span className={styles.statValue}>{user.totalPoints}</span>
          </span>
          <button
            type="button"
            className={styles.clearButton}
            onClick={onClear}
            disabled={clearing || (entries !== null && entries.length === 0)}
          >
            {clearing ? 'Clearing…' : 'Clear history'}
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {entries === null && !error && (
        <div className={styles.loading}>Loading battle history…</div>
      )}

      {entries?.length === 0 && (
        <div className={styles.empty}>
          No battles yet — go pick a matchup!
        </div>
      )}

      <div className={styles.grid}>
        {entries?.map(entry => (
          <HistoryCard key={entry.battleId} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function HistoryCard({ entry }: { entry: BattleHistoryEntry }) {
  const cardClass = `${styles.card} ${
    entry.correct ? styles.cardWin : styles.cardLoss
  }`;
  return (
    <article className={cardClass}>
      <div className={styles.cardHeader}>
        <span className={styles.battleLabel}>Battle #{entry.battleId}</span>
        <span
          className={entry.correct ? styles.badgeWin : styles.badgeLoss}
        >
          {entry.correct ? 'Win' : 'Loss'}
        </span>
      </div>

      <div className={styles.matchup}>
        <div className={styles.pokemon}>
          <img
            className={styles.sprite}
            src={sprite(entry.pokemon1Id)}
            alt={entry.pokemon1Name}
          />
          <span className={styles.pokemonName}>{entry.pokemon1Name}</span>
        </div>

        <div className={styles.vs}>
          <span className={styles.vsLabel}>VS</span>
          <span className={styles.oddsLabel}>{entry.odds.toFixed(1)} : 1</span>
        </div>

        <div className={styles.pokemon}>
          <img
            className={styles.sprite}
            src={sprite(entry.pokemon2Id)}
            alt={entry.pokemon2Name}
          />
          <span className={styles.pokemonName}>{entry.pokemon2Name}</span>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerRow}>
          <span className={styles.footerLabel}>You picked</span>
          <span className={styles.footerValue}>{entry.predictedWinnerName}</span>
        </div>
        <div className={styles.footerRow}>
          <span className={styles.footerLabel}>Winner</span>
          <span className={styles.footerValue}>{entry.winnerPokemonName}</span>
        </div>
      </div>
    </article>
  );
}
