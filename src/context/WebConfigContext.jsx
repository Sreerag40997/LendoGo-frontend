import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../utils/apiClient';

const WebConfigContext = createContext(null);

export const WebConfigProvider = ({ children }) => {
  const [webConfig, setWebConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      const res = await apiClient('/config');
      if (res && res.data) {
        setWebConfig(res.data);
      }
    } catch (e) {
      console.error("Failed to fetch web config:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    
    // Connect to the public system broadcast WebSocket
    const ws = new WebSocket(`${import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080'}/api/admin/ws`);
    
    ws.onopen = () => console.log("System WebConfig Syncer connected!");
    
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'SYS_CONFIG_UPDATE') {
          console.log("🔥 Instant Web Config Update Received via WS:", payload.data);
          setWebConfig(payload.data);
        }
      } catch (e) {
        // ignore parse errors
      }
    };
    
    ws.onclose = () => console.log("System WebConfig Syncer disconnected");

    // Poll every 3 minutes just as a fallback
    const intervalId = setInterval(fetchConfig, 180000);
    
    return () => {
      clearInterval(intervalId);
      ws.close();
    };
  }, []);

  return (
    <WebConfigContext.Provider value={{ webConfig, loading, refreshConfig: fetchConfig }}>
      {children}
    </WebConfigContext.Provider>
  );
};

export const useWebConfig = () => {
  const context = useContext(WebConfigContext);
  if (!context) {
    throw new Error('useWebConfig must be used within a WebConfigProvider');
  }
  return context;
};
