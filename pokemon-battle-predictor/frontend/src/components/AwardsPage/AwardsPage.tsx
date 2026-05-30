import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import type { RankAchievement, StreakAward } from '../../types/pokemon';
import styles from './AwardsPage.module.css';

interface AwardsPageProps {
  onBack: () => void;
}

// Renders the three stored-procedure outputs:
//   * GetUserWithLongestWinStreak    → top "win streak" card
//   * GetUserWithLongestLoseStreak   → top "lose streak" card
//   * GenerateRankAchievements       → ranked title table
//
// Refetches whenever AuthContext.awardsRefreshKey changes — that key is
// bumped after every battle and every donation CRUD, so navigating to
// this page after either kind of event always shows fresh data.
export function AwardsPage({ onBack }: AwardsPageProps) {
  const { awardsRefreshKey, refreshAwards } = useAuth();
  const [winStreak, setWinStreak] = useState<StreakAward | null>(null);
  const [loseStreak, setLoseStreak] = useState<StreakAward | null>(null);
  const [ranks, setRanks] = useState<RankAchievement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getLongestWinStreak(),
      api.getLongestLoseStreak(),
      api.getRankAchievements(),
    ])
      .then(([w, l, r]) => {
        setWinStreak(w);
        setLoseStreak(l);
        setRanks(r);
      })
      .catch(err =>
        setError(err instanceof Error ? err.message : 'Failed to load awards'),
      )
      .finally(() => setLoading(false));
  }, [awardsRefreshKey]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          ← Back
        </button>
        <h2 className={styles.title}>Awards</h2>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={refreshAwards}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.streakRow}>
        <StreakCard
          label="Longest Win Streak"
          accent="win"
          username={winStreak?.username ?? null}
          length={winStreak?.longestWinStreak ?? null}
        />
        <StreakCard
          label="Longest Lose Streak"
          accent="lose"
          username={loseStreak?.username ?? null}
          length={loseStreak?.longestLoseStreak ?? null}
        />
      </section>

      <section className={styles.rankSection}>
        <h3 className={styles.subtitle}>Rank Achievements</h3>
        {ranks === null && !error && <div className={styles.loading}>Loading…</div>}
        {ranks && ranks.length === 0 && (
          <div className={styles.empty}>No ranked users yet.</div>
        )}
        {ranks && ranks.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Trainer</th>
                <th>Points</th>
                <th>Title</th>
              </tr>
            </thead>
            <tbody>
              {ranks.map(r => (
                <tr key={`${r.rank}-${r.username}`}>
                  <td className={styles.rankCell}>{r.rank}</td>
                  <td>{r.username}</td>
                  <td>{r.points}</td>
                  <td>
                    <span className={styles.titleBadge}>
                      {r.achievementTitle}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function StreakCard({
  label,
  accent,
  username,
  length,
}: {
  label: string;
  accent: 'win' | 'lose';
  username: string | null;
  length: number | null;
}) {
  const cls = `${styles.streakCard} ${accent === 'win' ? styles.win : styles.lose}`;
  return (
    <div className={cls}>
      <div className={styles.streakLabel}>{label}</div>
      {username ? (
        <>
          <div className={styles.streakValue}>{length ?? 0}</div>
          <div className={styles.streakUser}>{username}</div>
        </>
      ) : (
        <div className={styles.streakEmpty}>Not enough battles yet</div>
      )}
    </div>
  );
}
