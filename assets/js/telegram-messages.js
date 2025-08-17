// === PRODUCTION TELEGRAM-INSPIRED MESSAGING SYSTEM ===

// Security Utils Import - Critical for XSS Protection
if (typeof SecurityUtils === 'undefined') {
    console.error('❌ SecurityUtils not loaded! XSS protection disabled.');
    throw new Error('SecurityUtils required for secure messaging');
}

class TelegramMessaging {
    constructor() {
        // Core Telegram-like properties
        this.socket = null;
        this.currentUser = this.loadUserProfile();
        this.currentChat = null;
        this.messages = new Map();
        this.chats = new Map();
        this.messageQueue = [];
        this.typingUsers = new Set();
        this.isOnline = false;
        this.isAuthenticated = false;
        
        // Error tracking
        this.errorHandler = new TelegramErrorHandler();
        
        // Initialize subsystems
        this.initSocket();
        this.initUI();
        this.initMessageHandlers();
        this.requestNotificationPermission();
        this.restoreSession();
    }

    // === USER PROFILE MANAGEMENT ===
    loadUserProfile() {
        try {
            const sources = [
                () => SecurityUtils.safeJSONParse(localStorage.getItem('user') || '{}'),
                () => SecurityUtils.safeJSONParse(localStorage.getItem('userInfo') || '{}'),
                () => window.loadUserInfo?.() || {}
            ];
            
            for (const source of sources) {
                const user = source();
                if (user && user.id && user.name) {
                    return user;
                }
            }
            
            // Try to extract from userName/userEmail in localStorage
            const userName = localStorage.getItem('userName');
            const userEmail = localStorage.getItem('userEmail');
            if (userName && userEmail) {
                const token = localStorage.getItem('token') || localStorage.getItem('authToken');
                if (token) {
                    try {
                        const payload = SecurityUtils.safeJSONParse(atob(token.split('.')[1]));
                        if (payload && payload.userId) {
                            return {
                                id: payload.userId,
                                name: userName,
                                email: userEmail,
                                username: userEmail.replace('@', '').replace('.', '_')
                            };
                        }
                    } catch (e) {
                        this.errorHandler.logError('Token parsing failed', e);
                    }
                }
            }
            
            throw new Error('No valid user profile found');
        } catch (error) {
            this.errorHandler.logError('User profile load failed', error);
            return null;
        }
    }

