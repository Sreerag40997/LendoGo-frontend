import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import './Navbar.css';
import ConsultationModal from '../ConsultationModal/ConsultationModal';
import TrustScoreView from './TrustScoreView';
import { useAuthController } from '../../../controllers/auth/useAuthController';
import { useWebConfig } from '../../../context/WebConfigContext';
import { apiClient } from '../../../utils/apiClient';

const getCleanDpUrl = (imgUrl) => {
  if (!imgUrl) return 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
  if (imgUrl.startsWith(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}http`)) {
    return imgUrl.replace(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}`, '');
  }
  if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
    return imgUrl;
  }
  return `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}${imgUrl}`;
};

// Global sliding profile sidebar React Portal component (Nested Sub-Views System)
const UserSidebar = ({ isOpen, onClose, user, signOut, navigate, initialView = 'menu', showToast }) => {
  // Navigation stack state ('menu', 'profile', 'trustScore', 'loan', 'repayment', 'feedback')
  const [currentView, setCurrentView] = useState(initialView);
  const [walletBalance, setWalletBalance] = useState(0);

  const getStoredScore = () => {
    if (!user || !user.email) return 736;
    const cached = localStorage.getItem(`trust_score_${user.email}`);
    if (cached) return parseInt(cached);
    let hash = 0;
    const email = user.email;
    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    const generated = 620 + Math.abs(hash % 240);
    localStorage.setItem(`trust_score_${user.email}`, generated.toString());
    return generated;
  };

  const fetchBalance = async () => {
    if (!user || !user.isAuthenticated) return;
    try {
      const res = await apiClient('/user/wallet/balance');
      if (res && res.success && res.data) {
        setWalletBalance(res.data.balance || 0);
      }
    } catch (err) {
      console.error("Failed to fetch user wallet balance:", err);
    }
  };

  useEffect(() => {
    if (isOpen && user && user.isAuthenticated) {
      fetchBalance();
    }
  }, [isOpen, user]);

  useEffect(() => {
    window.addEventListener('wallet-balance-changed', fetchBalance);
    return () => {
      window.removeEventListener('wallet-balance-changed', fetchBalance);
    };
  }, [user]);

  // Load profile photo state
  const [profilePhoto, setProfilePhoto] = useState(() => {
    return getCleanDpUrl(localStorage.getItem('user_dp'));
  });
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);

  const getFallbackName = () => {
    if (user && user.name && user.name !== 'LendoGO User') {
      return user.name;
    }
    if (user && user.email) {
      const namePart = user.email.split('@')[0];
      const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      const cleanName = capitalized.replace(/[0-9]/g, '');
      return cleanName || namePart;
    }
    return 'LendoGO Borrower';
  };

  // Load state from localStorage or default to empty
  const [fullName, setFullName] = useState(() => {
    return localStorage.getItem('user_full_name') || getFallbackName();
  });
  const [phone, setPhone] = useState(localStorage.getItem('user_phone') || '');
  const [dob, setDob] = useState(localStorage.getItem('user_dob') || '');
  const [pincode, setPincode] = useState(localStorage.getItem('user_pincode') || '');
  const [address, setAddress] = useState(localStorage.getItem('user_address') || '');

  const fetchUserProfile = async () => {
    if (!user || !user.isAuthenticated) return;
    try {
      const res = await apiClient('/user/profile');
      if (res && res.success && res.data) {
        const p = res.data;
        const nameVal = p.full_name || getFallbackName();
        const phoneVal = p.phone_number || '';
        const dobVal = p.date_of_birth || '';
        const pincodeVal = p.pincode || '';
        const addressVal = p.address || '';
        const profileImgUrl = getCleanDpUrl(p.profile_image);

        setFullName(nameVal);
        setPhone(phoneVal);
        setDob(dobVal);
        setPincode(pincodeVal);
        setAddress(addressVal);
        setProfilePhoto(profileImgUrl);

        // Sync to localStorage
        localStorage.setItem('user_full_name', nameVal);
        localStorage.setItem('user_phone', phoneVal);
        localStorage.setItem('user_dob', dobVal);
        localStorage.setItem('user_pincode', pincodeVal);
        localStorage.setItem('user_address', addressVal);
        localStorage.setItem('user_dp', profileImgUrl);

        window.dispatchEvent(new Event('user-dp-changed'));
        window.dispatchEvent(new Event('user-details-changed'));
      }
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
    }
  };

  useEffect(() => {
    if (isOpen && user && user.isAuthenticated) {
      fetchUserProfile();
    }
  }, [isOpen, user]);

  const wasOpenRef = useRef(false);
  const prevInitialViewRef = useRef(initialView);

  useEffect(() => {
    if ((isOpen && !wasOpenRef.current) || (isOpen && initialView !== prevInitialViewRef.current)) {
      setCurrentView(initialView);
    }
    wasOpenRef.current = isOpen;
    prevInitialViewRef.current = initialView;
  }, [isOpen, initialView]);

  const [panNumber, setPanNumber] = useState(localStorage.getItem('kyc_pan_number') || '');
  const [aadhaarNumber, setAadhaarNumber] = useState(localStorage.getItem('kyc_aadhaar_number') || '');
  const [fatherName, setFatherName] = useState(localStorage.getItem('kyc_father_name') || '');
  const [employmentType, setEmploymentType] = useState(localStorage.getItem('kyc_employment') || 'Salaried');
  const [monthlyIncome, setMonthlyIncome] = useState(localStorage.getItem('kyc_income') || '');
  const [kycAddress, setKycAddress] = useState(localStorage.getItem('kyc_verified_address') || '');

  const [aadharFrontName, setAadharFrontName] = useState(localStorage.getItem('kyc_aadhar_front') || 'No file uploaded');
  const [aadharBackName, setAadharBackName] = useState(localStorage.getItem('kyc_aadhar_back') || 'No file uploaded');
  const [panFileName, setPanFileName] = useState(localStorage.getItem('kyc_pan_file') || 'No file uploaded');

  // Feedback form states
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [language, setLanguage] = useState('English');

  // Collapsible states inside repayment schedules view
  const [expandedRepaymentInstallment, setExpandedRepaymentInstallment] = useState(1);

  // Applied Loan History State
  // (Note: Updated directly via fetchLoans from backend)

  // Bank Accounts Coordinates State
  const [bankAccounts, setBankAccounts] = useState([
    { id: 1, bankName: 'State Bank of India', accNum: '•••• •••• 4099', ifsc: 'SBIN0001234', isPrimary: true },
    { id: 2, bankName: 'HDFC Bank Ltd', accNum: '•••• •••• 8812', ifsc: 'HDFC0000124', isPrimary: false }
  ]);

  // Link New Bank Form State
  const [showAddBank, setShowAddBank] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newAccNum, setNewAccNum] = useState('');
  const [newIfsc, setNewIfsc] = useState('');

  // Handle Linked Account addition
  const handleAddBankAccount = (e) => {
    e.preventDefault();
    if (!newBankName || !newAccNum || !newIfsc) {
      showToast('Please fill out all bank credentials.', 'error');
      return;
    }
    const maskedAcc = '•••• •••• ' + newAccNum.slice(-4);
    const newBank = {
      id: Date.now(),
      bankName: newBankName,
      accNum: maskedAcc,
      ifsc: newIfsc.toUpperCase(),
      isPrimary: bankAccounts.length === 0
    };
    setBankAccounts([...bankAccounts, newBank]);
    setNewBankName('');
    setNewAccNum('');
    setNewIfsc('');
    setShowAddBank(false);
    showToast('Bank account successfully verified and linked to LendoGo Wallet!', 'success');
  };

  // Set Bank Account as primary
  const handleSetPrimaryBank = (id) => {
    setBankAccounts(prev => prev.map(bank => ({
      ...bank,
      isPrimary: bank.id === id
    })));
  };

  // Remove Bank Account
  const handleRemoveBank = (id) => {
    if (confirm('Are you sure you want to unlink this bank account from LendoGo?')) {
      const bank = bankAccounts.find(b => b.id === id);
      if (bank && bank.isPrimary && bankAccounts.length > 1) {
        showToast('Please select another primary bank before unlinking this one.', 'error');
        return;
      }
      setBankAccounts(prev => prev.filter(b => b.id !== id));
    }
  };

  // Sync state reactively if changes happen elsewhere
  useEffect(() => {
    if (!isOpen) return;
    const syncState = () => {
      setFullName(localStorage.getItem('user_full_name') || getFallbackName());
      setPhone(localStorage.getItem('user_phone') || '');
      setDob(localStorage.getItem('user_dob') || '');
      setPincode(localStorage.getItem('user_pincode') || '');
      setAddress(localStorage.getItem('user_address') || '');
      setPanNumber(localStorage.getItem('kyc_pan_number') || '');
      setAadhaarNumber(localStorage.getItem('kyc_aadhaar_number') || '');
      setFatherName(localStorage.getItem('kyc_father_name') || '');
      setEmploymentType(localStorage.getItem('kyc_employment') || 'Salaried');
      setMonthlyIncome(localStorage.getItem('kyc_income') || '');
      setKycAddress(localStorage.getItem('kyc_verified_address') || '');
      setAadharFrontName(localStorage.getItem('kyc_aadhar_front') || 'No file uploaded');
      setAadharBackName(localStorage.getItem('kyc_aadhar_back') || 'No file uploaded');
      setPanFileName(localStorage.getItem('kyc_pan_file') || 'No file uploaded');
      setProfilePhoto(localStorage.getItem('user_dp') || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png');
    };
    window.addEventListener('user-details-changed', syncState);
    window.addEventListener('user-dp-changed', syncState);
    return () => {
      window.removeEventListener('user-details-changed', syncState);
      window.removeEventListener('user-dp-changed', syncState);
    };
  }, [isOpen]);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhoto(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    const defaultNoDp = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
    setProfilePhoto(defaultNoDp);
    setSelectedPhotoFile(null);
    localStorage.removeItem('user_dp');
    window.dispatchEvent(new Event('user-dp-changed'));
  };

  const handleSavePersonal = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('full_name', fullName);
      formData.append('phone_number', phone);
      formData.append('date_of_birth', dob);
      formData.append('pincode', pincode);
      formData.append('address', address);
      if (selectedPhotoFile) {
        formData.append('profile_image', selectedPhotoFile);
      }

      await apiClient('/user/profile', {
        method: 'PUT',
        body: formData,
      });

      localStorage.setItem('user_full_name', fullName);
      localStorage.setItem('user_phone', phone);
      localStorage.setItem('user_dob', dob);
      localStorage.setItem('user_pincode', pincode);
      localStorage.setItem('user_address', address);

      const res = await apiClient('/user/profile');
      if (res && res.success && res.data) {
        const p = res.data;
        const profileImgUrl = getCleanDpUrl(p.profile_image);
        setProfilePhoto(profileImgUrl);
        localStorage.setItem('user_dp', profileImgUrl);
        window.dispatchEvent(new Event('user-dp-changed'));
      }

      window.dispatchEvent(new Event('user-details-changed'));
      setSelectedPhotoFile(null);
      setCurrentView('menu');
      showToast('Profile details updated successfully.', 'success');
    } catch (err) {
      console.error("Failed to save personal details:", err);
      showToast("Failed to save personal details: " + err.message, "error");
    }
  };

  const handleSaveKyc = (e) => {
    e.preventDefault();
    if (panNumber.length < 10 || aadhaarNumber.replace(/\s/g, '').length < 12) {
      showToast('Invalid PAN or Aadhaar format.', 'error');
      return;
    }
    localStorage.setItem('kyc_status', 'VERIFIED');
    localStorage.setItem('kyc_pan_number', panNumber.toUpperCase());
    localStorage.setItem('kyc_aadhaar_number', aadhaarNumber);
    localStorage.setItem('kyc_father_name', fatherName);
    localStorage.setItem('kyc_employment', employmentType);
    localStorage.setItem('kyc_income', monthlyIncome);
    localStorage.setItem('kyc_verified_address', kycAddress);
    window.dispatchEvent(new Event('user-details-changed'));
    showToast('KYC documents submitted and verified.', 'success');
    setCurrentView('menu');
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    try {
      await apiClient('/feedback', {
        method: 'POST',
        body: JSON.stringify({
          rating: feedbackRating, // Backend expects integer 1-5
          comment: feedbackComment
        })
      });
      
      showToast(`Thank you for your feedback! Rating: ${feedbackRating}/5 stars. Comments submitted.`, 'success');
      setFeedbackComment('');
      setCurrentView('menu');
    } catch (err) {
      console.error("Failed to submit feedback:", err);
      showToast('Failed to submit feedback. Please try again.', 'error');
    }
  };

  // Active Loan parameters state
  const [activeLoan, setActiveLoan] = useState(null);

  // Repayments schedule with Principal / Interest breakdowns state
  const [repaymentSchedule, setRepaymentSchedule] = useState([]);
  
  // Loan history state
  const [loanHistory, setLoanHistory] = useState([]);

  // Payment Selection Form states
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [paymentType, setPaymentType] = useState('due'); // 'due', 'entire', 'custom'
  const [customAmountText, setCustomAmountText] = useState('');
  const [paymentError, setPaymentError] = useState('');

  // Fetch loans from backend
  const fetchLoans = async () => {
    if (!user || !user.isAuthenticated) return;
    try {
      const res = await apiClient('/loans/my-loans');
      if (res && res.loans) {
        const history = res.loans.map(l => ({
          id: l.id,
          referenceNumber: l.reference_number,
          type: l.product_category || l.loan_track,
          amount: l.principal_amount,
          status: l.status,
          date: l.created_at ? new Date(l.created_at).toLocaleDateString('en-IN') : '',
          amountApplied: l.principal_amount,
          amountDistributed: l.principal_amount,
          dateApplied: l.created_at ? new Date(l.created_at).toLocaleDateString('en-IN') : '',
          dateDistributed: l.created_at ? new Date(l.created_at).toLocaleDateString('en-IN') : '',
          dailyInterestRate: (l.interest_rate ? (l.interest_rate / 365).toFixed(3) : '0.038') + '%',
          numberOfEmis: l.tenure_months,
          emiFrequency: 'Monthly',
          nextEmiAmount: l.estimated_emi,
          remainingBalance: l.estimated_emi * l.tenure_months // simple approx for now
        }));
        
        setLoanHistory(history);

        const active = history.find(l => ['ACTIVE', 'APPROVED', 'DISBURSED', 'UNDER_REVIEW'].includes(l.status));
        setActiveLoan(active || null);

        if (active) {
          const repRes = await apiClient(`/loans/${active.id}/repayments`);
          if (repRes && repRes.repayments && repRes.repayments.length > 0) {
            const schedule = repRes.repayments.map(r => ({
              installment: r.InstallmentNo,
              date: new Date(r.DueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
              amount: r.EMI,
              principal: r.PrincipalPart,
              interest: r.InterestPart,
              status: r.Status === 'PENDING' ? 'Upcoming' : r.Status,
              paidAmount: r.Status === 'PAID' ? r.EMI : 0
            }));
            
            const firstUpcoming = schedule.find(s => s.status === 'Upcoming');
            if (firstUpcoming) firstUpcoming.status = 'Next Due';
            
            if (active && schedule.length > 0) {
                const nextUnpaid = schedule.find(s => s.status !== 'PAID' && s.status !== 'Paid');
                if (nextUnpaid) {
                    active.nextEmiAmount = nextUnpaid.amount;
                    active.nextEmiDueDate = nextUnpaid.date;
                }
            }
            
            setRepaymentSchedule(schedule);
          } else {
            // Fallback: Dynamically project the schedule if not yet generated in backend
            const schedule = [];
            const principal = active.amountApplied || 0;
            const tenure = active.numberOfEmis || 0;
            const rateStr = active.dailyInterestRate ? active.dailyInterestRate.replace('%', '') : '0.038';
            const rate = parseFloat(rateStr) * 365;
            
            if (principal > 0 && tenure > 0) {
              const monthlyRate = (rate / 100) / 12;
              const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / (Math.pow(1 + monthlyRate, tenure) - 1);
              let currentPrincipal = principal;
              
              for (let i = 1; i <= tenure; i++) {
                const interestForMonth = currentPrincipal * monthlyRate;
                const principalForMonth = emi - interestForMonth;
                const dueDate = new Date();
                dueDate.setMonth(dueDate.getMonth() + i);
                
                schedule.push({
                  installment: i,
                  date: dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                  amount: Math.round(emi * 100) / 100,
                  principal: Math.round(principalForMonth * 100) / 100,
                  interest: Math.round(interestForMonth * 100) / 100,
                  status: i === 1 ? 'Next Due' : 'Upcoming',
                  paidAmount: 0
                });
                currentPrincipal -= principalForMonth;
              }
            }
            
            if (active && schedule.length > 0) {
                active.nextEmiAmount = schedule[0].amount;
                active.nextEmiDueDate = schedule[0].date;
            }
            setRepaymentSchedule(schedule);
          }
        } else {
          setRepaymentSchedule([]);
        }
      } else {
        setLoanHistory([]);
        setActiveLoan(null);
        setRepaymentSchedule([]);
      }
    } catch (err) {
      console.error("Failed to fetch loans:", err);
    }
  };

  // Synchronize state dynamically when loan state changes
  useEffect(() => {
    fetchLoans();
    window.addEventListener('loan-state-changed', fetchLoans);
    return () => window.removeEventListener('loan-state-changed', fetchLoans);
  }, [user, isOpen]);

  const handleRepaySubmit = async () => {
    let amountPaid = 0;
    const remainingToPay = repaymentSchedule.reduce((acc, emi) => emi.status !== 'Paid' ? acc + (emi.amount - (emi.paidAmount || 0)) : acc, 0);

    if (paymentType === 'due') {
      amountPaid = activeLoan.nextEmiAmount;
    } else if (paymentType === 'entire') {
      amountPaid = remainingToPay;
    } else if (paymentType === 'custom') {
      const parsed = parseFloat(customAmountText);
      if (isNaN(parsed) || parsed < 100) {
        setPaymentError('Please enter a valid amount of at least ₹100.');
        return;
      }
      if (parsed > remainingToPay) {
        setPaymentError(`Amount cannot exceed the remaining loan balance of ₹${remainingToPay.toLocaleString('en-IN')}.`);
        return;
      }
      amountPaid = parsed;
    }

    setPaymentError('');
    try {
      // 1. Create Razorpay order on Go backend
      const orderData = await apiClient('/payments/order', {
        method: 'POST',
        body: JSON.stringify({
          amount: amountPaid,
          loan_id: activeLoan.id
        })
      });

      if (!orderData || !orderData.order_id) {
        throw new Error("Failed to create Razorpay repayment order.");
      }

      // 2. Open Razorpay Checkout modal
      const options = {
        key: "rzp_test_SvWORMMdaUGuZO", // Public Key ID from backend/admin config
        amount: Math.round(orderData.amount * 100), // Amount in Paise
        currency: orderData.currency || "INR",
        name: "LendoGo Loan Repayment",
        description: `Repayment for Loan: ${activeLoan.referenceNumber || activeLoan.id}`,
        order_id: orderData.order_id,
        prefill: {
          name: fullName || user?.name || "",
          email: user?.email || "",
          contact: phone || ""
        },
        theme: {
          color: "#0f172a"
        },
        handler: async function (response) {
          try {
            // 3. Verify Payment Signature with backend
            const verifyRes = await apiClient('/payments/verify', {
              method: 'POST',
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                loan_id: activeLoan.id,
                amount_paid: amountPaid
              })
            });

            if (verifyRes && verifyRes.status === "success") {
              // Let the backend refetch handle the state update!

              if (amountPaid >= remainingToPay) {
                const emailKey = user?.email || 'user';
                const currentScore = parseInt(localStorage.getItem(`trust_score_${emailKey}`)) || 736;
                const newScore = Math.min(850, currentScore + 85);
                localStorage.setItem(`trust_score_${emailKey}`, newScore.toString());
                
                showToast(`Congratulations! Loan fully paid. Trust score updated to ${newScore}!`, 'success');
              } else {
                showToast(`Repayment of ₹${amountPaid.toLocaleString('en-IN')} successful!`, 'success');
              }

              window.dispatchEvent(new Event('loan-state-changed'));
              window.dispatchEvent(new Event('user-details-changed'));

              setShowPaymentOptions(false);
              setPaymentType('due');
              setCustomAmountText('');
              setPaymentError('');
            } else {
              throw new Error("Verification failed on the server.");
            }
          } catch (verifyErr) {
            console.error("Verification error:", verifyErr);
            showToast("Payment verification failed! " + verifyErr.message, "error");
          }
        },
        modal: {
          ondismiss: function () {
            showToast("Payment cancelled by user.", "info");
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (err) {
      console.error("Razorpay initiation error:", err);
      setPaymentError(err.message || "Something went wrong. Please try again.");
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="navbar-sidebar-wrapper">
      <div className="navbar-sidebar-backdrop" onClick={onClose} />
      <div className="navbar-sidebar-drawer animate-slide-in">
        
        {/* VIEW: MAIN NAVIGATION MENU */}
        {currentView === 'menu' && (
          <>
            <div className="sidebar-header main-menu-header">
              <div className="sidebar-user-card-header">
                <div className="sidebar-avatar-circle">
                  <img src={profilePhoto} alt="User Avatar" />
                </div>
                <div className="sidebar-meta-text">
                  <h4 className="sidebar-username">{fullName || getFallbackName()}</h4>
                </div>
              </div>
              <button type="button" className="sidebar-close-btn" onClick={onClose} aria-label="Close Profile Portal">×</button>
            </div>

            {/* High-fidelity Wallet Card Highlight */}
            <div className="sidebar-wallet-highlight-card">
              <div className="wallet-card-overlay-glow" />
              <div className="wallet-card-left-section">
                <span className="wallet-card-label">LendoGo Wallet Balance</span>
                <span className="wallet-card-amount">₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="wallet-card-right-section">
                <span className="wallet-active-pulse-dot"></span>
                <span className="wallet-active-status-text">ACTIVE LIMIT</span>
              </div>
            </div>

            <div className="sidebar-scroll-content">
              <div className="sidebar-navigation-menu-list">
                
                <div className="sidebar-menu-card-item" onClick={() => setCurrentView('profile')}>
                  <div className="sidebar-menu-left-details">
                    <span className="sidebar-menu-title">Profile</span>
                    <span className="sidebar-menu-subtitle">Edit your personal information</span>
                  </div>
                  <span className="sidebar-arrow-chevron">&gt;</span>
                </div>

                <div className="sidebar-menu-card-item" onClick={() => setCurrentView('trustScore')}>
                  <div className="sidebar-menu-left-details">
                    <span className="sidebar-menu-title">Internal Trust Score</span>
                    <span className="sidebar-menu-subtitle">Real-time internal credit score assessment</span>
                  </div>
                  <span className="sidebar-arrow-chevron">&gt;</span>
                </div>

                <div className="sidebar-menu-card-item" onClick={() => showToast('CIBIL Score Checker feature is coming soon!', 'info')}>
                  <div className="sidebar-menu-left-details">
                    <span className="sidebar-menu-title">Check CIBIL Score</span>
                    <span className="sidebar-menu-subtitle">Verify external credit report score details</span>
                  </div>
                  <span className="sidebar-arrow-chevron">&gt;</span>
                </div>

                <div className="sidebar-menu-card-item" onClick={() => showToast('Auto Pay feature is coming soon!', 'info')}>
                  <div className="sidebar-menu-left-details">
                    <span className="sidebar-menu-title">Auto Pay</span>
                    <span className="sidebar-menu-subtitle">Setup automatic monthly EMI deductions</span>
                  </div>
                  <span className="sidebar-arrow-chevron">&gt;</span>
                </div>

                <div className="sidebar-menu-card-item" onClick={() => setCurrentView('repayment')}>
                  <div className="sidebar-menu-left-details">
                    <span className="sidebar-menu-title">Repay</span>
                    <span className="sidebar-menu-subtitle">View repayment schedules and EMI dates</span>
                  </div>
                  <span className="sidebar-arrow-chevron">&gt;</span>
                </div>

                <div className="sidebar-menu-card-item" onClick={() => setCurrentView('loan')}>
                  <div className="sidebar-menu-left-details">
                    <span className="sidebar-menu-title">Loan History</span>
                    <span className="sidebar-menu-subtitle">View active/applied loans</span>
                  </div>
                  <span className="sidebar-arrow-chevron">&gt;</span>
                </div>

                <div className="sidebar-menu-card-item" onClick={() => setCurrentView('feedback')}>
                  <div className="sidebar-menu-left-details">
                    <span className="sidebar-menu-title">Feedback & App Settings</span>
                    <span className="sidebar-menu-subtitle">Help, push alerts, and submit evaluations</span>
                  </div>
                  <span className="sidebar-arrow-chevron">&gt;</span>
                </div>

              </div>

              {/* Secure exit at the bottom of the main menu */}
              <div className="sidebar-exit-section mt-3">
                <button 
                  type="button" 
                  className="sidebar-logout-btn-unified" 
                  onClick={() => {
                    signOut();
                    onClose();
                    navigate('/');
                  }}
                >
                  Sign Out
                </button>
              </div>
            </div>
          </>
        )}

        {/* VIEW: PERSONAL PROFILE SUB-SCREEN */}
        {currentView === 'profile' && (
          <>
            <div className="sidebar-header subview-header-row">
              <button type="button" className="sidebar-back-nav-btn" onClick={() => setCurrentView('menu')}>← Back</button>
              <h4 className="sidebar-subpage-title-text">Profile Details</h4>
              <div style={{ width: '40px' }} />
            </div>

            <div className="sidebar-scroll-content">
              {/* Profile Photo Upload */}
              <div className="sidebar-photo-container">
                <img src={profilePhoto} alt="Sidebar Profile" className="sidebar-profile-img" />
                <div className="sidebar-photo-actions">
                  <label className="sidebar-photo-btn upload">
                    Upload Photo
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handlePhotoUpload} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                  {profilePhoto !== 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png' && (
                    <button type="button" className="sidebar-photo-btn delete" onClick={handleRemovePhoto}>
                      Delete
                    </button>
                  )}
                </div>
              </div>

              <form onSubmit={handleSavePersonal} className="sidebar-form">
                <div className="sidebar-input-group">
                  <label>Full Legal Name</label>
                  <input 
                    type="text" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter legal name"
                    className="sidebar-input-field"
                    required
                  />
                </div>
                <div className="sidebar-input-group">
                  <label>Phone Coordinate</label>
                  <input 
                    type="text" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter phone number"
                    className="sidebar-input-field"
                    required
                  />
                </div>
                <div className="sidebar-input-group">
                  <label>Date of Birth</label>
                  <input 
                    type="date" 
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="sidebar-input-field"
                    required
                  />
                </div>
                <div className="sidebar-input-group">
                  <label>Postal Pincode</label>
                  <input 
                    type="text" 
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="Enter 6-digit pincode"
                    className="sidebar-input-field"
                    maxLength={6}
                    required
                  />
                </div>
                <div className="sidebar-input-group">
                  <label>Residential Address</label>
                  <textarea 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter residential address"
                    className="sidebar-textarea-field"
                    required
                  />
                </div>
                <button type="submit" className="sidebar-submit-btn-unified">Save Account Details</button>
              </form>
            </div>
          </>
        )}

        {/* VIEW: TRUST SCORE ASSESSMENT SUB-SCREEN */}
        {currentView === 'trustScore' && (
          <>
            <div className="sidebar-header subview-header-row">
              <button type="button" className="sidebar-back-nav-btn" onClick={() => setCurrentView('menu')}>← Back</button>
              <h4 className="sidebar-subpage-title-text">Trust Score Assessment</h4>
              <div style={{ width: '40px' }} />
            </div>

            <div className="sidebar-scroll-content">
              <TrustScoreView user={user} showToast={showToast} />
            </div>
          </>
        )}

        {/* VIEW: REPAY */}
        {currentView === 'repayment' && (
          <>
            <div className="sidebar-header subview-header-row">
              <button type="button" className="sidebar-back-nav-btn" onClick={() => setCurrentView('menu')}>← Back</button>
              <h4 className="sidebar-subpage-title-text">Repayment Schedule</h4>
              <div style={{ width: '40px' }} />
            </div>

            <div className="sidebar-scroll-content">
              {activeLoan && ['ACTIVE', 'DISBURSED'].includes(activeLoan.status) ? (
                <>
                  {/* Top next due card matching third image */}
                  <div className="sidebar-repayment-quick-summary-card">
                    <div className="summary-col">
                      <span className="summary-lbl">Next EMI</span>
                      <span className="summary-val">₹{activeLoan.nextEmiAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="summary-col">
                      <span className="summary-lbl">Due On</span>
                      <span className="summary-val">{activeLoan.nextEmiDueDate}</span>
                    </div>
                  </div>

                  <div className="repayment-table-header">
                    <span className="repayment-th-left">EMI Date</span>
                    <span className="repayment-th-right">Amount</span>
                  </div>

                  {/* Installment dates cards list matching third image exactly */}
                  <div className="sidebar-repayment-list-stack">
                    {repaymentSchedule.map((emi) => {
                      const isExpanded = expandedRepaymentInstallment === emi.installment;
                      const hasPaidPart = emi.paidAmount && emi.paidAmount > 0 && emi.paidAmount < emi.amount;
                      return (
                        <div key={emi.installment} className="sidebar-repayment-card-row">
                          <div 
                            className="repayment-card-row-header"
                            onClick={() => setExpandedRepaymentInstallment(isExpanded ? null : emi.installment)}
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                          >
                            <div className="repayment-row-left-group">
                              <span className="repayment-emi-date-lbl">{emi.date}</span>
                              {emi.status === 'Paid' && (
                                <span className="repayment-status-paid-icon">✓</span>
                              )}
                              {emi.status === 'Next Due' && !hasPaidPart && (
                                <span className="repayment-status-badge next-due">Next Due</span>
                              )}
                              {emi.status === 'Next Due' && hasPaidPart && (
                                <span className="repayment-status-badge next-due partial">Partially Paid</span>
                              )}
                            </div>
                            <div className="repayment-row-right-group">
                              <span className="repayment-amount-val">
                                {emi.status === 'Paid' 
                                  ? 'Paid' 
                                  : hasPaidPart 
                                    ? `₹${(emi.amount - emi.paidAmount).toLocaleString('en-IN')} left` 
                                    : `₹${emi.amount.toLocaleString('en-IN')}`}
                              </span>
                              <span className="repayment-arrow-static-indicator" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                                <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M1 1.5L6 6.5L11 1.5" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </span>
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <div className="repayment-card-row-body-details" style={{ padding: '0.5rem 1.25rem 1rem', borderTop: '1px solid #f1f5f9', backgroundColor: '#fafaf9' }}>
                              <div className="repayment-breakdown-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                <span className="breakdown-lbl" style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Principal</span>
                                <span className="breakdown-val" style={{ fontSize: '0.75rem', color: '#0f172a', fontWeight: 700 }}>₹{emi.principal.toLocaleString('en-IN')}</span>
                              </div>
                              <div className="repayment-breakdown-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                <span className="breakdown-lbl" style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Interest + Fees</span>
                                <span className="breakdown-val" style={{ fontSize: '0.75rem', color: '#0f172a', fontWeight: 700 }}>₹{emi.interest.toLocaleString('en-IN')}</span>
                              </div>
                              {emi.paidAmount > 0 && (
                                <div className="repayment-breakdown-row partial-payment-breakdown" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', paddingTop: '0.25rem', borderTop: '1px dashed #cbd5e1' }}>
                                  <span className="breakdown-lbl" style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 800 }}>Paid Portion</span>
                                  <span className="breakdown-val highlight-green" style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 800 }}>₹{emi.paidAmount.toLocaleString('en-IN')}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Make a Repayment button or options selection panel */}
                  <div className="repayment-action-section mt-3" style={{position: 'sticky', bottom: '0', backgroundColor: '#fff', paddingTop: '10px', paddingBottom: '10px', zIndex: 10, borderTop: '1px solid #e2e8f0', margin: '0 -1.5rem', paddingLeft: '1.5rem', paddingRight: '1.5rem'}}>
                    {!showPaymentOptions ? (
                      <button 
                        type="button" 
                        className="sidebar-pay-now-btn"
                        onClick={() => {
                          setShowPaymentOptions(true);
                          setPaymentError('');
                        }}
                      >
                        Make a Repayment
                      </button>
                    ) : (
                      <div className="repayment-options-panel animate-slide-in">
                        <h5 className="repayment-panel-title">Select Repayment Amount</h5>
                        
                        <div className="repayment-option-cards">
                          {/* Card 1: Next Due */}
                          <div 
                            className={`repayment-option-card ${paymentType === 'due' ? 'selected' : ''}`}
                            onClick={() => { setPaymentType('due'); setPaymentError(''); }}
                          >
                            <div className="option-card-radio">
                              <span className="radio-dot"></span>
                            </div>
                            <div className="option-card-content">
                              <span className="option-card-label">Next EMI Due</span>
                              <span className="option-card-amount">₹{activeLoan.nextEmiAmount ? activeLoan.nextEmiAmount.toLocaleString('en-IN') : 0}</span>
                              <span className="option-card-sub">Due on {activeLoan.nextEmiDueDate}</span>
                            </div>
                          </div>

                          {/* Card 2: Entire Loan Balance */}
                          <div 
                            className={`repayment-option-card ${paymentType === 'entire' ? 'selected' : ''}`}
                            onClick={() => { setPaymentType('entire'); setPaymentError(''); }}
                          >
                            <div className="option-card-radio">
                              <span className="radio-dot"></span>
                            </div>
                            <div className="option-card-content">
                              <span className="option-card-label">Pay Entire Loan</span>
                              <span className="option-card-amount">
                                ₹{(repaymentSchedule.reduce((acc, emi) => (emi.status !== 'Paid' && emi.status !== 'PAID') ? acc + (emi.amount - (emi.paidAmount || 0)) : acc, 0)).toLocaleString('en-IN')}
                              </span>
                              <span className="option-card-sub">Close loan entirely & boost Trust Score</span>
                            </div>
                          </div>

                          {/* Card 3: Custom Amount */}
                          <div 
                            className={`repayment-option-card ${paymentType === 'custom' ? 'selected' : ''}`}
                            onClick={() => { setPaymentType('custom'); setPaymentError(''); }}
                          >
                            <div className="option-card-radio">
                              <span className="radio-dot"></span>
                            </div>
                            <div className="option-card-content">
                              <span className="option-card-label">Custom Amount</span>
                              <span className="option-card-sub">Pay any partial or principal amount</span>
                            </div>
                          </div>
                        </div>

                        {paymentType === 'custom' && (
                          <div className="custom-amount-input-wrapper mt-2">
                            <label className="custom-amount-label">ENTER AMOUNT (MIN ₹100)</label>
                            <div className="custom-amount-input-box">
                              <span className="currency-symbol">₹</span>
                              <input 
                                type="number" 
                                value={customAmountText}
                                onChange={(e) => {
                                  setCustomAmountText(e.target.value);
                                  setPaymentError('');
                                }}
                                placeholder="0.00"
                                min="100"
                                className="custom-amount-input"
                              />
                            </div>
                          </div>
                        )}

                        {paymentError && (
                          <div className="repayment-error-msg mt-2">
                            {paymentError}
                          </div>
                        )}

                        <div className="repayment-panel-actions mt-3">
                          <button 
                            type="button" 
                            className="repayment-cancel-btn"
                            onClick={() => {
                              setShowPaymentOptions(false);
                              setPaymentType('due');
                              setCustomAmountText('');
                              setPaymentError('');
                            }}
                          >
                            Cancel
                          </button>
                          
                          <button 
                            type="button" 
                            className="repayment-confirm-btn"
                            onClick={handleRepaySubmit}
                          >
                            Confirm & Pay
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : activeLoan && activeLoan.status === 'CLOSED' ? (
                <div className="loan-closed-celebration-card mt-3">
                  <div className="celebration-glow" />
                  <h4 className="celebration-title">Loan Fully Closed!</h4>
                  <p className="celebration-desc">
                    Congratulations! Your loan accounts are fully closed. 
                    Your Trust Score has been updated, and you are eligible to apply for another loan.
                  </p>
                  <button
                    type="button"
                    className="sidebar-apply-new-loan-btn"
                    onClick={() => {
                      onClose();
                      navigate('/products/personal');
                    }}
                  >
                    Apply for Another Loan
                  </button>
                </div>
              ) : (
                <div className="loan-closed-celebration-card mt-3" style={{ padding: '2rem 1.25rem', textAlign: 'center' }}>
                  <div className="celebration-glow" />
                  <h4 className="celebration-title">No Active Loans</h4>
                  <p className="celebration-desc">
                    You currently have no active loans or repayment schedules.
                    Apply for a loan to get started!
                  </p>
                  <button
                    type="button"
                    className="sidebar-apply-new-loan-btn"
                    onClick={() => {
                      onClose();
                      navigate('/products/personal');
                    }}
                  >
                    Explore Loan Products
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* VIEW: LOAN HISTORY */}
        {currentView === 'loan' && (
          <>
            <div className="sidebar-header subview-header-row">
              <button type="button" className="sidebar-back-nav-btn" onClick={() => setCurrentView('menu')}>← Back</button>
              <h4 className="sidebar-subpage-title-text">Loan History</h4>
              <div style={{ width: '40px' }} />
            </div>

            <div className="sidebar-scroll-content">
              {/* Parameter List */}
              {activeLoan && ['ACTIVE', 'DISBURSED'].includes(activeLoan.status) ? (
                <div className="sidebar-loan-parameters-vertical-list">
                  <h5 className="sidebar-subpage-sub-title">Active Loan Specifications</h5>

                  <div className="sidebar-param-row-detail">
                    <span className="param-label-tag">Loan Account ID</span>
                    <span className="param-value-tag">{activeLoan.referenceNumber || activeLoan.id}</span>
                  </div>
                  
                  <div className="sidebar-param-row-detail">
                    <span className="param-label-tag">Amount Applied</span>
                    <span className="param-value-tag">₹{activeLoan.amountApplied.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="sidebar-param-row-detail">
                    <span className="param-label-tag">Date Applied</span>
                    <span className="param-value-tag">{activeLoan.dateApplied}</span>
                  </div>

                  <div className="sidebar-param-row-detail">
                    <span className="param-label-tag">Amount Distributed</span>
                    <span className="param-value-tag">₹{activeLoan.amountDistributed.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="sidebar-param-row-detail">
                    <span className="param-label-tag">Date Distributed</span>
                    <span className="param-value-tag">{activeLoan.dateDistributed}</span>
                  </div>

                  <div className="sidebar-param-row-detail">
                    <span className="param-label-tag">Daily Interest Rate</span>
                    <span className="param-value-tag highlight-green">{activeLoan.dailyInterestRate}</span>
                  </div>

                  <div className="sidebar-param-row-detail">
                    <span className="param-label-tag">Number of EMIs</span>
                    <span className="param-value-tag">{activeLoan.numberOfEmis} Months</span>
                  </div>

                  <div className="sidebar-param-row-detail">
                    <span className="param-label-tag">EMI Frequency</span>
                    <span className="param-value-tag">{activeLoan.emiFrequency}</span>
                  </div>
                </div>
              ) : (
                <div className="loan-closed-celebration-card" style={{ padding: '1.25rem', textAlign: 'center', marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>No Active Loans</h4>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                    You currently have no active credit liabilities on LendoGo. Make an application to explore capital options!
                  </p>
                </div>
              )}

              {/* Card 2: Applied Loan History */}
              <div style={{ marginTop: '2.5rem' }}>
                <h5 className="sidebar-subpage-sub-title">Applied Loan History</h5>
                <div className="loan-history-list">
                  {loanHistory.length === 0 ? (
                    <p className="no-loans-text">No active or applied loans found.</p>
                  ) : (
                    loanHistory.map((loan) => (
                      <div key={loan.id} className="loan-history-item">
                        <div className="loan-item-details">
                          <div className="loan-type-row">
                            <span className="loan-icon-bullet">•</span>
                            <div className="loan-meta-info">
                              <h4>{loan.type}</h4>
                              <span className="loan-id-sub">{loan.id} • {loan.date}</span>
                            </div>
                          </div>
                        </div>
                        <div className="loan-status-wrap">
                          <span className={`loan-status-tag ${loan.status.toLowerCase()}`}>
                            {loan.status}
                          </span>
                          <h4 className="loan-amount-val">₹{loan.amount.toLocaleString('en-IN')}</h4>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* VIEW: FEEDBACK & APP SETTINGS */}
        {currentView === 'feedback' && (
          <>
            <div className="sidebar-header subview-header-row">
              <button type="button" className="sidebar-back-nav-btn" onClick={() => setCurrentView('menu')}>← Back</button>
              <h4 className="sidebar-subpage-title-text">Feedback & Settings</h4>
              <div style={{ width: '40px' }} />
            </div>

            <div className="sidebar-scroll-content">
              <form onSubmit={handleSubmitFeedback} className="sidebar-form">
                <h5 className="sidebar-subpage-sub-title">Rate LendoGo Platform</h5>
                
                <div className="sidebar-input-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600, color: '#334155', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Satisfactory Rating
                  </label>
                  <div className="emoji-rating-container">
                    {['😡', '😞', '😐', '🙂', '😍'].map((emoji, index) => {
                      const ratingValue = index + 1;
                      const isSelected = feedbackRating === ratingValue;
                      return (
                        <button
                          key={ratingValue}
                          type="button"
                          onClick={() => setFeedbackRating(ratingValue)}
                          className={`emoji-rating-btn ${isSelected ? 'selected' : ''}`}
                          title={`Rate ${ratingValue} stars`}
                        >
                          {emoji}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="sidebar-input-group">
                  <label>Comments / Suggestions</label>
                  <textarea 
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="How can we make your fintech experience better?"
                    className="sidebar-textarea-field"
                    required
                  />
                </div>

                <button type="submit" className="sidebar-submit-btn-unified">Submit Feedback</button>
              </form>

              {/* App Settings block */}
              <div className="sidebar-app-settings-card-wrapper mt-3">
                <h5 className="sidebar-subpage-sub-title">Fintech App Configuration</h5>
                


                <div className="sidebar-settings-toggle-row mt-2">
                  <label className="toggle-lbl">Push App Notifications</label>
                  <input 
                    type="checkbox" 
                    checked={notificationsEnabled}
                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#0f66ff' }}
                  />
                </div>

                <div className="sidebar-settings-toggle-row mt-2" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                  <span className="app-version-lbl">Software Version</span>
                  <span className="app-version-val">v1.2.4 (Stable Release)</span>
                </div>
              </div>
            </div>
          </>
        )}

      </div>
    </div>,
    document.body
  );
};

const Navbar = () => {
  const { user, signOut } = useAuthController();
  const { webConfig } = useWebConfig();
  const navigate = useNavigate();

  const [activeDropdown, setActiveDropdown] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [sidebarInitialView, setSidebarInitialView] = useState('menu');
  const [notificationsDropdownOpen, setNotificationsDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const navbarRef = useRef(null);

  const [toast, setToast] = useState(null);

  const [showNavbar, setShowNavbar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (menuOpen || modalOpen || profileDropdownOpen || notificationsDropdownOpen) {
        setShowNavbar(true);
        return;
      }
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setShowNavbar(false);
      } else {
        setShowNavbar(true);
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, menuOpen, modalOpen, profileDropdownOpen, notificationsDropdownOpen]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const handleToastEvent = (e) => {
      if (e.detail && e.detail.message) {
        showToast(e.detail.message, e.detail.type || 'success');
      }
    };
    window.addEventListener('lendogo-toast', handleToastEvent);
    return () => window.removeEventListener('lendogo-toast', handleToastEvent);
  }, []);

  useEffect(() => {
    const handleOpenSidebar = (e) => {
      if (e.detail && e.detail.view) {
        setSidebarInitialView(e.detail.view);
      }
      setProfileDropdownOpen(true);
    };
    window.addEventListener('open-user-sidebar', handleOpenSidebar);
    return () => window.removeEventListener('open-user-sidebar', handleOpenSidebar);
  }, []);

  const [profileDp, setProfileDp] = useState(() => {
    return getCleanDpUrl(localStorage.getItem('user_dp'));
  });

  const getFallbackName = () => {
    if (user && user.name && user.name !== 'LendoGO User') {
      return user.name;
    }
    if (user && user.email) {
      const namePart = user.email.split('@')[0];
      const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      const cleanName = capitalized.replace(/[0-9]/g, '');
      return cleanName || namePart;
    }
    return 'LendoGO Borrower';
  };

  const [fullName, setFullName] = useState(() => {
    return localStorage.getItem('user_full_name') || getFallbackName();
  });

  useEffect(() => {
    const handleDpChange = () => {
      setProfileDp(
        getCleanDpUrl(localStorage.getItem('user_dp'))
      );
    };
    const handleDetailsChange = () => {
      setFullName(localStorage.getItem('user_full_name') || getFallbackName());
    };
    window.addEventListener('user-dp-changed', handleDpChange);
    window.addEventListener('user-dp-changed', handleDpChange);
    window.addEventListener('user-details-changed', handleDetailsChange);

    const fetchNotifications = async () => {
      try {
        if (!user || !user.isAuthenticated) return;
        const res = await apiClient('/notifications');
        if (res && res.notifications) {
          setNotifications(res.notifications);
        }
      } catch (err) {
        console.error("Failed to fetch notifications", err);
      }
    };

    if (user && user.isAuthenticated) {
      fetchNotifications();
      // Polling for notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      
      const fetchProfileInit = async () => {
        try {
          const res = await apiClient('/user/profile');
          if (res && res.success && res.data) {
            const p = res.data;
            const nameVal = p.full_name || getFallbackName();
            const profileImgUrl = getCleanDpUrl(p.profile_image);
            
            localStorage.setItem('user_full_name', nameVal);
            localStorage.setItem('user_phone', p.phone_number || '');
            localStorage.setItem('user_dob', p.date_of_birth || '');
            localStorage.setItem('user_pincode', p.pincode || '');
            localStorage.setItem('user_address', p.address || '');
            localStorage.setItem('user_dp', profileImgUrl);

            setProfileDp(profileImgUrl);
            setFullName(nameVal);

            window.dispatchEvent(new Event('user-dp-changed'));
            window.dispatchEvent(new Event('user-details-changed'));
          }
        } catch (err) {
          console.error("Failed to prefetch profile on login:", err);
        }
      };
      fetchProfileInit();
    }

    return () => {
      window.removeEventListener('user-dp-changed', handleDpChange);
      window.removeEventListener('user-details-changed', handleDetailsChange);
      if (typeof interval !== 'undefined') clearInterval(interval);
    };
  }, [user]);

  const toggleDropdown = (e, dropdownName) => {
    e.preventDefault();
    setActiveDropdown(activeDropdown === dropdownName ? null : dropdownName);
  };

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
    setActiveDropdown(null);
    setProfileDropdownOpen(false);
    setNotificationsDropdownOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      // If click target is inside the portal sidebar, do not close the dropdowns or menu!
      if (event.target.closest('.navbar-sidebar-wrapper')) {
        return;
      }
      if (navbarRef.current && !navbarRef.current.contains(event.target)) {
        setActiveDropdown(null);
        setMenuOpen(false);
        setProfileDropdownOpen(false);
        setNotificationsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
    <nav className={`navbar ${showNavbar ? '' : 'navbar--hidden'}`} ref={navbarRef}>
      <div className="navbar-container">
        <div className="navbar-logo" onClick={() => navigate(user.isAuthenticated ? '/home' : '/')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <img src="https://res.cloudinary.com/dfyhke26f/image/upload/q_auto/f_auto/v1781705723/image-removebg-preview_3_lcqqog.png" alt="LendoGO Logo" style={{ width: 'auto', height: '110px', objectFit: 'contain', margin: '-30px -15px' }} />
        </div>

        {/* Desktop Links */}
        <div className="navbar-links">
          <Link to={user.isAuthenticated ? "/home" : "/"} className="nav-link">Home</Link>

          <div className="dropdown-container">
            <a href="#" className="nav-link dropdown" onClick={(e) => toggleDropdown(e, 'loanProducts')}>Loan Products</a>
            {activeDropdown === 'loanProducts' && (
              <div className="dropdown-menu">
                <button className="dropdown-item" onClick={() => { navigate('/products/personal'); setActiveDropdown(null); }}>Personal Loans</button>
                <button className="dropdown-item" onClick={() => { navigate('/products/business'); setActiveDropdown(null); }}>Business Loan</button>
                <button className="dropdown-item" onClick={() => { navigate('/products/home'); setActiveDropdown(null); }}>Home Loan</button>
                <button className="dropdown-item" onClick={() => { navigate('/products/property'); setActiveDropdown(null); }}>Loan Against Property</button>
                <button className="dropdown-item" onClick={() => { navigate('/products/instant'); setActiveDropdown(null); }}>Instant Personal Loans</button>
                <button className="dropdown-item" onClick={() => { navigate('/products/credit-builder'); setActiveDropdown(null); }}>Credit Builder Loan</button>
              </div>
            )}
          </div>

          <a 
            href="#" 
            className="nav-link"
            onClick={(e) => {
              e.preventDefault();
              if (user.isAuthenticated) {
                setSidebarInitialView('repayment');
                setProfileDropdownOpen(true);
              } else {
                navigate('/');
              }
            }}
          >
            Repay Loan
          </a>
          <Link to="/blogs" className="nav-link">Blogs</Link>

          <div className="dropdown-container">
            <a href="#" className="nav-link dropdown" onClick={(e) => toggleDropdown(e, 'support')}>Support</a>
            {activeDropdown === 'support' && (
              <div className="dropdown-menu">
                <Link to="/about" className="dropdown-item">About Us</Link>
                <Link to="/careers" className="dropdown-item">Careers </Link>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="navbar-actions">
          <button className="btn-outline" onClick={() => {
            if (webConfig && webConfig.free_consultation_enabled === false) {
              showToast("This feature is currently temporarily disabled by the administrator.", "warning");
            } else {
              setModalOpen(true);
            }
          }}>Free Consultation</button>
          {user.isAuthenticated ? (
            <>
              {/* Notification Bell Dropdown */}
              <div className="notification-bell-container">
                <button 
                  type="button" 
                  className="navbar-bell-btn" 
                  onClick={() => setNotificationsDropdownOpen(!notificationsDropdownOpen)}
                  aria-label="Notifications"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="bell-svg">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                  {notifications.length > 0 && (
                    <span className="bell-badge-dot">{notifications.length}</span>
                  )}
                </button>
                
                {notificationsDropdownOpen && (
                  <div className="notifications-dropdown-menu">
                    <div className="notifications-header">
                      <h5>Notifications</h5>
                      <button 
                        type="button" 
                        className="mark-all-read-btn" 
                        onClick={async () => {
                          try {
                            await apiClient('/notifications/mark-read', { method: 'POST' });
                            setNotifications([]);
                            showToast('All notifications marked as read!', 'success');
                          } catch (err) {
                            showToast('Failed to mark read', 'error');
                          }
                        }}
                      >
                        Mark all read
                      </button>
                    </div>
                    <div className="notifications-list">
                      {notifications.length === 0 ? (
                        <p style={{ padding: '1rem', fontSize: '0.85rem', color: '#64748b', textAlign: 'center', margin: 0 }}>No new notifications.</p>
                      ) : (
                        notifications.map((n) => (
                          <div 
                            key={n.id}
                            className="notification-item unread" 
                            onClick={() => { 
                              if (n.target) {
                                setSidebarInitialView(n.target); 
                                setProfileDropdownOpen(true); 
                              }
                              setNotificationsDropdownOpen(false); 
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <span className="notification-dot"></span>
                            <div className="notification-text-group">
                              <p className="notification-msg">{n.message}</p>
                              <span className="notification-time">{new Date(n.created_at).toLocaleDateString('en-IN')}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="profile-dropdown-container">
                <button 
                  type="button"
                  className="navbar-avatar-btn"
                  onClick={() => {
                    setSidebarInitialView('menu');
                    setProfileDropdownOpen(!profileDropdownOpen);
                  }}
                  aria-label="User Menu"
                  style={{ padding: 0, overflow: 'hidden' }}
                >
                  <img 
                    src={profileDp} 
                    alt="User Avatar" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                </button>
                
                <UserSidebar 
                  isOpen={profileDropdownOpen} 
                  onClose={() => setProfileDropdownOpen(false)} 
                  user={user}
                  signOut={signOut}
                  navigate={navigate}
                  initialView={sidebarInitialView}
                  showToast={showToast}
                />
              </div>
            </>
          ) : (
            <button className="btn-primary" onClick={() => navigate('/')}>Sign In</button>
          )}
        </div>

        {/* Hamburger button — mobile only */}
        <button className="navbar-hamburger" onClick={toggleMenu} aria-label="Toggle menu">
          <span className={`ham-bar ${menuOpen ? 'open-1' : ''}`}></span>
          <span className={`ham-bar ${menuOpen ? 'open-2' : ''}`}></span>
          <span className={`ham-bar ${menuOpen ? 'open-3' : ''}`}></span>
        </button>
      </div>

      {/* Mobile Drawer */}
      <div className={`mobile-menu ${menuOpen ? 'mobile-menu--open' : ''}`}>
        <Link to={user.isAuthenticated ? "/home" : "/"} className="mobile-link" onClick={() => setMenuOpen(false)}>Home</Link>

        <div className="mobile-dropdown">
          <button className="mobile-link mobile-link--toggle" onClick={(e) => toggleDropdown(e, 'loanProductsMobile')}>
            Loan Products <span className="mobile-arrow">{activeDropdown === 'loanProductsMobile' ? '▲' : '▼'}</span>
          </button>
          {activeDropdown === 'loanProductsMobile' && (
            <div className="mobile-submenu">
              <button className="mobile-sublink" onClick={() => { navigate('/products/personal'); setMenuOpen(false); }}>Personal Loans</button>
              <button className="mobile-sublink" onClick={() => { navigate('/products/business'); setMenuOpen(false); }}>Business Loan</button>
              <button className="mobile-sublink" onClick={() => { navigate('/products/home'); setMenuOpen(false); }}>Home Loan</button>
              <button className="mobile-sublink" onClick={() => { navigate('/products/property'); setMenuOpen(false); }}>Loan Against Property</button>
              <button className="mobile-sublink" onClick={() => { navigate('/products/instant'); setMenuOpen(false); }}>Instant Personal Loans</button>
              <button className="mobile-sublink" onClick={() => { navigate('/products/credit-builder'); setMenuOpen(false); }}>Credit Builder Loan</button>
            </div>
          )}
        </div>

        <a 
          href="#" 
          className="mobile-link" 
          onClick={(e) => { 
            e.preventDefault(); 
            setMenuOpen(false); 
            if (user.isAuthenticated) {
              setSidebarInitialView('repayment');
              setProfileDropdownOpen(true);
            } else {
              navigate('/');
            }
          }}
        >
          Repay Loan
        </a>
        <Link to="/blogs" className="mobile-link" onClick={() => setMenuOpen(false)}>Blogs</Link>

        <div className="mobile-dropdown">
          <button className="mobile-link mobile-link--toggle" onClick={(e) => toggleDropdown(e, 'supportMobile')}>
            Support <span className="mobile-arrow">{activeDropdown === 'supportMobile' ? '▲' : '▼'}</span>
          </button>
          {activeDropdown === 'supportMobile' && (
            <div className="mobile-submenu">
              <Link to="/about" className="mobile-sublink" onClick={() => setMenuOpen(false)}>About Us</Link>
              <Link to="/careers" className="mobile-sublink" onClick={() => setMenuOpen(false)}>Careers </Link>
            </div>
          )}
        </div>

        <button className="mobile-link mobile-link-primary" onClick={() => {
          if (webConfig && webConfig.free_consultation_enabled === false) {
            setMenuOpen(false);
            showToast("This feature is currently temporarily disabled by the administrator.", "warning");
          } else {
            setModalOpen(true);
            setMenuOpen(false);
          }
        }}>
          Free Consultation
        </button>

        <div className="mobile-divider"></div>

        {user.isAuthenticated ? (
          <>
            <div className="mobile-user-header">
              <span className="mobile-username">{fullName || getFallbackName()}</span>
              <span className="mobile-useremail">{user.email}</span>
            </div>
            <Link to="/home" className="mobile-link" onClick={() => setMenuOpen(false)}>Dashboard</Link>
            <button 
              type="button" 
              className="mobile-link"
              onClick={() => {
                setSidebarInitialView('profile');
                setProfileDropdownOpen(true);
                setMenuOpen(false);
              }}
            >
              My Profile
            </button>
            <button 
              type="button"
              className="mobile-link mobile-sign-out" 
              onClick={() => {
                signOut();
                setMenuOpen(false);
                navigate('/');
              }}
            >
              Sign Out
            </button>
          </>
        ) : (
          <div className="mobile-actions" style={{ marginTop: '1rem', borderTop: 'none', padding: '0 1.5rem 1rem' }}>
            <button className="btn-primary" style={{ width: '100%' }} onClick={() => { navigate('/'); setMenuOpen(false); }}>Sign In</button>
          </div>
        )}
      </div>
    </nav>

    <ConsultationModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />

    {toast && (
      <div className="lendogo-toast-container">
        <div className={`lendogo-toast ${toast.type}`}>
          <div className="lendogo-toast-content">{toast.message}</div>
          <button 
            type="button" 
            className="lendogo-toast-close" 
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      </div>
    )}
    </>
  );
};

export default Navbar;
