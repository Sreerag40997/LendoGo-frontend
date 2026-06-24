import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../../../../utils/apiClient';

const permissionModules = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    permissions: [{ id: 'dashboard_view', label: 'View Dashboard' }]
  },
  {
    id: 'loan_app',
    title: 'Loan Applications',
    permissions: [
      { id: 'loan_app_view', label: 'View Applications' },
      { id: 'loan_app_update', label: 'Update Applications' }
    ]
  },
  {
    id: 'kyc',
    title: 'KYC Verifications',
    permissions: [
      { id: 'kyc_view', label: 'View KYC' },
      { id: 'kyc_update', label: 'Update KYC' }
    ]
  },
  {
    id: 'user_management',
    title: 'User Management',
    permissions: [
      { id: 'user_create', label: 'Create User' },
      { id: 'user_read', label: 'Read User' },
      { id: 'user_update', label: 'Update User' },
      { id: 'user_delete', label: 'Delete User' }
    ]
  },
  {
    id: 'careers',
    title: 'Careers',
    groups: [
      {
        title: 'View Applications',
        permissions: [
          { id: 'career_app_view', label: 'View Applications' },
          { id: 'career_app_update', label: 'Update Applications' }
        ]
      },
      {
        title: 'Post Job',
        permissions: [
          { id: 'career_job_create', label: 'Create Post' },
          { id: 'career_job_read', label: 'Read Post' },
          { id: 'career_job_update', label: 'Update Post' },
          { id: 'career_job_delete', label: 'Delete Post' }
        ]
      }
    ]
  },
  {
    id: 'customer_care',
    title: 'Customer Care',
    groups: [
      {
        title: 'Free Consultation',
        permissions: [
          { id: 'cc_consult_view', label: 'View Consultation' },
          { id: 'cc_consult_update', label: 'Update Consultation' }
        ]
      },
      {
        title: 'Chat Support',
        permissions: [
          { id: 'cc_chat_view', label: 'View Chat' },
          { id: 'cc_chat_update', label: 'Update Chat' }
        ]
      }
    ]
  },
  {
    id: 'due_date',
    title: 'Due Date',
    groups: [
      {
        title: 'Due Date',
        permissions: [
          { id: 'due_view', label: 'View Due Date' },
          { id: 'due_update', label: 'Update Due Date' }
        ]
      },
      {
        title: 'Over Due',
        permissions: [
          { id: 'overdue_view', label: 'View Over Due' },
          { id: 'overdue_update', label: 'Update Over Due' }
        ]
      }
    ]
  },
  {
    id: 'blog',
    title: 'Blog Management',
    permissions: [
      { id: 'blog_create', label: 'Create Blog' },
      { id: 'blog_read', label: 'Read Blog' },
      { id: 'blog_update', label: 'Update Blog' },
      { id: 'blog_delete', label: 'Delete Blog' }
    ]
  }
];

const allPermissionIds = permissionModules.flatMap(m => {
  if (m.permissions) return m.permissions.map(p => p.id);
  if (m.groups) return m.groups.flatMap(g => g.permissions.map(p => p.id));
  return [];
});

