import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SignInForm.css';

/* ─── Password requirements ─────────────────────────────────── */
const requirements = [
  { label: 'atleast 8 characters',                        test: (p) => p.length >= 8 },
  { label: 'atleast 1 number (eg. 1,2,3 etc)',            test: (p) => /[0-9]/.test(p) },
  { label: 'atleast 1 alphabet (eg. a,b,c etc)',          test: (p) => /[a-zA-Z]/.test(p) },
  { label: 'atleast 1 special character (eg. @,#,% etc)', test: (p) => /[^a-zA-Z0-9]/.test(p) },
];

/* ─── Helper Icons (Eye) ───────────────────── */
const EyeIcon = ({ visible }) => 
  visible ? (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );

const SignInForm = ({ onSignIn, loading, error }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  // Wrong password tracker state
  const [failedAttempts, setFailedAttempts] = useState(0);

  // Forgot password flow states
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Email, 2: OTP/Password, 3: Success
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmNewPw, setShowConfirmNewPw] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  // 👇 UPDATED: Now handles role-based routing 👇
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    try {
      const user = await onSignIn(email, password);
      
      if (user && user.role !== 'user') {
        navigate('/admin');
      } else {
        navigate('/home');
      }
    } catch (err) {
      setFailedAttempts((prev) => prev + 1);
      setLocalError(err.message || 'Invalid email or password.');
    }
  };

  const handleStartForgotPassword = () => {
    setIsForgotPassword(true);
    setForgotStep(1);
    setForgotEmail(email); // Autofill from the login email if typed
    setForgotError('');
    setForgotOtp('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const handleSendResetOtp = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotError('Please enter a valid email address.');
      return;
    }
    setForgotLoading(true);
    setForgotError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/auth/forgot-password/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const rawText = await response.text();
      let data = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        console.error("Non-JSON response from server:", rawText);
        setForgotError(`Server connection error (${response.status})`);
        setForgotLoading(false);
        return;
      }

      if (response.ok) {
        setForgotStep(2);
      } else {
        setForgotError(data.error || 'Failed to send OTP. Please check your email.');
      }
    } catch (err) {
      setForgotError('Could not reach the server. Please check if the backend is running.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setForgotError('');

    if (!forgotOtp.trim() || forgotOtp.length !== 6) {
      setForgotError('Please enter the 6-digit OTP sent to your email.');
      return;
    }

    const allMet = requirements.every((r) => r.test(newPassword));
    if (!allMet) {
      setForgotError('Password does not meet safety requirements.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setForgotError('Passwords do not match.');
      return;
    }

    setForgotLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/auth/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail,
          otp: forgotOtp,
          password: newPassword,
          confirmPassword: confirmNewPassword,
        }),
      });

      const rawText = await response.text();
      let data = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        console.error("Non-JSON response from server:", rawText);
        setForgotError(`Server connection error (${response.status})`);
        setForgotLoading(false);
        return;
      }

      if (response.ok) {
        setForgotStep(3);
        setFailedAttempts(0); // Reset attempts after successful password change!
      } else {
        setForgotError(data.error || 'Failed to reset password. Please check the OTP.');
      }
    } catch (err) {
      setForgotError('Could not reach the server. Please check if the backend is running.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setIsForgotPassword(false);
    setForgotError('');
    setLocalError('');
  };

  // Rendering standard login form
  if (!isForgotPassword) {
    return (
      <div className="signin-container">
        <div className="badge">
          <span className="badge-text">Instant Personal Loans Starting at Just 14%</span>
        </div>
        
        <h1 className="welcome-title">Welcome to LendoGO</h1>
        <p className="welcome-subtitle">Sign in to your account and manage your loans effortlessly.</p>
        
        <form className="signin-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <input 
              type="email" 
              placeholder="Enter your email address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input"
              autoComplete="email"
            />
          </div>
          
          <div className="input-group relative">
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Enter your password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input password-input"
              autoComplete="current-password"
            />
            <button 
              type="button" 
              className="eye-toggle-btn"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex="-1"
            >
              <EyeIcon visible={showPassword} />
            </button>
          </div>
          
          {/* Conditionally show small Forgot Password link right under the password input field when attempts >= 3 */}
          {failedAttempts >= 3 && (
            <div className="forgot-password-link-container">
              <button
                type="button"
                className="forgot-password-small-link"
                onClick={handleStartForgotPassword}
              >
                Forgot password?
              </button>
            </div>
          )}
          
          {localError && <div className="error-message">{localError}</div>}
          
          <button 
            type="submit" 
            className="btn-submit"
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        
        <div className="signup-link">
          <span>New to LendoGO? </span>
          <button
            type="button"
            className="create-account-btn"
            onClick={() => navigate('/signup')}
          >
            Create an account
          </button>
        </div>
      </div>
    );
  }

  // Rendering Forgot Password multi-step screens
  return (
    <div className="signin-container forgot-pwd-container animate-fade-in">
      {forgotStep === 1 && (
        <>
          <h1 className="welcome-title">Forgot Password</h1>
          <p className="welcome-subtitle">Enter your email and we'll send you a 6-digit OTP to reset your password.</p>
          
          <form className="signin-form" onSubmit={handleSendResetOtp}>
            <div className="input-group">
              <label className="spf-label">email address</label>
              <input 
                type="email" 
                placeholder="Enter your registered email id" 
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                className="form-input"
                autoComplete="email"
              />
            </div>
            
            {forgotError && <div className="error-message">{forgotError}</div>}
            
            <button 
              type="submit" 
              className="btn-submit"
              disabled={forgotLoading}
            >
              {forgotLoading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        </>
      )}

      {forgotStep === 2 && (
        <>
          <h1 className="welcome-title">Reset Password</h1>
          <p className="welcome-subtitle">Enter the OTP sent to {forgotEmail} and set a strong new password.</p>
          
          <form className="signin-form" onSubmit={handleResetPassword} noValidate>
            {/* OTP input field */}
            <div className="input-group">
              <label className="spf-label">6-digit OTP</label>
              <input 
                type="text" 
                placeholder="Enter 6-digit OTP" 
                value={forgotOtp}
                onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                required
                className="form-input otp-input"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
              />
            </div>

            {/* New Password input field */}
            <div className="input-group spf-group">
              <label className="spf-label">new password</label>
              <div className="spf-input-wrap">
                <input 
                  type={showNewPw ? "text" : "password"} 
                  placeholder="Enter secure new password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="form-input password-input"
                  autoComplete="new-password"
                />
                <button 
                  type="button" 
                  className="eye-toggle-btn spf-eye"
                  onClick={() => setShowNewPw(!showNewPw)}
                  tabIndex="-1"
                >
                  <EyeIcon visible={showNewPw} />
                </button>
              </div>
            </div>

            {/* Confirm New Password input field */}
            <div className="input-group spf-group">
              <label className="spf-label">confirm password</label>
              <div className="spf-input-wrap">
                <input 
                  type={showConfirmNewPw ? "text" : "password"} 
                  placeholder="Confirm new password" 
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                  className="form-input password-input"
                  autoComplete="new-password"
                />
                <button 
                  type="button" 
                  className="eye-toggle-btn spf-eye"
                  onClick={() => setShowConfirmNewPw(!showConfirmNewPw)}
                  tabIndex="-1"
                >
                  <EyeIcon visible={showConfirmNewPw} />
                </button>
              </div>
            </div>

            {/* Password Requirements List */}
            <div className="spf-requirements">
              <p className="spf-req-title">Password must contain:</p>
              <ul className="spf-req-list">
                {requirements.map((r, i) => {
                  const met = r.test(newPassword);
                  return (
                    <li key={i} className={`spf-req-item ${met ? 'met' : ''}`}>
                      <span className="spf-req-dot" />
                      <span>{r.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            
            {forgotError && <div className="error-message">{forgotError}</div>}
            
            <button 
              type="submit" 
              className="btn-submit"
              disabled={forgotLoading}
            >
              {forgotLoading ? 'Updating Password...' : 'Reset & Save Password'}
            </button>
          </form>
        </>
      )}

      {forgotStep === 3 && (
        <div className="reset-success-card">
          <div className="success-badge">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="success-check animate-scale-up">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 className="welcome-title text-center text-gradient-success">Success!</h2>
          <p className="welcome-subtitle text-center">Your password has been successfully updated in our database. You can now log in using your new credentials.</p>
          
          <button 
            type="button" 
            className="btn-submit"
            onClick={handleBackToLogin}
          >
            Back to Sign In
          </button>
        </div>
      )}

      {forgotStep !== 3 && (
        <button 
          type="button" 
          className="back-to-login-btn"
          onClick={handleBackToLogin}
        >
          ← Back to Sign In
        </button>
      )}
    </div>
  );
};

export default SignInForm;