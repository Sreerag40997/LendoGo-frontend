import React, { useState, useEffect } from 'react';
import './ConsultationModal.css';

const ConsultationModal = ({ isOpen, onClose }) => {
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      // Reset on close
      setTimeout(() => {
        setForm({ name: '', email: '', phone: '' });
        setErrors({});
        setSubmitted(false);
        setLoading(false);
      }, 300);
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) {
      e.name = 'Full name is required.';
    } else if (form.name.trim().length < 3) {
      e.name = 'Please enter your actual full name.';
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email.trim()) {
      e.email = 'Email address is required.';
    } else if (!emailRe.test(form.email)) {
      e.email = 'Enter a valid email format (e.g. name@domain.com).';
    }

    const phoneRe = /^[6-9]\d{9}$/;
    const sanitizedPhone = form.phone.replace(/[^0-9]/g, '');
    if (!form.phone.trim()) {
      e.phone = 'Phone number is required.';
    } else if (sanitizedPhone.length !== 10 || !phoneRe.test(sanitizedPhone)) {
      e.phone = 'Enter a valid 10-digit Indian mobile number.';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    const payload = {
      full_name: form.name.trim(),
      email: form.email.trim(),
      phone_number: form.phone.replace(/[^0-9]/g, '')
    };

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/consultation/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        const data = await response.json().catch(() => ({}));
        setErrors((prev) => ({
          ...prev,
          submit: data.error || "Failed to submit request. Please verify your details."
        }));
      }
    } catch (error) {
      console.error("Network error:", error);
      // Fallback: If local backend is down during testing, show a helpful validation error
      setErrors((prev) => ({
        ...prev,
        submit: "Failed to connect to the backend server."
      }));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`cm-overlay ${isOpen ? 'cm-overlay--visible' : ''}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Free Consultation"
    >
      <div className={`cm-modal ${isOpen ? 'cm-modal--visible' : ''}`}>
        {/* Close button */}
        <button className="cm-close" onClick={onClose} aria-label="Close modal">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {!submitted ? (
          <>
            {/* Header */}
            <div className="cm-header">
              <div className="cm-icon-wrap">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.46 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.37 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z" />
                </svg>
              </div>
              <h2 className="cm-title">Free Consultation</h2>
              <p className="cm-subtitle">Our loan experts will call you within 24 hours.</p>
            </div>

            {/* Error Banner */}
            {errors.submit && (
              <div className="cm-submit-error">
                ⚠️ {errors.submit}
              </div>
            )}

            {/* Form */}
            <form className="cm-form" onSubmit={handleSubmit} noValidate>
              {/* Full Name */}
              <div className="cm-field">
                <label className="cm-label" htmlFor="cm-name">Full Name</label>
                <div className={`cm-input-wrap ${errors.name ? 'cm-input-wrap--error' : ''}`}>
                  <svg className="cm-input-icon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <input
                    id="cm-name"
                    type="text"
                    className="cm-input"
                    placeholder="e.g. Rahul Sharma"
                    value={form.name}
                    onChange={handleChange('name')}
                    autoComplete="name"
                  />
                </div>
                {errors.name && <span className="cm-error">{errors.name}</span>}
              </div>

              {/* Email */}
              <div className="cm-field">
                <label className="cm-label" htmlFor="cm-email">Email Address</label>
                <div className={`cm-input-wrap ${errors.email ? 'cm-input-wrap--error' : ''}`}>
                  <svg className="cm-input-icon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <input
                    id="cm-email"
                    type="email"
                    className="cm-input"
                    placeholder="e.g. rahul@email.com"
                    value={form.email}
                    onChange={handleChange('email')}
                    autoComplete="email"
                  />
                </div>
                {errors.email && <span className="cm-error">{errors.email}</span>}
              </div>

              {/* Phone */}
              <div className="cm-field">
                <label className="cm-label" htmlFor="cm-phone">Phone Number</label>
                <div className={`cm-input-wrap ${errors.phone ? 'cm-input-wrap--error' : ''}`}>
                  <svg className="cm-input-icon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                    <line x1="12" y1="18" x2="12.01" y2="18" />
                  </svg>
                  <input
                    id="cm-phone"
                    type="tel"
                    className="cm-input"
                    placeholder="e.g. 9876543210"
                    value={form.phone}
                    onChange={handleChange('phone')}
                    autoComplete="tel"
                    maxLength={15}
                  />
                </div>
                {errors.phone && <span className="cm-error">{errors.phone}</span>}
              </div>

              <button
                type="submit"
                id="consultationSubmitBtn"
                className="cm-submit"
                disabled={loading}
              >
                {loading ? (
                  <><span className="cm-spinner" /> Submitting…</>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    Request Callback
                  </>
                )}
              </button>
            </form>

            <p className="cm-privacy">
              🔒 Your details are 100% secure and never shared.
            </p>
          </>
        ) : (
          /* Success State */
          <div className="cm-success">
            <div className="cm-success-icon">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="cm-success-title">You're all set!</h2>
            <p className="cm-success-msg">
              Thanks, <strong>{form.name.split(' ')[0]}</strong>! Our team will reach out to <strong>{form.email}</strong> or call you on <strong>{form.phone}</strong> shortly.
            </p>
            <button className="cm-submit" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsultationModal;
