// === TELEGRAM-INSPIRED MESSAGING SYSTEM ===
class TelegramMessaging {
    constructor() {
        console.log('🚀 Initializing Telegram-style messaging system');
        
        // Core Telegram-like properties
        this.socket = null;
        this.currentUser = this.loadUserProfile();
        this.currentChat = null;
        this.messages = new Map(); // Message storage like Telegram
        this.chats = new Map(); // Chat storage
        this.messageQueue = []; // Pending messages
        this.typingUsers = new Set();
        this.isOnline = false;
        this.isAuthenticated = false; // Socket.IO authentication status
        
        // Initialize subsystems
        this.initSocket();
        this.initUI();
        this.initMessageHandlers();
        this.requestNotificationPermission();
        this.restoreSession();
        
        console.log('✅ Telegram messaging system ready');
    }

    // === USER PROFILE MANAGEMENT ===
    loadUserProfile() {
        try {
            // Try multiple sources like Telegram
            const sources = [
                () => JSON.parse(localStorage.getItem('user') || '{}'),
                () => JSON.parse(localStorage.getItem('userInfo') || '{}'),
                () => window.loadUserInfo?.() || {},
                () => ({ // Fallback demo user
                    id: '689c9b9d1e859ae855bb1e01',
                    name: 'Nghĩa Hoàng',
                    username: 'nghia_hoang',
                    avatar: 'https://placehold.co/48x48/4F46E5/FFFFFF?text=NH'
                })
            ];
            
            for (const source of sources) {
                const user = source();
                if (user && user.id && user.name) {
                    console.log('👤 User profile loaded:', user);
                    return user;
                }
            }
            
            throw new Error('No valid user profile found');
        } catch (error) {
            console.error('❌ User profile load failed:', error);
            return null;
        }
    }

    // === SOCKET CONNECTION ===
    initSocket() {
        try {
            // Check if Socket.IO is available
            if (typeof io === 'undefined') {
                console.warn('⚠️ Socket.IO not yet loaded, will retry...');
                // Wait for Socket.IO to load
                if (window.socketIOLoaded) {
                    this.initSocket();
                    return;
                }
                
                // Listen for Socket.IO ready event
                window.addEventListener('socketio-ready', () => {
                    console.log('🔄 Socket.IO ready, initializing connection...');
                    this.initSocket();
                });
                return;
            }

            this.socket = io({
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                timeout: 20000
            });

            this.socket.on('connect', () => {
                console.log('🔌 Connected to Telegram-style server');
                this.isOnline = true;
                this.updateConnectionStatus();
                this.authenticateUser();
                this.joinUserRoom();
            });

            this.socket.on('disconnect', () => {
                console.log('💔 Disconnected from server');
                this.isOnline = false;
                this.updateConnectionStatus();
            });

            this.socket.on('reconnect', () => {
                console.log('🔄 Reconnected to server');
                this.isOnline = true;
                this.updateConnectionStatus();
                this.restoreSession();
            });

        } catch (error) {
            console.error('❌ Socket initialization failed:', error);
        }
    }

    authenticateUser() {
        if (this.currentUser && this.socket?.connected) {
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            if (token) {
                this.socket.emit('authenticate', {
                    token: token
                });
                console.log('🔐 User authentication sent with JWT token');
            } else {
                console.error('❌ No JWT token found for authentication');
            }
        }
    }

    joinUserRoom() {
        if (this.currentUser && this.socket?.connected) {
            this.socket.emit('join_user_room', {
                userId: this.currentUser.id
            });
        }
    }

    // === MESSAGE HANDLERS ===
    initMessageHandlers() {
        if (!this.socket) return;

        // Authentication events
        this.socket.on('authenticated', (data) => this.handleAuthenticated(data));
        this.socket.on('authentication_failed', (data) => this.handleAuthenticationFailed(data));

        // Telegram-style message events
        this.socket.on('new_message', (message) => this.handleIncomingMessage(message));
        this.socket.on('message', (message) => this.handleIncomingMessage(message));
        this.socket.on('broadcast_message', (message) => this.handleIncomingMessage(message));
        this.socket.on('message_sent', (data) => this.handleMessageSent(data));
        this.socket.on('message_delivered', (data) => this.handleMessageDelivered(data));
        this.socket.on('typing_start', (data) => this.handleTypingStart(data));
        this.socket.on('typing_stop', (data) => this.handleTypingStop(data));
    }