const RolePermissionsTab = () => {
  const [selectedPerms, setSelectedPerms] = useState(allPermissionIds);
  const [isLoading, setIsLoading] = useState(true);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    const fetchPerms = async () => {
      try {
        const res = await apiClient('/admin/global-permissions');
        if (res.permissions && res.permissions !== '[]') {
          setSelectedPerms(JSON.parse(res.permissions));
        } else {
          // If empty in backend, default to all on
          setSelectedPerms(allPermissionIds);
        }
      } catch (e) {
        console.error("Failed to fetch global permissions", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPerms();

    const handleUpdate = () => {
      isFirstLoad.current = true; // prevent circular save
      fetchPerms();
    };
    window.addEventListener('admin-permissions-updated', handleUpdate);
    return () => window.removeEventListener('admin-permissions-updated', handleUpdate);
  }, []);

  useEffect(() => {
    if (isFirstLoad.current || isLoading) {
      isFirstLoad.current = false;
      return;
    }

    const savePerms = async () => {
      try {
        // Save to backend
        await apiClient('/admin/global-permissions', {
          method: 'POST',
          body: JSON.stringify({ permissions: selectedPerms })
        });

        // Broadcast to all connected clients via Chat Websocket Hub
        const wsUrl = `${import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080'}/api/ws/chat?user_id=0&role=admin&name=System&email=system`;
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          ws.send(JSON.stringify({
            text: 'SYS_PERMISSIONS_UPDATE',
            is_from_admin: true,
            receiver_id: 'ALL'
          }));
          setTimeout(() => ws.close(), 500);
        };
      } catch (e) {
        console.error("Failed to save global permissions", e);
      }
    };
    
    savePerms();
  }, [selectedPerms, isLoading]);

  const isAllSelected = selectedPerms.length === allPermissionIds.length && allPermissionIds.length > 0;

  const handleGlobalToggle = () => {
    if (isAllSelected) {
      setSelectedPerms([]);
    } else {
      setSelectedPerms(allPermissionIds);
    }
  };

  const handleModuleToggle = (moduleIds, isModuleAllSelected) => {
    if (isModuleAllSelected) {
      setSelectedPerms(prev => prev.filter(id => !moduleIds.includes(id)));
    } else {
      setSelectedPerms(prev => {
        const newPerms = new Set(prev);
        moduleIds.forEach(id => newPerms.add(id));
        return Array.from(newPerms);
      });
    }
  };

  const handleToggle = (id) => {
    setSelectedPerms(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  return (
    <div className="tab-pane-container animate-fade-in" style={{ paddingBottom: '40px' }}>
      
      {/* Global Toggle Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap',
        gap: '20px',
        marginBottom: '30px', 
        padding: '24px', 
        background: 'var(--admin-card)', 
        border: '1px solid var(--admin-border)', 
        borderRadius: '16px',
        boxShadow: '0 4px 20px var(--admin-shadow)'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--admin-text)' }}>Role Permissions</h2>        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--admin-bg)', padding: '12px 20px', borderRadius: '12px' }}>
          <span style={{ fontWeight: '600', color: 'var(--admin-text)' }}>Select All</span>
          <label className="toggle-switch" style={{ margin: 0 }}>
            <input type="checkbox" checked={isAllSelected} onChange={handleGlobalToggle} />
            <span className="slider-round" />
          </label>
        </div>
      </div>

      {/* Cards Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
        gap: '24px' 
      }}>
        {permissionModules.map(module => {
          const moduleIds = module.permissions 
            ? module.permissions.map(p => p.id) 
            : module.groups.flatMap(g => g.permissions.map(p => p.id));
          const isModuleAllSelected = moduleIds.length > 0 && moduleIds.every(id => selectedPerms.includes(id));

          return (
            <div key={module.id} style={{ 
              background: 'var(--admin-card)', 
              border: '1px solid var(--admin-border)', 
              borderRadius: '16px', 
              padding: '24px', 
              display: 'flex', 
              flexDirection: 'column',
              boxShadow: '0 4px 20px var(--admin-shadow)',
              color: 'var(--admin-text)'
            }}>
              
              {/* Card Header */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                borderBottom: '1px solid var(--admin-border)', 
                paddingBottom: '16px', 
                marginBottom: '20px' 
              }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '600' }}>{module.title}</h3>
                <label className="toggle-switch" style={{ margin: 0 }}>
                  <input type="checkbox" checked={isModuleAllSelected} onChange={() => handleModuleToggle(moduleIds, isModuleAllSelected)} />
                  <span className="slider-round" />
                </label>
              </div>

              {/* Permissions List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
                {module.permissions && module.permissions.map(perm => (
                  <div key={perm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: '500', color: 'var(--admin-text)' }}>{perm.label}</span>
                    <label className="toggle-switch" style={{ transform: 'scale(0.85)', margin: 0 }}>
                      <input type="checkbox" checked={selectedPerms.includes(perm.id)} onChange={() => handleToggle(perm.id)} />
                      <span className="slider-round" />
                    </label>
                  </div>
                ))}

                {module.groups && module.groups.map((group, idx) => (
                  <div key={idx} style={{ 
                    marginBottom: idx !== module.groups.length - 1 ? '12px' : '0',
                    background: 'var(--admin-bg)',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--admin-border)'
                  }}>
                    <h4 style={{ 
                      margin: '0 0 12px 0', 
                      fontSize: '0.8rem', 
                      color: 'var(--admin-text-light)', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.8px',
                      fontWeight: '700'
                    }}>{group.title}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {group.permissions.map(perm => (
                        <div key={perm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--admin-text)' }}>{perm.label}</span>
                          <label className="toggle-switch" style={{ transform: 'scale(0.85)', margin: 0 }}>
                            <input type="checkbox" checked={selectedPerms.includes(perm.id)} onChange={() => handleToggle(perm.id)} />
                            <span className="slider-round" />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RolePermissionsTab;
