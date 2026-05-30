import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './UserMenu.module.css';

interface UserMenuProps {
  onSelectHistory: () => void;
  onSelectAwards: () => void;
  onSelectDonations: () => void;
}

export function UserMenu({
  onSelectHistory,
  onSelectAwards,
  onSelectDonations,
}: UserMenuProps) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking outside of it.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (!user) return null;

  const initial = user.username.charAt(0).toUpperCase();

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.avatar}
        onClick={() => setOpen(o => !o)}
        aria-label="Open user menu"
        aria-expanded={open}
      >
        {initial}
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <div className={styles.userBlock}>
            <div className={styles.username}>{user.username}</div>
            <div className={styles.points}>{user.totalPoints} pts</div>
          </div>

          <button
            type="button"
            className={styles.item}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSelectHistory();
            }}
          >
            Battle history
          </button>

          <button
            type="button"
            className={styles.item}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSelectAwards();
            }}
          >
            Awards
          </button>

          <button
            type="button"
            className={styles.item}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSelectDonations();
            }}
          >
            Donations
          </button>

          <button
            type="button"
            className={`${styles.item} ${styles.logoutItem}`}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
