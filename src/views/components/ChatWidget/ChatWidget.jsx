import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthController } from '../../../controllers/auth/useAuthController';
import { useWebConfig } from '../../../context/WebConfigContext';
import './ChatWidget.css';

const ChatWidget = () => {
  const { user } = useAuthController();
  const { webConfig } = useWebConfig();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const chatBodyRef = useRef(null);
  const wsRef = useRef(null);
  const clearTypingRef = useRef(null);
  const typingThrottleRef = useRef(null);

  // Initialize and load chat history when user changes or logs in
  useEffect(() => {
    const isAdminRoute = location.pathname.startsWith('/admin') || user?.role === 'admin';
    const isChatEnabled = !webConfig || webConfig.chat_support_enabled !== false;
    
    if (user && user.isAuthenticated && user.id && !isAdminRoute && isChatEnabled) {
      // No more fake local storage dummy threads!
      setMessages([]);

      // Open a WebSocket connection
      const wsUrl = `${import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080'}/api/ws/chat?user_id=${user.id}&role=user&name=${encodeURIComponent(user.name || user.full_name || '')}&email=${encodeURIComponent(user.email || '')}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Customer Chat Widget WS connected for user", user.id);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.text === 'SYS_TYPING') {
            setIsTyping(true);
            if (clearTypingRef.current) clearTimeout(clearTypingRef.current);
            clearTypingRef.current = setTimeout(() => setIsTyping(false), 2000);
            return;
          }

          setMessages(prev => {
            setIsTyping(false); // Clear typing when message arrives
            // Avoid duplicate appending if it's already the last message
            const isDuplicate = prev.length > 0 && 
              prev[prev.length - 1].text === data.text && 
              (prev[prev.length - 1].sender === (data.is_from_admin ? 'credy' : 'user'));
            
            if (isDuplicate) return prev;

            const newMsg = {
              sender: data.is_from_admin ? 'credy' : 'user',
              text: data.text,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            const updated = [...prev, newMsg];
            
            return updated;
          });
        } catch (err) {
          console.error("Error parsing user WS message:", err);
        }
      };

      ws.onclose = () => {
        console.log("Customer Chat Widget WS disconnected");
      };

      return () => {
        ws.close();
      };
    } else {
      setMessages([]);
      setIsOpen(false);
    }
  }, [user]);

  // 30-minute auto-clear inactivity timer
  const lastActivityRef = useRef(Date.now());
  
  useEffect(() => {
    // Update ref whenever messages change
    if (messages.length > 0) {
      lastActivityRef.current = Date.now();
    }
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (messages.length > 0) {
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;
        if (timeSinceLastActivity >= 30 * 60 * 1000) { // 30 minutes
          console.log("Chat cleared due to 30 minutes of inactivity.");
          setMessages([]);
        }
      }
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [messages.length]);

  // Scroll to bottom whenever messages or typing state changes
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages, isTyping, isOpen]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMsg = {
      sender: 'user',
      text: inputValue,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    const sentText = inputValue;
    setInputValue('');

    // Send via WebSocket if open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        text: sentText,
        is_from_admin: false,
        receiver_id: "0"
      }));
    }

    // Trigger virtual reply if message matches a greeting and WebSocket is not connected
    const queryText = sentText.toLowerCase().trim();
    const isGreeting = ['hi', 'hello', 'hey', 'hy'].some(g => queryText.includes(g));
    if (isGreeting && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
      setIsTyping(true);
      setTimeout(() => {
        const replyText = `Hello, ${user.name || 'User'}! I hope you are having a wonderful day. How can I assist you today?`;
        
        const credyReply = {
          sender: 'credy',
          text: replyText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, credyReply]);
        setIsTyping(false);
      }, 1000);
    }
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    
    // Broadcast typing signal every 1.5 seconds if actively typing
    if (!typingThrottleRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ text: 'SYS_TYPING', is_from_admin: false, receiver_id: "0" }));
      typingThrottleRef.current = setTimeout(() => {
        typingThrottleRef.current = null;
      }, 1500);
    }
  };

  const handleOpenChat = () => {
    if (webConfig && webConfig.chat_support_enabled === false) {
      window.dispatchEvent(new CustomEvent('lendogo-toast', { 
        detail: { message: "Chat Support is currently temporarily disabled by the administrator.", type: "warning" } 
      }));
      return;
    }
    setIsClosing(false);
    setIsOpen(true);
  };

  const handleCloseChat = () => {
    setIsClosing(true);
    // Wait for the slideOut animation to complete before unmounting/hiding
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 490); // Matches the CSS transition duration
  };

  // Only render if user is authenticated/logged in, and is NOT on an admin page/role
  if (!user || !user.isAuthenticated || user.role === 'admin' || location.pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <>
      {/* Floating Action Button (FAB) */}
      {!isOpen && (
        <button 
          className="credy-chat-fab" 
          onClick={handleOpenChat}
          title="Ask Credy Support"
          aria-label="Ask Credy Support"
        >
          <img src="https://res.cloudinary.com/dfyhke26f/image/upload/q_auto/f_auto/v1781686366/ask_credy_avatar_tp1jsb.webp" alt="Credy Avatar" className="credy-chat-fab-img" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className={`credy-chat-window ${isClosing ? 'closing' : ''}`}>
          {/* Header */}
          <div className="credy-chat-header">
            <h3 className="credy-chat-title">Ask Credy</h3>
            <p className="credy-chat-subtitle">How can I help you today?</p>
            
            <div className="credy-chat-header-avatar">
              <img src="https://res.cloudinary.com/dfyhke26f/image/upload/q_auto/f_auto/v1781686366/ask_credy_avatar_tp1jsb.webp" alt="Credy Avatar" />
            </div>

            <button 
              type="button" 
              className="credy-chat-close-btn" 
              onClick={handleCloseChat}
              aria-label="Close Chat Window"
            >
              &times;
            </button>
          </div>

          {/* Messages Body */}
          <div className="credy-chat-body" ref={chatBodyRef}>
            {messages.map((msg) => (
              <div key={msg.id} className={`credy-msg-row ${msg.sender}`}>
                <div className="credy-msg-bubble">
                  {msg.text}
                </div>
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="credy-msg-row credy">
                <div className="credy-typing-bubble">
                  <span className="credy-typing-dot"></span>
                  <span className="credy-typing-dot"></span>
                  <span className="credy-typing-dot"></span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Input Bar */}
          <form className="credy-chat-footer" onSubmit={handleSendMessage}>
            <div className="credy-chat-input-wrapper">
              <input 
                type="text" 
                className="credy-chat-input" 
                placeholder="Type your message.." 
                value={inputValue}
                onChange={handleInputChange}
                maxLength={500}
              />
              <button 
                type="submit" 
                className="credy-chat-send-btn" 
                disabled={!inputValue.trim()}
                title="Send Message"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