    // === SOCKET CONNECTION ===
    initSocket() {
        try {
            if (typeof io === 'undefined') {
                if (window.socketIOLoaded) {
                    this.initSocket();
                    return;
                }
                
                window.addEventListener('socketio-ready', () => {
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
                this.isOnline = true;
                this.updateConnectionStatus();
                this.authenticateUser();
                this.joinUserRoom();
            });

            this.socket.on('disconnect', () => {
                this.isOnline = false;
                this.updateConnectionStatus();
            });

            this.socket.on('reconnect', () => {
                this.isOnline = true;
                this.updateConnectionStatus();
                this.restoreSession();
            });

        } catch (error) {
            this.errorHandler.logError('Socket initialization failed', error);
        }
    }

    authenticateUser() {
        if (this.currentUser && this.socket?.connected) {
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            if (token) {
                this.socket.emit('authenticate', { token: token });
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

        this.socket.on('authenticated', (data) => this.handleAuthenticated(data));
        this.socket.on('authentication_failed', (data) => this.handleAuthenticationFailed(data));
        this.socket.on('new_message', (message, ack) => {
            this.handleIncomingMessage(message);
            if (ack) ack({ received: true, timestamp: Date.now() });
        });
        this.socket.on('message', (message) => this.handleIncomingMessage(message));
        this.socket.on('broadcast_message', (message) => this.handleIncomingMessage(message));
        this.socket.on('message_sent', (data) => this.handleMessageSent(data));
        this.socket.on('message_delivered', (data) => this.handleMessageDelivered(data));
        this.socket.on('typing_start', (data) => this.handleTypingStart(data));
        this.socket.on('typing_stop', (data) => this.handleTypingStop(data));
        this.socket.on('room_joined', (data) => this.handleRoomJoined(data));
        this.socket.on('join_room_error', (data) => this.handleJoinRoomError(data));
    }

    handleAuthenticated(data) {
        this.isAuthenticated = true;
        this.currentUser = data.user;
        
        if (this.currentChat) {
            this.socket.emit('join_room', { roomId: this.currentChat.id });
        }
    }

    handleAuthenticationFailed(data) {
        this.isAuthenticated = false;
        this.errorHandler.showUserError('Xác thực thất bại. Vui lòng đăng nhập lại.');
    }

    handleIncomingMessage(message) {
        if (!message || !message.id) {
            return;
        }

        const telegramMessage = {
            id: message.id,
            text: message.text || message.content || '',
            senderId: message.senderId,
            senderName: message.senderName || 'Unknown',
            chatId: message.chatId || message.conversationId || message.senderId,
            timestamp: new Date(message.timestamp),
            type: message.type || 'text',
            status: 'received'
        };

        this.messages.set(message.id, telegramMessage);
        this.updateConversationsList(telegramMessage);
        
        const belongsToCurrentChat = this.currentChat && (
            telegramMessage.chatId === this.currentChat.id ||
            telegramMessage.senderId === this.currentChat.id ||
            (telegramMessage.senderId === this.currentUser?.id && this.currentChat.id)
        );
        
        if (belongsToCurrentChat) {
            this.renderMessage(telegramMessage);
            this.scrollToBottom();
        } else {
            this.showNotificationBadge(telegramMessage.chatId);
        }
    }

    handleMessageSent(data) {
        this.updateMessageStatus(data.messageId, 'sent');
    }

    handleMessageDelivered(data) {
        this.updateMessageStatus(data.messageId, 'delivered');
    }

    handleRoomJoined(data) {
        // Successfully joined room
    }

    handleJoinRoomError(data) {
        this.errorHandler.logError('Failed to join room', data);
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
        if (!chatId || chatId === 'undefined' || chatId === 'null') {
            this.errorHandler.showUserError('Không thể tải cuộc trò chuyện: ID không hợp lệ');
            return;
        }
        
        try {
            this.currentChat = { id: chatId };
            localStorage.setItem('currentChatId', chatId);
            
            this.clearNotificationBadge(chatId);
            this.showChatWindow();
            
            const savedChatUser = localStorage.getItem('currentChatUser');
            if (savedChatUser) {
                try {
                    // 🛡️ SECURITY: Using SecurityUtils.safeJSONParse instead of JSON.parse
                    const chatUser = SecurityUtils.safeJSONParse(savedChatUser);
                    updateChatHeader(chatUser.name, chatUser.avatar);
                } catch (e) {
                    // Silent fail for non-critical operation
                }
            }
            
            if (this.socket?.connected) {
                this.socket.emit('join_room', { roomId: chatId });
            }
            
            const messages = await this.fetchMessagesFromAPI(chatId);
            this.clearMessageContainer();
            
            messages.forEach(msg => {
                this.messages.set(msg.id, msg);
                this.renderMessage(msg);
            });
            
            this.scrollToBottom();
            this.updateUI();
            
        } catch (error) {
            this.errorHandler.showUserError('Không thể tải cuộc trò chuyện');
            this.errorHandler.logError('Chat load failed', error);
        }
    }

    showChatWindow() {
        const chatWindow = document.getElementById('chat-window');
        const placeholder = document.getElementById('empty-chat-placeholder');
        
        if (chatWindow) {
            chatWindow.classList.remove('hidden');
            chatWindow.style.display = 'flex';
        }
        
        if (placeholder) {
            placeholder.classList.add('hidden');
            placeholder.style.display = 'none';
        }
    }

    async fetchMessagesFromAPI(chatId) {
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

        return data.messages.map(msg => {
            const currentUserId = this.currentUser?.id;
            const isOwnMessage = currentUserId && msg.senderId === currentUserId;
            
            return {
                id: msg.id || msg._id,
                text: msg.text || msg.content || '',
                senderId: msg.senderId,
                senderName: msg.senderName || 'Unknown',
                chatId: chatId,
                timestamp: new Date(msg.timestamp),
                type: msg.type || 'text',
                status: isOwnMessage ? 'sent' : 'received'
            };
        });
    }

    // === MESSAGE SENDING ===
    async sendMessage(text) {
        if (!text?.trim() || !this.currentChat) {
            return;
        }

        if (!this.currentUser || !this.currentUser.id) {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    // 🛡️ SECURITY: Using SecurityUtils.safeJWTParse instead of JSON.parse
                    const tokenData = SecurityUtils.safeJWTParse(token);
                    if (tokenData) {
                        this.currentUser = {
                            id: tokenData.userId,
                            name: tokenData.name || tokenData.username || tokenData.fullName || 'Unknown User',
                            email: tokenData.email
                        };
                    }
                } catch (e) {
                    this.errorHandler.logError('Failed to parse token for user info', e);
                }
            }
        }

        if (!this.currentUser || !this.currentUser.id) {
            this.errorHandler.showUserError('Không thể gửi tin nhắn: Thông tin người dùng không có');
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

        this.messages.set(message.id, message);
        this.renderMessage(message);
        this.scrollToBottom();

        try {
            if (this.socket?.connected && this.isAuthenticated) {
                this.socket.emit('send_message', {
                    messageId: message.id,
                    text: message.text,
                    chatId: this.currentChat.id,
                    senderId: this.currentUser.id,
                    senderName: this.currentUser.name,
                    timestamp: message.timestamp.toISOString()
                });
            } else {
                await this.sendMessageViaAPI(message);
            }

            message.status = 'sent';
            this.updateMessageStatus(message.id, 'sent');

        } catch (error) {
            this.errorHandler.logError('Send failed', error);
            message.status = 'failed';
            this.updateMessageStatus(message.id, 'failed');
            this.errorHandler.showUserError('Không thể gửi tin nhắn. Vui lòng thử lại.');
        }
    }

    async sendMessageViaAPI(message) {
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
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Send failed');
        }
        
        return result;
    }

    // === UI RENDERING ===
    renderMessage(message) {
        const container = document.querySelector('#messages-container');
        if (!container) {
            return;
        }

        const currentUserId = this.currentUser?.id;
        const currentUserName = this.currentUser?.name || localStorage.getItem('userName');
        
        let isOwn = false;
        
        if (currentUserId && message.senderId) {
            isOwn = message.senderId === currentUserId;
        } else if (currentUserName && message.senderName) {
            isOwn = message.senderName === currentUserName;
        } else {
            isOwn = message.status === 'sending' || 
                   (message.id && message.id.startsWith('msg'));
        }
        
        const timeStr = message.timestamp.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const messageEl = document.createElement('div');
        messageEl.className = `message-item ${isOwn ? 'own' : 'other'}`;
        messageEl.setAttribute('data-message-id', message.id);

        const isLongMessage = message.text.length > 50;
        const isHashLike = /^[a-f0-9]{32,}/.test(message.text) || message.text.includes(':');
        const maxWidthClass = isLongMessage ? 'max-w-md lg:max-w-lg' : 'max-w-xs lg:max-w-md';
        
        const messageTextClass = isHashLike ? 
            'message-text break-words font-mono text-xs leading-tight' : 
            'message-text break-words';

        // 🛡️ XSS PROTECTION: Using SecurityUtils.safeSetInnerHTML instead of innerHTML
        const safeHTML = `
            <div class="${maxWidthClass} px-4 py-2 rounded-lg ${
                isOwn 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-100'
            } ${isLongMessage ? 'message-long' : ''}">
                ${!isOwn ? `<div class="text-xs text-gray-400 mb-1">${SecurityUtils.sanitizeHTML(message.senderName)}</div>` : ''}
                <div class="${messageTextClass}">${SecurityUtils.sanitizeHTML(message.text)}</div>
                <div class="text-xs ${isOwn ? 'text-blue-200' : 'text-gray-500'} mt-1 flex items-center ${isOwn ? 'justify-end' : 'justify-start'}">
                    <span>${SecurityUtils.sanitizeHTML(timeStr)}</span>
                    ${isOwn ? `<span class="ml-1">${this.getStatusIcon(message.status)}</span>` : ''}
                </div>
            </div>
        `;
        SecurityUtils.safeSetInnerHTML(messageEl, safeHTML);

        container.appendChild(messageEl);
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
                // 🛡️ XSS PROTECTION: Using SecurityUtils.safeSetInnerHTML
                SecurityUtils.safeSetInnerHTML(statusEl, this.getStatusIcon(status));
            }
        }
    }

    clearMessageContainer() {
        const container = document.querySelector('#messages-container');
        if (container) {
            // 🛡️ XSS PROTECTION: Safe clearing
            SecurityUtils.safeClearElement(container);
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
                // 🛡️ XSS PROTECTION: Using SecurityUtils.safeSetInnerHTML
                const safeHTML = `
                    <div class="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span>Đã kết nối</span>
                `;
                SecurityUtils.safeSetInnerHTML(statusIndicator, safeHTML);
            } else {
                statusIndicator.className = 'flex items-center space-x-2 text-red-400 text-sm';
                // 🛡️ XSS PROTECTION: Using SecurityUtils.safeSetInnerHTML
                const safeHTML = `
                    <div class="w-2 h-2 bg-red-400 rounded-full"></div>
                    <span>Mất kết nối</span>
                `;
                SecurityUtils.safeSetInnerHTML(statusIndicator, safeHTML);
            }
        }
    }

    updateUI() {
        const chatWindow = document.getElementById('chat-window');
        const emptyPlaceholder = document.getElementById('empty-chat-placeholder');
        
        if (this.currentChat) {
            if (chatWindow) {
                chatWindow.classList.remove('hidden');
                chatWindow.style.setProperty('display', 'flex');
            }
            if (emptyPlaceholder) {
                emptyPlaceholder.classList.add('hidden');
                emptyPlaceholder.style.setProperty('display', 'none');
            }
        } else {
            if (chatWindow) {
                chatWindow.classList.add('hidden');
                chatWindow.style.setProperty('display', 'none');
            }
            if (emptyPlaceholder) {
                emptyPlaceholder.classList.remove('hidden');
                emptyPlaceholder.style.setProperty('display', 'flex');
            }
        }
    }

    updateTypingIndicator() {
        const typingContainer = document.getElementById('typing-indicator');
        
        if (this.typingUsers.size === 0) {
            if (typingContainer) {
                typingContainer.classList.add('hidden');
                // 🛡️ XSS PROTECTION: Safe clearing
                SecurityUtils.safeClearElement(typingContainer);
            }
            return;
        }
        
        if (typingContainer) {
            typingContainer.classList.remove('hidden');
            
            const typingArray = Array.from(this.typingUsers);
            let typingText = '';
            
            if (typingArray.length === 1) {
                typingText = `${SecurityUtils.sanitizeHTML(typingArray[0])} đang nhập...`;
            } else if (typingArray.length === 2) {
                typingText = `${SecurityUtils.sanitizeHTML(typingArray[0])} và ${SecurityUtils.sanitizeHTML(typingArray[1])} đang nhập...`;
            } else {
                typingText = `${SecurityUtils.sanitizeHTML(typingArray[0])} và ${typingArray.length - 1} người khác đang nhập...`;
            }
            
            // 🛡️ XSS PROTECTION: Using SecurityUtils.safeSetInnerHTML
            const safeHTML = `
                <div class="flex items-center space-x-2 px-4 py-2 text-sm text-gray-400">
                    <div class="flex space-x-1">
                        <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 0.2s"></div>
                        <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 0.4s"></div>
                    </div>
                    <span>${typingText}</span>
                </div>
            `;
            SecurityUtils.safeSetInnerHTML(typingContainer, safeHTML);
        }
    }

    // === SESSION MANAGEMENT ===
    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    restoreSession() {
        const savedChatId = localStorage.getItem('currentChatId');
        if (savedChatId) {
            setTimeout(() => {
                this.loadChat(savedChatId);
            }, 1000);
        }
    }

    // === UTILITIES ===
    generateMessageId() {
        return 'msg_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateConversationsList(message) {
        const conversationsList = document.getElementById('conversations-list');
        if (!conversationsList) {
            return;
        }

        const conversationItem = conversationsList.querySelector(`[data-user-id="${message.chatId}"]`);
        
        if (conversationItem) {
            const lastMessageEl = conversationItem.querySelector('.text-sm.text-gray-400');
            if (lastMessageEl) {
                lastMessageEl.textContent = message.text.length > 30 ? 
                    message.text.substring(0, 30) + '...' : message.text;
            }
            
            const timeEl = conversationItem.querySelector('.text-xs.text-gray-500');
            if (timeEl) {
                timeEl.textContent = this.formatTime(message.timestamp);
            }
            
            conversationsList.insertBefore(conversationItem, conversationsList.firstChild);
        } else {
            if (window.loadRealConversations) {
                window.loadRealConversations();
            }
        }
    }

    showNotificationBadge(chatId) {
        const conversationItem = document.querySelector(`[data-user-id="${chatId}"]`);
        if (conversationItem) {
            let badge = conversationItem.querySelector('.unread-badge');
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'unread-badge bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ml-auto';
                badge.textContent = '1';
                
                const contentDiv = conversationItem.querySelector('.flex.items-center.gap-4');
                if (contentDiv) {
                    contentDiv.appendChild(badge);
                }
            } else {
                const count = parseInt(badge.textContent) || 0;
                badge.textContent = count + 1;
            }
        }
    }

    formatTime(timestamp) {
        const now = new Date();
        const messageTime = new Date(timestamp);
        const diff = now - messageTime;
        
        if (diff < 60000) {
            return 'now';
        } else if (diff < 3600000) {
            return Math.floor(diff / 60000) + 'm';
        } else if (diff < 86400000) {
            return Math.floor(diff / 3600000) + 'h';
        } else {
            return messageTime.toLocaleDateString();
        }
    }

    clearNotificationBadge(chatId) {
        const conversationItem = document.querySelector(`[data-user-id="${chatId}"]`);
        if (conversationItem) {
            const badge = conversationItem.querySelector('.unread-badge');
            if (badge) {
                badge.remove();
            }
        }
    }

    showNotification(message) {
        if (!('Notification' in window)) {
            return;
        }
        
        if (Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    this.displayNotification(message);
                }
            });
        } else if (Notification.permission === 'granted') {
            this.displayNotification(message);
        }
        
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
            
            setTimeout(() => {
                notification.close();
            }, 5000);
            
        } catch (error) {
            this.errorHandler.logError('Failed to show push notification', error);
        }
    }
    
    showInPageNotification(message) {
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg z-50 max-w-sm';
        
        // 🛡️ XSS PROTECTION: Using SecurityUtils.safeSetInnerHTML
        const safeHTML = `
            <div class="flex items-start space-x-3">
                <div class="flex-shrink-0">
                    <div class="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                        ${SecurityUtils.sanitizeHTML(message.senderName.charAt(0).toUpperCase())}
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="font-medium text-sm">${SecurityUtils.sanitizeHTML(message.senderName)}</p>
                    <p class="text-sm text-gray-300 truncate">${SecurityUtils.sanitizeHTML(message.text)}</p>
                </div>
                <button class="text-gray-400 hover:text-white" onclick="this.parentElement.parentElement.remove()">
                    ✕
                </button>
            </div>
        `;
        SecurityUtils.safeSetInnerHTML(toast, safeHTML);
        
        toast.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') {
                this.loadChat(message.chatId);
                toast.remove();
            }
        });
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 4000);
    }

    // === UI INITIALIZATION ===
    initUI() {
        this.initMessageInput();
        this.initSendButton();
    }

    initMessageInput() {
        this.messageInput = document.getElementById('message-input');
        if (this.messageInput) {
            this.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSendMessage();
                }
            });
            
            let typingTimer;
            this.messageInput.addEventListener('input', () => {
                if (this.currentChat && this.socket?.connected) {
                    this.socket.emit('typing_start', {
                        chatId: this.currentChat.id,
                        username: this.currentUser?.name || 'Unknown'
                    });
                    
                    clearTimeout(typingTimer);
                    
                    typingTimer = setTimeout(() => {
                        this.socket.emit('typing_stop', {
                            chatId: this.currentChat.id,
                            username: this.currentUser?.name || 'Unknown'
                        });
                    }, 2000);
                }
            });
            
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

