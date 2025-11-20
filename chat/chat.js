
    // Dark Mode Toggle Functionality
        (() => {
        const THEME_KEY = "darkLightMode";
        const btn = document.getElementById("darkLightToggleBtn");
        const body = document.body;

        // Detect and apply theme
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const saved = localStorage.getItem(THEME_KEY);
        let darkMode = saved ? saved === "dark" : prefersDark;

        const applyTheme = () => {
            if (darkMode) {
                body.classList.remove("light-mode");
                btn.innerHTML = "🌙";
                btn.setAttribute("aria-label", "Switch to light mode");
            } else {
                body.classList.add("light-mode");
                btn.innerHTML = "☀️";
                btn.setAttribute("aria-label", "Switch to dark mode");
            }
            localStorage.setItem(THEME_KEY, darkMode ? "dark" : "light");
        };

        applyTheme();

        // Toggle mode
        btn.onclick = () => {
            darkMode = !darkMode;
            applyTheme();
        };
    })();

    // Initialize Supabase with the correct credentials
    const supabaseUrl = 'https://lrezerxsbuekkhmpverr.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZXplcnhzYnVla2tobXB2ZXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNTI3MjMsImV4cCI6MjA3MzkyODcyM30.96senppPRMHveFi2ouDPDqhh17XIwxsLvA4U0rvjU9g';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    const elements = {
        mobileMenuToggle: document.getElementById('mobile-menu-toggle'),
        navLinks: document.getElementById('nav-links'),
        sidebar: document.getElementById('sidebar'),
        conversationsContainer: document.getElementById('conversations-container'),
        messagesContainer: document.getElementById('messages-container'),
        messageForm: document.getElementById('message-form'),
        messageInput: document.getElementById('message-input'),
        messageInputContainer: document.getElementById('message-input-container'),
        chatHeader: document.getElementById('chat-header'),
        chatUserAvatar: document.getElementById('chat-user-avatar'),
        chatUserName: document.getElementById('chat-user-name'),
        chatUserStatus: document.getElementById('chat-user-status'),
        chatUserContact: document.getElementById('chat-user-contact'),
        chatUserPhone: document.getElementById('chat-user-phone'),
        callBtn: document.getElementById('call-btn'),
        whatsappBtn: document.getElementById('whatsapp-btn'),
        backToInboxBtn: document.getElementById('back-to-inbox'),
        logoutBtn: document.getElementById('logout-btn'),
        searchInput: document.getElementById('search-input'),
        tabBtns: document.querySelectorAll('.tab-btn')
    };

    let currentUser = null, activeTab = 'inbox', activeConversation = null, onlineUsers = new Set(), page = 1, pageSize = 20;
    let presenceChannel = null;
    let messagesChannel = null;

    const isMobile = () => window.innerWidth <= 768;

    const debounce = (fn, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn(...args), delay);
        };
    };

    const escapeHtml = text => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    // --- NAVBAR TOGGLE ---
    elements.mobileMenuToggle.addEventListener('click', () => {
        const isActive = elements.navLinks.classList.toggle('active');
        document.body.style.overflow = isActive ? 'hidden' : '';
    });

    // Close mobile menu when clicking on a link
    elements.navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            elements.navLinks.classList.remove('active');
            document.body.style.overflow = '';
        });
    });

    // --- UTILITIES ---
    const formatTime = dateString => {
        const date = new Date(dateString), now = new Date();
        if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        // Add icon based on type
        if (type === 'success') {
            toast.innerHTML = `<span>✅</span> <span>${message}</span>`;
        } else if (type === 'error') {
            toast.innerHTML = `<span>❌</span> <span>${message}</span>`;
        } else if (type === 'warning') {
            toast.innerHTML = `<span>⚠️</span> <span>${message}</span>`;
        } else {
            toast.textContent = message;
        }
        
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 3000);
    };

    // --- AUTH CHECK ---
    async function checkAuth() {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (!user) {
                showToast('Please log in to access chat 😕', 'error');
                window.location.href = 'index.html';
                return null;
            }
            
            return user;
        } catch (error) {
            console.error('Authentication error:', error);
            showToast('Authentication failed. Please log in again. 😕', 'error');
            window.location.href = 'index.html';
            return null;
        }
    }

    // --- DEBUGGING FUNCTION ---
    function debugLog(message, data = null) {
        console.log(`[DEBUG] ${message}`, data);
    }

    // --- LOAD CONVERSATIONS ---
    async function loadConversations(searchTerm = '') {
        debugLog('Loading conversations', { activeTab, searchTerm });
        
        // Use WhatsApp-like loader
        elements.conversationsContainer.innerHTML = `
            <div class="whatsapp-loader">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;

        try {
            if (activeTab === 'inbox') {
                debugLog('Loading private conversations');
                
                // First, let's check if the messages table exists
                try {
                    const { data: testData, error: testError } = await supabase
                        .from('messages')
                        .select('count')
                        .limit(1);
                    
                    if (testError) {
                        console.error('Messages table might not exist:', testError);
                        elements.conversationsContainer.innerHTML = `
                            <div class="error-message">
                                <h3>Database Setup Required</h3>
                                <p>The messages table needs to be set up in your Supabase database.</p>
                                <p>Please run the SQL queries provided in the documentation.</p>
                            </div>
                        `;
                        return;
                    }
                } catch (err) {
                    console.error('Error checking messages table:', err);
                }

                // Fetch private messages without joins
                let messages;
                let error;
                
                try {
                    const result = await supabase
                        .from('messages')
                        .select('*')
                        .or(`user_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
                        .eq('is_private', true)
                        .order('created_at', { ascending: false });
                    
                    messages = result.data;
                    error = result.error;
                } catch (err) {
                    console.error('Error fetching messages:', err);
                    elements.conversationsContainer.innerHTML = `
                        <div class="error-message">
                            <h3>Connection Error</h3>
                            <p>Unable to connect to the database. Please check your connection.</p>
                            <small>Error: ${err.message}</small>
                        </div>
                    `;
                    return;
                }

                if (error) {
                    console.error('Supabase error:', error);
                    elements.conversationsContainer.innerHTML = `
                        <div class="error-message">
                            <h3>Database Error</h3>
                            <p>${error.message}</p>
                            <p>Please make sure your database tables are set up correctly.</p>
                        </div>
                    `;
                    return;
                }

                debugLog('Messages fetched', { count: messages?.length || 0 });

                // Extract unique user IDs (other than current user)
                const userIds = new Set();
                messages.forEach(msg => {
                    if (msg.user_id === currentUser.id && msg.recipient_id) {
                        userIds.add(msg.recipient_id);
                    } else if (msg.recipient_id === currentUser.id && msg.user_id) {
                        userIds.add(msg.user_id);
                    }
                });

                // Fetch profiles for these user IDs
                let profiles = [];
                if (userIds.size > 0) {
                    const { data: profilesData, error: profilesError } = await supabase
                        .from('profiles')
                        .select('id, full_name, phone')
                        .in('id', Array.from(userIds));
                    
                    if (profilesError) {
                        console.error('Error fetching profiles:', profilesError);
                    } else {
                        profiles = profilesData || [];
                    }
                }

                // Create a map of user profiles
                const profileMap = {};
                profiles.forEach(profile => {
                    profileMap[profile.id] = profile;
                });

                // Group messages by the other user
                const conversationsMap = new Map();
                
                if (messages && messages.length > 0) {
                    messages.forEach(msg => {
                        const otherUserId = msg.user_id === currentUser.id ? msg.recipient_id : msg.user_id;
                        const otherUserProfile = profileMap[otherUserId] || { full_name: 'Unknown User', phone: null };
                        
                        if (!conversationsMap.has(otherUserId)) {
                            conversationsMap.set(otherUserId, {
                                id: otherUserId,
                                name: otherUserProfile.full_name,
                                phone: otherUserProfile.phone,
                                lastMessage: msg.content,
                                lastMessageTime: msg.created_at,
                                unreadCount: msg.user_id !== currentUser.id && !msg.is_read ? 1 : 0
                            });
                        } else {
                            // Update with the latest message
                            const existing = conversationsMap.get(otherUserId);
                            if (new Date(msg.created_at) > new Date(existing.lastMessageTime)) {
                                existing.lastMessage = msg.content;
                                existing.lastMessageTime = msg.created_at;
                            }
                            // Update unread count
                            if (msg.user_id !== currentUser.id && !msg.is_read) {
                                existing.unreadCount = (existing.unreadCount || 0) + 1;
                            }
                        }
                    });
                }

                let conversations = Array.from(conversationsMap.values());
                debugLog('Conversations mapped', { count: conversations.length });

                // Filter by search term if provided
                if (searchTerm) {
                    const lowerSearchTerm = searchTerm.toLowerCase();
                    conversations = conversations.filter(conv => 
                        conv.name.toLowerCase().includes(lowerSearchTerm) ||
                        (conv.lastMessage && conv.lastMessage.toLowerCase().includes(lowerSearchTerm))
                    );
                }

                // Render conversations
                if (conversations.length === 0) {
                    elements.conversationsContainer.innerHTML = `
                        <div class="no-conversations">
                            <i class="fas fa-comments"></i>
                            <h3>No conversations found</h3>
                            <p>${searchTerm ? 'Try adjusting your search terms' : 'Start a conversation with another user'}</p>
                        </div>
                    `;
                    return;
                }

                // WhatsApp-style conversation rows
                elements.conversationsContainer.innerHTML = conversations.map(conv => `
                    <div class="conversation ${activeConversation === conv.id ? 'active' : ''}" data-user-id="${conv.id}">
                        <div class="conversation-avatar ${onlineUsers.has(conv.id) ? 'online' : ''}">${conv.name.charAt(0).toUpperCase()}</div>
                        <div class="conversation-details">
                            <div class="conversation-header">
                                <div class="conversation-name">${escapeHtml(conv.name)}</div>
                                <div class="conversation-time">${formatTime(conv.lastMessageTime)}</div>
                            </div>
                            <div class="conversation-preview">${escapeHtml(conv.lastMessage || 'No messages yet')}</div>
                        </div>
                        ${conv.unreadCount > 0 ? `<div class="unread-indicator">${conv.unreadCount}</div>` : ''}
                    </div>
                `).join('');

                // Add click event to each conversation
                document.querySelectorAll('.conversation').forEach(conv => {
                    conv.addEventListener('click', () => {
                        const userId = conv.getAttribute('data-user-id');
                        const userName = conv.querySelector('.conversation-name').textContent;
                        const userPhone = conv.querySelector('.conversation-phone')?.textContent || null;
                        debugLog('Conversation clicked', { userId, userName, userPhone });
                        loadPrivateMessages(userId, userName, userPhone);
                    });
                });

            } else if (activeTab === 'community') {
                debugLog('Loading community chat');
                
                // For community, we just show one conversation for the community chat
                elements.conversationsContainer.innerHTML = `
                    <div class="conversation ${activeConversation === 'community' ? 'active' : ''}" data-conversation-id="community">
                        <div class="conversation-avatar">
                            <i class="fas fa-users"></i>
                        </div>
                        <div class="conversation-details">
                            <div class="conversation-header">
                                <div class="conversation-name">Community Chat</div>
                                <div class="conversation-time">Now</div>
                            </div>
                            <div class="conversation-preview">Join the community conversation</div>
                        </div>
                    </div>
                `;

                // Add click event to community conversation
                document.querySelector('.conversation').addEventListener('click', () => {
                    debugLog('Community conversation clicked');
                    loadCommunityChat();
                });
            }
        } catch (error) {
            console.error('Error in loadConversations:', error);
            elements.conversationsContainer.innerHTML = `
                <div class="error-message">
                    <h3>Unexpected Error</h3>
                    <p>An error occurred while loading conversations.</p>
                    <small>${error.message}</small>
                </div>
            `;
        }
    }

    // --- LOAD PRIVATE MESSAGES ---
    async function loadPrivateMessages(recipientId, recipientName, recipientPhone = null) {
        debugLog('Loading private messages', { recipientId, recipientName, recipientPhone });
        
        activeConversation = recipientId;
        elements.chatHeader.style.display = 'flex';
        elements.chatUserName.textContent = recipientName;
        elements.chatUserStatus.textContent = onlineUsers.has(recipientId) ? 'Online' : 'Offline';
        elements.chatUserStatus.className = onlineUsers.has(recipientId) ? 'chat-user-status online' : 'chat-user-status';
        elements.chatUserAvatar.classList.toggle('online', onlineUsers.has(recipientId));
        elements.chatUserAvatar.textContent = recipientName.charAt(0).toUpperCase();
        
        // Show contact information if phone number is available
        if (recipientPhone) {
            elements.chatUserPhone.textContent = recipientPhone;
            elements.chatUserContact.style.display = 'flex';
            
            // Set up call button
            elements.callBtn.onclick = () => {
                window.location.href = `tel:${recipientPhone}`;
            };
            
            // Set up WhatsApp button
            elements.whatsappBtn.onclick = () => {
                window.open(`https://wa.me/${recipientPhone.replace(/\D/g, '')}`, '_blank');
            };
        } else {
            elements.chatUserContact.style.display = 'none';
        }
        
        elements.messageInputContainer.style.display = 'flex';

        if (isMobile()) {
            elements.sidebar.classList.add('hidden');
        }

        // Use WhatsApp-like loader
        elements.messagesContainer.innerHTML = `
            <div class="whatsapp-loader">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;

        try {
            // Fetch messages without joins
            const { data: messages, error } = await supabase
                .from('messages')
                .select('*')
                .or(`and(user_id.eq.${currentUser.id},recipient_id.eq.${recipientId}),and(user_id.eq.${recipientId},recipient_id.eq.${currentUser.id})`)
                .eq('is_private', true)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error loading messages:', error);
                elements.messagesContainer.innerHTML = `
                    <div class="error-message">
                        <h3>Error Loading Messages</h3>
                        <p>${error.message}</p>
                    </div>
                `;
                return;
            }

            debugLog('Messages loaded', { count: messages?.length || 0 });

            // Extract user IDs to fetch profiles
            const userIds = new Set();
            if (messages && messages.length > 0) {
                messages.forEach(msg => {
                    userIds.add(msg.user_id);
                });
            }

            // Fetch profiles for these users
            let profiles = [];
            if (userIds.size > 0) {
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, full_name, phone')
                    .in('id', Array.from(userIds));
                
                if (profilesError) {
                    console.error('Error fetching profiles:', profilesError);
                } else {
                    profiles = profilesData || [];
                }
            }

            // Create a map of user profiles
            const profileMap = {};
            profiles.forEach(profile => {
                profileMap[profile.id] = profile;
            });

            // Mark messages as read if they are from the other user and unread
            if (messages && messages.length > 0) {
                const unreadMessageIds = messages
                    .filter(msg => msg.user_id !== currentUser.id && !msg.is_read)
                    .map(msg => msg.id);

                if (unreadMessageIds.length > 0) {
                    debugLog('Marking messages as read', { count: unreadMessageIds.length });
                    await markMessagesAsRead(unreadMessageIds);
                }
            }

            // Render messages
            if (!messages || messages.length === 0) {
                elements.messagesContainer.innerHTML = `
                    <div class="no-messages">
                        <i class="fas fa-comment-dots"></i>
                        <h3>No messages yet</h3>
                        <p>Start a conversation with ${recipientName}!</p>
                    </div>
                `;
                return;
            }

            elements.messagesContainer.innerHTML = messages.map(msg => {
                const senderProfile = profileMap[msg.user_id] || { full_name: 'Unknown User' };
                return `
                    <div class="message ${msg.user_id === currentUser.id ? 'sent' : 'received'}" data-message-id="${msg.id}">
                        <div class="message-header">
                            <span>${msg.user_id === currentUser.id ? 'You' : escapeHtml(senderProfile.full_name)}</span>
                            <span>${formatTime(msg.created_at)}</span>
                        </div>
                        <div class="message-content">${escapeHtml(msg.content)}</div>
                        <div class="message-time">${formatTime(msg.created_at)}</div>
                        ${msg.user_id === currentUser.id ? `<button class="delete-btn" data-message-id="${msg.id}"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                `;
            }).join('');

            // Add event listeners to delete buttons
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const messageId = btn.getAttribute('data-message-id');
                    deleteMessage(messageId);
                });
            });

            // Scroll to bottom
            elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;

        } catch (error) {
            console.error('Error in loadPrivateMessages:', error);
            elements.messagesContainer.innerHTML = `
                <div class="error-message">
                    <h3>Error Loading Messages</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    // --- LOAD COMMUNITY CHAT ---
    async function loadCommunityChat() {
        debugLog('Loading community chat');
        
        activeConversation = 'community';
        elements.chatHeader.style.display = 'flex';
        elements.chatUserName.textContent = 'Community Chat';
        elements.chatUserStatus.textContent = 'Public';
        elements.chatUserStatus.className = 'chat-user-status';
        elements.chatUserAvatar.innerHTML = '<i class="fas fa-users"></i>';
        elements.chatUserAvatar.classList.remove('online');
        elements.chatUserContact.style.display = 'none';
        elements.messageInputContainer.style.display = 'flex';

        if (isMobile()) {
            elements.sidebar.classList.add('hidden');
        }

        // Use WhatsApp-like loader
        elements.messagesContainer.innerHTML = `
            <div class="whatsapp-loader">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;

        try {
            // Fetch messages without joins
            const { data: messages, error } = await supabase
                .from('messages')
                .select('*')
                .eq('is_private', false)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error loading community messages:', error);
                elements.messagesContainer.innerHTML = `
                    <div class="error-message">
                        <h3>Error Loading Community Messages</h3>
                        <p>${error.message}</p>
                    </div>
                `;
                return;
            }

            debugLog('Community messages loaded', { count: messages?.length || 0 });

            // Extract user IDs to fetch profiles
            const userIds = new Set();
            if (messages && messages.length > 0) {
                messages.forEach(msg => {
                    userIds.add(msg.user_id);
                });
            }

            // Fetch profiles for these users
            let profiles = [];
            if (userIds.size > 0) {
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, full_name, phone')
                    .in('id', Array.from(userIds));
                
                if (profilesError) {
                    console.error('Error fetching profiles:', profilesError);
                } else {
                    profiles = profilesData || [];
                }
            }

            // Create a map of user profiles
            const profileMap = {};
            profiles.forEach(profile => {
                profileMap[profile.id] = profile;
            });

            // Render messages
            if (!messages || messages.length === 0) {
                elements.messagesContainer.innerHTML = `
                    <div class="no-messages">
                        <i class="fas fa-comments"></i>
                        <h3>No messages in the community chat yet.</h3>
                        <p>Be the first to say something!</p>
                    </div>
                `;
                return;
            }

            elements.messagesContainer.innerHTML = messages.map(msg => {
                const senderProfile = profileMap[msg.user_id] || { full_name: 'Unknown User' };
                return `
                    <div class="message ${msg.user_id === currentUser.id ? 'sent' : 'received'}" data-message-id="${msg.id}">
                        <div class="message-header">
                            <span>${msg.user_id === currentUser.id ? 'You' : escapeHtml(senderProfile.full_name)}</span>
                            <span>${formatTime(msg.created_at)}</span>
                        </div>
                        <div class="message-content">${escapeHtml(msg.content)}</div>
                        <div class="message-time">${formatTime(msg.created_at)}</div>
                        ${msg.user_id === currentUser.id ? `<button class="delete-btn" data-message-id="${msg.id}"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                `;
            }).join('');

            // Add event listeners to delete buttons
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const messageId = btn.getAttribute('data-message-id');
                    deleteMessage(messageId);
                });
            });

            // Scroll to bottom
            elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;

        } catch (error) {
            console.error('Error in loadCommunityChat:', error);
            elements.messagesContainer.innerHTML = `
                <div class="error-message">
                    <h3>Error Loading Community Messages</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    // --- MARK MESSAGES AS READ ---
    async function markMessagesAsRead(messageIds) {
        debugLog('Marking messages as read', { count: messageIds.length });
        
        try {
            const { error } = await supabase
                .from('messages')
                .update({ is_read: true })
                .in('id', messageIds);

            if (error) {
                console.error('Error marking messages as read:', error);
            }
        } catch (error) {
            console.error('Error in markMessagesAsRead:', error);
        }
    }

    // --- DELETE MESSAGE ---
    async function deleteMessage(messageId) {
        debugLog('Deleting message', { messageId });
        
        try {
            const { error } = await supabase
                .from('messages')
                .delete()
                .eq('id', messageId);

            if (error) {
                console.error('Error deleting message:', error);
                showToast('Error deleting message 😕', 'error');
                return;
            }

            // Remove the message from the UI
            const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
            if (messageElement) {
                messageElement.remove();
            }

            showToast('Message deleted ✅');
        } catch (error) {
            console.error('Error in deleteMessage:', error);
            showToast('Error deleting message 😕', 'error');
        }
    }

    // --- MESSAGE FORM SUBMIT ---
    elements.messageForm.addEventListener('submit', async e => {
        e.preventDefault();
        const content = elements.messageInput.value.trim();
        if (!content) return showToast('Please enter a message 😕', 'error');

        const messageData = {
            content,
            user_id: currentUser.id,
            is_private: activeConversation !== 'community',
            is_read: false
        };
        
        if (messageData.is_private) {
            messageData.recipient_id = activeConversation;
        }

        debugLog('Sending message', messageData);

        try {
            const { error } = await supabase.from('messages').insert([messageData]);
            if (error) {
                console.error('Error sending message:', error);
                showToast(`Error sending message: ${error.message} 😕`, 'error');
                return;
            }

            elements.messageInput.value = '';
            
            // Refresh the chat
            if (activeConversation === 'community') {
                loadCommunityChat();
            } else {
                loadPrivateMessages(activeConversation, elements.chatUserName.textContent);
            }
        } catch (error) {
            console.error('Error in message form submit:', error);
            showToast('Error sending message 😕', 'error');
        }
    });

    // --- TAB BUTTONS ---
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTab = btn.getAttribute('data-tab');
            activeConversation = null;
            elements.chatHeader.style.display = 'none';
            elements.messageInputContainer.style.display = 'none';
            elements.messagesContainer.innerHTML = '<div class="no-messages">Select a conversation to start chatting</div>';
            loadConversations();
        });
    });

    // --- BACK TO INBOX ---
    elements.backToInboxBtn.addEventListener('click', () => {
        elements.sidebar.classList.remove('hidden');
        elements.chatHeader.style.display = 'none';
        elements.messageInputContainer.style.display = 'none';
        elements.messagesContainer.innerHTML = '<div class="no-messages">Select a conversation to start chatting</div>';
        activeConversation = null;
    });

    // --- LOGOUT ---
    elements.logoutBtn.addEventListener('click', async () => {
        try {
            showToast('Logging out... ⏳', 'warning');
            await supabase.auth.signOut();
            showToast('👋 Logged out successfully ✅');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } catch (error) {
            console.error('Logout error:', error);
            showToast('Error logging out. Please try again. 😕', 'error');
        }
    });

    // --- SEARCH INPUT ---
    elements.searchInput.addEventListener('input', debounce(() => {
        loadConversations(elements.searchInput.value);
    }, 300));

    // --- CLEANUP SUBSCRIPTIONS ---
    function cleanupSubscriptions() {
        if (presenceChannel) {
            supabase.removeChannel(presenceChannel);
            presenceChannel = null;
        }
        
        if (messagesChannel) {
            supabase.removeChannel(messagesChannel);
            messagesChannel = null;
        }
    }

    // --- INIT APP ---
    async function initApp() {
        debugLog('Initializing app');
        
        try {
            currentUser = await checkAuth();
            if (!currentUser) return;

            debugLog('User authenticated', { userId: currentUser.id });

            // Set up presence channel
            presenceChannel = supabase.channel('online-users')
                .on('presence', { event: 'sync' }, () => {
                    onlineUsers = new Set(Object.keys(presenceChannel.presenceState()));
                    if (activeConversation && activeConversation !== 'community') {
                        elements.chatUserStatus.textContent = onlineUsers.has(activeConversation) ? 'Online' : 'Offline';
                        elements.chatUserStatus.className = onlineUsers.has(activeConversation) ? 'chat-user-status online' : 'chat-user-status';
                        elements.chatUserAvatar.classList.toggle('online', onlineUsers.has(activeConversation));
                    }
                    if (!activeConversation) loadConversations();
                })
                .subscribe(async status => {
                    if (status === 'SUBSCRIBED') {
                        await presenceChannel.track({ 
                            user_id: currentUser.id, 
                            online_at: new Date().toISOString() 
                        });
                    }
                });

            // Set up messages channel
            messagesChannel = supabase.channel('messages')
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'messages' 
                }, () => {
                    debugLog('Postgres change detected');
                    if (activeConversation) {
                        if (activeConversation === 'community') {
                            loadCommunityChat();
                        } else {
                            loadPrivateMessages(activeConversation, elements.chatUserName.textContent);
                        }
                    } else {
                        loadConversations();
                    }
                })
                .subscribe();

            // --- Auto-open chat if sessionStorage exists ---
            const sellerId = sessionStorage.getItem('chatSellerId');
            const sellerName = sessionStorage.getItem('chatSellerName');
            const productTitle = sessionStorage.getItem('chatProductTitle');

            if (sellerId && sellerName && productTitle) {
                debugLog('Auto-opening chat', { sellerId, sellerName, productTitle });
                
                elements.tabBtns.forEach(btn => btn.classList.remove('active'));
                document.querySelector('.tab-btn[data-tab="inbox"]').classList.add('active');
                activeTab = 'inbox';
                
                // Get user profile to fetch phone number
                try {
                    const { data: profile, error } = await supabase
                        .from('profiles')
                        .select('phone')
                        .eq('id', sellerId)
                        .single();
                    
                    if (error) {
                        console.error('Error fetching user profile:', error);
                        loadPrivateMessages(sellerId, sellerName);
                    } else {
                        debugLog('User profile fetched', { phone: profile.phone });
                        loadPrivateMessages(sellerId, sellerName, profile.phone);
                    }
                } catch (error) {
                    console.error('Error fetching user profile:', error);
                    loadPrivateMessages(sellerId, sellerName);
                }
                
                elements.messageInput.value = `Hi ${sellerName}, I'm interested in your product: ${productTitle}`;
                sessionStorage.removeItem('chatSellerId');
                sessionStorage.removeItem('chatSellerName');
                sessionStorage.removeItem('chatProductTitle');
            } else {
                loadConversations();
            }
        } catch (error) {
            console.error('Error in initApp:', error);
            showToast('Error initializing app 😕', 'error');
        }
    }

    // Mobile-specific improvements
    document.addEventListener('DOMContentLoaded', () => {
        // Prevent zoom on double tap (iOS)
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (event) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
        
        // Improve scrolling performance
        const scrollContainers = document.querySelectorAll('.conversations-container, .messages-container');
        scrollContainers.forEach(container => {
            container.style.overflowScrolling = 'touch';
            container.style.webkitOverflowScrolling = 'touch';
        });
        
        // Handle viewport height changes (mobile keyboard)
        function handleViewportChange() {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
            
            // Adjust chat area height when keyboard is open
            if (window.innerWidth <= 768 && activeConversation) {
                const chatArea = document.querySelector('.chat-area');
                const headerHeight = document.querySelector('header').offsetHeight;
                chatArea.style.height = `calc(var(--vh, 1vh) * 100 - ${headerHeight}px)`;
            }
        }
        
        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('orientationchange', handleViewportChange);
        handleViewportChange(); // Initial call
        
        // Better touch feedback for buttons
        const buttons = document.querySelectorAll('button, .conversation, .contact-btn');
        buttons.forEach(button => {
            button.addEventListener('touchstart', function() {
                this.style.opacity = '0.7';
            });
            button.addEventListener('touchend', function() {
                this.style.opacity = '';
            });
        });
        
        // Optimize scrolling for mobile
        let isScrolling;
        scrollContainers.forEach(container => {
            container.addEventListener('scroll', () => {
                window.clearTimeout(isScrolling);
                isScrolling = setTimeout(() => {
                    // Scrolling has stopped
                    container.style.scrollBehavior = 'auto';
                }, 100);
            }, { passive: true });
        });
    });

    // Initialize app when DOM is loaded
    document.addEventListener('DOMContentLoaded', initApp);
    
    // Cleanup subscriptions when page is unloaded
    window.addEventListener('beforeunload', cleanupSubscriptions);
