import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AwardsPage } from './components/AwardsPage/AwardsPage';
import { BattleArena } from './components/BattleArena/BattleArena';
import { BattleHistoryPage } from './components/BattleHistoryPage/BattleHistoryPage';
import { DonationsPage } from './components/DonationsPage/DonationsPage';
import { LoginPage } from './components/LoginPage/LoginPage';
import { SignupPage } from './components/SignupPage/SignupPage';
import { UserMenu } from './components/UserMenu/UserMenu';
import styles from './App.module.css';

// State-based view routing — six views cover the whole app.
type View = 'login' | 'signup' | 'battle' | 'history' | 'awards' | 'donations';

function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

function AppRouter() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<View>('login');
  // After signup we redirect to login and pre-fill the username field.
  const [pendingUsername, setPendingUsername] = useState('');

  // Keep the view state consistent with auth state. On logout, drop back
  // to login; on login, default to the battle arena.
  useEffect(() => {
    if (!user && view !== 'login' && view !== 'signup') {
      setView('login');
    } else if (user && (view === 'login' || view === 'signup')) {
      setView('battle');
    }
  }, [user, view]);

  if (loading) {
    return <div className={styles.bootLoader}>Loading…</div>;
  }

  if (!user) {
    return view === 'signup' ? (
      <SignupPage
        onSignupSuccess={username => {
          setPendingUsername(username);
          setView('login');
        }}
        onSwitchToLogin={() => setView('login')}
      />
    ) : (
      <LoginPage
        defaultUsername={pendingUsername}
        onSwitchToSignup={() => {
          setPendingUsername('');
          setView('signup');
        }}
      />
    );
  }

  const back = () => setView('battle');

  return (
    <div className={styles.shell}>
      <UserMenu
        onSelectHistory={() => setView('history')}
        onSelectAwards={() => setView('awards')}
        onSelectDonations={() => setView('donations')}
      />

      {view === 'history' && <BattleHistoryPage onBack={back} />}
      {view === 'awards' && <AwardsPage onBack={back} />}
      {view === 'donations' && <DonationsPage onBack={back} />}
      {view !== 'history' && view !== 'awards' && view !== 'donations' && (
        <>
          <header className={styles.header}>
            <h1 className={styles.title}>Pokémon Battle Predictor</h1>
            <p className={styles.subtitle}>
              Pick a winner. Wager points. Outsmart the odds.
            </p>
          </header>
          <BattleArena />
        </>
      )}
    </div>
  );
}

export default App;