// === ERROR HANDLING SYSTEM ===
class TelegramErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 100;
    }

    logError(message, error) {
        const errorEntry = {
            timestamp: new Date(),
            message: message,
            error: error?.message || error,
            stack: error?.stack
        };
        
        this.errors.push(errorEntry);
        
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        // In production, send to logging service
        if (window.productionLogger) {
            window.productionLogger.error(message, { error: errorEntry });
        }
    }

    showUserError(message) {
        const errorToast = document.createElement('div');
        errorToast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-4 rounded-lg shadow-lg z-50 max-w-md';
        
        // 🛡️ XSS PROTECTION: Using SecurityUtils.safeSetInnerHTML
        const safeHTML = `
            <div class="flex items-center space-x-3">
                <div class="flex-shrink-0">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <div class="flex-1">
                    <p class="font-medium text-sm">Lỗi</p>
                    <p class="text-sm text-red-100">${SecurityUtils.sanitizeHTML(message)}</p>
                </div>
                <button class="text-red-200 hover:text-white ml-2" onclick="this.parentElement.parentElement.remove()">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;
        SecurityUtils.safeSetInnerHTML(errorToast, safeHTML);
        
        document.body.appendChild(errorToast);
        
        setTimeout(() => {
            if (errorToast.parentElement) {
                errorToast.remove();
            }
        }, 5000);
        
        errorToast.style.transform = 'translate(-50%, -20px)';
        errorToast.style.opacity = '0';
        requestAnimationFrame(() => {
            errorToast.style.transition = 'all 0.3s ease-out';
            errorToast.style.transform = 'translate(-50%, 0)';
            errorToast.style.opacity = '1';
        });
    }
}

// === CALLING SYSTEM ===
class TelegramCallSystem {
    constructor() {
        this.currentCall = null;
        this.socket = null;
        this.ringtone = null;
        this.initializeCallButtons();
        this.initializeCallNotifications();
        this.initializeRingtone();
    }

    initializeRingtone() {
        this.ringtone = new Audio();
        this.ringtone.loop = true;
        this.ringtone.volume = 0.7;
        this.ringtone.src = 'data:audio/wav;base64,UklGRsABAABXQVZFZm10IAAAAAABAAABBACJAQABBQAAAAVAEAAAE=';
    }

    initializeCallNotifications() {
        document.addEventListener('DOMContentLoaded', () => {
            const messaging = window.telegramMessaging;
            if (messaging && messaging.socket) {
                messaging.socket.on('incoming_call', (data) => {
                    const currentUserId = messaging.currentUser?.id;
                    if (currentUserId && data.callerId !== currentUserId) {
                        this.showIncomingCallNotification(data);
                    }
                });
                
                messaging.socket.on('call_initiated', (data) => {
                    this.showCallNotification('Đang gọi...', 'info');
                });
                
                messaging.socket.on('call_accepted', (data) => {
                    this.handleCallAccepted(data);
                });
                
                messaging.socket.on('call_rejected', (data) => {
                    this.handleCallRejected(data);
                });
                
                messaging.socket.on('call_ended', (data) => {
                    this.handleCallEnded(data);
                });
            }
        });
    }

    initializeCallButtons() {
        document.addEventListener('DOMContentLoaded', () => {
            const voiceCallBtn = document.getElementById('voice-call-btn');
            const videoCallBtn = document.getElementById('video-call-btn');

            if (voiceCallBtn) {
                voiceCallBtn.addEventListener('click', () => this.initiateCall('voice'));
            }
            if (videoCallBtn) {
                videoCallBtn.addEventListener('click', () => this.initiateCall('video'));
            }
        });
    }

    async initiateCall(type) {
        const currentChat = window.telegramMessaging?.currentChat;
        if (!currentChat || !currentChat.id) {
            this.showError('Vui lòng chọn cuộc trò chuyện để bắt đầu cuộc gọi');
            return;
        }

        const chatUserName = document.getElementById('chat-user-name')?.textContent || 'Unknown User';
        const chatUserAvatar = document.getElementById('chat-user-avatar')?.src || '';
        const currentUser = window.telegramMessaging.currentUser;

        if (!currentUser) {
            this.showError('Không thể xác định người dùng hiện tại');
            return;
        }

        if (currentUser.id === currentChat.id) {
            this.showError('Không thể gọi cho chính mình');
            return;
        }

        if (!window.telegramMessaging?.socket?.connected) {
            this.showError('Mất kết nối mạng. Vui lòng kiểm tra kết nối internet.');
            return;
        }

        const callId = crypto.randomUUID();
        
        const callSession = {
            callId: callId,
            type: type,
            state: 'requesting',
            direction: 'outgoing',
            
            caller: {
                id: currentUser.id,
                name: currentUser.name,
                avatar: currentUser.avatar
            },
            callee: {
                id: currentChat.id,
                name: chatUserName,
                avatar: chatUserAvatar
            },
            
            timestamp: Date.now(),
            requestTime: new Date().toISOString(),
            
            connectionState: 'connecting',
            localStream: null,
            remoteStream: null
        };

        localStorage.setItem('currentCall', JSON.stringify(callSession));
        localStorage.setItem('activeCallId', callId);

        if (window.webrtcClient) {
            window.webrtcClient.currentCallId = callId;
            window.webrtcClient.callSession = callSession;
        }

        if (window.updateCallState) {
            window.updateCallState('requesting');
        }

        try {
            const callRequest = {
                callId: callId,
                targetUserId: currentChat.id,
                callType: type,
                callerData: {
                    id: currentUser.id,
                    name: currentUser.name,
                    avatar: currentUser.avatar
                },
                timestamp: Date.now()
            };

            window.telegramMessaging.socket.emit('initiate_call', callRequest);

            callSession.state = 'ringing';
            callSession.connectionState = 'signaling';
            localStorage.setItem('currentCall', JSON.stringify(callSession));

            if (window.updateCallState) {
                window.updateCallState('ringing');
            }

        } catch (error) {
            this.showError('Không thể khởi tạo cuộc gọi. Vui lòng thử lại.');
            return;
        }

        this.openCallWindow(callSession);
        this.setupCallTimeout(callId, 30000);
    }

    openCallWindow(callSession) {
        const callWindow = window.open(
            'calls.html',
            `telegram_call_${callSession?.callId || 'unknown'}`,
            'width=800,height=600,resizable=yes,scrollbars=no,status=no,menubar=no,toolbar=no,location=no'
        );

        if (!callWindow) {
            this.showError('Không thể mở cửa sổ cuộc gọi. Vui lòng cho phép popup trong trình duyệt.');
            if (callSession?.callId) {
                this.endCall(callSession.callId);
            }
            return;
        }

        this.currentCall = {
            window: callWindow,
            session: callSession
        };

        callWindow.focus();
    }

    setupCallTimeout(callId, timeoutMs = 30000) {
        this.callTimeout = setTimeout(() => {
            const activeCallId = localStorage.getItem('activeCallId');
            if (activeCallId === callId) {
                this.endCall(callId, 'timeout');
            }
        }, timeoutMs);
    }

    endCall(callId, reason = 'user') {
        if (this.callTimeout) {
            clearTimeout(this.callTimeout);
            this.callTimeout = null;
        }
        
        localStorage.removeItem('currentCall');
        localStorage.removeItem('activeCallId');
        
        if (this.currentCall?.window) {
            this.currentCall.window.close();
            this.currentCall = null;
        }
        
        if (window.telegramMessaging?.socket?.connected) {
            window.telegramMessaging.socket.emit('end_call', {
                callId: callId,
                reason: reason
            });
        }
        
        if (window.webrtcClient) {
            window.webrtcClient.cleanup();
        }
    }

    showIncomingCallNotification(callData) {
        const { callId, callerId, callerUsername, callType } = callData;
        
        const existingOverlay = document.getElementById('incoming-call-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        if (this.ringtone) {
            this.ringtone.play().catch(e => {
                // Silent fail for audio
            });
        }
        
        const overlay = document.createElement('div');
        overlay.id = 'incoming-call-overlay';
        overlay.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]';
        
        // 🛡️ XSS PROTECTION: Using SecurityUtils.safeSetInnerHTML
        const safeHTML = `
            <div class="glass-pane p-8 rounded-3xl max-w-md w-full mx-4 text-center animate-pulse">
                <div class="mb-6">
                    <div class="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            ${callType === 'video' ? 
                                '<polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>' : 
                                '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>'
                            }
                        </svg>
                    </div>
                    <h3 class="text-2xl font-bold text-white mb-2">${callType === 'video' ? 'Video Call' : 'Voice Call'}</h3>
                    <p class="text-lg text-gray-300">${SecurityUtils.sanitizeHTML(callerUsername)}</p>
                    <p class="text-sm text-gray-400 mt-2">Cuộc gọi đến...</p>
                </div>
                
                <div class="flex gap-4 justify-center">
                    <button onclick="telegramCallSystem.rejectCall('${SecurityUtils.sanitizeHTML(callId)}')" class="p-4 bg-red-500 hover:bg-red-600 rounded-full transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                    </button>
                    <button onclick="telegramCallSystem.acceptCall('${SecurityUtils.sanitizeHTML(callId)}', '${SecurityUtils.sanitizeHTML(callType)}', '${SecurityUtils.sanitizeHTML(callerUsername)}')" class="p-4 bg-green-500 hover:bg-green-600 rounded-full transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                    </button>
                </div>
                
                <div class="mt-6">
                    <div class="flex justify-center items-center gap-2 text-gray-400">
                        <div class="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                        <div class="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                        <div class="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                    </div>
                </div>
            </div>
        `;
        SecurityUtils.safeSetInnerHTML(overlay, safeHTML);
        
        document.body.appendChild(overlay);
        
        setTimeout(() => {
            if (document.getElementById('incoming-call-overlay')) {
                this.rejectCall(callId);
            }
        }, 30000);
    }

    acceptCall(callId, callType, callerUsername) {
        if (this.ringtone) {
            this.ringtone.pause();
            this.ringtone.currentTime = 0;
        }
        
        const overlay = document.getElementById('incoming-call-overlay');
        if (overlay) {
            overlay.remove();
        }
        
        if (window.telegramMessaging?.socket) {
            window.telegramMessaging.socket.emit('answer_call', {
                callId: callId,
                answer: 'accept'
            });
        }
        
        if (window.webrtcClient) {
            window.webrtcClient.currentCallId = callId;
        }
        
        const callInfo = {
            callId: callId,
            type: callType,
            contact: callerUsername,
            contactId: callId,
            state: 'incoming',
            timestamp: Date.now()
        };
        
        localStorage.setItem('currentCall', JSON.stringify(callInfo));
        window.location.href = 'calls.html';
    }

    rejectCall(callId) {
        if (this.ringtone) {
            this.ringtone.pause();
            this.ringtone.currentTime = 0;
        }
        
        const overlay = document.getElementById('incoming-call-overlay');
        if (overlay) {
            overlay.remove();
        }
        
        if (window.telegramMessaging?.socket) {
            window.telegramMessaging.socket.emit('answer_call', {
                callId: callId,
                answer: 'reject'
            });
        }
    }

    handleCallAccepted(data) {
        if (this.callTimeout) {
            clearTimeout(this.callTimeout);
            this.callTimeout = null;
        }
        
        const currentCall = localStorage.getItem('currentCall');
        if (currentCall) {
            try {
                // 🛡️ SECURITY: Using SecurityUtils.safeJSONParse instead of JSON.parse
                const callSession = SecurityUtils.safeJSONParse(currentCall);
                if (callSession) {
                    callSession.state = 'active';
                    callSession.connectionState = 'connected';
                    callSession.acceptedTime = new Date().toISOString();
                    
                    localStorage.setItem('currentCall', JSON.stringify(callSession));
                }
                
                if (window.updateCallState) {
                    window.updateCallState('active');
                }
                
            } catch (error) {
                // Silent fail
            }
        }
        
        this.showCallNotification('Cuộc gọi đã được chấp nhận', 'success');
    }

    handleCallRejected(data) {
        this.showCallNotification('Cuộc gọi bị từ chối', 'error');
    }

    handleCallEnded(data) {
        this.showCallNotification('Cuộc gọi đã kết thúc', 'info');
    }

    showCallNotification(message, type = 'info') {
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            info: 'bg-blue-500'
        };
        
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce`;
        
        // 🛡️ XSS PROTECTION: Using SecurityUtils.safeSetInnerHTML
        const safeHTML = `
            <div class="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                <span>${SecurityUtils.sanitizeHTML(message)}</span>
            </div>
        `;
        SecurityUtils.safeSetInnerHTML(notification, safeHTML);
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showError(message) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// === GLOBAL SETUP ===
window.TelegramMessaging = TelegramMessaging;

