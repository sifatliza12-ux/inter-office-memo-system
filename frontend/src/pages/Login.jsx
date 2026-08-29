import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import Card from '../components/ui/Card.jsx';
import Field from '../components/ui/Field.jsx';
import Input from '../components/ui/Input.jsx';

// Abstract, workflow-inspired geometry for the hero panel — a document
// stack, a reference-number watermark, and an approval-path node graph
// (filled = decided, outlined = pending) built from the app's own visual
// vocabulary, not stock/AI imagery. Pure decoration: aria-hidden, and the
// only thing that moves is the whole group drifting a couple of percent
// over ~20s (`animate-drift`, defined in tailwind.config.js) — no particles,
// no constant motion elsewhere on the page.
function HeroGeometry() {
  return (
    <svg
      viewBox="0 0 600 600"
      className="absolute inset-0 h-full w-full animate-drift"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <text
        x="300"
        y="330"
        textAnchor="middle"
        fontFamily="'JetBrains Mono', monospace"
        fontSize="150"
        fontWeight="600"
        fill="#ffffff"
        opacity="0.05"
      >
        M-0142
      </text>

      {/* Document stack, upper area */}
      <g opacity="0.16" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round">
        <rect x="70" y="90" width="150" height="104" rx="6" fill="none" />
        <line x1="88" y1="116" x2="196" y2="116" />
        <line x1="88" y1="134" x2="180" y2="134" />
        <line x1="88" y1="152" x2="196" y2="152" />
        <line x1="88" y1="170" x2="150" y2="170" />
      </g>

      {/* Approval-path node graph, lower-right — reuses the exact dot
          language StatusBadge/timeline use: filled = decided, outlined =
          not yet reached, one tangerine node = the accent moment. */}
      <g strokeLinecap="round">
        <path d="M370 430 L440 400 L500 440 L560 410" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.22" />
        <circle cx="370" cy="430" r="7" fill="#ffffff" opacity="0.85" />
        <circle cx="440" cy="400" r="7" fill="#ffffff" opacity="0.85" />
        <circle cx="500" cy="440" r="7" fill="#fb923c" />
        <circle cx="560" cy="410" r="7" fill="none" stroke="#ffffff" strokeWidth="1.75" opacity="0.5" />
      </g>

      <circle cx="500" cy="140" r="120" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.08" />
      <circle cx="60" cy="480" r="70" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.08" />
    </svg>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (submitError) {
      setError(submitError.response?.data?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-tangerine-50">
      {/* Brand hero — desktop/tablet only; mobile gets a compact header
          band below instead of a second, cramped copy of this panel. */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 lg:flex lg:w-1/2 xl:w-3/5">
        <HeroGeometry />
        <div
          className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gradient-to-br from-blue-400/30 to-tangerine-500/20 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex w-full flex-col justify-between p-10 text-white xl:p-16">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
            Inter-Office Memo
          </span>

          <div className="max-w-md">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
              Documents that move.
              <br />
              Decisions that stay tracked.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-blue-100 xl:text-base">
              Every memo carries its own approval path, participant history, and audit
              trail — from first draft to final decision.
            </p>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs font-medium uppercase tracking-[0.2em] text-blue-300">
            <span>Memos</span>
            <span className="text-blue-500" aria-hidden="true">
              &middot;
            </span>
            <span>Workflow</span>
            <span className="text-blue-500" aria-hidden="true">
              &middot;
            </span>
            <span>Audit</span>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-col lg:w-1/2 xl:w-2/5">
        {/* Compact brand band, mobile/tablet only */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-800 px-6 py-8 text-center lg:hidden">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
            Inter-Office Memo
          </span>
          <p className="mt-1.5 text-sm text-blue-100">Documents that move. Decisions that stay tracked.</p>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full max-w-sm animate-fade-in-up">
            <div className="mb-6 hidden text-center lg:block">
              <h2 className="text-2xl font-semibold tracking-tight text-stone-900">Sign in</h2>
              <p className="mt-1 text-sm text-stone-500">Welcome back — pick up where you left off.</p>
            </div>
            <h2 className="mb-6 text-center text-2xl font-semibold tracking-tight text-stone-900 lg:hidden">
              Sign in
            </h2>

            <Card>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                    {error}
                  </p>
                )}

                <Field label="Email" htmlFor="email">
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </Field>

                <Field label="Password" htmlFor="password">
                  <Input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </Field>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-900 to-tangerine-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 ease-out hover:from-blue-800 hover:to-tangerine-600 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tangerine-300 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]"
                >
                  {submitting ? 'Signing in...' : 'Sign in'}
                  {!submitting && (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  )}
                </button>

                <p className="text-center text-sm text-stone-500">
                  Don&apos;t have an organization yet?{' '}
                  <Link to="/register" className="font-medium text-blue-700 hover:underline">
                    Register one
                  </Link>
                </p>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
