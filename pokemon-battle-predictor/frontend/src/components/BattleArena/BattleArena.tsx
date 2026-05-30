import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import type {
  BattleResult,
  Matchup,
  MatchupFilters,
} from '../../types/pokemon';
import { BattleAnimation } from '../BattleAnimation/BattleAnimation';
import { ControlBar } from '../ControlBar/ControlBar';
import { FiltersPanel } from '../FiltersPanel/FiltersPanel';
import { OddsDisplay } from '../OddsDisplay/OddsDisplay';
import { PokemonCard } from '../PokemonCard/PokemonCard';
import { WinnerSelector } from '../WinnerSelector/WinnerSelector';
import styles from './BattleArena.module.css';

export function BattleArena() {
  const { user, setUserState, refreshAwards } = useAuth();
  const [matchup, setMatchup] = useState<Matchup | null>(null);
  const [predictedWinnerId, setPredictedWinnerId] = useState<number | null>(null);
  const [wager, setWager] = useState<number>(25);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<MatchupFilters>({});
  const [lastResult, setLastResult] = useState<BattleResult | null>(null);
  // While the animation overlay is up, the result panel below the arena
  // stays hidden — the user only sees the play-by-play.
  const [animationOpen, setAnimationOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load an initial matchup on mount.
  useEffect(() => {
    api
      .getRandomMatchup()
      .then(setMatchup)
      .catch(err =>
        setError(
          err instanceof Error ? err.message : 'Failed to connect to backend',
        ),
      );
  }, []);

  // Clamp the displayed wager whenever the user's total points changes — if
  // they just lost a battle and wager > new totalPoints, drag it down.
  useEffect(() => {
    if (user && wager > user.totalPoints) {
      setWager(Math.max(1, user.totalPoints));
    }
  }, [user, wager]);

  const loadNewMatchup = async () => {
    setBusy(true);
    setLastResult(null);
    setPredictedWinnerId(null);
    try {
      const next = await api.getRandomMatchup(filters);
      setMatchup(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load matchup');
    } finally {
      setBusy(false);
    }
  };

  const onSimulate = async () => {
    if (!matchup || !user || predictedWinnerId === null) return;
    if (wager > user.totalPoints) {
      setError(`Cannot wager ${wager} — you only have ${user.totalPoints} points`);
      return;
    }
    setBusy(true);
    try {
      const result = await api.simulateBattle({
        matchup,
        predictedWinnerId,
        wager,
        userId: user.userId,
      });
      setLastResult(result);
      setAnimationOpen(true);
      // Refetch the user from the server rather than applying pointsDelta
      // optimistically — the trigger floor at 10 means the response's
      // pointsDelta can overstate what actually changed if the user wagered
      // close to their balance.
      try {
        const refreshed = await api.getUser(user.userId);
        setUserState(refreshed);
      } catch {
        // non-fatal — display will catch up on next nav.
      }
      refreshAwards();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Battle simulation failed');
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className={styles.error}>
        <p>{error}</p>
        <p className={styles.hint}>
          Make sure the backend is running (<code>uvicorn api:app --port 8000</code>
          {' '}or <code>docker compose up</code>).
        </p>
        <button
          type="button"
          className={styles.nextButton}
          onClick={() => { setError(null); window.location.reload(); }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!matchup || !user) {
    return <div className={styles.loading}>Loading…</div>;
  }

  const winnerName =
    lastResult &&
    (lastResult.winnerPokemonId === matchup.pokemon1.pokemonId
      ? matchup.pokemon1.pokemonName
      : matchup.pokemon2.pokemonName);

  return (
    <div className={styles.arena}>
      <div className={styles.matchup}>
        <PokemonCard pokemon={matchup.pokemon1} side="left" />
        <OddsDisplay odds1={matchup.odds1} odds2={matchup.odds2} />
        <PokemonCard pokemon={matchup.pokemon2} side="right" />
      </div>

      <WinnerSelector
        pokemon1Id={matchup.pokemon1.pokemonId}
        pokemon2Id={matchup.pokemon2.pokemonId}
        selectedId={predictedWinnerId}
        onSelect={setPredictedWinnerId}
      />

      <ControlBar
        points={user.totalPoints}
        wager={wager}
        maxWager={user.totalPoints}
        onWagerChange={setWager}
        onSimulate={onSimulate}
        onToggleFilters={() => setFiltersOpen(o => !o)}
        filtersOpen={filtersOpen}
        simulateDisabled={
          busy
          || predictedWinnerId === null
          || wager <= 0
          || wager > user.totalPoints
          || lastResult !== null
        }
      />

      {lastResult && !animationOpen && (
        <div className={styles.result}>
          <div className={styles.resultHeader}>
            {winnerName} wins!{' '}
            <span
              className={
                lastResult.pointsDelta >= 0 ? styles.delta : styles.deltaNeg
              }
            >
              {lastResult.pointsDelta >= 0 ? '+' : ''}
              {lastResult.pointsDelta} pts
            </span>
          </div>
          <button type="button" className={styles.nextButton} onClick={loadNewMatchup}>
            Next matchup →
          </button>
        </div>
      )}

      <FiltersPanel
        open={filtersOpen}
        filters={filters}
        onChange={setFilters}
        onClose={() => setFiltersOpen(false)}
      />

      {animationOpen && lastResult && (
        <BattleAnimation
          matchup={matchup}
          result={lastResult}
          onClose={() => setAnimationOpen(false)}
        />
      )}
    </div>
  );
}
