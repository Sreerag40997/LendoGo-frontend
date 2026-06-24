import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserModel } from '../../models/UserModel';
import { apiClient } from '../../utils/apiClient';

const AuthContext = createContext(null);

const getEffectivePermissions = (assignedAreas, globalPermsOverride = null) => {
  try {
    let globalPerms = globalPermsOverride;
    
    if (!globalPerms) {
      const savedGlobalPermsStr = localStorage.getItem('lendogo_role_permissions_ui');
      if (savedGlobalPermsStr) {
        globalPerms = JSON.parse(savedGlobalPermsStr);
      } else {
        globalPerms = [
          'dashboard_view', 'loan_app_view', 'loan_app_update', 'kyc_view', 'kyc_update',
          'user_create', 'user_read', 'user_update', 'user_delete',
          'career_app_view', 'career_app_update', 'career_job_create', 'career_job_update',
          'cc_consult_view', 'cc_chat_view', 'due_view', 'blog_create', 'blog_read', 'blog_update', 'blog_delete'
        ];
      }
    }
    
    const effective = {};
    const mapping = {
      'Dashboard': ['dashboard_view'],
      'Loan Applications': ['loan_app_view', 'loan_app_update'],
      'KYC Verifications': ['kyc_view', 'kyc_update'],
      'User Management': ['user_create', 'user_read', 'user_update', 'user_delete'],
      'Careers': ['career_app_view', 'career_app_update', 'career_job_create', 'career_job_update'],
      'Customer Care': ['cc_consult_view', 'cc_chat_view'],
      'Due Date': ['due_view'],
      'Blog Management': ['blog_create', 'blog_read', 'blog_update', 'blog_delete']
    };

    // First, copy everything
    Object.keys(assignedAreas).forEach(k => {
      effective[k] = assignedAreas[k];
    });

    // Then strictly override the granular operations based on global toggles + area assignment
    Object.keys(mapping).forEach(area => {
      // If the area is assigned, intersection with global perms
      if (assignedAreas[area] === true || effective[area] === true) {
        effective[area] = true;
        mapping[area].forEach(op => {
          effective[op] = globalPerms.includes(op);
        });
      } else {
        // Area not assigned, all operations disabled
        effective[area] = false;
        mapping[area].forEach(op => {
          effective[op] = false;
        });
      }
    });

    return effective;
  } catch (err) {
    return assignedAreas;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('lendogo_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.isAuthenticated) {
          parsed.permissions = getEffectivePermissions(parsed.permissions || {});
          return new UserModel(parsed);
        }
      } catch (e) {
        console.error("Error parsing saved user from localStorage:", e);
      }
    }
    return new UserModel({});
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Global Permissions Syncer & Realtime WebSocket Updater
  useEffect(() => {
    if (user && user.isAuthenticated && user.id) {
      const fetchGlobalPerms = async () => {
        // Only fetch global permissions if the user is staff/admin
        if (user.role === 'user') return;
        
        try {
          const res = await apiClient('/admin/global-permissions');
          let perms = [];
          if (res.permissions && res.permissions !== '[]') {
            perms = JSON.parse(res.permissions);
          } else {
            perms = [
              'dashboard_view', 'loan_app_view', 'loan_app_update', 'kyc_view', 'kyc_update',
              'user_create', 'user_read', 'user_update', 'user_delete',
              'career_app_view', 'career_app_update', 'career_job_create', 'career_job_update',
              'cc_consult_view', 'cc_chat_view', 'due_view', 'blog_create', 'blog_read', 'blog_update', 'blog_delete'
            ];
          }
          localStorage.setItem('lendogo_role_permissions_ui', JSON.stringify(perms));
          setUser(prev => {
             const updated = new UserModel(prev);
             updated.permissions = getEffectivePermissions(prev.permissions || {}, perms);
             return updated;
          });
        } catch (e) {
          console.error("Failed to fetch global perms", e);
        }
      };

      fetchGlobalPerms();

      // Realtime System Broadcast WebSockets
      const wsUrl = `${import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080'}/api/ws/chat?user_id=${user.id}&role=${encodeURIComponent(user.role)}&name=SystemSync&email=system`;
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
         try {
           const data = JSON.parse(event.data);
           if (data.text === 'SYS_PERMISSIONS_UPDATE') {
             console.log("🔥 System broadcast received: Reloading permissions!");
             fetchGlobalPerms();
           }
         } catch(e) {}
      };
      
      return () => ws.close();
    }
  }, [user?.id]);

  const signIn = async (email, password) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiClient('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      
      // 👇 FIX: Handle Go's nested "data" response
      const backendUser = data.data || data;

      const loggedInUser = new UserModel({
        id: backendUser.id || 'unknown',
        email: backendUser.email || email,
        name: backendUser.full_name || backendUser.fullName || backendUser.name || 'LendoGO User', // Map Go's snake_case
        avatar: backendUser.avatar || '',
        role: backendUser.role || 'user',              // Capture the role!
        permissions: getEffectivePermissions(backendUser.permissions || {}),    // Capture permissions!
        isAuthenticated: true,
      });
      
      localStorage.setItem('lendogo_user', JSON.stringify(loggedInUser));
      if (data.token) {
        localStorage.setItem('lendogo_token', data.token);
      }
      setUser(loggedInUser);
      
      // 👇 FIX: Return the user so SignInForm can use it for routing
      return loggedInUser; 
    } catch (err) {
      const errMsg = err.message === 'Failed to fetch' || err.message.includes('network')
        ? 'Could not connect to the authentication server. Please check if the backend is running.'
        : err.message || 'An error occurred during sign in.';
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    // Purge all cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date(0).toUTCString() + ";path=/");
    });
    // Purge all localStorage keys to leave no trace of previous user data
    localStorage.clear();
    setUser(new UserModel({}));
  };

  const loginUserLocally = (userData) => {
    const loggedInUser = new UserModel({
      id: userData.id || 'unknown',
      email: userData.email,
      name: userData.name || userData.fullName || 'LendoGO User',
      avatar: userData.avatar || '',
      role: userData.role || 'user',
      permissions: getEffectivePermissions(userData.permissions || {}),
      isAuthenticated: true,
    });
    localStorage.setItem('lendogo_user', JSON.stringify(loggedInUser));
    if (userData.token) {
      localStorage.setItem('lendogo_token', userData.token);
    }
    setUser(loggedInUser);
  };

  return React.createElement(
    AuthContext.Provider,
    { value: { user, loading, error, signIn, signOut, loginUserLocally, setUser } },
    children
  );
};

export const useAuthController = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthController must be used within an AuthProvider');
  }
  return context;
};