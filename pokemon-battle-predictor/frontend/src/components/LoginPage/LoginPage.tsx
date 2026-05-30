import { useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './LoginPage.module.css';

interface LoginPageProps {
  onSwitchToSignup: () => void;
  // Pre-fill the username field after a successful signup.
  defaultUsername?: string;
}

export function LoginPage({ onSwitchToSignup, defaultUsername = '' }: LoginPageProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState(defaultUsername);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username, password);
    } catch (err) {
      // The backend returns 401 with plaintext "Invalid username or password".
      // Any other error is reported verbatim so network problems aren't hidden.
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(
        msg.includes('401')
          ? 'Invalid username or password'
          : msg,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.container}>
      <form className={styles.card} onSubmit={onSubmit}>
        <h2 className={styles.title}>Log in</h2>

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
            autoComplete="current-password"
            className={styles.input}
          />
        </label>

        {error && <div className={styles.error}>{error}</div>}

        <button type="submit" className={styles.submit} disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>

        <div className={styles.switch}>
          No account?{' '}
          <button type="button" className={styles.link} onClick={onSwitchToSignup}>
            Sign up
          </button>
        </div>
      </form>
    </div>
  );
}
