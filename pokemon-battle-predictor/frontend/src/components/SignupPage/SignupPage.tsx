import { useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './SignupPage.module.css';

interface SignupPageProps {
  // Called with the newly-created username so the login page can pre-fill it.
  onSignupSuccess: (username: string) => void;
  onSwitchToLogin: () => void;
}

const MIN_PASSWORD_LEN = 8;

export function SignupPage({ onSignupSuccess, onSwitchToLogin }: SignupPageProps) {
  const { signup } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side length check so the user gets immediate feedback; the
    // backend enforces the same rule so this can't be bypassed.
    if (password.length < MIN_PASSWORD_LEN) {
      setError(`Password must be at least ${MIN_PASSWORD_LEN} characters`);
      return;
    }

    setBusy(true);
    try {
      await signup(username, password);
      onSignupSuccess(username);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Signup failed';
      if (msg.includes('409')) {
        setError('Username taken');
      } else if (msg.includes('400')) {
        setError(`Password must be at least ${MIN_PASSWORD_LEN} characters`);
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.container}>
      <form className={styles.card} onSubmit={onSubmit}>
        <h2 className={styles.title}>Create account</h2>

        <label className={styles.field}>
          <span className={styles.label}>Username</span>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
            required
            autoComplete="username"
            className={styles.input}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Password</span>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LEN}
            autoComplete="new-password"
            className={styles.input}
          />
          <span className={styles.hint}>
            At least {MIN_PASSWORD_LEN} characters
          </span>
        </label>

        {error && <div className={styles.error}>{error}</div>}

        <button type="submit" className={styles.submit} disabled={busy}>
          {busy ? 'Creating…' : 'Sign up'}
        </button>

        <div className={styles.switch}>
          Already have an account?{' '}
          <button type="button" className={styles.link} onClick={onSwitchToLogin}>
            Log in
          </button>
        </div>
      </form>
    </div>
  );
}