    handleAuthenticated(data) {
        console.log('✅ Socket.IO authentication successful:', data);
        this.isAuthenticated = true;
        // Join current chat room if we have one
        if (this.currentChat) {
            this.socket.emit('join_room', { roomId: this.currentChat.id });
        }
    }

    handleAuthenticationFailed(data) {
        console.error('❌ Socket.IO authentication failed:', data);
        this.isAuthenticated = false;
        // Try to refresh the token or redirect to login
    }

    handleIncomingMessage(message) {
        console.log('📨 Incoming Telegram message:', message);
        
        if (!message || !message.id) {
            console.warn('⚠️ Invalid message received');
            return;
        }

        // Store message in Telegram-style storage
        const telegramMessage = {
            id: message.id,
            text: message.text || message.content || '',
            senderId: message.senderId,
            senderName: message.senderName || 'Unknown',
            chatId: message.chatId || message.conversationId,
            timestamp: new Date(message.timestamp),
            type: message.type || 'text',
            status: 'received'
        };

        this.messages.set(message.id, telegramMessage);

        // Update chat
        this.updateChatLastMessage(telegramMessage);
        
        // Render if current chat
        if (telegramMessage.chatId === this.currentChat?.id) {
            this.renderMessage(telegramMessage);
            this.scrollToBottom();
        }

        // Show notification if not current chat
        if (telegramMessage.chatId !== this.currentChat?.id) {
            this.showNotification(telegramMessage);
        }
    }

    handleMessageSent(data) {
        console.log('✅ Message sent confirmation:', data);
        this.updateMessageStatus(data.messageId, 'sent');
    }

    handleMessageDelivered(data) {
        console.log('📨 Message delivered:', data);
        this.updateMessageStatus(data.messageId, 'delivered');
    }

    handleTypingStart(data) {
        this.typingUsers.add(data.username);
        this.updateTypingIndicator();
    }

    handleTypingStop(data) {
        this.typingUsers.delete(data.username);
        this.updateTypingIndicator();
    }

    // === CHAT MANAGEMENT ===
    async loadChat(chatId) {
        console.log('💬 Loading Telegram chat:', chatId);
        
        // Validate chat ID
        if (!chatId || chatId === 'undefined' || chatId === 'null') {
            console.error('❌ Invalid chat ID for loadChat:', chatId);
            this.showError('Không thể tải cuộc trò chuyện: ID không hợp lệ');
            return;
        }
        
        try {
            // Store current chat
            this.currentChat = { id: chatId };
            localStorage.setItem('currentChatId', chatId);
            
            // Show chat window and hide placeholder
            const chatWindow = document.getElementById('chat-window');
            const placeholder = document.getElementById('empty-chat-placeholder');
            
            if (chatWindow) {
                chatWindow.classList.remove('hidden');
                chatWindow.style.display = 'flex';
                console.log('✅ Chat window shown');
            }
            
            if (placeholder) {
                placeholder.classList.add('hidden');
                placeholder.style.display = 'none';
                console.log('✅ Placeholder hidden');
            }
            
            // Update chat header with saved user info
            const savedChatUser = localStorage.getItem('currentChatUser');
            if (savedChatUser) {
                try {
                    const chatUser = JSON.parse(savedChatUser);
                    updateChatHeader(chatUser.name, chatUser.avatar);
                } catch (e) {
                    console.warn('Failed to parse saved chat user:', e);
                }
            }
            
            // Join chat room
            if (this.socket?.connected) {
                this.socket.emit('join_room', { roomId: chatId });
            }
            
            // Load messages from API
            const messages = await this.fetchMessagesFromAPI(chatId);
            console.log('📥 Fetched messages:', messages.length, messages);
            
            // Clear and render messages
            this.clearMessageContainer();
            console.log('🧹 Cleared message container');
            
            messages.forEach(msg => {
                this.messages.set(msg.id, msg);
                this.renderMessage(msg);
            });
            
            console.log('🎨 Rendered all messages to DOM');
            
            this.scrollToBottom();
            this.updateUI();
            
            console.log(`✅ Loaded ${messages.length} messages for chat ${chatId}`);
            
        } catch (error) {
            console.error('❌ Chat load failed:', error);
            this.showError('Không thể tải cuộc trò chuyện');
        }
    }

