import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './SetPasswordForm.css';
import { useAuthController } from '../../../controllers/auth/useAuthController';

/* ─── Password requirements ─────────────────────────────────── */
const requirements = [
  { label: 'atleast 8 characters',                        test: (p) => p.length >= 8 },
  { label: 'atleast 1 number (eg. 1,2,3 etc)',            test: (p) => /[0-9]/.test(p) },
  { label: 'atleast 1 alphabet (eg. a,b,c etc)',          test: (p) => /[a-zA-Z]/.test(p) },
  { label: 'atleast 1 special character (eg. @,#,% etc)', test: (p) => /[^a-zA-Z0-9]/.test(p) },
];

/* ─── Helper Icons (Eye, Refresh, Shield) ───────────────────── */
const EyeIcon = ({ visible }) => 
  visible ? <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> : <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;

const RefreshIcon = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;

const ShieldIcon = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>;

/* ─── Component ──────────────────────────────────────────────── */
const SetPasswordForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginUserLocally } = useAuthController();
  const { fullName, email, tempToken } = location.state || {};

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestedPassword, setSuggestedPassword] = useState('');
  const [suggestionShown, setSuggestionShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const allMet = requirements.every((r) => r.test(password));

  const refreshSuggestion = useCallback(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$%&*!';
    let pw = '';
    for (let i = 0; i < 12; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
    setSuggestedPassword(pw);
    setCopied(false);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(suggestedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePasswordFocus = () => {
    if (!suggestionShown && password === '') {
      refreshSuggestion();
      setShowSuggestion(true);
      setSuggestionShown(true);
    }
  };

  const handleApplySuggestion = () => {
    setPassword(suggestedPassword);
    setConfirmPassword(suggestedPassword);
    setShowPw(true); setShowConfirm(true); setShowSuggestion(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!allMet) { setError('Password does not meet requirements.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (!agreeTerms) { setError('You must agree to our Privacy Policy and Terms & Conditions to continue.'); return; }

    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/auth/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 👇 FIX: Added confirmPassword to the payload
        body: JSON.stringify({ 
          fullName, 
          email, 
          password, 
          confirmPassword, 
          token: tempToken 
        }),
      });

      const data = await response.json();
      if (response.ok) {
        const backendUser = data.data || {};
        loginUserLocally({
          id: backendUser.id || 'unknown',
          email: backendUser.email || email,
          name: backendUser.fullName || fullName || 'LendoGO User',
          role: backendUser.role || 'user',
          token: data.token,
        });
        navigate('/home'); 
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="spf-container">
      <h2 className="spf-title">Set New Password</h2>
      <form className="spf-form" onSubmit={handleSubmit} noValidate>
        {/* New Password Group */}
        <div className="spf-group">
          <label className="spf-label" htmlFor="spfNewPw">new password</label>
          <div className="spf-input-wrap">
            <input id="spfNewPw" type={showPw ? 'text' : 'password'} className="spf-input" value={password} onChange={(e) => setPassword(e.target.value)} onFocus={handlePasswordFocus} />
            <button type="button" className="spf-eye-btn" onClick={() => setShowPw(!showPw)}><EyeIcon visible={showPw} /></button>

            {showSuggestion && (
              <div className="spf-suggestion-popup">
                <div className="spf-suggestion-header">
                  <div className="spf-suggestion-icon">
                    <ShieldIcon />
                  </div>
                  <div>
                    <h3 className="spf-suggestion-title">Use strong password?</h3>
                    <p className="spf-suggestion-subtitle">Highly secure & easy to autofill</p>
                  </div>
                </div>

                <div className="spf-suggestion-pw-row">
                  <span className="spf-suggestion-pw">{suggestedPassword}</span>
                  <div className="spf-suggestion-pw-actions">
                    <button type="button" className="spf-suggestion-copy" onClick={handleCopy} title="Copy suggested password">
                      {copied ? '✓' : '📋'}
                    </button>
                    <button type="button" className="spf-suggestion-refresh" onClick={refreshSuggestion} title="Generate new password">
                      <RefreshIcon />
                    </button>
                  </div>
                </div>

                <p className="spf-suggestion-note">
                  {copied ? 'Copied to clipboard!' : 'Meets all security requirements'}
                </p>

                <div className="spf-suggestion-btns">
                  <button type="button" className="spf-suggestion-btn-cancel" onClick={() => setShowSuggestion(false)}>
                    No, thanks
                  </button>
                  <button type="button" className="spf-suggestion-btn-apply" onClick={handleApplySuggestion}>
                    Use Suggested
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Confirm Password Group */}
        <div className="spf-group">
          <label className="spf-label" htmlFor="spfConfirmPw">confirm password</label>
          <div className="spf-input-wrap">
            <input id="spfConfirmPw" type={showConfirm ? 'text' : 'password'} className="spf-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            <button type="button" className="spf-eye-btn" onClick={() => setShowConfirm(!showConfirm)}><EyeIcon visible={showConfirm} /></button>
          </div>
        </div>

        {/* Password Requirements List */}
        <div className="spf-requirements">
          <p className="spf-req-title">Password must contain:</p>
          <ul className="spf-req-list">
            {requirements.map((r, i) => {
              const met = r.test(password);
              return (
                <li key={i} className={`spf-req-item ${met ? 'met' : ''}`}>
                  <span className="spf-req-dot" />
                  <span>{r.label}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* T&C agreement checkbox */}
        <div className="spf-agree-group">
          <label className="spf-agree-label">
            <input
              type="checkbox"
              className="spf-agree-checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
            />
            <span className="spf-agree-text">
              By continuing, you agree to our{' '}
              <a href="#" className="spf-link" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
              {' '}and{' '}
              <a href="#" className="spf-link" onClick={(e) => e.preventDefault()}>Terms &amp; Conditions</a>
            </span>
          </label>
        </div>

        {error && <div className="spf-error">{error}</div>}

        <button type="submit" className="spf-btn-proceed" disabled={loading}>
          {loading ? 'processing…' : 'proceed'}
        </button>
      </form>
    </div>
  );
};

export default SetPasswordForm;