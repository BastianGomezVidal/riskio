import { useEffect, useState } from 'react';
import { api, Session, Storm, User } from './api/client';
import {
  clearAccessToken,
  decodeTokenClaims,
  getAccessToken,
  hasValidSession,
} from './auth/session';
import Login from './pages/Login';
import OAuthCallback from './pages/OAuthCallback';

/** Minimal user derived from the stored JWT claims after OAuth/reload. */
function userFromClaims(): User | null {
  const token = getAccessToken();
  if (!token) return null;

  const claims = decodeTokenClaims(token);
  if (!claims) return null;

  return {
    id: claims.sub ?? '',
    email: claims.email ?? '',
    role: claims.role === 'admin' ? 'admin' : 'client',
    firstName: '',
    lastName: '',
  };
}

export default function App() {
  const isOAuthCallback = window.location.pathname === '/auth/callback';
  const [user, setUser] = useState<User | null>(() =>
    hasValidSession() ? userFromClaims() : null,
  );
  const [apiStatus, setApiStatus] = useState<string>('checking…');
  const [storms, setStorms] = useState<Storm[]>([]);

  function handleAuthed(session: Session) {
    setUser(session.user);
  }

  function handleOAuthDone(_message: { kind: 'token' } | { kind: 'error'; reason: string }) {
    setUser(userFromClaims());
  }

  function handleLogout() {
    clearAccessToken();
    setUser(null);
  }

  useEffect(() => {
    if (isOAuthCallback || !user) return;

    api
      .health()
      .then(({ status }) => setApiStatus(status))
      .catch((err: unknown) =>
        setApiStatus(err instanceof Error ? err.message : 'unreachable'),
      );

    api
      .storms()
      .then((page) => setStorms(page.data))
      .catch(() => setStorms([]));
  }, [isOAuthCallback, user]);

  if (isOAuthCallback) {
    return <OAuthCallback onDone={handleOAuthDone} />;
  }

  if (!user) {
    return <Login onAuthed={handleAuthed} />;
  }

  return (
    <main>
      <header className="topbar">
        <h1>Riskio</h1>
        <div className="account">
          <span className="role-badge">{user.role}</span>
          {user.email && <span className="email">{user.email}</span>}
          <button type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>
      <p>
        API: <code>{apiStatus}</code>
      </p>
      <h2>Active storms</h2>
      {storms.length === 0 ? (
        <p>No storms stored yet.</p>
      ) : (
        <ul>
          {storms.map((storm) => (
            <li key={storm.atcfId}>
              <strong>{storm.name ?? storm.atcfId}</strong>{' '}
              <span>({storm.basin})</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}