    async fetchMessagesFromAPI(chatId) {
        console.log('📡 Fetching messages from Telegram API...');
        
        const response = await fetch(`/api/conversations/${chatId}/messages`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success || !data.messages) {
            throw new Error(data.message || 'Failed to load messages');
        }

        console.log(`📬 Fetched ${data.messages.length} messages from server`);
        console.log('🔍 Raw message data from server:', data.messages);

        // Convert to internal Telegram format
        return data.messages.map(msg => {
            console.log('📝 Processing message:', msg);
            
            return {
                id: msg.id || msg._id,
                text: msg.text || msg.content || '', // Use text field first (decrypted), fallback to content
                senderId: msg.senderId,
                senderName: msg.senderName || 'Unknown',
                chatId: chatId,
                timestamp: new Date(msg.timestamp),
                type: msg.type || 'text',
                status: 'sent'
            };
        });
    }

    // === MESSAGE SENDING ===
    async sendMessage(text) {
        if (!text?.trim() || !this.currentChat) {
            return;
        }

        const message = {
            id: this.generateMessageId(),
            text: text.trim(),
            senderId: this.currentUser.id,
            senderName: this.currentUser.name,
            chatId: this.currentChat.id,
            timestamp: new Date(),
            type: 'text',
            status: 'sending'
        };

        console.log('📤 Sending Telegram message:', message);

        // Add to local storage
        this.messages.set(message.id, message);
        this.renderMessage(message);
        this.scrollToBottom();

        try {
            // Send via Socket.IO if connected and authenticated
            if (this.socket?.connected && this.isAuthenticated) {
                this.socket.emit('send_message', {
                    messageId: message.id,
                    text: message.text,
                    chatId: this.currentChat.id,
                    senderId: this.currentUser.id,
                    senderName: this.currentUser.name,
                    timestamp: message.timestamp.toISOString()
                });
                
                console.log('📡 Message sent via Socket.IO (authenticated)');
            } else {
                // Fallback to API
                console.log('🔄 Using API fallback (Socket.IO not available/authenticated)');
                await this.sendMessageViaAPI(message);
                console.log('📡 Message sent via API fallback');
            }

            // Update status
            message.status = 'sent';
            this.updateMessageStatus(message.id, 'sent');
            
            // Reload messages to ensure persistence
            setTimeout(() => {
                console.log('🔄 Reloading messages to verify persistence...');
                this.loadMessagesForCurrentChat();
            }, 1000);

        } catch (error) {
            console.error('❌ Send failed:', error);
            message.status = 'failed';
            this.updateMessageStatus(message.id, 'failed');
        }
    }

