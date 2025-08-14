// === Real-time Messaging System with Real Users ===
class RealTimeMessaging {
    constructor() {
        console.log('=== REAL TIME MESSAGING CONSTRUCTOR ===');
        this.socket = null;
        this.currentUser = this.getCurrentUser();
        this.currentChatId = this.getCurrentChatId();
        this.messages = [];
        this.onlineUsers = new Set();
        this.isConnected = false;
        this.typingUsers = new Set();
        
        this.initializeWebSocket();
        this.initializeUI();
        this.loadMessageHistory();
        this.updateChatLayout();
        
        // Check for direct message after a short delay to ensure DOM is ready
        setTimeout(() => {
            this.checkForDirectMessage();
        }, 100);
    }

    checkForDirectMessage() {
        console.log('=== CHECKING FOR DIRECT MESSAGE ===');
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('userId');
        const messageUserData = localStorage.getItem('message_user');
        
        console.log('URL userId:', userId);
        console.log('localStorage message_user:', messageUserData);
        
        if (messageUserData) {
            try {
                const messageUser = JSON.parse(messageUserData);
                console.log('Parsed message user:', messageUser);
                
                // Validate user data before starting conversation
                if (messageUser && messageUser.name && messageUser.name !== 'undefined') {
                    // Start a conversation with this user
                    this.startConversationWith(messageUser);
                } else {
                    console.warn('Invalid user data, not starting conversation:', messageUser);
                }
                
                // Clear the localStorage after use
                localStorage.removeItem('message_user');
            } catch (error) {
                console.error('Error parsing message user data:', error);
                localStorage.removeItem('message_user');
            }
        } else {
            console.log('No message user data found');
        }
    }

