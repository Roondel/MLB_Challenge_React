import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, type = 'text', value, onChange, placeholder, autoComplete }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="w-full px-4 py-2.5 rounded-lg bg-dark-700 border border-dark-500 text-white
                   placeholder-gray-500 focus:outline-none focus:border-accent focus:ring-1
                   focus:ring-accent transition-colors"
      />
    </div>
  );
}

function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">
      {message}
    </div>
  );
}

// ── Sign-In form ──────────────────────────────────────────────────────────────

function SignInForm({ onSwitchToSignUp }) {
  const { signIn, authError, loading } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await signIn(email, password);
    } catch {
      // authError state is set by AuthContext
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ErrorBanner message={authError} />
      <Field
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        autoComplete="email"
      />
      <Field
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder="••••••••"
        autoComplete="current-password"
      />
      <button
        type="submit"
        disabled={loading}
        data-testid="auth-submit"
        className="w-full py-2.5 rounded-lg bg-accent text-white font-semibold
                   hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </button>
      <p className="text-center text-sm text-gray-500">
        No account?{' '}
        <button
          type="button"
          onClick={onSwitchToSignUp}
          className="text-accent hover:underline"
        >
          Sign up
        </button>
      </p>
    </form>
  );
}

// ── Sign-Up form ──────────────────────────────────────────────────────────────

function SignUpForm({ onSwitchToSignIn }) {
  const { signUp, confirmSignUp, signIn, authError, loading } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode]         = useState('');
  const [needsCode, setNeedsCode] = useState(false);

  const handleSignUp = async (e) => {
    e.preventDefault();
    try {
      const result = await signUp(email, password);
      if (result?.nextStep?.signUpStep === 'CONFIRM_SIGN_UP') {
        setNeedsCode(true);
      }
    } catch {
      // authError state is set by AuthContext
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    try {
      await confirmSignUp(email, code);
      // Auto sign-in after confirmation
      await signIn(email, password);
    } catch {
      // authError state is set by AuthContext
    }
  };

  if (needsCode) {
    return (
      <form onSubmit={handleConfirm} className="space-y-4">
        <p className="text-sm text-gray-400 text-center">
          Check your email for a verification code.
        </p>
        <ErrorBanner message={authError} />
        <Field
          label="Verification Code"
          value={code}
          onChange={setCode}
          placeholder="123456"
          autoComplete="one-time-code"
        />
        <button
          type="submit"
          disabled={loading}
          data-testid="auth-submit"
          className="w-full py-2.5 rounded-lg bg-accent text-white font-semibold
                     hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          {loading ? 'Verifying…' : 'Verify & Sign In'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSignUp} className="space-y-4">
      <ErrorBanner message={authError} />
      <Field
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        autoComplete="email"
      />
      <Field
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder="Min 8 chars, upper + lower + number"
        autoComplete="new-password"
      />
      <button
        type="submit"
        disabled={loading}
        data-testid="auth-submit"
        className="w-full py-2.5 rounded-lg bg-accent text-white font-semibold
                   hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
      >
        {loading ? 'Creating account…' : 'Create Account'}
      </button>
      <p className="text-center text-sm text-gray-500">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitchToSignIn}
          className="text-accent hover:underline"
        >
          Sign in
        </button>
      </p>
    </form>
  );
}

// ── AuthPage ──────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const [tab, setTab] = useState('signin');

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-accent">30</span> Ballpark Challenge
          </h1>
          <p className="text-gray-500 text-sm mt-2">Track your journey to all 30 parks</p>
        </div>

        {/* Card */}
        <div className="bg-dark-800 rounded-2xl border border-dark-600 p-8 shadow-xl">
          {/* Tab switcher */}
          <div className="flex rounded-lg bg-dark-700 p-1 mb-6">
            {['signin', 'signup'].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  tab === t
                    ? 'bg-dark-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {tab === 'signin' ? (
            <SignInForm onSwitchToSignUp={() => setTab('signup')} />
          ) : (
            <SignUpForm onSwitchToSignIn={() => setTab('signin')} />
          )}
        </div>
      </div>
    </div>
  );
}