    async sendMessageViaAPI(message) {
        console.log('📤 Sending message via API:', message);
        
        const response = await fetch(`/api/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            },
            body: JSON.stringify({
                receiverId: message.chatId,
                content: message.text,
                isEncrypted: false
            })
        });

        console.log('📡 API Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log('✅ API Response:', result);
        
        if (!result.success) {
            throw new Error(result.message || 'Send failed');
        }
        
        return result;
    }
    
    async loadMessagesForCurrentChat() {
        if (!this.currentChat || !this.currentChat.id) {
            console.log('❌ No current chat to reload messages for');
            return;
        }
        
        console.log('🔄 Reloading messages for chat:', this.currentChat.id);
        await this.loadChat(this.currentChat.id);
    }

    // === UI RENDERING ===
    renderMessage(message) {
        const container = document.querySelector('#messages-container');
        if (!container) {
            console.error('❌ Messages container not found! Looking for #messages-container');
            return;
        }

        const isOwn = message.senderId === this.currentUser?.id;
        const timeStr = message.timestamp.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        console.log('🎨 Rendering Telegram message:', {
            text: message.text,
            isOwn,
            senderId: message.senderId,
            currentUserId: this.currentUser?.id,
            container: !!container
        });

        const messageEl = document.createElement('div');
        messageEl.className = `message-item ${isOwn ? 'own' : 'other'}`;
        messageEl.setAttribute('data-message-id', message.id);

        // Check if message is long (hash-like or very long text)
        const isLongMessage = message.text.length > 50;
        const isHashLike = /^[a-f0-9]{32,}/.test(message.text) || message.text.includes(':');
        const maxWidthClass = isLongMessage ? 'max-w-md lg:max-w-lg' : 'max-w-xs lg:max-w-md';
        
        // Special styling for hash-like messages
        const messageTextClass = isHashLike ? 
            'message-text break-words font-mono text-xs leading-tight' : 
            'message-text break-words';

        messageEl.innerHTML = `
            <div class="${maxWidthClass} px-4 py-2 rounded-lg ${
                isOwn 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-100'
            } ${isLongMessage ? 'message-long' : ''}">
                ${!isOwn ? `<div class="text-xs text-gray-400 mb-1">${message.senderName}</div>` : ''}
                <div class="${messageTextClass}">${this.escapeHtml(message.text)}</div>
                <div class="text-xs ${isOwn ? 'text-blue-200' : 'text-gray-500'} mt-1 flex items-center ${isOwn ? 'justify-end' : 'justify-start'}">
                    <span>${timeStr}</span>
                    ${isOwn ? `<span class="ml-1">${this.getStatusIcon(message.status)}</span>` : ''}
                </div>
            </div>
        `;

        container.appendChild(messageEl);
        console.log('✅ Message element added to container:', messageEl);
    }

    getStatusIcon(status) {
        switch (status) {
            case 'sending': return '<span class="ml-1">⏳</span>';
            case 'sent': return '<span class="ml-1">✓</span>';
            case 'delivered': return '<span class="ml-1">✓✓</span>';
            case 'failed': return '<span class="ml-1 text-red-400">❌</span>';
            default: return '';
        }
    }

    updateMessageStatus(messageId, status) {
        const message = this.messages.get(messageId);
        if (message) {
            message.status = status;
            const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
            const statusEl = messageEl?.querySelector('.text-xs span:last-child');
            if (statusEl) {
                statusEl.innerHTML = this.getStatusIcon(status);
            }
        }
    }

    clearMessageContainer() {
        const container = document.querySelector('#messages-container');
        if (container) {
            container.innerHTML = '';
        }
    }

    scrollToBottom() {
        const container = document.querySelector('#messages-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    updateConnectionStatus() {
        const statusIndicator = document.getElementById('connection-status');
        if (statusIndicator) {
            if (this.isOnline) {
                statusIndicator.className = 'flex items-center space-x-2 text-green-400 text-sm';
                statusIndicator.innerHTML = `
                    <div class="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span>Đã kết nối</span>
                `;
            } else {
                statusIndicator.className = 'flex items-center space-x-2 text-red-400 text-sm';
                statusIndicator.innerHTML = `
                    <div class="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span>Mất kết nối</span>
                `;
            }
        }
    }

    updateUI() {
        // Update chat layout
        const chatWindow = document.getElementById('chat-window');
        const emptyPlaceholder = document.getElementById('empty-chat-placeholder');
        
        console.log('🔄 Updating UI state:', {
            hasCurrentChat: !!this.currentChat,
            chatWindow: !!chatWindow,
            emptyPlaceholder: !!emptyPlaceholder
        });
        
        if (this.currentChat) {
            if (chatWindow) {
                chatWindow.classList.remove('hidden');
                chatWindow.style.setProperty('display', 'flex');
                console.log('✅ Chat window shown');
            }
            if (emptyPlaceholder) {
                emptyPlaceholder.classList.add('hidden');
                emptyPlaceholder.style.setProperty('display', 'none');
                console.log('✅ Empty placeholder hidden');
            }
        } else {
            if (chatWindow) {
                chatWindow.classList.add('hidden');
                chatWindow.style.setProperty('display', 'none');
                console.log('❌ Chat window hidden');
            }
            if (emptyPlaceholder) {
                emptyPlaceholder.classList.remove('hidden');
                emptyPlaceholder.style.setProperty('display', 'flex');
                console.log('❌ Empty placeholder shown');
            }
        }
    }

    updateChatLastMessage(message) {
        // Update conversation list last message
        try {
            const conversationItem = document.querySelector(`[data-conversation-id="${message.chatId}"]`);
            if (conversationItem) {
                // Update last message text
                const lastMessageEl = conversationItem.querySelector('.last-message');
                if (lastMessageEl) {
                    const truncatedText = message.text.length > 30 
                        ? message.text.substring(0, 30) + '...' 
                        : message.text;
                    lastMessageEl.textContent = truncatedText;
                }
                
                // Update timestamp
                const timestampEl = conversationItem.querySelector('.timestamp');
                if (timestampEl) {
                    timestampEl.textContent = message.timestamp.toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
                
                // Move to top of conversation list
                const conversationsList = conversationItem.parentElement;
                if (conversationsList) {
                    conversationsList.insertBefore(conversationItem, conversationsList.firstChild);
                }
                
                console.log('📋 Updated conversation list for:', message.chatId);
            }
        } catch (error) {
            console.error('❌ Failed to update conversation list:', error);
        }
    }

    updateTypingIndicator() {
        // Implement typing indicator like Telegram
        const typingContainer = document.getElementById('typing-indicator');
        
        if (this.typingUsers.size === 0) {
            // Hide typing indicator
            if (typingContainer) {
                typingContainer.classList.add('hidden');
                typingContainer.innerHTML = '';
            }
            return;
        }
        
        // Show typing indicator
        if (typingContainer) {
            typingContainer.classList.remove('hidden');
            
            const typingArray = Array.from(this.typingUsers);
            let typingText = '';
            
            if (typingArray.length === 1) {
                typingText = `${typingArray[0]} đang nhập...`;
            } else if (typingArray.length === 2) {
                typingText = `${typingArray[0]} và ${typingArray[1]} đang nhập...`;
            } else {
                typingText = `${typingArray[0]} và ${typingArray.length - 1} người khác đang nhập...`;
            }
            
            typingContainer.innerHTML = `
                <div class="flex items-center space-x-2 px-4 py-2 text-sm text-gray-400">
                    <div class="flex space-x-1">
                        <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 0.2s"></div>
                        <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 0.4s"></div>
                    </div>
                    <span>${typingText}</span>
                </div>
            `;
            
            console.log('⌨️ Updated typing indicator:', typingText);
        } else {
            console.warn('⚠️ Typing indicator container not found');
        }
    }

    // === SESSION MANAGEMENT ===
    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                console.log('🔔 Notification permission:', permission);
            });
        }
    }

    restoreSession() {
        const savedChatId = localStorage.getItem('currentChatId');
        if (savedChatId) {
            console.log('🔄 Restoring Telegram session for chat:', savedChatId);
            setTimeout(() => {
                this.loadChat(savedChatId);
            }, 1000);
        }
    }

    // === UTILITIES ===
    generateMessageId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message) {
        console.log('🔔 Telegram notification:', message.text);
        
        // Check if notifications are supported and permitted
        if (!('Notification' in window)) {
            console.warn('⚠️ Browser does not support notifications');
            return;
        }
        
        // Request permission if needed
        if (Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    this.displayNotification(message);
                }
            });
        } else if (Notification.permission === 'granted') {
            this.displayNotification(message);
        }
        
        // Also show in-page notification
        this.showInPageNotification(message);
    }
    
    displayNotification(message) {
        try {
            const notification = new Notification(`Tin nhắn từ ${message.senderName}`, {
                body: message.text.length > 100 ? message.text.substring(0, 100) + '...' : message.text,
                icon: '/assets/images/logo.png',
                badge: '/assets/images/badge.png',
                tag: `message-${message.chatId}`,
                requireInteraction: false,
                silent: false
            });
            
            notification.onclick = () => {
                window.focus();
                this.loadChat(message.chatId);
                notification.close();
            };
            
            // Auto close after 5 seconds
            setTimeout(() => {
                notification.close();
            }, 5000);
            
            console.log('🔔 Push notification sent');
        } catch (error) {
            console.error('❌ Failed to show push notification:', error);
        }
    }
    
    showInPageNotification(message) {
        // Create in-page notification toast
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg z-50 max-w-sm';
        toast.innerHTML = `
            <div class="flex items-start space-x-3">
                <div class="flex-shrink-0">
                    <div class="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                        ${message.senderName.charAt(0).toUpperCase()}
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="font-medium text-sm">${message.senderName}</p>
                    <p class="text-sm text-gray-300 truncate">${message.text}</p>
                </div>
                <button class="text-gray-400 hover:text-white" onclick="this.parentElement.parentElement.remove()">
                    ✕
                </button>
            </div>
        `;
        
        // Add click handler to open chat
        toast.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') {
                this.loadChat(message.chatId);
                toast.remove();
            }
        });
        
        document.body.appendChild(toast);
        
        // Auto remove after 4 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 4000);
    }

    showError(error) {
        console.error('❌ Telegram error:', error);
        
        // Create user-friendly error toast
        const errorToast = document.createElement('div');
        errorToast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-4 rounded-lg shadow-lg z-50 max-w-md';
        
        // Determine user-friendly message
        let userMessage = 'Đã xảy ra lỗi không xác định';
        
        if (typeof error === 'string') {
            if (error.includes('Không thể tải')) {
                userMessage = 'Không thể tải tin nhắn. Vui lòng thử lại.';
            } else if (error.includes('Failed to load')) {
                userMessage = 'Mất kết nối với máy chủ. Vui lòng kiểm tra internet.';
            } else if (error.includes('Send failed')) {
                userMessage = 'Không thể gửi tin nhắn. Vui lòng thử lại.';
            } else if (error.includes('HTTP 401')) {
                userMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
            } else if (error.includes('HTTP 403')) {
                userMessage = 'Bạn không có quyền thực hiện thao tác này.';
            } else if (error.includes('HTTP 500')) {
                userMessage = 'Lỗi máy chủ. Vui lòng thử lại sau.';
            } else {
                userMessage = error;
            }
        } else if (error?.message) {
            userMessage = error.message;
        }
        
        errorToast.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="flex-shrink-0">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <div class="flex-1">
                    <p class="font-medium text-sm">Lỗi</p>
                    <p class="text-sm text-red-100">${userMessage}</p>
                </div>
                <button class="text-red-200 hover:text-white ml-2" onclick="this.parentElement.parentElement.remove()">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;
        
        document.body.appendChild(errorToast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (errorToast.parentElement) {
                errorToast.remove();
            }
        }, 5000);
        
        // Add slide-in animation
        errorToast.style.transform = 'translate(-50%, -20px)';
        errorToast.style.opacity = '0';
        requestAnimationFrame(() => {
            errorToast.style.transition = 'all 0.3s ease-out';
            errorToast.style.transform = 'translate(-50%, 0)';
            errorToast.style.opacity = '1';
        });
        
        // Provide action buttons for specific errors
        if (userMessage.includes('đăng nhập lại')) {
            this.addErrorAction(errorToast, 'Đăng nhập', () => {
                window.location.href = '/pages/login.html';
            });
        } else if (userMessage.includes('thử lại')) {
            this.addErrorAction(errorToast, 'Thử lại', () => {
                if (this.currentChat) {
                    this.loadChat(this.currentChat.id);
                }
                errorToast.remove();
            });
        }
    }
    
    addErrorAction(errorToast, buttonText, action) {
        const actionButton = document.createElement('button');
        actionButton.className = 'ml-3 bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1 rounded text-sm font-medium transition-all';
        actionButton.textContent = buttonText;
        actionButton.onclick = action;
        
        const buttonContainer = errorToast.querySelector('.flex-1');
        buttonContainer.appendChild(actionButton);
    }

    // === UI INITIALIZATION ===
    initUI() {
        this.initMessageInput();
        this.initSendButton();
    }

    initMessageInput() {
        this.messageInput = document.getElementById('message-input');
        if (this.messageInput) {
            // Handle Enter key
            this.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSendMessage();
                }
            });
            
            // Handle typing indicator
            let typingTimer;
            this.messageInput.addEventListener('input', () => {
                if (this.currentChat && this.socket?.connected) {
                    // Send typing start
                    this.socket.emit('typing_start', {
                        chatId: this.currentChat.id,
                        username: this.currentUser?.name || 'Unknown'
                    });
                    
                    // Clear existing timer
                    clearTimeout(typingTimer);
                    
                    // Set timer to stop typing after 2 seconds of inactivity
                    typingTimer = setTimeout(() => {
                        this.socket.emit('typing_stop', {
                            chatId: this.currentChat.id,
                            username: this.currentUser?.name || 'Unknown'
                        });
                    }, 2000);
                }
            });
            
            // Handle blur (stop typing when input loses focus)
            this.messageInput.addEventListener('blur', () => {
                clearTimeout(typingTimer);
                if (this.currentChat && this.socket?.connected) {
                    this.socket.emit('typing_stop', {
                        chatId: this.currentChat.id,
                        username: this.currentUser?.name || 'Unknown'
                    });
                }
            });
        }
    }

    initSendButton() {
        this.sendButton = document.getElementById('send-button');
        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => {
                this.handleSendMessage();
            });
        }
    }

    handleSendMessage() {
        const text = this.messageInput?.value?.trim();
        if (text) {
            this.sendMessage(text);
            this.messageInput.value = '';
        }
    }
}

// === TELEGRAM-STYLE GLOBAL SETUP ===
window.TelegramMessaging = TelegramMessaging;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM Content Loaded - Initializing Telegram messaging');
    
    window.telegramMessaging = new TelegramMessaging();
    
    // Also set as realTimeMessaging for compatibility
    window.realTimeMessaging = window.telegramMessaging;
    
    // Force load conversations after a short delay
    setTimeout(() => {
        console.log('📋 Force loading conversations...');
        if (typeof window.loadRealConversations === 'function') {
            window.loadRealConversations();
        } else {
            console.error('❌ loadRealConversations function not found!');
        }
    }, 1000);
});

// Global conversation selection (Telegram-style)
window.selectConversation = function(conversationId, userName, userAvatar) {
    console.log('🎯 Telegram: Selecting conversation:', conversationId, userName);
    
    // Validate conversation ID
    if (!conversationId || conversationId === 'undefined' || conversationId === 'null') {
        console.error('❌ Invalid conversation ID:', conversationId);
        window.showTelegramError('Không thể chọn cuộc trò chuyện: ID không hợp lệ');
        return;
    }
    
    if (window.telegramMessaging) {
        // Save chat user info
        localStorage.setItem('currentChatUser', JSON.stringify({
            name: userName,
            avatar: userAvatar
        }));
        
        // Update chat header immediately
        updateChatHeader(userName, userAvatar);
        
        // Load the chat
        window.telegramMessaging.loadChat(conversationId);
        
        // Update UI active state
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-conversation-id="${conversationId}"]`)?.classList.add('active');
    }
};

