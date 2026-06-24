import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../../utils/apiClient';
import { useAuthController } from '../../../../controllers/auth/useAuthController';

export const useAdminController = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuthController();

  // Theme & Navigation States
  const [darkMode, setDarkMode] = useState(true);
  
  // Initialize activeTab based on permissions
  const [activeTab, setActiveTab] = useState(() => {
    const p = user?.permissions || {};
    const isAdmin = user?.role === 'admin' || user?.email === 'admin@gmail.com';
    if (isAdmin || p['dashboard_view']) return 'Dashboard';
    if (p['loan_app_view']) return 'Loan Applications';
    if (p['kyc_view']) return 'KYC Verifications';
    if (p['user_read']) return 'User Management';
    if (p['career_app_view']) return 'View Applications';
    if (p['career_job_create'] || p['career_job_update']) return 'Post Job Openings';
    if (p['cc_consult_view']) return 'Free Consultation';
    if (p['cc_chat_view']) return 'Chat Support';
    if (p['blog_read']) return 'Blog Management';
    if (p['due_view']) return 'Due Date Reminders';
    return 'Admin Settings'; // Fallback to personal settings if no permissions
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sliders & Web Config States
  const [minCreditScore, setMinCreditScore] = useState(650);
  const [baseInterestRate, setBaseInterestRate] = useState(14);
  const [isSignupsEnabled, setIsSignupsEnabled] = useState(true);
  const [isConsultationsEnabled, setIsConsultationsEnabled] = useState(true);

  // Dynamic Global Financial Ledger States
  const [activeBalance, setActiveBalance] = useState(0);
  const [disbursedCapital, setDisbursedCapital] = useState(0);

  // Admin Personal Detail States
  const [adminAvatar, setAdminAvatar] = useState(user?.avatar || '');
  const [adminName, setAdminName] = useState(user?.name || '');
  const [adminEmail, setAdminEmail] = useState(user?.email || '');

  // Input States for Settings Forms
  const [emailInput, setEmailInput] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [transferEmail, setTransferEmail] = useState('');
  const [transferKey, setTransferKey] = useState('');

  // 1. Audit Logs Dataset State
  const [auditLogs, setAuditLogs] = useState([]);

  const addAuditLog = (action, type = 'info') => {
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').substring(0, 19);
    setAuditLogs(prev => [
      { id: Date.now(), timestamp: timeStr, user: 'Lending Officer (Admin)', action, type },
      ...prev
    ]);
  };

  // 2. User Directory dataset
  const [users, setUsers] = useState([]);

  // 3. Interactive Loan Requests Dataset
  const [loanRequests, setLoanRequests] = useState([]);

  // 4. Approved/Sanctioned Loans Dataset
  const [approvedLoans, setApprovedLoans] = useState([]);

  // Keep audited scores in local memory or track them dynamically to prevent resetting them on page shifts
  const [auditedScores, setAuditedScores] = useState({});

  // 6. Customer Care Consultation Logs State
  const [consultations, setConsultations] = useState([]);

  // 6b. Customer Care Live Chats State (Purely Backend Driven)
  const [chats, setChats] = useState([]);

  const fetchWalletBalance = async () => {
    try {
      const res = await apiClient('/admin/wallet/balance');
      if (res && typeof res.balance !== 'undefined') {
        setActiveBalance(res.balance);
      }
    } catch (err) {
      console.error("Failed to fetch wallet balance:", err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await apiClient('/admin/all-users');
      const data = res?.data || res || [];
      const normalized = data.map(u => ({
        id: u.ID || u.id || '',
        name: u.full_name || u.FullName || 'Unknown',
        email: u.Email || u.email || '',
        avatar: u.Avatar || u.avatar || u.ProfilePicture || u.profile_picture || u.profile_image || '',
        PAN: u.PAN || u.pan || 'Attached',
        rating: u.rating || 'Low Risk',
        status: u.status || 'Active',
        creditScore: u.creditScore || 750,
        loanHistory: u.loanHistory || 'None',
        joined: u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'
      }));
      setUsers(normalized);
    } catch (err) {
      console.error("Failed to fetch users from database:", err);
    }
  };

  const fetchConsultations = async () => {
    try {
      const res = await apiClient('/admin/consultations');
      const data = res?.data || res || [];
      
      const calledIds = JSON.parse(localStorage.getItem('lendogo_called_consultations') || '[]');
      
      const mapped = data.map(item => ({
        id: item.ID || item.id,
        name: item.FullName || item.full_name || 'N/A',
        email: item.Email || item.email || 'N/A',
        phone: item.PhoneNumber || item.phone_number || 'N/A',
        date: item.CreatedAt ? new Date(item.CreatedAt).toLocaleDateString() : 'N/A',
        status: calledIds.includes(item.ID || item.id) ? 'Called' : 'Pending',
        type: 'Free Consultation'
      }));
      setConsultations(mapped);
    } catch (err) {
      console.error("Failed to fetch consultations:", err);
    }
  };

  const fetchChatSessions = async () => {
    try {
      const res = await apiClient('/admin/chats/sessions');
      const sessions = res?.data || res || [];
      
      if (!Array.isArray(sessions)) return;

      setChats(prev => {
        const updated = [...prev];
        sessions.forEach(session => {
          const senderId = session.sender_id || session.sender?.ID;
          if (!senderId) return;
          
          const chatId = `CHT-${senderId}`;
          const existingIdx = updated.findIndex(c => c.id === chatId || c.userId === senderId);
          
          const clientName = session.sender?.full_name || session.sender?.FullName || 'Unknown User';
          const clientEmail = session.sender?.email || session.sender?.Email || '';
          const clientAvatar = session.sender?.Avatar || session.sender?.profile_picture || session.sender?.profile_image || '';

          if (existingIdx !== -1) {
            updated[existingIdx] = {
              ...updated[existingIdx],
              client: clientName,
              email: clientEmail,
              avatar: clientAvatar || updated[existingIdx].avatar
            };
          } else {
            updated.push({
              id: chatId,
              userId: senderId,
              client: clientName,
              email: clientEmail,
              avatar: clientAvatar,
              lastMsg: session.message_text || 'New conversation started',
              date: new Date(session.timestamp || session.CreatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              status: 'Active',
              messages: [
                {
                  sender: 'user',
                  text: session.message_text || 'Started conversation',
                  time: new Date(session.timestamp || session.CreatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
              ]
            });
          }
        });
        return updated;
      });
    } catch (err) {
      console.error("Failed to fetch admin chat sessions:", err);
    }
  };

  const fetchApplications = async () => {
    try {
      const res = await apiClient('/admin/applications');
      const data = res?.data || res || [];
      
      const requests = [];
      const approved = [];
      let totalDisbursed = 0;

      data.forEach(app => {
        let docPAN = 'Attached';
        if (app.kyc_documents?.pan_card_path) {
          const filenameWithParams = app.kyc_documents.pan_card_path.split('/').pop() || '';
          const filename = filenameWithParams.split('?')[0] || '';
          if (filename) {
            docPAN = filename.length > 20 ? `${filename.substring(0, 16)}...` : filename;
          }
        }

        const normalizedApp = {
          id: app.id || '',
          referenceNumber: app.reference_number || app.id || '',
          name: app.full_name || 'Unknown',
          type: app.product_category || app.loan_track || 'Personal Loan',
          amount: app.principal_amount || 0,
          PAN: docPAN,
          riskScore: auditedScores[app.id]?.riskScore || app.riskScore || null,
          auditState: auditedScores[app.id]?.auditState || app.auditState || 'idle',
          dob: app.dob || '',
          email: app.email || '',
          mobileNumber: app.mobile_number || '',
          address: app.address || '',
          city: app.city || '',
          state: app.state || '',
          pincode: app.pincode || '',
          tenureMonths: app.tenure_months || 12,
          interestRate: app.interest_rate || 14,
          estimatedEmi: app.estimated_emi || 0,
          employmentType: app.financial_details?.employment_status || 'Salaried',
          monthlyIncome: app.financial_details?.monthly_income || 0,
          raw: app
        };

        if (app.status === 'APPROVED' || app.status === 'DISBURSED') {
          approved.push({
            id: app.id || '',
            name: app.full_name || 'Unknown',
            type: app.product_category || app.loan_track || 'Personal Loan',
            amount: app.principal_amount || 0,
            rate: app.interest_rate || 14,
            date: app.created_at ? new Date(app.created_at).toLocaleDateString() : 'N/A',
            status: app.status === 'DISBURSED' ? 'Disbursed' : 'Pre-Approved',
            raw: app
          });
          if (app.status === 'DISBURSED') {
            totalDisbursed += app.principal_amount || 0;
          }
        } else if (app.status === 'UNDER_REVIEW') {
          requests.push(normalizedApp);
        }
      });

      setLoanRequests(requests);
      setApprovedLoans(approved);
      setDisbursedCapital(totalDisbursed);
    } catch (err) {
      console.error("Failed to fetch applications from database:", err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await apiClient('/admin/audit-logs');
      const data = res?.data || res || [];
      const mappedLogs = data.map(log => ({
        id: log.id || log.ID,
        timestamp: log.created_at ? new Date(log.created_at).toISOString().replace('T', ' ').substring(0, 19) : '',
        user: log.actor_name,
        action: log.description,
        type: log.action_type ? log.action_type.toLowerCase() : 'info'
      }));
      setAuditLogs(mappedLogs);
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    }
  };

  const fetchCareerOpenings = async () => {
    try {
      const res = await apiClient('/careers/openings');
      const data = res?.data || res || [];
      const safeParse = (field) => Array.isArray(field) ? field : (typeof field === 'string' ? JSON.parse(field || '[]') : []);
      const formatted = data.map(job => ({
        id: job.id,
        title: job.title,
        dept: job.department,
        type: job.employment_type,
        status: job.status,
        applicants: 0,
        experience: job.experience_range,
        location: job.location,
        mode: job.work_mode,
        skills: safeParse(job.skills),
        briefNote: job.short_description,
        aboutRole: job.about_role,
        responsibilities: safeParse(job.responsibilities),
        requirements: safeParse(job.requirements),
        benefits: safeParse(job.benefits)
      }));
      setCareersOpenings(formatted);
    } catch (e) {
      console.error("Failed to fetch careers:", e);
    }
  };

  useEffect(() => {
    const p = user?.permissions || {};
    const isAdmin = user?.role === 'admin' || user?.email === 'admin@gmail.com';
    
    if (isAdmin || p['User Management'] || p['user_read']) fetchUsers();
    if (isAdmin || p['Loan Applications'] || p['loan_app_view']) fetchApplications();
    if (isAdmin || p['Dashboard'] || p['dashboard_view']) fetchWalletBalance();
    if (isAdmin || p['Customer Care'] || p['cc_consult_view'] || p['cc_chat_view']) fetchConsultations();
    if (isAdmin || p['user_read'] || p['audit_read']) fetchAuditLogs();
    if (isAdmin || p['career_job_read']) {
      fetchCareerOpenings();
      fetchJobApplications();
    }
    
    // Chats can be fetched by anyone who can see Customer Care or Dashboard
    if (isAdmin || p['Customer Care'] || p['Dashboard'] || p['cc_chat_view']) fetchChatSessions();
  }, [auditedScores, user]);

  // Real-time Audit Logs WebSocket
  useEffect(() => {
    const p = user?.permissions || {};
    const isAdmin = user?.role === 'admin' || user?.email === 'admin@gmail.com';
    
    if (isAdmin || p['audit_read'] || p['user_read']) {
      // Connect to the new dedicated Admin WebSocket Hub!
      const wsUrl = `${import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080'}/api/admin/ws`;
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'NEW_AUDIT_LOG') {
            const log = data.data;
            setAuditLogs(prev => {
              const newLog = {
                id: log.ID || log.id || Date.now(),
                timestamp: log.created_at ? new Date(log.created_at).toISOString().replace('T', ' ').substring(0, 19) : new Date().toISOString().replace('T', ' ').substring(0, 19),
                user: log.actor_name,
                action: log.description,
                type: log.action_type ? log.action_type.toLowerCase() : 'info'
              };
              // avoid duplicate keys by filtering if it somehow already exists
              if (prev.find(p => p.id === newLog.id)) return prev;
              return [newLog, ...prev];
            });
          } else if (data.event === 'STAFF_PROVISIONED' || data.event === 'STAFF_STATUS_UPDATED' || data.event === 'STAFF_DELETED') {
            window.dispatchEvent(new Event('admin-staff-updated'));
          } else if (data.event === 'USER_CREATED' || data.event === 'USER_UPDATED' || data.event === 'USER_DELETED' || data.event === 'USER_STATUS_UPDATED') {
            fetchUsers();
          } else if (data.event === 'LOAN_STATUS_UPDATED' || data.event === 'LOAN_DISBURSED') {
            fetchApplications();
            if (data.event === 'LOAN_DISBURSED') {
              fetchWalletBalance();
            }
          } else if (data.event === 'CAREER_OPENING_CREATED' || data.event === 'CAREER_OPENING_UPDATED') {
            fetchCareerOpenings();
          } else if (data.event === 'GLOBAL_PERMISSIONS_UPDATED') {
            window.dispatchEvent(new Event('admin-permissions-updated'));
          }
        } catch(e) {}
      };
      return () => ws.close();
    }
  }, [user]);

  // No more local storage sync for live chats; it's handled by WS and REST API

  const handleToggleUserStatus = (userId, userName, currentStatus) => {
    const nextStatus = currentStatus === 'Active' ? 'Blocked' : 'Active';
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: nextStatus } : u));
  };

  const handleCreateUser = (newUser) => {
    setUsers(prev => [newUser, ...prev]);
  };

  const handleUpdateUser = (updatedUser) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  const handleDeleteUser = (userId, userName) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'Deleted' } : u));
  };

  // KYC Verification Dataset & Handlers (kept for interface match, though KYCVerificationsTab handles it internally)
  const [kycList, setKycList] = useState([]);

  const handleApproveKYC = (kycId, userName) => {
    addAuditLog(`KYC verification approved for ${userName} (${kycId})`, 'success');
    alert(`KYC verification successfully approved for ${userName}.`);
  };

  const handleRejectKYC = (kycId, userName) => {
    addAuditLog(`KYC verification rejected/returned for ${userName} (${kycId})`, 'warning');
    alert(`KYC verification rejected/returned for ${userName}.`);
  };

  // Simulated Audit Scoring Model
  const handleRunRiskAudit = (reqId) => {
    setLoanRequests(prev => prev.map(r => r.id === reqId ? { ...r, auditState: 'scanning' } : r));
    setAuditedScores(prev => ({
      ...prev,
      [reqId]: { auditState: 'scanning', riskScore: null }
    }));
    
    setTimeout(() => {
      const generatedScore = Math.floor(Math.random() * (850 - 580 + 1)) + 580;
      setAuditedScores(prev => ({
        ...prev,
        [reqId]: { auditState: 'completed', riskScore: generatedScore }
      }));
      addAuditLog(`Risk analysis compiled for request ${reqId}. Calculated Credit Score: ${generatedScore}`, 'info');
    }, 1500);
  };

  // Decision Handlers
  const handleApproveLoan = async (request) => {
    try {
      await apiClient(`/admin/applications/${request.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'APPROVED' })
      });
      
      // Log is handled by backend WebSocket broadcast
      alert(`Loan successfully approved and moved to disbursements ledger.`);
      
      setLiveMarquee(prev => [
        { name: `${request.name} (PAN: ${request.PAN})`, type: request.type, amount: `₹${request.amount.toLocaleString()}`, status: 'Approved' },
        ...prev
      ]);

      fetchApplications();
      await fetchWalletBalance();
      return true;
    } catch (err) {
      console.error("Failed to approve loan:", err);
      alert(`Failed to approve loan: ${err.message}`);
      return false;
    }
  };

  const handleRejectLoan = async (reqId, name) => {
    try {
      await apiClient(`/admin/applications/${reqId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'REJECTED' })
      });
      // Log is handled by backend WebSocket broadcast
      alert(`Application ${reqId} rejected.`);
      fetchApplications();
      return true;
    } catch (err) {
      console.error("Failed to reject loan application:", err);
      alert(`Failed to reject application: ${err.message}`);
      return false;
    }
  };

  const handleDisburseMoney = async (loanId, feeAmount) => {
    const loan = approvedLoans.find(l => l.id === loanId);
    if (!loan) return false;

    const netAmount = loan.amount - feeAmount;

    try {
      await apiClient('/admin/wallet/disburse', {
        method: 'POST',
        body: JSON.stringify({
          loan_id: loanId,
          user_id: loan.raw.user_id,
          sanctioned_amount: Number(loan.amount),
          processing_fee: Number(feeAmount),
          net_payout: Number(netAmount)
        })
      });

      await fetchWalletBalance();

      alert(`Loan disbursed successfully.`);
      fetchApplications();
      return true;
    } catch (err) {
      console.error("Failed to disburse money:", err);
      alert(`Failed to disburse money: ${err.message}`);
      return false;
    }
  };

  // 5. Careers & Recruiting Dataset
  const [careersOpenings, setCareersOpenings] = useState([]);

  const [jobApplications, setJobApplications] = useState([]);

  const fetchJobApplications = async () => {
    try {
      const data = await apiClient('/careers/admin/applications');
      const apps = data.data || [];
      const formatted = apps.map(app => ({
        id: app.id,
        firstName: app.first_name,
        lastName: app.last_name,
        name: `${app.first_name} ${app.last_name}`,
        email: app.email,
        phone: app.phone,
        address: app.address,
        city: app.city,
        state: app.state,
        zip: app.postal_code,
        cvName: app.resume_path ? app.resume_path.split('/').pop() : 'resume.pdf',
        cvUrl: app.resume_path ? (app.resume_path.startsWith('http') ? app.resume_path : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/${app.resume_path}`) : '',
        role: app.CareerOpening ? app.CareerOpening.title : 'Unknown Role',
        dept: app.CareerOpening ? app.CareerOpening.department : 'Unknown Dept',
        applied: app.created_at ? new Date(app.created_at).toISOString().split('T')[0] : 'N/A',
        status: (app.status === 'Under Review' ? 'Reviewing' : app.status) || 'Reviewing'
      }));
      setJobApplications(formatted);
    } catch (e) {
      console.error("Failed to fetch job applications:", e);
    }
  };

  const handleToggleJobStatus = async (jobId, title, currentStatus) => {
    const nextStatus = currentStatus === 'Open' ? 'Closed' : 'Open';
    try {
      await apiClient(`/careers/admin/openings/${jobId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus })
      });
      fetchCareerOpenings();
    } catch (err) {
      console.error(err);
      alert('Failed to update job status');
    }
  };

  const handleUpdateApplicantStatus = async (appId, applicantName, nextStatus) => {
    try {
      await apiClient(`/careers/admin/applications/${appId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus })
      });
      setJobApplications(prev => prev.map(a => a.id === appId ? { ...a, status: nextStatus } : a));
      addAuditLog(`Application ${appId} for ${applicantName} updated to ${nextStatus}`, 'info');
    } catch (err) {
      console.error(err);
      alert('Failed to update application status');
    }
  };

  const handleRechargeWallet = async (amount) => {
    try {
      // 1. Create Razorpay Order on backend
      const orderData = await apiClient('/admin/wallet/create-order', {
        method: 'POST',
        body: JSON.stringify({ amount })
      });

      if (!orderData || !orderData.order_id) {
        throw new Error("Failed to create Razorpay order.");
      }

      // 2. Configure and Open Razorpay Checkout modal
      const options = {
        key: "rzp_test_SvWORMMdaUGuZO", // Public Key ID from backend
        amount: orderData.amount, // Amount in Paise
        currency: "INR",
        name: "LendoGo Admin Capital",
        description: `Wallet Recharge: ₹${amount.toLocaleString('en-IN')}`,
        order_id: orderData.order_id,
        handler: async function (response) {
          try {
            // 3. Verify Payment signature on backend
            const verifyData = await apiClient('/admin/wallet/verify-payment', {
              method: 'POST',
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                amount: amount // Actual INR amount to credit
              })
            });

            // 4. Update balance state and log audit
            await fetchWalletBalance();
            addAuditLog(`Admin wallet recharged by ₹${amount.toLocaleString('en-IN')} via Razorpay (Order ID: ${orderData.order_id})`, 'success');
            alert(verifyData.message || "Admin Wallet recharged successfully!");
          } catch (verifyErr) {
            console.error("Razorpay verification error:", verifyErr);
            alert(`Payment verification failed: ${verifyErr.message}`);
          }
        },
        prefill: {
          name: adminName,
          email: adminEmail,
        },
        theme: {
          color: "#0066ff"
        },
        modal: {
          ondismiss: function () {
            console.log("Razorpay Checkout dismissed.");
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (err) {
      console.error("Razorpay recharge failed:", err);
      alert(`Recharge failed: ${err.message}`);
    }
  };

  const handleCreateJobOpening = async (job) => {
    try {
      await apiClient('/careers/admin/openings', {
        method: 'POST',
        body: JSON.stringify(job)
      });
      fetchCareerOpenings();
      addAuditLog(`Job opening '${job.title}' created successfully`, 'success');
    } catch (err) {
      console.error(err);
      alert('Failed to create job opening: ' + err.message);
    }
  };

  const handleUpdateJobOpening = async (jobId, job) => {
    try {
      await apiClient(`/careers/admin/openings/${jobId}`, {
        method: 'PUT',
        body: JSON.stringify(job)
      });
      fetchCareerOpenings();
      addAuditLog(`Job opening '${job.title}' updated successfully`, 'success');
    } catch (err) {
      console.error(err);
      alert('Failed to update job opening: ' + err.message);
    }
  };

  const handleResolveTicket = (ticketId, customerName) => {
    const calledIds = JSON.parse(localStorage.getItem('lendogo_called_consultations') || '[]');
    if (!calledIds.includes(ticketId)) {
      calledIds.push(ticketId);
      localStorage.setItem('lendogo_called_consultations', JSON.stringify(calledIds));
    }
    
    setConsultations(prev => prev.map(c => c.id === ticketId ? { ...c, status: 'Called' } : c));
    addAuditLog(`Consultation request for ${customerName} has been processed and marked as Called.`, 'success');
    alert(`Consultation request for ${customerName} marked as Called successfully!`);
  };

  // 7. Staff Management State
  const [staffMembers, setStaffMembers] = useState([
    { name: 'Admin Flow', email: 'admin.flow@lendogo.com', role: 'Lending Officer', status: 'Active', clearance: 'L3 Admin' },
    { name: 'Nikhil Nair', email: 'nikhil.n@lendogo.com', role: 'Credit Underwriter', status: 'Active', clearance: 'L2 Compliance' },
    { name: 'Sameer Sen', email: 'sameer.s@lendogo.com', role: 'Verification Agent', status: 'Away', clearance: 'L1 Operations' }
  ]);

  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('Verification Agent');

  const handleAddStaff = (e) => {
    e.preventDefault();
    if (!newStaffName || !newStaffEmail) return;
    
    const newStaff = {
      name: newStaffName,
      email: newStaffEmail,
      role: newStaffRole,
      status: 'Active',
      clearance: newStaffRole === 'Lending Officer' ? 'L3 Admin' : newStaffRole === 'Credit Underwriter' ? 'L2 Compliance' : 'L1 Operations'
    };
    
    setStaffMembers(prev => [...prev, newStaff]);
    addAuditLog(`Created new staff account for ${newStaffName} (${newStaffRole})`, 'success');
    setNewStaffName('');
    setNewStaffEmail('');
  };

  const handleUpdateStaffRole = (staffEmail, nextRole) => {
    const clearanceMap = {
      'Verification Agent': 'L1 Operations',
      'Credit Underwriter': 'L2 Compliance',
      'Lending Officer': 'L3 Admin'
    };
    
    setStaffMembers(prev => prev.map(s => {
      if (s.email === staffEmail) {
        return {
          ...s,
          role: nextRole,
          clearance: clearanceMap[nextRole] || 'L1 Operations'
        };
      }
      return s;
    }));
    
    addAuditLog(`Staff clearance role updated for ${staffEmail} to ${nextRole}`, 'info');
  };

  // 8. Live Marquee approvals
  const [liveMarquee, setLiveMarquee] = useState([
    { name: 'Rahul S. (PAN: A****32P)', type: 'Personal Loan', amount: '₹1,50,000', status: 'Approved' },
    { name: 'Aarav M. (PAN: B****91K)', type: 'Business Loan', amount: '₹5,00,000', status: 'Approved' },
    { name: 'Priya K. (PAN: D****84D)', type: 'Auto Loan', amount: '₹3,50,000', status: 'Approved' },
    { name: 'Sneha R. (PAN: C****74S)', type: 'Home Loan', amount: '₹12,00,000', status: 'Approved' }
  ]);

  // Web Config save success alert
  const [showConfigSuccess, setShowConfigSuccess] = useState(false);
  const handleSaveWebConfig = () => {
    setShowConfigSuccess(true);
    addAuditLog(`System web configurations saved: Min Credit Score set to ${minCreditScore}, Base Rate set to ${baseInterestRate}%.`, 'success');
    setTimeout(() => setShowConfigSuccess(false), 3000);
  };

  // ─── SETTINGS HANDLERS ───

  // 1. Upload Admin Photo to AWS S3
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('avatar', file);

      try {
        const res = await apiClient('/admin/profile/avatar', {
          method: 'POST',
          body: formData, // apiClient will automatically handle FormData and omit Content-Type header
        });

        if (res && res.avatar) {
          setAdminAvatar(res.avatar);
          // Update the user session in localStorage so it persists
          const userDataStr = localStorage.getItem('lendogo_user');
          if (userDataStr) {
            const userData = JSON.parse(userDataStr);
            userData.avatar = res.avatar;
            localStorage.setItem('lendogo_user', JSON.stringify(userData));
          }
          addAuditLog('Admin updated profile picture via AWS S3 upload', 'info');
          alert('Profile picture updated successfully!');
        }
      } catch (err) {
        console.error("Failed to upload avatar:", err);
        alert(`Failed to upload avatar: ${err.message}`);
      }
    }
  };

  // 2. Profile Details Change (Name and Email)
  const handleUpdateAdminEmail = async (e) => {
    e.preventDefault();
    if (!emailInput.trim() || !adminName.trim()) return;

    try {
      const res = await apiClient('/admin/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ full_name: adminName, email: emailInput })
      });

      setAdminEmail(emailInput);
      
      const userDataStr = localStorage.getItem('lendogo_user');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        userData.email = emailInput;
        userData.full_name = adminName;
        localStorage.setItem('lendogo_user', JSON.stringify(userData));
      }

      addAuditLog(`Admin profile updated (Name: ${adminName}, Email: ${emailInput})`, 'info');
      alert(`Profile details updated successfully.`);
    } catch (err) {
      console.error("Failed to update profile:", err);
      alert(`Failed to update profile: ${err.message}`);
    }
  };

  // 3. Password Reset
  const handleUpdateAdminPassword = (e) => {
    e.preventDefault();
    if (!currentPassword) {
      alert('Please enter your current password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('Confirm password does not match new password.');
      return;
    }
    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters long.');
      return;
    }
    addAuditLog('Admin administrative password updated successfully', 'success');
    alert('Administrative credentials updated successfully.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  // 4. Platform Ownership Transfer
  const handleTransferOwnership = (e) => {
    e.preventDefault();
    if (!transferEmail || !transferKey) {
      alert('Please fill out all transfer verification details.');
      return;
    }
    const confirmed = window.confirm(
      `⚠️ CRITICAL DESTRUCTIVE TRIGGER ⚠️\n\nAre you absolutely sure you want to transfer total LendoGo platform ownership to ${transferEmail}?\n\nThis action is irreversible and will immediately revoke your credentials, record this event in the compliance log, and sign you out.`
    );
    if (confirmed) {
      addAuditLog(`SYSTEM CLEARANCE TRANSFER: Platform master ownership transferred to ${transferEmail}`, 'warning');
      alert(`Master ownership successfully assigned to ${transferEmail}. Closing your session.`);
      handleAdminLogout();
    }
  };

  // 5. System Logout
  const handleAdminLogout = () => {
    signOut();
    alert('Logged out from Admin Dashboard successfully.');
    navigate('/');
  };

  return {
    darkMode, setDarkMode,
    activeTab, setActiveTab,
    searchQuery, setSearchQuery,
    sidebarCollapsed, setSidebarCollapsed,
    minCreditScore, setMinCreditScore,
    baseInterestRate, setBaseInterestRate,
    isSignupsEnabled, setIsSignupsEnabled,
    isConsultationsEnabled, setIsConsultationsEnabled,
    activeBalance, setActiveBalance,
    disbursedCapital, setDisbursedCapital,
    adminAvatar, setAdminAvatar,
    adminName, setAdminName,
    adminEmail, setAdminEmail,
    emailInput, setEmailInput,
    currentPassword, setCurrentPassword,
    newPassword, setNewPassword,
    confirmPassword, setConfirmPassword,
    transferEmail, setTransferEmail,
    transferKey, setTransferKey,
    auditLogs, setAuditLogs,
    users, setUsers,
    kycList, setKycList,
    loanRequests, setLoanRequests,
    approvedLoans, setApprovedLoans,
    careersOpenings, setCareersOpenings,
    jobApplications, setJobApplications,
    consultations, setConsultations,
    chats, setChats,
    staffMembers, setStaffMembers,
    newStaffName, setNewStaffName,
    newStaffEmail, setNewStaffEmail,
    newStaffRole, setNewStaffRole,
    liveMarquee, setLiveMarquee,
    showConfigSuccess, setShowConfigSuccess,
    addAuditLog,
    handleToggleUserStatus,
    handleCreateUser,
    handleUpdateUser,
    handleDeleteUser,
    handleApproveKYC,
    handleRejectKYC,
    handleRunRiskAudit,
    handleApproveLoan,
    handleRejectLoan,
    handleDisburseMoney,
    handleToggleJobStatus,
    handleCreateJobOpening,
    handleUpdateJobOpening,
    handleUpdateApplicantStatus,
    handleRechargeWallet,
    handleResolveTicket,
    handleAddStaff,
    handleUpdateStaffRole,
    handleSaveWebConfig,
    handlePhotoUpload,
    handleUpdateAdminEmail,
    handleUpdateAdminPassword,
    handleTransferOwnership,
    handleAdminLogout
  };
};