document.addEventListener('DOMContentLoaded', () => {
    window.telegramMessaging = new TelegramMessaging();
    window.realTimeMessaging = window.telegramMessaging;
    
    setTimeout(() => {
        if (typeof window.loadRealConversations === 'function') {
            window.loadRealConversations();
        }
    }, 1000);
});

// Global conversation selection
window.selectConversation = function(conversationId, userName, userAvatar) {
    if (!conversationId || conversationId === 'undefined' || conversationId === 'null') {
        return;
    }
    
    if (window.telegramMessaging) {
        localStorage.setItem('currentChatUser', JSON.stringify({
            name: userName,
            avatar: userAvatar
        }));
        
        updateChatHeader(userName, userAvatar);
        window.telegramMessaging.loadChat(conversationId);
        
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-conversation-id="${conversationId}"]`)?.classList.add('active');
    }
};

function updateChatHeader(userName, userAvatar) {
    const chatTitle = document.querySelector('#chat-window h2, #chat-window h3, .chat-header h2, .chat-header h3');
    const chatAvatar = document.querySelector('#chat-window img, .chat-header img');
    const chatStatus = document.querySelector('#chat-window .text-green-400, .chat-header .text-green-400');
    
    if (chatTitle) {
        chatTitle.textContent = userName;
    }
    
    if (chatAvatar) {
        chatAvatar.src = userAvatar || `https://placehold.co/40x40/4F46E5/FFFFFF?text=${userName.charAt(0).toUpperCase()}`;
        chatAvatar.alt = userName;
    }
    
    if (chatStatus) {
        chatStatus.textContent = 'Hoạt động';
    }
}

