import { useState, type FormEvent } from 'react';
import { api, oauthAuthorizeUrl, Session } from '../api/client';
import { storeAccessToken } from '../auth/session';

interface LoginProps {
  onAuthed: (session: Session) => void;
}

/**
 * Email/password sign-in and sign-up, plus Google and Outlook OAuth buttons.
 * OAuth buttons bounce the browser through the backend's `/auth/oauth/:provider`
 * endpoint, which redirects back to `/auth/callback` with a session token.
 */
export default function Login({ onAuthed }: LoginProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const session =
        mode === 'signup'
          ? await api.register({
              firstName,
              lastName,
              phone: phone || undefined,
              email,
              password,
            })
          : await api.login(email, password);
      storeAccessToken(session.accessToken);
      onAuthed(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login">
      <h1>Riskio</h1>
      <nav className="tabs">
        <button
          type="button"
          className={mode === 'signin' ? 'active' : ''}
          onClick={() => setMode('signin')}
        >
          Sign in
        </button>
        <button
          type="button"
          className={mode === 'signup' ? 'active' : ''}
          onClick={() => setMode('signup')}
        >
          Create account
        </button>
      </nav>

      <section className="providers">
        <a className="provider" href={oauthAuthorizeUrl('google')}>
          Continue with Google (Gmail)
        </a>
        <a className="provider" href={oauthAuthorizeUrl('outlook')}>
          Continue with Microsoft (Outlook)
        </a>
      </section>

      <form onSubmit={handleSubmit}>
        {mode === 'signup' && (
          <>
            <label>
              First name
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                maxLength={80}
              />
            </label>
            <label>
              Last name
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                maxLength={80}
              />
            </label>
            <label>
              Phone
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 010 1234"
                maxLength={20}
              />
            </label>
          </>
        )}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </main>
  );
}