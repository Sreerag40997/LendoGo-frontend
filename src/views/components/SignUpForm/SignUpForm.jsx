import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './SignUpForm.css';

/* ── Captcha helpers ─────────────────────────────────────── */
const CAPTCHA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const generateCaptcha = (length = 6) => {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
  }
  return result;
};

const CaptchaCanvas = ({ text }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#EEF2FF');
    bg.addColorStop(1, '#E0F2FE');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Noise lines
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = `hsla(${Math.random() * 360},60%,70%,0.5)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.random() * W, Math.random() * H);
      ctx.lineTo(Math.random() * W, Math.random() * H);
      ctx.stroke();
    }

    // Noise dots
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `hsla(${Math.random() * 360},50%,60%,0.4)`;
      ctx.beginPath();
      ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw each character with slight rotation / color variation
    const fonts = ['Georgia', 'Impact', 'Arial', 'Courier New'];
    const charW = W / text.length;
    text.split('').forEach((ch, idx) => {
      ctx.save();
      const x = charW * idx + charW / 2;
      const y = H / 2 + (Math.random() * 8 - 4);
      ctx.translate(x, y);
      ctx.rotate((Math.random() - 0.5) * 0.5);
      ctx.font = `bold ${18 + Math.random() * 8}px ${fonts[idx % fonts.length]}`;
      ctx.fillStyle = `hsl(${210 + Math.random() * 60},70%,30%)`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
  }, [text]);

  return <canvas ref={canvasRef} width={160} height={48} className="captcha-canvas" />;
};

/* ── Main Component ──────────────────────────────────────── */
const SignUpForm = () => {
  const navigate = useNavigate();

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail]       = useState('');
  const [captchaText, setCaptchaText]   = useState(() => generateCaptcha());
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaError, setCaptchaError] = useState('');

  // OTP phase
  const [otpSent, setOtpSent]     = useState(false);
  const [otpValue, setOtpValue]   = useState('');
  const [otpError, setOtpError]   = useState('');
  const [sending, setSending]     = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Field-level validation errors
  const [nameError,  setNameError]  = useState('');
  const [emailError, setEmailError] = useState('');

  const refreshCaptcha = () => {
    setCaptchaText(generateCaptcha());
    setCaptchaInput('');
    setCaptchaError('');
  };

  const validateFields = () => {
    let valid = true;
    if (!fullName.trim()) {
      setNameError('Full name is required.');
      valid = false;
    } else {
      setNameError('');
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRe.test(email)) {
      setEmailError('Please enter a valid email address.');
      valid = false;
    } else {
      setEmailError('');
    }
    if (captchaInput.trim().toLowerCase() !== captchaText.toLowerCase()) {
      setCaptchaError('Captcha does not match. Try again.');
      refreshCaptcha();
      valid = false;
    } else {
      setCaptchaError('');
    }
    return valid;
  };

  // const handleSendOtp = async (e) => {
  //   e.preventDefault();
  //   if (!validateFields()) return;
  //   setSending(true);
  //   // Backend will send OTP — we just trigger the UI state
  //   // TODO: replace with actual API call
  //   setTimeout(() => {
  //     setSending(false);
  //     setOtpSent(true);
  //   }, 900);
  // };
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!validateFields()) return;
    setSending(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/auth/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ fullName, email }),
      });

      // Safely read body as text first — server may return HTML/plain-text on errors
      const rawText = await response.text();
      let data = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        // Response was not JSON (e.g. Express "Cannot POST /...", Nginx 502, etc.)
        console.error("Non-JSON response from server:", rawText);
        setSending(false);
        setEmailError(
          response.status === 404
            ? "API route not found (404). Is the backend running and the route registered?"
            : `Server error ${response.status}: ${rawText.slice(0, 120)}`
        );
        return;
      }

      if (response.ok) {
        setSending(false);
        setOtpSent(true);
      } else {
        setSending(false);
        setEmailError(data.error || `Server error (${response.status})`);
      }
    } catch (err) {
      console.error("Network error:", err);
      setSending(false);
      setEmailError("Could not reach the server. Make sure your backend is running on port 8080.");
    }
  };

  // const handleVerifyOtp = async (e) => {
  //   e.preventDefault();
  //   if (!otpValue.trim() || otpValue.length < 4) {
  //     setOtpError('Please enter the OTP sent to your email.');
  //     return;
  //   }
  //   setOtpError('');
  //   setVerifying(true);
  //   // TODO: replace with actual API call to verify OTP
  //   setTimeout(() => {
  //     setVerifying(false);
  //     // Pass user info to password page via navigation state
  //     navigate('/signup/set-password', { state: { fullName, email } });
  //   }, 900);
  // };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();

    if (!otpValue.trim() || otpValue.length !== 6) {
      setOtpError('Please enter the 6-digit OTP sent to your email.');
      return;
    }

    setOtpError('');
    setVerifying(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/auth/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ email, otp: otpValue }),
      });

      // Safely parse — server may return plain text on failure
      const rawText = await response.text();
      let data = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        console.error("Non-JSON response from server:", rawText);
        setVerifying(false);
        setOtpError(
          response.status === 404
            ? "Verify route not found (404). Check backend route registration."
            : `Server error ${response.status}: ${rawText.slice(0, 120)}`
        );
        return;
      }

      if (response.ok) {
        setVerifying(false);
        navigate('/signup/set-password', {
          state: { fullName, email, tempToken: data.tempToken },
        });
      } else {
        setVerifying(false);
        setOtpError(data.error || `Invalid OTP (${response.status})`);
      }
    } catch (err) {
      console.error("Network error:", err);
      setVerifying(false);
      setOtpError("Could not reach the server. Make sure your backend is running on port 8080.");
    }
  };

  return (
    <div className="signup-form-container">
      <h1 className="signup-title">Register</h1>
      <div className="signup-title-underline" />

      <form
        className="signup-form"
        onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}
        noValidate
      >
        {/* ── Full Name ── */}
        <div className="su-input-group">
          <label className="su-label" htmlFor="suFullName">full name</label>
          <div className={`su-input-wrapper ${nameError ? 'has-error' : ''}`}>
            <input
              id="suFullName"
              type="text"
              className="su-input"
              placeholder="enter your full name"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setNameError(''); }}
              autoComplete="name"
              disabled={otpSent}
            />
          </div>
          {nameError && <span className="su-field-error">{nameError}</span>}
        </div>

        {/* ── Email ── */}
        <div className="su-input-group">
          <label className="su-label" htmlFor="suEmail">email address</label>
          <div className={`su-input-wrapper ${emailError ? 'has-error' : ''}`}>
            <input
              id="suEmail"
              type="email"
              className="su-input"
              placeholder="enter your email id"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
              autoComplete="email"
              disabled={otpSent}
            />
          </div>
          {emailError && <span className="su-field-error">{emailError}</span>}
        </div>

        {/* ── Captcha ── */}
        {!otpSent && (
          <div className="su-input-group">
            <label className="su-label" htmlFor="suCaptcha">captcha</label>
            <div className="su-captcha-row">
              <div className={`su-input-wrapper captcha-input-wrapper ${captchaError ? 'has-error' : ''}`}>
                <input
                  id="suCaptcha"
                  type="text"
                  className="su-input"
                  placeholder="enter captcha"
                  value={captchaInput}
                  onChange={(e) => { setCaptchaInput(e.target.value); setCaptchaError(''); }}
                  autoComplete="off"
                  maxLength={8}
                />
              </div>
              <div className="su-captcha-img-wrap" data-captcha={captchaText}>
                <CaptchaCanvas text={captchaText} />
                <button
                  type="button"
                  className="su-captcha-refresh"
                  onClick={refreshCaptcha}
                  aria-label="Refresh captcha"
                  title="Refresh captcha"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 4v6h6"/>
                    <path d="M23 20v-6h-6"/>
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                  </svg>
                </button>
              </div>
            </div>
            {captchaError && <span className="su-field-error">{captchaError}</span>}
          </div>
        )}

        {/* ── OTP Field (appears after Send OTP) ── */}
        {otpSent && (
          <div className="su-input-group su-otp-group">
            <label className="su-label" htmlFor="suOtp">
              enter otp
              <span className="su-otp-hint"> (sent to {email})</span>
            </label>
            <div className={`su-input-wrapper ${otpError ? 'has-error' : ''}`}>
              <input
                id="suOtp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="su-input su-otp-input"
                placeholder="enter OTP"
                value={otpValue}
                onChange={(e) => { setOtpValue(e.target.value.replace(/\D/g, '')); setOtpError(''); }}
                maxLength={8}
                autoFocus
              />
            </div>
            {otpError && <span className="su-field-error">{otpError}</span>}
            <button type="button" className="su-resend-link" onClick={() => { setOtpSent(false); setCaptchaInput(''); refreshCaptcha(); }}>
              resend OTP
            </button>
          </div>
        )}

        {/* ── CTA Button ── */}
        <button
          type="submit"
          id="signupSubmitBtn"
          className={`su-btn-submit ${otpSent ? 'verify-mode' : ''}`}
          disabled={sending || verifying}
        >
          {sending ? (
            <><span className="su-spinner" /> sending otp…</>
          ) : verifying ? (
            <><span className="su-spinner" /> verifying…</>
          ) : otpSent ? (
            <>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              verify &amp; continue
            </>
          ) : (
            <>
              send otp
            </>
          )}
        </button>
      </form>

      <div className="su-signin-link">
        already registered?{' '}
        <button type="button" className="su-signin-btn" onClick={() => navigate('/')}>
          login
        </button>
      </div>
    </div>
  );
};

export default SignUpForm;