    async startConversationWith(user) {
        console.log('=== STARTING CONVERSATION WITH ===', user);
        
        // Validate user data
        if (!user || !user.name || user.name === 'undefined') {
            console.error('Invalid user data for conversation:', user);
            return;
        }
        
        console.log('Valid user, starting conversation with:', user.name);
        
        // For now, just show placeholder since we don't have real API
        console.log('Using placeholder conversation for development');
        this.showConversationPlaceholder(user);
        return;
        
        try {
            // Create or get existing conversation with this user
            const token = localStorage.getItem('authToken');
            console.log('Auth token exists:', !!token);
            
            const response = await fetch('/api/conversations', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    participantId: user.id
                })
            });

            console.log('API response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Switch to this conversation
                    this.switchToConversation(data.conversation);
                    // Show notification
                    this.showNotification(`Đã mở cuộc trò chuyện với ${user.name}`, 'success');
                }
            } else {
                console.log('API response not ok, falling back to placeholder');
                this.showConversationPlaceholder(user);
            }
        } catch (error) {
            console.error('Error starting conversation:', error);
            console.log('Falling back to placeholder conversation');
            // Fallback: just show a placeholder conversation
            this.showConversationPlaceholder(user);
        }
    }

    switchToConversation(conversation) {
        // Update current chat ID
        this.currentChatId = conversation.id;
        localStorage.setItem('currentChatId', this.currentChatId);
        
        // Show the chat window
        this.showChatWindow();
        
        // Load conversation messages
        this.loadConversationMessages(conversation);
        
        // Update UI with conversation info
        this.updateChatHeader(conversation);
    }

    showConversationPlaceholder(user) {
        console.log('Showing conversation placeholder for user:', user.name);
        
        // Show the chat window first
        this.showChatWindow();
        
        // Update chat header with user info
        this.updateChatHeaderWithUser(user);
        
        // Clear existing messages and show welcome message
        const messagesContainer = document.querySelector('.messages-container') || 
                                document.getElementById('messages-container') ||
                                document.querySelector('#chat-window .messages-container');
        
        console.log('Messages container found:', !!messagesContainer);
        
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div class="text-center py-8 text-gray-400">
                    <img src="${user.avatar || 'https://placehold.co/80x80/4F46E5/FFFFFF?text=' + (user.name ? user.name.charAt(0) : 'U')}" 
                         alt="${user.name}" class="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-indigo-500">
                    <p class="text-lg font-semibold text-white mb-2">Bắt đầu cuộc trò chuyện với ${user.name}</p>
                    <p class="text-sm">Hãy gửi tin nhắn đầu tiên để bắt đầu!</p>
                </div>
            `;
        } else {
            console.error('Messages container not found!');
        }

        // Enable message input
        const messageInput = document.querySelector('.message-input');
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.placeholder = `Nhắn tin cho ${user.name}...`;
            console.log('Message input enabled for', user.name);
        } else {
            console.error('Message input not found!');
        }
    }

    showChatWindow() {
        console.log('=== SHOWING CHAT WINDOW ===');
        const chatWindow = document.getElementById('chat-window');
        const emptyPlaceholder = document.getElementById('empty-chat-placeholder');
        
        console.log('Chat window element:', !!chatWindow);
        console.log('Empty placeholder element:', !!emptyPlaceholder);
        
        if (chatWindow && emptyPlaceholder) {
            console.log('Hiding empty placeholder and showing chat window');
            
            // Use direct style manipulation to be sure
            emptyPlaceholder.style.display = 'none';
            chatWindow.style.display = 'flex';
            
            // Also remove/add classes as backup
            emptyPlaceholder.classList.add('hidden');
            chatWindow.classList.remove('hidden');
            
            console.log('Chat window display style after change:', chatWindow.style.display);
            console.log('Chat window classes after change:', chatWindow.className);
        } else {
            console.error('Required elements not found!');
            if (!chatWindow) console.error('chat-window element not found');
            if (!emptyPlaceholder) console.error('empty-chat-placeholder element not found');
        }
    }

    updateChatHeaderWithUser(user) {
        // Find the chat header area in the chat window
        const chatHeader = document.querySelector('#chat-window .flex.items-center.justify-between') ||
                          document.querySelector('#chat-window > div:first-child');
        
        if (chatHeader) {
            // Update the left side with user info
            const userInfoSection = chatHeader.querySelector('.flex.items-center.gap-4');
            if (userInfoSection) {
                userInfoSection.innerHTML = `
                    <img src="${user.avatar || 'https://placehold.co/40x40/4F46E5/FFFFFF?text=' + (user.name ? user.name.charAt(0) : 'U')}" 
                         alt="${user.name}" class="w-10 h-10 rounded-full">
                    <div>
                        <h3 class="font-bold text-white">${user.name}</h3>
                        <p class="text-xs text-green-400">Hoạt động</p>
                    </div>
                `;
            }
        }
        
        console.log('Updated chat header for user:', user.name);
    }

    updateChatHeader(conversation) {
        // This would be used for actual conversation data from API
        const otherUser = conversation.participants?.find(p => p.id !== this.currentUser?.id);
        if (otherUser) {
            this.updateChatHeaderWithUser(otherUser);
        }
    }

    loadConversationMessages(conversation) {
        // This would load actual messages from API
        // For now, just show empty conversation
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div class="text-center py-8 text-gray-400">
                    <p>Tải tin nhắn...</p>
                </div>
            `;
        }
    }

    updateChatLayout() {
        const conversationsList = document.getElementById('conversations-list');
        const chatWindow = document.getElementById('chat-window');
        const emptyPlaceholder = document.getElementById('empty-chat-placeholder');
        
        console.log('=== UPDATING CHAT LAYOUT ===');
        console.log('Current chat ID:', this.currentChatId);
        
        // If no current chat is selected, show empty placeholder
        if (!this.currentChatId) {
            console.log('No chat selected, showing empty placeholder');
            if (chatWindow) {
                chatWindow.classList.add('hidden');
                chatWindow.style.display = 'none';
            }
            if (emptyPlaceholder) {
                emptyPlaceholder.classList.remove('hidden');
                emptyPlaceholder.style.display = 'flex';
            }
        } else {
            console.log('Chat selected, showing chat window');
            if (chatWindow) {
                chatWindow.classList.remove('hidden');
                chatWindow.style.display = 'flex';
            }
            if (emptyPlaceholder) {
                emptyPlaceholder.classList.add('hidden');
                emptyPlaceholder.style.display = 'none';
            }
        }
        
        // Update conversations list layout
        if (conversationsList) {
            conversationsList.className = 'w-full flex flex-col';
        }
    }

    getCurrentUser() {
        // Get current user from localStorage or create new one
        let userData = localStorage.getItem('currentUser');
        if (userData) {
            const user = JSON.parse(userData);
            // Check if it's a mock user and reset
            if (user.name.startsWith('Người dùng ') && user.name.includes('user_')) {
                localStorage.removeItem('currentUser');
                userData = null;
            } else {
                return user;
            }
        }
        
        // Create new user - let them authenticate with the real system
        const userName = prompt('Nhập tên của bạn:') || 'Anonymous';
        const userId = 'user_' + Date.now(); // Use timestamp for unique ID
        const user = {
            id: userId,
            name: userName,
            avatar: `https://placehold.co/40x40/${this.getRandomColor()}/FFFFFF?text=${userName.charAt(0).toUpperCase()}`,
            joinedAt: Date.now()
        };
        
        localStorage.setItem('currentUser', JSON.stringify(user));
        return user;
    }

    getCurrentChatId() {
        // Return null if no chat is selected
        // In a real app, this would check URL params or selected conversation
        const urlParams = new URLSearchParams(window.location.search);
        const chatId = urlParams.get('chatId');
        
        // Only return chat ID if we have a specific chat selected
        return chatId;
    }

    getRandomColor() {
        const colors = ['4F46E5', '8A2BE2', '00BFFF', 'FFAA00', '22C55E', 'EF4444', 'F59E0B'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    initializeWebSocket() {
        console.log('=== INITIALIZING TELEGRAM-STYLE WEBSOCKET ===');
        
        // Check if Socket.IO is available
        if (typeof io === 'undefined') {
            console.error('❌ Socket.IO not loaded, using fallback messaging');
            this.initializeFallbackMessaging();
            return;
        }
        
        // Initialize Telegram-style Socket.IO connection
        try {
            this.socket = io({
                transports: ['websocket', 'polling'], // WebSocket first like Telegram
                timeout: 45000, // Match server timeout
                forceNew: true,
                reconnection: true,
                reconnectionDelay: 2000,
                reconnectionAttempts: 10,
                maxReconnectionAttempts: 10,
                auth: {
                    token: localStorage.getItem('authToken') || localStorage.getItem('token')
                }
            });

            // Telegram-style connection handling
            this.socket.on('connect', () => {
                console.log('✅ Telegram-style connection established:', this.socket.id);
                this.isConnected = true;
                this.updateConnectionStatus(true);
                
                // Request any queued messages
                this.socket.emit('request_queued_messages');
                
                // Update presence to online
                this.socket.emit('update_presence', {
                    status: 'online',
                    lastSeen: Date.now()
                });
                
                // Authenticate user for messaging
                const token = localStorage.getItem('authToken') || localStorage.getItem('token');
                console.log('Auth token found:', !!token);
                
                if (token) {
                    console.log('Attempting to authenticate with token...');
                    this.socket.emit('authenticate', { token });
                } else {
                    console.warn('No auth token found, using guest mode');
                    // Use current user as guest
                    this.socket.emit('join_chat', {
                        userId: this.currentUser.id,
                        username: this.currentUser.name,
                        avatar: this.currentUser.avatar
                    });
                }
            });

            this.socket.on('disconnect', (reason) => {
                console.log('❌ Telegram-style connection lost:', reason);
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.showConnectionMessage('Mất kết nối... Đang thử kết nối lại...', 'warning');
            });

            this.socket.on('connect_error', (error) => {
                console.error('Socket connection error:', error);
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.showConnectionMessage('Lỗi kết nối: ' + error.message, 'error');
                
                this.connectionAttempts = (this.connectionAttempts || 0) + 1;
                
                // After 5 failed attempts, switch to fallback
                if (this.connectionAttempts >= 5) {
                    console.log('❌ Socket connection failed multiple times, switching to fallback');
                    this.socket.disconnect();
                    this.initializeFallbackMessaging();
                }
            });

            // Telegram-style heartbeat system
            this.socket.on('ping', () => {
                // Server is checking if we're alive
                this.socket.emit('pong', {
                    timestamp: Date.now(),
                    clientId: this.currentUser?.id
                });
            });

            // Connection health monitoring
            this.socket.on('connection_quality', (data) => {
                console.log('📶 Connection quality:', data.latency + 'ms');
                this.updateConnectionQuality(data.latency);
            });

            // User presence updates (like Telegram's last seen)
            this.socket.on('user_presence_update', (data) => {
                this.updateUserPresence(data.userId, data.status, data.lastSeen);
            });

            // Telegram-style message acknowledgments
            this.socket.on('message_ack', (data) => {
                console.log('✅ Message acknowledged:', data.messageId);
                this.markMessageAsDelivered(data.messageId, data.deliveredAt);
            });

            // Queued messages when we come back online
            this.socket.on('queued_messages', (messages) => {
                console.log('📬 Received queued messages:', messages.length);
                messages.forEach(message => {
                    this.displayMessage(message, false); // Don't play sound for queued
                });
            });

            // Authentication response
            this.socket.on('authenticated', (data) => {
                console.log('✅ Authenticated for messaging:', data);
                this.authenticatedUserId = data.userId;
                this.authenticatedUsername = data.username;
            });

            this.socket.on('authentication_failed', (data) => {
                console.warn('❌ Authentication failed:', data.error);
                // Fallback to guest mode
                this.socket.emit('join_chat', {
                    userId: this.currentUser.id,
                    username: this.currentUser.name,
                    avatar: this.currentUser.avatar
                });
            });

            // Join chat responses
            this.socket.on('join_success', (data) => {
                console.log('✅ Successfully joined chat:', data.message);
            });

            this.socket.on('join_error', (data) => {
                console.error('❌ Join chat failed:', data.error);
                this.showNotification('Không thể tham gia chat: ' + data.error, 'error');
            });

            // Enhanced message responses
            this.socket.on('telegram_message_ack', (data) => {
                console.log('✅ Telegram message acknowledged:', data);
                this.markMessageAsDelivered(data.messageId, data.deliveredAt);
            });

            this.socket.on('message_error', (data) => {
                console.error('❌ Message send failed:', data.error);
                this.showNotification('Không thể gửi tin nhắn: ' + data.error, 'error');
                this.updateMessageStatus(data.messageId, 'failed');
            });

            // Real-time message events
            this.socket.on('new_telegram_message', (data) => {
                console.log('📨 Received Telegram-style message:', data);
                this.receiveMessage(data);
            });

            this.socket.on('typing_start', (data) => {
                if (data.userId !== this.currentUser.id) {
                    this.typingUsers.add(data.username);
                    this.showTypingIndicator();
                }
            });

            this.socket.on('typing_stop', (data) => {
                if (data.userId !== this.currentUser.id) {
                    this.typingUsers.delete(data.username);
                    this.updateTypingIndicator();
                }
            });

            this.socket.on('user_joined', (data) => {
                if (data.userId !== this.currentUser.id) {
                    this.onlineUsers.add(data);
                    this.showSystemMessage(`${data.username} đã tham gia cuộc trò chuyện`);
                    this.updateOnlineUsers();
                }
            });

            this.socket.on('user_left', (data) => {
                if (data.userId !== this.currentUser.id) {
                    this.onlineUsers.delete(data);
                    this.showSystemMessage(`${data.username} đã rời khỏi cuộc trò chuyện`);
                    this.updateOnlineUsers();
                }
            });

        } catch (error) {
            console.error('❌ Failed to initialize Socket.IO:', error);
            this.initializeFallbackMessaging();
        }
    }
    
    // Fallback messaging system using BroadcastChannel
    initializeFallbackMessaging() {
        console.log('🔄 Initializing fallback messaging system...');
        
        // Simulate WebSocket connection using localStorage and BroadcastChannel
        this.channel = new BroadcastChannel('cosmic_chat');
        
        // Listen for messages from other tabs/windows
        this.channel.onmessage = (event) => {
            const data = event.data;
            this.handleWebSocketMessage(data);
        };

        // Simulate connection
        setTimeout(() => {
            this.isConnected = true;
            this.updateConnectionStatus(true);
            
            // Join the chat room
            this.broadcastMessage({
                type: 'user_joined',
                user: this.currentUser,
                timestamp: Date.now()
            });
            
            console.log('Real-time messaging connected');
        }, 1000);

        // Listen for storage events (for persistence)
        window.addEventListener('storage', (event) => {
            if (event.key === `messages_${this.currentChatId}`) {
                this.loadMessageHistory();
            }
        });

        // Handle page unload
        window.addEventListener('beforeunload', () => {
            this.broadcastMessage({
                type: 'user_left',
                user: this.currentUser,
                timestamp: Date.now()
            });
        });
    }

    broadcastMessage(data) {
        if (this.channel) {
            this.channel.postMessage(data);
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'message':
                if (data.senderId !== this.currentUser.id) {
                    this.receiveMessage(data);
                }
                break;
            case 'typing_start':
                if (data.userId !== this.currentUser.id) {
                    this.typingUsers.add(data.userName);
                    this.showTypingIndicator();
                }
                break;
            case 'typing_stop':
                if (data.userId !== this.currentUser.id) {
                    this.typingUsers.delete(data.userName);
                    this.updateTypingIndicator();
                }
                break;
            case 'user_joined':
                if (data.user.id !== this.currentUser.id) {
                    this.onlineUsers.add(data.user);
                    this.showSystemMessage(`${data.user.name} đã tham gia cuộc trò chuyện`);
                    this.updateOnlineUsers();
                }
                break;
            case 'user_left':
                if (data.user.id !== this.currentUser.id) {
                    this.onlineUsers.delete(data.user);
                    this.showSystemMessage(`${data.user.name} đã rời khỏi cuộc trò chuyện`);
                    this.updateOnlineUsers();
                }
                break;
        }
    }

    initializeUI() {
        // Get message elements
        this.messageContainer = document.getElementById('messages-container');
        this.messageInput = document.querySelector('.message-input');
        this.sendButton = document.querySelector('.send-button');
        
        // Disable message input by default (until a conversation is selected)
        if (this.messageInput) {
            this.messageInput.disabled = true;
            this.messageInput.placeholder = 'Chọn một cuộc trò chuyện để bắt đầu...';
        }
        
        // Add event listeners
        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => this.sendMessage());
        }

        // Add clear chat button listener
        const clearChatBtn = document.getElementById('clear-chat-btn');
        if (clearChatBtn) {
            clearChatBtn.addEventListener('click', () => {
                if (confirm('Bạn có chắc muốn xóa tất cả tin nhắn không?')) {
                    this.clearChatHistory();
                }
            });
        }

        // Add reset user button listener
        const resetUserBtn = document.getElementById('reset-user-btn');
        if (resetUserBtn) {
            resetUserBtn.addEventListener('click', () => {
                if (confirm('Bạn có chắc muốn đặt lại thông tin người dùng không? Điều này sẽ xóa tất cả dữ liệu chat.')) {
                    this.resetUserProfile();
                }
            });
        }
        
        if (this.messageInput) {
            this.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            // Typing indicator
            let typingTimer;
            this.messageInput.addEventListener('input', () => {
                if (!this.isTyping) {
                    this.isTyping = true;
                    this.broadcastMessage({
                        type: 'typing_start',
                        userId: this.currentUser.id,
                        userName: this.currentUser.name,
                        timestamp: Date.now()
                    });
                }

                clearTimeout(typingTimer);
                typingTimer = setTimeout(() => {
                    this.isTyping = false;
                    this.broadcastMessage({
                        type: 'typing_stop',
                        userId: this.currentUser.id,
                        userName: this.currentUser.name,
                        timestamp: Date.now()
                    });
                }, 1000);
            });
        }
    }

    loadMessageHistory() {
        const savedMessages = localStorage.getItem(`messages_${this.currentChatId}`);
        if (savedMessages) {
            this.messages = JSON.parse(savedMessages);
            this.renderAllMessages();
        } else {
            this.messages = [];
            // No automatic welcome message - keep chat clean
        }
    }

    saveMessages() {
        localStorage.setItem(`messages_${this.currentChatId}`, JSON.stringify(this.messages));
    }

    clearChatHistory() {
        this.messages = [];
        localStorage.removeItem(`messages_${this.currentChatId}`);
        if (this.messageContainer) {
            this.messageContainer.innerHTML = '';
        }
        console.log('Chat history cleared');
    }

    resetUserProfile() {
        localStorage.removeItem('currentUser');
        localStorage.removeItem(`messages_${this.currentChatId}`);
        location.reload(); // Reload page to recreate user
    }

    sendMessage() {
        const messageText = this.messageInput?.value.trim();
        if (!messageText) return;

        // Use Telegram-style messaging if Socket.IO is available
        if (this.socket && this.isConnected) {
            console.log('📨 Sending Telegram-style message via Socket.IO');
            this.sendMessageWithAcknowledgment(messageText, this.currentChatId || 'general');
        } else {
            console.log('📨 Sending fallback message via BroadcastChannel');
            // Fallback to BroadcastChannel
            const newMessage = {
                id: this.generateTelegramMessageId(),
                senderId: this.currentUser.id,
                senderName: this.currentUser.name,
                senderAvatar: this.currentUser.avatar,
                text: messageText,
                timestamp: Date.now(),
                type: 'text',
                status: 'sending'
            };

            // Add to messages array
            this.messages.push(newMessage);
            this.renderMessage(newMessage);
            this.saveMessages();

            // Broadcast to other users
            this.broadcastMessage({
                type: 'message',
                ...newMessage,
                status: 'sent'
            });

            // Update status for fallback
            setTimeout(() => {
                newMessage.status = 'sent';
                this.updateMessageStatus(newMessage.id, 'sent');
            }, 500);
        }

        // Clear input
        if (this.messageInput) {
            this.messageInput.value = '';
        }

        this.scrollToBottom();
    }

    receiveMessage(messageData) {
        const message = {
            id: messageData.id,
            senderId: messageData.senderId,
            senderName: messageData.senderName,
            senderAvatar: messageData.senderAvatar,
            text: messageData.text,
            timestamp: messageData.timestamp,
            type: messageData.type,
            status: 'received'
        };

        this.messages.push(message);
        this.renderMessage(message);
        this.saveMessages();
        this.scrollToBottom();

        // Show notification
        this.showNotification(message);

        // Remove from typing if this user was typing
        this.typingUsers.delete(message.senderName);
        this.updateTypingIndicator();
    }

    renderAllMessages() {
        if (!this.messageContainer) return;
        this.messageContainer.innerHTML = '';
        this.messages.forEach(message => this.renderMessage(message));
        this.updateTypingIndicator();
    }

    renderMessage(message) {
        if (!this.messageContainer) return;

        const isOwn = message.senderId === this.currentUser.id;
        const isSystem = message.type === 'system';
        const timeStr = new Date(message.timestamp).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const messageElement = document.createElement('div');
        
        if (isSystem) {
            messageElement.className = 'system-message';
            messageElement.innerHTML = `
                <div class="inline-block bg-gray-600/30 text-gray-300 px-4 py-2 rounded-full text-sm border border-gray-600/20">
                    ${this.escapeHtml(message.text)}
                </div>
            `;
        } else {
            messageElement.className = `message ${isOwn ? 'message-own' : 'message-other'}`;
            messageElement.setAttribute('data-message-id', message.id);

            messageElement.innerHTML = `
                <div class="flex ${isOwn ? 'justify-end' : 'justify-start'} items-start gap-3">
                    ${!isOwn ? `<img src="${message.senderAvatar}" alt="${message.senderName}" class="w-8 h-8 rounded-full object-cover">` : ''}
                    
                    <div class="max-w-xs lg:max-w-md ${isOwn ? 'order-first' : 'order-last'}">
                        ${!isOwn ? `<div class="text-xs text-gray-400 mb-1 px-2">${this.escapeHtml(message.senderName)}</div>` : ''}
                        <div class="${isOwn ? 'bg-indigo-600 text-white' : 'bg-gray-700/50 text-gray-100'} rounded-lg p-3 shadow-sm ${message.text.length > 200 ? 'message-long' : ''}">
                            <p class="break-words">${this.escapeHtml(message.text)}</p>
                        </div>
                        
                        <div class="flex items-center gap-1 mt-1 px-2 text-xs text-gray-400">
                            <span>${timeStr}</span>
                            ${isOwn && message.status ? `<span class="ml-1 message-status" data-status="${message.status}">${this.getStatusIcon(message.status)}</span>` : ''}
                        </div>
                    </div>
                    
                    ${isOwn ? `<img src="${message.senderAvatar}" alt="${message.senderName}" class="w-8 h-8 rounded-full object-cover">` : ''}
                </div>
            `;
        }

        // Add with animation
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'translateY(10px)';
        this.messageContainer.appendChild(messageElement);
        
        // Trigger animation
        setTimeout(() => {
            messageElement.style.transition = 'all 0.3s ease-out';
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0)';
        }, 50);
    }

    updateMessageStatus(messageId, status) {
        const messageElement = this.messageContainer.querySelector(`[data-message-id="${messageId}"] .message-status`);
        if (messageElement) {
            messageElement.setAttribute('data-status', status);
            messageElement.textContent = this.getStatusIcon(status);
        }
    }

    showSystemMessage(text) {
        const systemMessage = {
            id: 'system_' + Date.now(),
            text: text,
            timestamp: Date.now(),
            type: 'system'
        };
        
        this.messages.push(systemMessage);
        this.renderMessage(systemMessage);
        this.saveMessages();
        this.scrollToBottom();
    }

    showTypingIndicator() {
        this.updateTypingIndicator();
    }

    updateTypingIndicator() {
        const existingIndicator = this.messageContainer.querySelector('.typing-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }

        if (this.typingUsers.size > 0) {
            const typingIndicator = document.createElement('div');
            typingIndicator.className = 'typing-indicator mb-4';
            
            const typingText = this.typingUsers.size === 1 
                ? `${Array.from(this.typingUsers)[0]} đang nhập...`
                : `${this.typingUsers.size} người đang nhập...`;

            typingIndicator.innerHTML = `
                <div class="flex justify-start items-end gap-2">
                    <img src="https://placehold.co/32x32/8A2BE2/FFFFFF?text=..." alt="Typing" class="w-8 h-8 rounded-full">
                    <div class="bg-gray-700/50 rounded-lg rounded-tl-none px-4 py-2">
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-gray-300">${typingText}</span>
                            <div class="typing-dots flex gap-1">
                                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            this.messageContainer.appendChild(typingIndicator);
        }
    }

    updateOnlineUsers() {
        // Update online users count in UI
        const onlineCount = this.onlineUsers.size + 1; // +1 for current user
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            if (onlineCount <= 1) {
                statusElement.textContent = 'Trống';
                statusElement.className = 'text-xs text-gray-400';
            } else {
                statusElement.textContent = `${onlineCount} người trực tuyến`;
                statusElement.className = 'text-xs text-green-400';
            }
        }
    }

    scrollToBottom() {
        if (this.messageContainer) {
            setTimeout(() => {
                this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
            }, 100);
        }
    }

    showNotification(message) {
        // Show browser notification if page is not active
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`${message.senderName}`, {
                body: message.text,
                icon: message.senderAvatar,
                badge: message.senderAvatar
            });
        }

        // Play notification sound (optional)
        this.playNotificationSound();
    }

    playNotificationSound() {
        // Create a simple notification sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    }

    updateConnectionStatus(isConnected) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            if (isConnected) {
                const onlineCount = this.onlineUsers.size + 1;
                if (onlineCount <= 1) {
                    statusElement.textContent = 'Trống';
                    statusElement.className = 'text-xs text-gray-400';
                } else {
                    statusElement.textContent = `${onlineCount} người trực tuyến`;
                    statusElement.className = 'text-xs text-green-400';
                }
            } else {
                statusElement.textContent = 'Đang kết nối...';
                statusElement.className = 'text-xs text-yellow-400';
            }
        }
    }

    getStatusIcon(status) {
        switch (status) {
            case 'sending': return '⏳';
            case 'sent': return '✓';
            case 'delivered': return '✓✓';
            case 'read': return '✓✓';
            default: return '';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Clean up when page unloads
    destroy() {
        if (this.channel) {
            this.broadcastMessage({
                type: 'user_left',
                user: this.currentUser,
                timestamp: Date.now()
            });
            this.channel.close();
        }
    }

    // === Telegram-style Features ===
    
    // Connection quality monitoring
    updateConnectionQuality(latency) {
        const qualityIndicator = document.getElementById('connection-quality') || this.createConnectionQualityIndicator();
        
        let qualityClass = 'excellent';
        let qualityText = 'Tuyệt vời';
        
        if (latency > 500) {
            qualityClass = 'poor';
            qualityText = 'Kém';
        } else if (latency > 200) {
            qualityClass = 'fair';
            qualityText = 'Trung bình';
        } else if (latency > 100) {
            qualityClass = 'good';
            qualityText = 'Tốt';
        }
        
        qualityIndicator.className = `connection-quality ${qualityClass}`;
        qualityIndicator.textContent = `${latency}ms - ${qualityText}`;
    }
    
    createConnectionQualityIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'connection-quality';
        indicator.className = 'connection-quality excellent';
        indicator.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
            color: white;
        `;
        
        // Add CSS styles if not exist
        if (!document.querySelector('#telegram-quality-styles')) {
            const style = document.createElement('style');
            style.id = 'telegram-quality-styles';
            style.textContent = `
                .connection-quality.excellent { background-color: #4CAF50; }
                .connection-quality.good { background-color: #FF9800; }
                .connection-quality.fair { background-color: #FF5722; }
                .connection-quality.poor { background-color: #F44336; }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(indicator);
        return indicator;
    }
    
    // User presence updates (Telegram-style last seen)
    updateUserPresence(userId, status, lastSeen) {
        const userElements = document.querySelectorAll(`[data-user-id="${userId}"]`);
        userElements.forEach(element => {
            const statusElement = element.querySelector('.user-status') || this.createStatusElement(element);
            
            if (status === 'online') {
                statusElement.textContent = 'Đang hoạt động';
                statusElement.className = 'user-status online';
            } else {
                const lastSeenTime = new Date(lastSeen);
                const timeAgo = this.formatLastSeen(lastSeenTime);
                statusElement.textContent = `Hoạt động ${timeAgo}`;
                statusElement.className = 'user-status offline';
            }
        });
    }
    
    createStatusElement(parentElement) {
        const statusElement = document.createElement('div');
        statusElement.className = 'user-status';
        statusElement.style.cssText = `
            font-size: 12px;
            margin-top: 2px;
            color: #666;
        `;
        
        // Add CSS for status colors
        if (!document.querySelector('#telegram-status-styles')) {
            const style = document.createElement('style');
            style.id = 'telegram-status-styles';
            style.textContent = `
                .user-status.online { color: #4CAF50; }
                .user-status.offline { color: #999; }
            `;
            document.head.appendChild(style);
        }
        
        parentElement.appendChild(statusElement);
        return statusElement;
    }
    
    formatLastSeen(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'vừa xong';
        if (minutes < 60) return `${minutes} phút trước`;
        if (hours < 24) return `${hours} giờ trước`;
        if (days < 7) return `${days} ngày trước`;
        return date.toLocaleDateString('vi-VN');
    }
    
    // Telegram-style message delivery confirmation
    markMessageAsDelivered(messageId, deliveredAt) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            let statusElement = messageElement.querySelector('.message-status');
            if (!statusElement) {
                statusElement = document.createElement('div');
                statusElement.className = 'message-status';
                statusElement.style.cssText = `
                    font-size: 10px;
                    color: #666;
                    margin-top: 2px;
                    text-align: right;
                `;
                messageElement.appendChild(statusElement);
            }
            
            statusElement.innerHTML = '✓✓ Đã gửi';
            statusElement.style.color = '#4CAF50';
        }
    }
    
    // Enhanced message sending with reliability
    async sendMessageWithAcknowledgment(text, recipientId) {
        const messageId = this.generateTelegramMessageId();
        const message = {
            id: messageId,
            text: text,
            senderId: this.currentUser.id,
            senderName: this.currentUser.name,
            recipientId: recipientId,
            timestamp: Date.now(),
            type: 'telegram_message'
        };
        
        // Display message immediately with pending status
        this.renderMessage(message);
        this.addPendingMessageStatus(messageId);
        
        // Send through Socket.IO with acknowledgment callback
        if (this.socket && this.isConnected) {
            this.socket.emit('telegram_message', message, (acknowledgment) => {
                if (acknowledgment && acknowledgment.success) {
                    this.updateMessageStatus(messageId, 'sent');
                } else {
                    this.updateMessageStatus(messageId, 'failed');
                    this.showRetryOption(messageId, message);
                }
            });
        } else {
            // Fallback: Use BroadcastChannel
            this.broadcastMessage({
                type: 'message',
                ...message
            });
            this.updateMessageStatus(messageId, 'sent');
        }
        
        return messageId;
    }
    
    generateTelegramMessageId() {
        return 'tg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    addPendingMessageStatus(messageId) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            const statusElement = document.createElement('div');
            statusElement.className = 'message-status';
            statusElement.style.cssText = `
                font-size: 10px;
                color: #999;
                margin-top: 2px;
                text-align: right;
            `;
            statusElement.innerHTML = '⏳ Đang gửi...';
            messageElement.appendChild(statusElement);
        }
    }
    
    updateMessageStatus(messageId, status) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            const statusElement = messageElement.querySelector('.message-status');
            if (statusElement) {
                switch(status) {
                    case 'sent':
                        statusElement.innerHTML = '✓ Đã gửi';
                        statusElement.style.color = '#4CAF50';
                        break;
                    case 'failed':
                        statusElement.innerHTML = '❌ Thất bại';
                        statusElement.style.color = '#F44336';
                        break;
                    case 'queued':
                        statusElement.innerHTML = '📤 Đang chờ';
                        statusElement.style.color = '#FF9800';
                        break;
                }
            }
        }
    }
    
    showRetryOption(messageId, message) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement && !messageElement.querySelector('.retry-btn')) {
            const retryButton = document.createElement('button');
            retryButton.innerHTML = '🔄 Thử lại';
            retryButton.className = 'retry-btn text-xs text-blue-500 hover:text-blue-700 mt-1 bg-transparent border-none cursor-pointer';
            retryButton.onclick = () => {
                this.sendMessageWithAcknowledgment(message.text, message.recipientId);
                retryButton.remove();
            };
            messageElement.appendChild(retryButton);
        }
    }

    // Connection status messages
    showConnectionMessage(message, type) {
        const existingMessage = document.getElementById('connection-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        const messageElement = document.createElement('div');
        messageElement.id = 'connection-message';
        messageElement.className = `fixed top-4 right-4 p-3 rounded-lg shadow-lg z-50 ${
            type === 'error' ? 'bg-red-500' : 
            type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
        } text-white`;
        messageElement.textContent = message;
        
        document.body.appendChild(messageElement);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.remove();
            }
        }, 5000);
    }
    
    // Enhanced message display with delivery status
    displayMessage(message, playSound = true) {
        if (!message || !message.text) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = 'message-bubble mb-2';
        messageElement.setAttribute('data-message-id', message.id);
        
        const isOwnMessage = message.senderId === this.currentUser.id;
        const messageClass = isOwnMessage ? 'sent' : 'received';
        
        messageElement.innerHTML = `
            <div class="message-${messageClass} p-3 rounded-lg max-w-xs break-words ${
                isOwnMessage ? 
                'bg-blue-500 text-white ml-auto' : 
                'bg-gray-200 text-gray-800'
            }">
                <div class="message-text">${this.escapeHtml(message.text)}</div>
                <div class="message-time text-xs opacity-75 mt-1">
                    ${new Date(message.timestamp).toLocaleTimeString('vi-VN', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    })}
                </div>
            </div>
        `;
        
        if (this.messageContainer) {
            this.messageContainer.appendChild(messageElement);
            this.scrollToBottom();
        }
        
        // Play notification sound for received messages
        if (playSound && !isOwnMessage && 'Notification' in window && Notification.permission === 'granted') {
            this.playTelegramNotificationSound();
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    playTelegramNotificationSound() {
        try {
            // Create Telegram-like notification beep
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Telegram-style beep pattern
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.4);
        } catch (error) {
            console.log('Could not play notification sound:', error);
        }
    }
}

// Initialize Real-time Messaging
let realTimeMessaging = null;

// === Voice and Video Call System ===
let localStream = null;
let remoteStream = null;
let callTimer = null;
let callStartTime = null;
let isCallActive = false;
let isMuted = false;
let isCameraOff = false;

// Call Management
class CallManager {
    constructor() {
        this.initializeEventListeners();
        this.audioContext = null;
        this.analyser = null;
        this.voiceBars = document.querySelectorAll('.voice-bar');
    }

    initializeEventListeners() {
        // Check if elements exist before adding listeners
        const voiceCallBtn = document.getElementById('voice-call-btn');
        if (voiceCallBtn) {
            voiceCallBtn.addEventListener('click', () => {
                this.initiateCall('voice');
            });
        }

        const videoCallBtn = document.getElementById('video-call-btn');
        if (videoCallBtn) {
            videoCallBtn.addEventListener('click', () => {
                this.initiateCall('video');
            });
        }

        // Voice call controls
        document.getElementById('mute-btn').addEventListener('click', () => {
            this.toggleMute();
        });

        document.getElementById('speaker-btn').addEventListener('click', () => {
            this.toggleSpeaker();
        });

        document.getElementById('end-call-btn').addEventListener('click', () => {
            this.endCall();
        });

        // Video call controls
        document.getElementById('video-mute-btn').addEventListener('click', () => {
            this.toggleMute();
        });

        document.getElementById('camera-toggle-btn').addEventListener('click', () => {
            this.toggleCamera();
        });

        document.getElementById('screen-share-btn').addEventListener('click', () => {
            this.toggleScreenShare();
        });

        document.getElementById('video-end-call-btn').addEventListener('click', () => {
            this.endCall();
        });
    }

    // New method to initiate call and open in new tab
    initiateCall(type) {
        // Store call info in localStorage for the calls page (accessible across tabs)
        const callInfo = {
            type: type, // 'voice' or 'video'
            contact: 'Cosmic Chat', // Current chat contact
            timestamp: Date.now(),
            state: 'outgoing',
            callId: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        
        localStorage.setItem('currentCall', JSON.stringify(callInfo));
        localStorage.setItem(`call_${callInfo.callId}`, JSON.stringify(callInfo));
        
        // Open calls page in new tab/window
        const callWindow = window.open('./calls.html', 'cosmicCall', 'width=1200,height=800,scrollbars=yes,resizable=yes');
        
        // Focus the new window
        if (callWindow) {
            callWindow.focus();
        }
        
        // Optional: Listen for call window close event
        if (callWindow) {
            const checkClosed = setInterval(() => {
                if (callWindow.closed) {
                    clearInterval(checkClosed);
                    // Clean up call data when window is closed
                    localStorage.removeItem('currentCall');
                    localStorage.removeItem(`call_${callInfo.callId}`);
                    console.log('Call window closed');
                }
            }, 1000);
        }
    }

    async startVoiceCall() {
        try {
            // Request microphone access
            localStream = await navigator.mediaDevices.getUserMedia({ 
                audio: true, 
                video: false 
            });

            // Show voice call overlay
            document.getElementById('voice-call-overlay').classList.remove('hidden');
            
            // Setup audio visualization
            this.setupAudioVisualization();
            
            // Simulate call connection
            this.simulateCallConnection('voice');
            
            isCallActive = true;
        } catch (error) {
            console.error('Error starting voice call:', error);
            alert('Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.');
        }
    }

    async startVideoCall() {
        try {
            // Request camera and microphone access
            localStream = await navigator.mediaDevices.getUserMedia({ 
                audio: true, 
                video: true 
            });

            // Show video call overlay
            document.getElementById('video-call-overlay').classList.remove('hidden');
            
            // Setup local video stream
            const localVideo = document.getElementById('local-video');
            localVideo.srcObject = localStream;
            
            // Simulate remote video (placeholder)
            this.setupRemoteVideo();
            
            // Simulate call connection
            this.simulateCallConnection('video');
            
            isCallActive = true;
        } catch (error) {
            console.error('Error starting video call:', error);
            alert('Không thể truy cập camera/microphone. Vui lòng kiểm tra quyền truy cập.');
        }
    }

    setupAudioVisualization() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(localStream);
            this.analyser = this.audioContext.createAnalyser();
            
            source.connect(this.analyser);
            this.analyser.fftSize = 256;
            
            const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            
            const animateVoiceBars = () => {
                if (!isCallActive) return;
                
                this.analyser.getByteFrequencyData(dataArray);
                
                // Animate voice bars based on audio data
                this.voiceBars.forEach((bar, index) => {
                    const value = dataArray[index * 10] || 0;
                    const height = Math.max(4, (value / 255) * 30);
                    bar.style.height = `${height}px`;
                });
                
                requestAnimationFrame(animateVoiceBars);
            };
            
            animateVoiceBars();
        } catch (error) {
            console.error('Error setting up audio visualization:', error);
        }
    }

    setupRemoteVideo() {
        // Simulate remote video with a colored background
        const remoteVideo = document.getElementById('remote-video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = 1920;
        canvas.height = 1080;
        
        // Create gradient background
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#8A2BE2');
        gradient.addColorStop(1, '#4B0082');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add user icon
        ctx.fillStyle = 'white';
        ctx.font = '200px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('👤', canvas.width / 2, canvas.height / 2 + 70);
        
        // Convert canvas to video stream
        const stream = canvas.captureStream(30);
        remoteVideo.srcObject = stream;
    }

    simulateCallConnection(type) {
        const statusElement = type === 'voice' ? 
            document.getElementById('call-status') : 
            document.getElementById('video-call-status');
        
        const timerElement = type === 'voice' ? 
            document.getElementById('call-timer') : 
            document.getElementById('video-call-timer');

        // Simulate connection sequence
        setTimeout(() => {
            statusElement.textContent = 'Đang kết nối...';
        }, 1000);

        setTimeout(() => {
            statusElement.textContent = 'Đã kết nối';
            statusElement.classList.remove('text-green-400');
            statusElement.classList.add('text-blue-400');
            
            // Start call timer
            this.startCallTimer(timerElement);
        }, 3000);
    }

    startCallTimer(timerElement) {
        callStartTime = Date.now();
        timerElement.classList.remove('hidden');
        
        callTimer = setInterval(() => {
            const elapsed = Date.now() - callStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            timerElement.textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    toggleMute() {
        if (!localStream) return;
        
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            audioTracks[0].enabled = !audioTracks[0].enabled;
            isMuted = !isMuted;
            
            // Update mute button visual state
            const muteBtns = [document.getElementById('mute-btn'), document.getElementById('video-mute-btn')];
            muteBtns.forEach(btn => {
                if (btn) {
                    btn.classList.toggle('bg-red-600', isMuted);
                    btn.classList.toggle('bg-gray-700', !isMuted);
                }
            });
        }
    }

    toggleCamera() {
        if (!localStream) return;
        
        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            videoTracks[0].enabled = !videoTracks[0].enabled;
            isCameraOff = !isCameraOff;
            
            // Update camera button visual state
            const cameraBtn = document.getElementById('camera-toggle-btn');
            cameraBtn.classList.toggle('bg-red-600', isCameraOff);
            cameraBtn.classList.toggle('bg-gray-700', !isCameraOff);
        }
    }

    async toggleScreenShare() {
        try {
            if (localStream.getVideoTracks()[0].label.includes('screen')) {
                // Stop screen share, switch back to camera
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: true, 
                    video: true 
                });
                
                const videoTrack = stream.getVideoTracks()[0];
                const sender = localStream.getVideoTracks()[0];
                
                localStream.removeTrack(sender);
                localStream.addTrack(videoTrack);
                
                document.getElementById('local-video').srcObject = localStream;
                
                document.getElementById('screen-share-btn').classList.remove('bg-blue-600');
                document.getElementById('screen-share-btn').classList.add('bg-gray-700');
            } else {
                // Start screen share
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
                    video: true, 
                    audio: true 
                });
                
                const videoTrack = screenStream.getVideoTracks()[0];
                const oldTrack = localStream.getVideoTracks()[0];
                
                localStream.removeTrack(oldTrack);
                localStream.addTrack(videoTrack);
                
                document.getElementById('local-video').srcObject = localStream;
                
                document.getElementById('screen-share-btn').classList.add('bg-blue-600');
                document.getElementById('screen-share-btn').classList.remove('bg-gray-700');
                
                // Handle screen share end
                videoTrack.onended = () => {
                    this.toggleScreenShare();
                };
            }
        } catch (error) {
            console.error('Error toggling screen share:', error);
            alert('Không thể chia sẻ màn hình.');
        }
    }

    toggleSpeaker() {
        // Note: Web browsers have limited control over audio output device
        // This would typically require additional WebRTC implementation
        const speakerBtn = document.getElementById('speaker-btn');
        speakerBtn.classList.toggle('bg-blue-600');
        speakerBtn.classList.toggle('bg-gray-700');
    }

    endCall() {
        // Stop all media tracks
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        
        // Clear call timer
        if (callTimer) {
            clearInterval(callTimer);
            callTimer = null;
        }
        
        // Hide overlays
        document.getElementById('voice-call-overlay').classList.add('hidden');
        document.getElementById('video-call-overlay').classList.add('hidden');
        
        // Reset states
        isCallActive = false;
        isMuted = false;
        isCameraOff = false;
        
        // Reset button states
        document.querySelectorAll('[id$="-btn"]').forEach(btn => {
            btn.classList.remove('bg-red-600', 'bg-blue-600');
            btn.classList.add('bg-gray-700');
        });
        
        // Reset status and timer displays
        document.getElementById('call-status').textContent = 'Đang gọi...';
        document.getElementById('call-status').className = 'text-green-400';
        document.getElementById('call-timer').classList.add('hidden');
        document.getElementById('video-call-status').textContent = 'Đang kết nối...';
        document.getElementById('video-call-status').className = 'text-green-400 text-sm';
        document.getElementById('video-call-timer').classList.add('hidden');
        
        // Close audio context
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

// Initialize Call Manager safely
let callManager = null;
try {
    callManager = new CallManager();
} catch (error) {
    console.warn('⚠️ CallManager initialization failed:', error.message);
}

// Monitor active calls
const monitorActiveCalls = () => {
    setInterval(() => {
        const activeCall = localStorage.getItem('currentCall');
        const callStatusIndicator = document.getElementById('call-status-indicator');
        
        if (activeCall) {
            const callData = JSON.parse(activeCall);
            if (!callStatusIndicator) {
                // Create call status indicator
                const indicator = document.createElement('div');
                indicator.id = 'call-status-indicator';
                indicator.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2';
                indicator.innerHTML = `
                    <div class="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span>Cuộc gọi ${callData.type === 'video' ? 'video' : 'voice'} đang diễn ra</span>
                `;
                document.body.appendChild(indicator);
            }
        } else {
            // Remove indicator if no active call
            if (callStatusIndicator) {
                callStatusIndicator.remove();
            }
        }
    }, 1000);
};

// Start monitoring when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== DOM CONTENT LOADED ===');
    
    // Initialize Real-time Messaging
    realTimeMessaging = new RealTimeMessaging();
    
    // Add a debug button for testing
    const debugButton = document.createElement('button');
    debugButton.innerHTML = 'DEBUG: Test Chat Window';
    debugButton.className = 'fixed top-4 left-4 bg-red-600 text-white px-4 py-2 rounded z-50';
    debugButton.onclick = () => {
        console.log('=== DEBUG TEST ===');
        const testUser = {
            id: 'debug-user',
            name: 'Debug User',
            username: 'debug',
            avatar: 'https://placehold.co/100x100/FF0000/FFFFFF?text=D'
        };
        if (realTimeMessaging) {
            realTimeMessaging.showConversationPlaceholder(testUser);
        }
    };
    document.body.appendChild(debugButton);
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    monitorActiveCalls();
});

// Cleanup when page unloads
window.addEventListener('beforeunload', () => {
    if (realTimeMessaging) {
        realTimeMessaging.destroy();
    }
});

// --- Page Navigation Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const mainNav = document.getElementById('main-nav');
    const navLinks = mainNav.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page-content');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // Only prevent default if it's an internal page transition (href="#")
            if (link.getAttribute('href') === '#' && link.dataset.page) {
                e.preventDefault();
                const targetPageId = link.dataset.page;

                // Hide all page content
                pages.forEach(page => {
                    page.classList.add('hidden');
                });

                // Show the target page
                const targetPage = document.getElementById(`page-${targetPageId}`);
                if (targetPage) {
                    targetPage.classList.remove('hidden');
                }

                // Update active link style
                navLinks.forEach(navLink => {
                    navLink.classList.remove('text-white', 'bg-gray-500/20');
                    navLink.classList.add('hover:bg-gray-800/50');
                });
                link.classList.add('text-white', 'bg-gray-500/20');
                link.classList.remove('hover:bg-gray-800/50');
            }
            // If href is set to a real URL, let the default navigation happen
        });
    });
});


// --- 3D Cosmic Background Script ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.z = 1;
const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('cosmic-bg'),
    antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
const starGeo = new THREE.BufferGeometry();
const starCount = 6000;
const posArray = new Float32Array(starCount * 3);
for (let i = 0; i < starCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 600;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const starMaterial = new THREE.PointsMaterial({
    size: 0.5,
    color: 0xaaaaaa,
    transparent: true,
});
const stars = new THREE.Points(starGeo, starMaterial);
scene.add(stars);
let mouseX = 0;
let mouseY = 0;
document.addEventListener('mousemove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
});
const clock = new THREE.Clock();
const animate = () => {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();
    stars.rotation.y = -mouseX * 0.00005;
    stars.rotation.x = -mouseY * 0.00005;
    // Adjust camera based on scroll position to create a parallax effect
    camera.position.z = 1 + (document.documentElement.scrollTop || document.body.scrollTop) * 0.001;
    renderer.render(scene, camera);
};
animate();
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
