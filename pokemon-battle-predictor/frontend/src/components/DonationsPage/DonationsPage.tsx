import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import type { DistributionResult, Donation } from '../../types/pokemon';
import styles from './DonationsPage.module.css';

interface DonationsPageProps {
  onBack: () => void;
}

// CRUD on the Donation table — Create (form), Read (list), Update (inline
// edit), Delete (inline button).  The Distribute button calls the
// transactional stored procedure.
export function DonationsPage({ onBack }: DonationsPageProps) {
  const { user, refreshAwards, setUserState } = useAuth();
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Create-form state
  const [amount, setAmount] = useState('');

  // Edit-row state — id of the donation currently being edited, plus
  // its draft amount.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');

  // Latest distribution result, shown above the list when present.
  const [distResult, setDistResult] = useState<DistributionResult | null>(null);

  // Pool of points across all undistributed donations — drives the
  // header pill and the disabled-state of the Distribute button so the
  // user can tell at a glance whether there's anything to distribute.
  const pendingPool = (donations ?? [])
    .filter(d => !d.distributed)
    .reduce((sum, d) => sum + d.amount, 0);

  const load = async () => {
    try {
      setDonations(await api.listDonations());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load donations');
    }
  };

  // Donations now deduct/refund points server-side, so the user's
  // TotalPoints in the menu and battle screen has to refresh after every
  // donation CRUD or distribute call.
  const refreshUser = async () => {
    if (!user) return;
    try {
      const refreshed = await api.getUser(user.userId);
      setUserState(refreshed);
    } catch {
      // non-fatal; the user state will catch up on next navigation.
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Donation amount must be a positive number');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createDonation(user.userId, amt);
      setAmount('');
      await load();
      await refreshUser();
      refreshAwards();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create donation');
    } finally {
      setBusy(false);
    }
  };

  const onSaveEdit = async (id: number) => {
    const amt = Number(editDraft);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Edited amount must be a positive number');
      return;
    }
    setBusy(true);
    try {
      await api.updateDonation(id, amt);
      setEditingId(null);
      setEditDraft('');
      await load();
      await refreshUser();
      refreshAwards();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update donation');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: number) => {
    if (!window.confirm('Delete this donation? Your points will be refunded.')) return;
    setBusy(true);
    try {
      await api.deleteDonation(id);
      await load();
      await refreshUser();
      refreshAwards();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete donation');
    } finally {
      setBusy(false);
    }
  };

  const onDistribute = async () => {
    if (!window.confirm(
      'Distribute the pending donation pool equally to the 5 lowest-pointed users? '
      + 'These donations will be marked as distributed and won\'t be paid out again.',
    )) return;
    setBusy(true);
    try {
      const r = await api.distributeDailyPool();
      setDistResult(r);
      await load();
      await refreshUser();
      refreshAwards();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Distribution failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          ← Back
        </button>
        <h2 className={styles.title}>Donations</h2>
        <div className={styles.poolBadge}>
          Pending pool: <strong>{pendingPool}</strong>
        </div>
        <button
          type="button"
          className={styles.distributeButton}
          onClick={onDistribute}
          disabled={busy || pendingPool === 0}
        >
          Distribute pool
        </button>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {distResult && (
        <div className={styles.distResult}>
          <div className={styles.distHeader}>Distribution complete</div>
          <div className={styles.distGrid}>
            <span><strong>{distResult.summary.distributedTotal}</strong> total</span>
            <span><strong>{distResult.summary.donorCount}</strong> donors</span>
            <span><strong>{distResult.summary.perUserAmount}</strong> per recipient</span>
            <span><strong>{distResult.summary.recipientCount}</strong> recipients</span>
          </div>
          {distResult.affectedUsers.length > 0 && (
            <div className={styles.recipients}>
              {distResult.affectedUsers.map(u => (
                <span key={u.userId} className={styles.recipient}>
                  {u.username} → {u.newTotalPoints} pts
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <section className={styles.formSection}>
        <h3 className={styles.subtitle}>Make a donation</h3>
        <form className={styles.form} onSubmit={onCreate}>
          <input
            type="number"
            min={1}
            placeholder="Amount"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className={styles.input}
            required
          />
          <button
            type="submit"
            className={styles.submitButton}
            disabled={busy || !user}
          >
            Donate
          </button>
        </form>
        <div className={styles.formHint}>
          Donating from <strong>{user?.username ?? 'guest'}</strong>
        </div>
      </section>

      <section>
        <h3 className={styles.subtitle}>All donations</h3>

        {donations === null && !error && (
          <div className={styles.loading}>Loading…</div>
        )}

        {donations && donations.length === 0 && (
          <div className={styles.empty}>No donations yet.</div>
        )}

        {donations && donations.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Donor</th>
                <th>Amount</th>
                <th>When</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {donations.map(d => {
                const isOwn = user?.userId === d.userId;
                const isEditing = editingId === d.donationId;
                // Once distributed, a donation is locked — editing or
                // deleting it after the fact would create accounting drift
                // because the points were already paid out.
                const locked = d.distributed;
                return (
                  <tr
                    key={d.donationId}
                    className={locked ? styles.lockedRow : undefined}
                  >
                    <td>{d.username}</td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          min={1}
                          value={editDraft}
                          onChange={e => setEditDraft(e.target.value)}
                          className={styles.editInput}
                          autoFocus
                        />
                      ) : (
                        d.amount
                      )}
                    </td>
                    <td className={styles.dateCell}>{formatDate(d.donatedAt)}</td>
                    <td>
                      {locked ? (
                        <span className={styles.distributedBadge}>Distributed</span>
                      ) : (
                        <span className={styles.pendingBadge}>Pending</span>
                      )}
                    </td>
                    <td className={styles.actions}>
                      {isOwn && !isEditing && !locked && (
                        <>
                          <button
                            type="button"
                            className={styles.actionButton}
                            onClick={() => {
                              setEditingId(d.donationId);
                              setEditDraft(String(d.amount));
                            }}
                            disabled={busy}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`${styles.actionButton} ${styles.deleteButton}`}
                            onClick={() => onDelete(d.donationId)}
                            disabled={busy}
                          >
                            Delete
                          </button>
                        </>
                      )}
                      {isEditing && (
                        <>
                          <button
                            type="button"
                            className={styles.actionButton}
                            onClick={() => onSaveEdit(d.donationId)}
                            disabled={busy}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className={styles.actionButton}
                            onClick={() => {
                              setEditingId(null);
                              setEditDraft('');
                            }}
                            disabled={busy}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function formatDate(s: string): string {
  // The backend returns naïve ISO-ish strings (e.g. "2026-04-26 21:14:55").
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}