// Function to update chat header
function updateChatHeader(userName, userAvatar) {
    console.log('📋 Updating chat header:', userName);
    
    // Find the chat header elements
    const chatTitle = document.querySelector('#chat-window h2, #chat-window h3, .chat-header h2, .chat-header h3');
    const chatAvatar = document.querySelector('#chat-window img, .chat-header img');
    const chatStatus = document.querySelector('#chat-window .text-green-400, .chat-header .text-green-400');
    
    console.log('🔍 Header elements found:', {
        title: !!chatTitle,
        avatar: !!chatAvatar,
        status: !!chatStatus
    });
    
    // Update title
    if (chatTitle) {
        chatTitle.textContent = userName;
        console.log('✅ Updated chat title to:', userName);
    }
    
    // Update avatar
    if (chatAvatar) {
        chatAvatar.src = userAvatar || `https://placehold.co/40x40/4F46E5/FFFFFF?text=${userName.charAt(0).toUpperCase()}`;
        chatAvatar.alt = userName;
        console.log('✅ Updated chat avatar');
    }
    
    // Update status
    if (chatStatus) {
        chatStatus.textContent = 'Hoạt động';
        console.log('✅ Updated chat status');
    }
}

// Load conversations function
window.loadRealConversations = async function() {
    try {
        console.log('📋 Loading Telegram conversations...');
        const token = localStorage.getItem('token') || '';
        
        // Show loading state
        const conversationsList = document.getElementById('conversations-list');
        if (conversationsList) {
            conversationsList.innerHTML = `
                <div class="p-4 text-center text-gray-400">
                    <div class="animate-pulse">📡 Đang tải cuộc trò chuyện...</div>
                </div>
            `;
        }
        
        const response = await fetch('/api/conversations', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('🔍 API Response status:', response.status);

        if (response.ok) {
            const data = await response.json();
            console.log('🔍 API Response full data:', data);
            console.log('🔍 API Response conversations array:', data.conversations);
            
            if (data.conversations && data.conversations.length > 0) {
                console.log('🔍 First conversation raw structure:', JSON.stringify(data.conversations[0], null, 2));
            }
            
            if (data.success && data.conversations) {
                console.log(`✅ Loaded ${data.conversations.length} Telegram conversations`);
                console.log('📋 First conversation details:', data.conversations[0]);
                window.renderConversations(data.conversations);
            } else {
                console.warn('⚠️ No conversations in response or success=false');
                showEmptyConversations();
            }
        } else {
            console.error('❌ API response not ok:', response.status, response.statusText);
            showEmptyConversations();
        }
    } catch (error) {
        console.error('❌ Load Telegram conversations failed:', error);
        showEmptyConversations();
    }
};

// Show empty state
function showEmptyConversations() {
    const conversationsList = document.getElementById('conversations-list');
    if (conversationsList) {
        conversationsList.innerHTML = `
            <div class="p-4 text-center text-gray-400">
                <div class="mb-4">
                    <svg class="w-16 h-16 mx-auto text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                    </svg>
                </div>
                <p class="text-lg font-medium">Chưa có cuộc trò chuyện</p>
                <p class="text-sm mt-2">Tìm bạn bè để bắt đầu chat!</p>
                <button onclick="window.location.href='discovery.html'" class="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                    Tìm bạn bè
                </button>
            </div>
        `;
    }
}

// Render conversations function with proper name display
window.renderConversations = function(conversations) {
    console.log('🎨 Rendering conversations:', conversations);
    
    const conversationsList = document.getElementById('conversations-list');
    if (!conversationsList) {
        console.error('❌ Conversations list element not found');
        return;
    }

    if (!conversations || conversations.length === 0) {
        conversationsList.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <p>📭 Chưa có cuộc trò chuyện nào</p>
                <p class="text-sm mt-2">Tìm bạn bè để bắt đầu chat!</p>
            </div>
        `;
        return;
    }

    // Get current user for comparison
    const currentUser = JSON.parse(localStorage.getItem('user') || localStorage.getItem('userInfo') || '{}');
    
    conversationsList.innerHTML = conversations.map(conv => {
        console.log('📋 Processing conversation:', conv);
        console.log('📋 Conversation keys:', Object.keys(conv));
        console.log('📋 Conversation participants:', conv.participants);
        
        // Get conversation ID - fix for new server structure  
        const conversationId = conv.partnerId || conv.id || conv._id || conv.conversationId || conv.otherUserId;
        
        if (!conversationId) {
            console.error('❌ No valid conversation ID found for:', conv);
            console.log('Available conversation properties:', Object.keys(conv));
            console.log('Conv.partnerId:', conv.partnerId, 'Conv.id:', conv.id, 'Conv._id:', conv._id);
            return ''; // Skip this conversation
        }
        
        console.log('✅ Found conversation ID:', conversationId);
        
        // Find the other participant - fix for new server structure
        let otherUser = null;
        
        // New structure: otherUser is directly available
        if (conv.otherUser) {
            otherUser = conv.otherUser;
            console.log('✅ Found otherUser from conv.otherUser:', otherUser);
        }
        // Fallback: check participants array (old structure)
        else if (conv.participants && Array.isArray(conv.participants) && conv.participants.length > 0) {
            otherUser = conv.participants.find(p => 
                (p.id || p._id) !== (currentUser.id || currentUser._id)
            );
            console.log('✅ Found otherUser from participants:', otherUser);
        }
        // Additional fallback
        else if (conv.user) {
            otherUser = conv.user;
            console.log('✅ Found otherUser from conv.user:', otherUser);
        }
        
        // Extract name safely
        let displayName = 'Người dùng';
        let avatar = 'https://placehold.co/48x48/4F46E5/FFFFFF?text=U';
        
        if (otherUser) {
            displayName = otherUser.name || otherUser.fullName || otherUser.username || 'Người dùng';
            if (otherUser.avatar) {
                avatar = otherUser.avatar;
            } else {
                avatar = `https://placehold.co/48x48/4F46E5/FFFFFF?text=${displayName.charAt(0).toUpperCase()}`;
            }
        }
        
        console.log('👤 Rendering conversation with:', {
            conversationId,
            displayName,
            avatar,
            otherUser,
            originalConv: conv
        });
        
        const lastMessage = conv.lastMessage || {};
        const lastMessageText = lastMessage.content || lastMessage.text || 'Chưa có tin nhắn';
        const timestamp = lastMessage.timestamp ? 
            new Date(lastMessage.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 
            '';

        return `
            <div class="conversation-item p-4 hover:bg-gray-700/30 cursor-pointer border-b border-gray-700/30 transition-colors" 
                 data-conversation-id="${conversationId}"
                 onclick="selectConversation('${conversationId}', '${displayName.replace(/'/g, "\\'")}', '${avatar}')">
                <div class="flex items-center space-x-3">
                    <img src="${avatar}" alt="${displayName}" class="w-12 h-12 rounded-full object-cover">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between">
                            <h3 class="font-semibold text-white truncate">${displayName}</h3>
                            ${timestamp ? `<span class="text-xs text-gray-400 timestamp">${timestamp}</span>` : ''}
                        </div>
                        <p class="text-sm text-gray-400 truncate last-message">${lastMessageText}</p>
                    </div>
                </div>
            </div>
        `;
    }).filter(html => html.length > 0).join(''); // Filter out empty results
    
    console.log('✅ Conversations rendered successfully');
};

console.log('🚀 Telegram-style messaging system loaded');
