import React, { useState, useEffect, useRef } from 'react';
import { useAuthController } from '../../../../../controllers/auth/useAuthController';

const calculateChatDuration = (startStr) => {
  if (!startStr) return '5 mins';
  try {
    const today = new Date();
    const parts = startStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!parts) return '5 mins';
    let hours = parseInt(parts[1], 10);
    const minutes = parseInt(parts[2], 10);
    const isPM = parts[3].toUpperCase() === 'PM';
    if (isPM && hours < 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
    
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, 0);
    const diffMs = today - startDate;
    if (diffMs < 0) return '5 mins'; 
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 1) return '1 min';
    if (diffMins > 60) {
      const hrs = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hrs} hr${hrs > 1 ? 's' : ''} ${mins} min${mins !== 1 ? 's' : ''}`;
    }
    return `${diffMins} mins`;
  } catch (err) {
    return '5 mins';
  }
};

const ChatSupportPanel = ({ chats, setChats, users }) => {
  const { user } = useAuthController();
  const adminId = user?.id || 'admin';
  const adminEmail = user?.email || 'admin@lendogo.com';
  const adminName = user?.name || user?.full_name || 'Admin';

  const [selectedChatId, setSelectedChatId] = useState(() => {
    const firstActive = (chats || []).find(c => c.status === 'Active');
    return firstActive ? firstActive.id : null;
  });
  const [chatSearch, setChatSearch] = useState('');
  const [chatFilter, setChatFilter] = useState('Active'); // 'Active' or 'Resolved'
  const [replyInput, setReplyInput] = useState('');
  const [viewingHistoryChat, setViewingHistoryChat] = useState(null);

  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const typingTimeoutsRef = useRef({});
  const typingThrottleRef = useRef(null);

  // Connect to Admin Chat WebSocket on mount
  useEffect(() => {
    const wsUrl = `${import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080'}/api/ws/chat?user_id=0&role=admin&name=${encodeURIComponent(adminName)}&email=${encodeURIComponent(adminEmail)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Admin Chat Console WS connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.is_from_admin) return; // Skip messages sent by admin themselves

        const senderId = data.sender_id;
        const matchedUser = (users || []).find(u => u.id && u.id.toString().toLowerCase() === senderId.toString().toLowerCase());
        if (data.text === 'SYS_TYPING') {
          setChats(prevChats => {
            const threadIndex = prevChats.findIndex(c => c.userId?.toString() === senderId.toString() || c.id === `CHT-${senderId}`);
            if (threadIndex !== -1) {
              const updatedChats = [...prevChats];
              updatedChats[threadIndex] = { ...updatedChats[threadIndex], isTyping: true };
              return updatedChats;
            }
            return prevChats;
          });
          
          if (typingTimeoutsRef.current[senderId]) clearTimeout(typingTimeoutsRef.current[senderId]);
          typingTimeoutsRef.current[senderId] = setTimeout(() => {
            setChats(prevChats => {
              const threadIndex = prevChats.findIndex(c => c.userId?.toString() === senderId.toString() || c.id === `CHT-${senderId}`);
              if (threadIndex !== -1) {
                const updatedChats = [...prevChats];
                updatedChats[threadIndex] = { ...updatedChats[threadIndex], isTyping: false };
                return updatedChats;
              }
              return prevChats;
            });
          }, 2000);
          return;
        }

        const senderName = data.sender_name || matchedUser?.name || `Borrower #${senderId}`;
        const senderEmail = data.sender_email || matchedUser?.email || `borrower.${senderId}@lendogo.com`;
        const text = data.text;
        const time = data.timestamp ? new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        setChats(prevChats => {
          const threadIndex = prevChats.findIndex(c => 
            c.userId?.toString() === senderId.toString() || 
            c.id === `CHT-${senderId}`
          );

          const newMsg = {
            sender: 'user',
            text: text,
            time: time
          };

          if (threadIndex !== -1) {
            const thread = prevChats[threadIndex];
            const messagesList = thread.messages || [];
            const isDuplicate = messagesList.length > 0 && 
              messagesList[messagesList.length - 1].text === text && 
              messagesList[messagesList.length - 1].sender === 'user';
            
            if (isDuplicate) return prevChats;

            const updatedChats = [...prevChats];
            const updatedThread = { ...thread };
            updatedThread.messages = [...messagesList, newMsg];
            updatedThread.lastMsg = text;
            updatedThread.date = 'Just now';
            updatedThread.status = 'Active';
            updatedThread.client = thread.client && !thread.client.startsWith('Borrower #') ? thread.client : senderName;
            updatedThread.email = thread.email || senderEmail;
            updatedThread.isTyping = false; // clear typing
            updatedThread.lastActivity = Date.now();
            updatedChats[threadIndex] = updatedThread;
            return updatedChats;
          } else {
            // Create a new thread dynamically for this user
            const newThread = {
              id: `CHT-${senderId}`,
              userId: senderId,
              client: senderName,
              email: senderEmail,
              lastMsg: text,
              date: 'Just now',
              status: 'Active',
              startTime: time,
              lastActivity: Date.now(),
              avatar: matchedUser?.avatar || '',
              messages: [newMsg]
            };
            return [newThread, ...prevChats];
          }
        });
      } catch (err) {
        console.error("Error parsing admin WS message:", err);
      }
    };

    ws.onclose = () => {
      console.log("Admin Chat Console WS disconnected");
    };

    return () => {
      ws.close();
    };
  }, [setChats, adminId, adminName, adminEmail, users]);

  // Auto scroll to bottom of active chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedChatId, chats]);

  const handleResolveChat = (id, client) => {
    const now = new Date();
    const endTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setChats(prev => prev.map(c => {
      if (c.id === id) {
        const dur = calculateChatDuration(c.startTime);
        return { 
          ...c, 
          status: 'Resolved', 
          lastMsg: 'Thread closed by support agent.',
          endTime: endTimeStr,
          duration: dur,
          messages: [...(c.messages || []), { sender: 'credy', text: 'Thread closed by support agent.', time: 'Just now' }]
        };
      }
      return c;
    }));
    
    // Broadcast closure message to the specific user via WebSocket
    const chatToClose = (chats || []).find(c => c.id === id);
    if (chatToClose && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const receiverId = chatToClose.userId ? chatToClose.userId.toString() : id.replace('CHT-', '');
      wsRef.current.send(JSON.stringify({
        text: 'The support agent has ended this session. Thank you for contacting LendoGo!',
        is_from_admin: true,
        receiver_id: receiverId
      }));
    }

    setSelectedChatId(null);
    alert(`Chat thread ${id} for ${client} has been marked as Resolved.`);
  };

  // 1. Filter chats by Active vs Resolved and Search Query (client name/email)
  const filteredChats = (chats || []).filter(c => {
    const matchesFilter = c.status === chatFilter;
    const matchesSearch = c.client.toLowerCase().includes(chatSearch.toLowerCase()) || 
                          c.email.toLowerCase().includes(chatSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Sort active chats by lastActivity descending so newest active chats appear at the top
  const sortedFilteredChats = [...filteredChats].sort((a, b) => {
    const timeA = a.lastActivity || 0;
    const timeB = b.lastActivity || 0;
    return timeB - timeA;
  });

  // 2. Get currently selected active chat
  const activeChat = (chats || []).find(c => c.id === selectedChatId && c.status === 'Active');

  // 3. Handle sending reply message
  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyInput.trim() || !activeChat) return;

    const sentText = replyInput;
    setReplyInput('');

    const newMsg = {
      sender: 'credy', // Admin/Credy reply
      text: sentText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChats(prev => prev.map(c => {
      if (c.id === activeChat.id) {
        return {
          ...c,
          lastMsg: sentText,
          date: 'Just now',
          lastActivity: Date.now(),
          messages: [...(c.messages || []), newMsg]
        };
      }
      return c;
    }));

    const receiverId = activeChat.userId ? activeChat.userId.toString() : activeChat.id.replace('CHT-', '');

    // Send via WebSocket if open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        text: sentText,
        is_from_admin: true,
        receiver_id: receiverId
      }));
    } else {
      // Fallback simulated reply back from the user after 1.5s (only if offline/no WS server)
      setTimeout(() => {
        let simulatedReply = "";
        const userMessageText = sentText.toLowerCase();
        if (userMessageText.includes("hello") || userMessageText.includes("hi") || userMessageText.includes("hey") || userMessageText.includes("hy")) {
          simulatedReply = "Thank you for joining the chat! Can you help me check my loan eligibility status?";
        } else if (userMessageText.includes("loan") || userMessageText.includes("eligibility") || userMessageText.includes("amount") || userMessageText.includes("lakhs")) {
          simulatedReply = "Awesome. I have uploaded my PAN Card and bank statement. Could you please review and expedite it?";
        } else if (userMessageText.includes("kyc") || userMessageText.includes("document") || userMessageText.includes("upload")) {
          simulatedReply = "Done, I see the verification is pending. Let me know if you need any other documents.";
        } else {
          simulatedReply = "Understood. Thank you for your support, I will wait for further updates.";
        }

        // Only append if the chat is still active and exists
        setChats(prev => prev.map(c => {
          if (c.id === activeChat.id && c.status === 'Active') {
            const currentMsgs = c.messages || [];
            // Only add if the admin was indeed the last sender (avoiding duplicate triggers)
            if (currentMsgs.length > 0 && currentMsgs[currentMsgs.length - 1].sender === 'credy') {
              return {
                ...c,
                lastMsg: simulatedReply,
                date: 'Just now',
                lastActivity: Date.now(),
                messages: [...currentMsgs, { sender: 'user', text: simulatedReply, time: 'Just now' }]
              };
            }
          }
          return c;
        }));
      }, 1500);
    }
  };

  const handleAdminTyping = (e) => {
    setReplyInput(e.target.value);
    
    if (!typingThrottleRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN && activeChat) {
      const receiverId = activeChat.userId ? activeChat.userId.toString() : activeChat.id.replace('CHT-', '');
      wsRef.current.send(JSON.stringify({
        text: 'SYS_TYPING',
        is_from_admin: true,
        receiver_id: receiverId
      }));
      typingThrottleRef.current = setTimeout(() => {
        typingThrottleRef.current = null;
      }, 1500);
    }
  };

  // 4. Handle exporting the chat log
  const handleExportChat = (chat) => {
    if (!chat) return;
    const messagesText = (chat.messages || []).map(m => {
      const senderLabel = m.sender === 'user' ? chat.client : 'Support Agent (Credy)';
      return `[${m.time || 'N/A'}] ${senderLabel}: ${m.text}`;
    }).join('\n');
    
    const fileContent = `==================================================
LENDOGO CUSTOMER CARE CHAT EXPORT
==================================================
Thread ID:     ${chat.id}
Client Name:   ${chat.client}
Email Contact: ${chat.email}
Chat Status:   ${chat.status}
Started At:    ${chat.startTime || 'N/A'}
Resolved At:   ${chat.endTime || 'N/A'}
Chat Duration: ${chat.duration || 'N/A'}
==================================================

Chat History:
--------------------------------------------------
${messagesText}
--------------------------------------------------
Exported on:   ${new Date().toLocaleString()}
==================================================`;

    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LendoGo_ChatLog_${chat.id}_${chat.client.replace(/\s+/g, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ width: '100%' }}>
      <style>{`
        .admin-typing-dot {
          width: 6px;
          height: 6px;
          background-color: var(--admin-text-light, #a0aec0);
          border-radius: 50%;
          display: inline-block;
          animation: adminBounce 1.4s infinite ease-in-out both;
        }
        @keyframes adminBounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
      <div className="section-header-row">
        <h2>Customer Support Chat Console</h2>
      </div>

      {/* Tab toggles: Active vs Resolved (History Report) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '20px' }}>
        <div className="admin-chat-tab-toggle" style={{ width: '380px' }}>
          <button 
            className={`admin-chat-tab-btn ${chatFilter === 'Active' ? 'active' : ''}`}
            onClick={() => {
              setChatFilter('Active');
              const firstActive = (chats || []).find(c => c.status === 'Active');
              if (firstActive) setSelectedChatId(firstActive.id);
            }}
          >
            Active Chats
          </button>
          <button 
            className={`admin-chat-tab-btn ${chatFilter === 'Resolved' ? 'active' : ''}`}
            onClick={() => {
              setChatFilter('Resolved');
            }}
          >
            Chat History (Resolved)
          </button>
        </div>

        {/* Search bar */}
        <div className="admin-chat-search" style={{ width: '280px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--admin-text-light)' }}>
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input 
            type="text" 
            className="admin-chat-search-input" 
            placeholder="Search borrower or email..." 
            value={chatSearch}
            onChange={(e) => setChatSearch(e.target.value)}
          />
        </div>
      </div>

      {chatFilter === 'Active' ? (
        /* ACTIVE CHATS: Split layout sidebar + messages pane */
        <div className="admin-chat-layout animate-fade-in">
          <div className="admin-chat-sidebar" style={{ borderTop: 'none' }}>
            <div className="admin-chat-threads-list">
              {sortedFilteredChats.length > 0 ? (
                sortedFilteredChats.map(c => {
                  const lastMsgObj = c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1] : null;
                  const isNewPending = c.status === 'Active' && lastMsgObj && lastMsgObj.sender === 'user';
                  
                  return (
                    <div 
                      key={c.id} 
                      className={`admin-chat-thread-card ${selectedChatId === c.id ? 'active' : ''}`}
                      onClick={() => setSelectedChatId(c.id)}
                    >
                      {c.avatar ? (
                        <img 
                          src={c.avatar} 
                          alt={c.client} 
                          className="admin-chat-thread-avatar"
                        />
                      ) : (
                        <div className="admin-chat-thread-avatar-fallback">
                          {(c.client || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="admin-chat-thread-info">
                        <div className="admin-chat-thread-top">
                          <span className="admin-chat-thread-name">{c.client}</span>
                          <span className="admin-chat-thread-time">{c.date}</span>
                        </div>
                        <span className="admin-chat-thread-msg" style={{ fontWeight: isNewPending ? '800' : 'normal', color: isNewPending ? 'var(--admin-text)' : 'var(--admin-text-light)' }}>
                          {c.lastMsg}
                        </span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                          <span className="admin-chat-thread-status active-tag">
                            {c.status}
                          </span>
                          {isNewPending && (
                            <span className="admin-chat-thread-badge">New</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--admin-text-light)', fontSize: '0.8rem' }}>
                  No active chats found.
                </div>
              )}
            </div>
          </div>

          <div className="admin-chat-main">
            {activeChat ? (
              <>
                {/* Chat Header */}
                <div className="admin-chat-header">
                  <div className="admin-chat-header-user">
                    {activeChat.avatar ? (
                      <img 
                        src={activeChat.avatar} 
                        alt={activeChat.client} 
                        className="admin-chat-header-avatar"
                      />
                    ) : (
                      <div className="admin-chat-header-avatar-fallback">
                        {(activeChat.client || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="admin-chat-header-details">
                      <div className="admin-chat-header-name">{activeChat.client}</div>
                      <div className="admin-chat-header-email">{activeChat.email}</div>
                    </div>
                  </div>

                  <div className="admin-chat-header-actions">
                    <button 
                      className="admin-chat-btn-end" 
                      onClick={() => handleResolveChat(activeChat.id, activeChat.client)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                      </svg>
                      End Session
                    </button>
                  </div>
                </div>

                {/* Messages List Area */}
                <div className="admin-chat-messages-area">
                  {(activeChat.messages || []).map((m, idx) => (
                    <div key={idx} className={`admin-chat-msg-row ${m.sender === 'user' ? 'user' : 'admin'}`}>
                      <div className="admin-chat-msg-bubble">
                        <div style={{ wordBreak: 'break-word' }}>{m.text}</div>
                        <span className="admin-chat-msg-meta">{m.time || 'Just now'}</span>
                      </div>
                    </div>
                  ))}
                  
                  {activeChat.isTyping && (
                    <div className="admin-chat-msg-row user">
                      <div className="admin-chat-msg-bubble" style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '12px' }}>
                          <span className="admin-typing-dot"></span>
                          <span className="admin-typing-dot" style={{ animationDelay: '0.2s' }}></span>
                          <span className="admin-typing-dot" style={{ animationDelay: '0.4s' }}></span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Footer Input */}
                <div className="admin-chat-footer">
                  <form onSubmit={handleSendReply} className="admin-chat-input-wrapper">
                    <input 
                      type="text" 
                      className="admin-chat-input" 
                      placeholder={`Reply to ${activeChat.client}...`}
                      value={replyInput}
                      onChange={handleAdminTyping}
                    />
                    <button type="submit" className="admin-chat-btn-send">
                      Send
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="admin-chat-placeholder animate-fade-in">
                <span className="admin-chat-placeholder-icon">💬</span>
                <h3>No Active Chat Selected</h3>
                <p>Select a borrower support thread from the left list to start responding.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* CHAT HISTORY (RESOLVED): Beautiful table listing details */
        <div className="admin-history-table-container">
          <table className="admin-history-table">
            <thead>
              <tr>
                <th>Borrower</th>
                <th>Email Address</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Chat Duration</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredChats.length > 0 ? (
                filteredChats.map(chat => (
                  <tr key={chat.id}>
                    <td>
                      <div className="admin-history-user-cell">
                        {chat.avatar ? (
                          <img 
                            src={chat.avatar} 
                            alt={chat.client} 
                            className="admin-history-avatar"
                          />
                        ) : (
                          <div className="admin-history-avatar-fallback">
                            {(chat.client || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <strong style={{ color: 'var(--admin-text)', display: 'block' }}>{chat.client}</strong>
                          <span style={{ fontSize: '0.72rem', color: 'var(--admin-text-light)' }}>ID: {chat.id}</span>
                        </div>
                      </div>
                    </td>
                    <td>{chat.email}</td>
                    <td>{chat.startTime || 'N/A'}</td>
                    <td>{chat.endTime || chat.date || 'N/A'}</td>
                    <td>
                      <span className="admin-history-duration-badge">
                        {chat.duration || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button 
                          className="btn-history-view"
                          onClick={() => setViewingHistoryChat(chat)}
                        >
                          Chat History
                        </button>
                        <button 
                          className="btn-action-outline btn-history-export"
                          onClick={() => handleExportChat(chat)}
                          title="Export conversation history"
                          style={{
                            padding: '8px 12px',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            height: '34px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            border: '1.5px solid var(--admin-border)',
                            backgroundColor: 'var(--admin-input)',
                            color: 'var(--admin-text)'
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          Export
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--admin-text-light)' }}>
                    No resolved chat history records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEWING CHAT HISTORY DIALOG / MODAL (WITH EXPORT) */}
      {viewingHistoryChat && (
        <div className="admin-chat-modal-overlay" onClick={() => setViewingHistoryChat(null)}>
          <div className="admin-chat-modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="admin-chat-header">
              <div className="admin-chat-header-user">
                {viewingHistoryChat.avatar ? (
                  <img 
                    src={viewingHistoryChat.avatar} 
                    alt={viewingHistoryChat.client} 
                    className="admin-chat-header-avatar"
                  />
                ) : (
                  <div className="admin-chat-header-avatar-fallback">
                    {(viewingHistoryChat.client || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="admin-chat-header-details">
                  <div className="admin-chat-header-name">{viewingHistoryChat.client}</div>
                  <div className="admin-chat-header-email">{viewingHistoryChat.email}</div>
                </div>
              </div>
              <button 
                className="admin-chat-btn-export" 
                onClick={() => handleExportChat(viewingHistoryChat)}
                title="Export conversation history"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export Log
              </button>
            </div>

            {/* Modal Info Summary */}
            <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-sidebar)', display: 'flex', gap: '20px', fontSize: '0.82rem' }}>
              <div><span style={{ color: 'var(--admin-text)', opacity: 0.75, marginRight: '4px' }}>Started:</span> <strong style={{ color: 'var(--admin-text)' }}>{viewingHistoryChat.startTime || 'N/A'}</strong></div>
              <div><span style={{ color: 'var(--admin-text)', opacity: 0.75, marginRight: '4px' }}>Ended:</span> <strong style={{ color: 'var(--admin-text)' }}>{viewingHistoryChat.endTime || viewingHistoryChat.date || 'N/A'}</strong></div>
              <div><span style={{ color: 'var(--admin-text)', opacity: 0.75, marginRight: '4px' }}>Duration:</span> <strong style={{ color: 'var(--admin-text)' }}>{viewingHistoryChat.duration || 'N/A'}</strong></div>
            </div>

            {/* Modal Messages */}
            <div className="admin-chat-messages-area" style={{ flex: 1, backgroundColor: 'var(--admin-bg)' }}>
              {(viewingHistoryChat.messages || []).map((m, idx) => (
                <div key={idx} className={`admin-chat-msg-row ${m.sender === 'user' ? 'user' : 'admin'}`}>
                  <div className="admin-chat-msg-bubble">
                    <div style={{ wordBreak: 'break-word' }}>{m.text}</div>
                    <span className="admin-chat-msg-meta">{m.time || 'Just now'}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="admin-chat-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                className="btn-action-outline" 
                onClick={() => setViewingHistoryChat(null)}
                style={{ cursor: 'pointer', padding: '10px 18px', borderRadius: '10px', fontSize: '0.85rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatSupportPanel;