// Load conversations function
window.loadRealConversations = async function() {
    try {
        const token = localStorage.getItem('token') || '';
        
        const conversationsList = document.getElementById('conversations-list');
        if (conversationsList) {
            // 🛡️ XSS PROTECTION: Using SecurityUtils.safeSetInnerHTML
            const loadingHTML = `
                <div class="p-4 text-center text-gray-400">
                    <div class="animate-pulse">📡 Đang tải cuộc trò chuyện...</div>
                </div>
            `;
            SecurityUtils.safeSetInnerHTML(conversationsList, loadingHTML);
        }
        
        const response = await fetch('/api/conversations', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.conversations) {
                window.renderConversations(data.conversations);
            } else {
                showEmptyConversations();
            }
        } else {
            showEmptyConversations();
        }
    } catch (error) {
        showEmptyConversations();
    }
};

function showEmptyConversations() {
    const conversationsList = document.getElementById('conversations-list');
    if (conversationsList) {
        // 🛡️ XSS PROTECTION: Using SecurityUtils.safeSetInnerHTML
        const emptyHTML = `
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
        SecurityUtils.safeSetInnerHTML(conversationsList, emptyHTML);
    }
}

window.renderConversations = function(conversations) {
    const conversationsList = document.getElementById('conversations-list');
    if (!conversationsList) {
        return;
    }

    if (!conversations || conversations.length === 0) {
        // 🛡️ XSS PROTECTION: Using SecurityUtils.safeSetInnerHTML
        const noConversationsHTML = `
            <div class="text-center py-8 text-gray-400">
                <p>📭 Chưa có cuộc trò chuyện nào</p>
                <p class="text-sm mt-2">Tìm bạn bè để bắt đầu chat!</p>
            </div>
        `;
        SecurityUtils.safeSetInnerHTML(conversationsList, noConversationsHTML);
        return;
    }

    const currentUser = SecurityUtils.safeJSONParse(localStorage.getItem('user') || localStorage.getItem('userInfo') || '{}');
    
    // 🛡️ XSS PROTECTION: Using SecurityUtils.safeSetInnerHTML with sanitized data
    const conversationsHTML = conversations.map(conv => {
        const conversationId = conv.partnerId || conv.id || conv._id || conv.conversationId || conv.otherUserId;
        
        if (!conversationId) {
            return '';
        }
        
        let otherUser = null;
        
        if (conv.otherUser) {
            otherUser = conv.otherUser;
        } else if (conv.participants && Array.isArray(conv.participants) && conv.participants.length > 0) {
            otherUser = conv.participants.find(p => 
                (p.id || p._id) !== (currentUser.id || currentUser._id)
            );
        } else if (conv.user) {
            otherUser = conv.user;
        }
        
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
        
        const lastMessage = conv.lastMessage || {};
        const lastMessageText = lastMessage.content || lastMessage.text || 'Chưa có tin nhắn';
        const timestamp = lastMessage.timestamp ? 
            new Date(lastMessage.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 
            '';

        // Sanitize all user-provided data
        const safeConversationId = SecurityUtils.sanitizeHTML(conversationId);
        const safeDisplayName = SecurityUtils.sanitizeHTML(displayName);
        const safeAvatar = SecurityUtils.sanitizeHTML(avatar);
        const safeLastMessageText = SecurityUtils.sanitizeHTML(lastMessageText);
        const safeTimestamp = SecurityUtils.sanitizeHTML(timestamp);

        return `
            <div class="conversation-item p-4 hover:bg-gray-700/30 cursor-pointer border-b border-gray-700/30 transition-colors" 
                 data-conversation-id="${safeConversationId}"
                 onclick="selectConversation('${safeConversationId}', '${safeDisplayName.replace(/'/g, "\\'")}', '${safeAvatar}')">
                <div class="flex items-center space-x-3">
                    <img src="${safeAvatar}" alt="${safeDisplayName}" class="w-12 h-12 rounded-full object-cover">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between">
                            <h3 class="font-semibold text-white truncate">${safeDisplayName}</h3>
                            ${safeTimestamp ? `<span class="text-xs text-gray-400 timestamp">${safeTimestamp}</span>` : ''}
                        </div>
                        <p class="text-sm text-gray-400 truncate last-message">${safeLastMessageText}</p>
                    </div>
                </div>
            </div>
        `;
    }).filter(html => html.length > 0).join('');
    
    // 🛡️ XSS PROTECTION: Using SecurityUtils.safeSetInnerHTML
    SecurityUtils.safeSetInnerHTML(conversationsList, conversationsHTML);
};

// Initialize call system
window.telegramCallSystem = new TelegramCallSystem();
