import { useEffect, useState } from 'react';
import { storeAccessToken } from '../auth/session';

interface OAuthCallbackProps {
  onDone: (message: { kind: 'token' } | { kind: 'error'; reason: string }) => void;
}

/**
 * Landing page after an OAuth round-trip. The backend redirects here with
 * `?token=...` (success) or `?error=...` (failure). The token is stored and
 * the URL is cleaned up.
 */
export default function OAuthCallback({ onDone }: OAuthCallbackProps) {
  const [message, setMessage] = useState('Finishing sign-in…');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    window.history.replaceState({}, '', '/');

    if (token) {
      storeAccessToken(token);
      setMessage('Signed in');
      onDone({ kind: 'token' });
      return;
    }

    const reason = error ?? 'oauth_failed';
    setMessage(`Sign-in failed: ${reason}`);
    onDone({ kind: 'error', reason });
  }, [onDone]);

  return <main className="login"><h1>Riskio</h1><p>{message}</p></main>;
}