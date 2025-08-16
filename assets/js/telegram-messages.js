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
        
        // Initialize subsystems
        this.initSocket();
        this.initUI();
        this.initMessageHandlers();
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
                this.authenticateUser();
                this.joinUserRoom();
            });

            this.socket.on('disconnect', () => {
                console.log('💔 Disconnected from server');
                this.isOnline = false;
            });

            this.socket.on('reconnect', () => {
                console.log('🔄 Reconnected to server');
                this.restoreSession();
            });

        } catch (error) {
            console.error('❌ Socket initialization failed:', error);
        }
    }

    authenticateUser() {
        if (this.currentUser && this.socket?.connected) {
            this.socket.emit('authenticate', {
                userId: this.currentUser.id,
                username: this.currentUser.name,
                avatar: this.currentUser.avatar
            });
            console.log('🔐 User authenticated');
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

        // Telegram-style message events
        this.socket.on('new_message', (message) => this.handleIncomingMessage(message));
        this.socket.on('message', (message) => this.handleIncomingMessage(message));
        this.socket.on('broadcast_message', (message) => this.handleIncomingMessage(message));
        this.socket.on('message_sent', (data) => this.handleMessageSent(data));
        this.socket.on('message_delivered', (data) => this.handleMessageDelivered(data));
        this.socket.on('typing_start', (data) => this.handleTypingStart(data));
        this.socket.on('typing_stop', (data) => this.handleTypingStop(data));
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
        
        try {
            // Store current chat
            this.currentChat = { id: chatId };
            localStorage.setItem('currentChatId', chatId);
            
            // Join chat room
            if (this.socket?.connected) {
                this.socket.emit('join_room', { roomId: chatId });
            }
            
            // Load messages from API
            const messages = await this.fetchMessagesFromAPI(chatId);
            
            // Clear and render messages
            this.clearMessageContainer();
            messages.forEach(msg => {
                this.messages.set(msg.id, msg);
                this.renderMessage(msg);
            });
            
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

        // Convert to internal Telegram format
        return data.messages.map(msg => ({
            id: msg.id,
            text: msg.text || msg.content || '',
            senderId: msg.senderId,
            senderName: msg.senderName || 'Unknown',
            chatId: chatId,
            timestamp: new Date(msg.timestamp),
            type: msg.type || 'text',
            status: 'sent'
        }));
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
            // Send via Socket.IO
            if (this.socket?.connected) {
                this.socket.emit('send_message', {
                    messageId: message.id,
                    text: message.text,
                    chatId: this.currentChat.id,
                    senderId: this.currentUser.id,
                    senderName: this.currentUser.name,
                    timestamp: message.timestamp.toISOString()
                });
                
                console.log('📡 Message sent via Socket.IO');
            } else {
                // Fallback to API
                await this.sendMessageViaAPI(message);
                console.log('📡 Message sent via API fallback');
            }

            // Update status
            message.status = 'sent';
            this.updateMessageStatus(message.id, 'sent');

        } catch (error) {
            console.error('❌ Send failed:', error);
            message.status = 'failed';
            this.updateMessageStatus(message.id, 'failed');
        }
    }

    async sendMessageViaAPI(message) {
        const response = await fetch(`/api/conversations/${message.chatId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            },
            body: JSON.stringify({
                text: message.text,
                type: 'text'
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || 'Send failed');
        }
    }

    // === UI RENDERING ===
    renderMessage(message) {
        const container = document.querySelector('.messages-container');
        if (!container) return;

        const isOwn = message.senderId === this.currentUser?.id;
        const timeStr = message.timestamp.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        console.log('🎨 Rendering Telegram message:', {
            text: message.text,
            isOwn,
            senderId: message.senderId,
            currentUserId: this.currentUser?.id
        });

        const messageEl = document.createElement('div');
        messageEl.className = `message-item ${isOwn ? 'own' : 'other'} mb-4`;
        messageEl.setAttribute('data-message-id', message.id);

        messageEl.innerHTML = `
            <div class="flex ${isOwn ? 'justify-end' : 'justify-start'}">
                <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    isOwn 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-100'
                }">
                    ${!isOwn ? `<div class="text-xs text-gray-400 mb-1">${message.senderName}</div>` : ''}
                    <div class="message-text">${this.escapeHtml(message.text)}</div>
                    <div class="text-xs ${isOwn ? 'text-blue-200' : 'text-gray-500'} mt-1 flex items-center">
                        <span>${timeStr}</span>
                        ${isOwn ? this.getStatusIcon(message.status) : ''}
                    </div>
                </div>
            </div>
        `;

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
                statusEl.innerHTML = this.getStatusIcon(status);
            }
        }
    }

    clearMessageContainer() {
        const container = document.querySelector('.messages-container');
        if (container) {
            container.innerHTML = '';
        }
    }

    scrollToBottom() {
        const container = document.querySelector('.messages-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    updateUI() {
        // Update chat layout
        const chatWindow = document.getElementById('chat-window');
        const emptyPlaceholder = document.getElementById('empty-chat-placeholder');
        
        if (this.currentChat) {
            chatWindow?.classList.remove('hidden');
            chatWindow?.style.setProperty('display', 'flex');
            emptyPlaceholder?.classList.add('hidden');
            emptyPlaceholder?.style.setProperty('display', 'none');
        } else {
            chatWindow?.classList.add('hidden');
            chatWindow?.style.setProperty('display', 'none');
            emptyPlaceholder?.classList.remove('hidden');
            emptyPlaceholder?.style.setProperty('display', 'flex');
        }
    }

    updateChatLastMessage(message) {
        // Update conversation list last message
        // TODO: Implement conversation list update
    }

    updateTypingIndicator() {
        // TODO: Implement typing indicator
    }

    // === SESSION MANAGEMENT ===
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
        // TODO: Implement push notifications
    }

    showError(error) {
        console.error('❌ Telegram error:', error);
        // TODO: Show user-friendly error UI
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
    window.telegramMessaging = new TelegramMessaging();
    
    // Also set as realTimeMessaging for compatibility
    window.realTimeMessaging = window.telegramMessaging;
});

// Global conversation selection (Telegram-style)
window.selectConversation = function(conversationId, userName, userAvatar) {
    console.log('🎯 Telegram: Selecting conversation:', conversationId, userName);
    
    if (window.telegramMessaging) {
        // Save chat user info
        localStorage.setItem('currentChatUser', JSON.stringify({
            name: userName,
            avatar: userAvatar
        }));
        
        // Load the chat
        window.telegramMessaging.loadChat(conversationId);
        
        // Update UI active state
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-conversation-id="${conversationId}"]`)?.classList.add('active');
    }
};

// Load conversations function
window.loadRealConversations = async function() {
    try {
        console.log('📋 Loading Telegram conversations...');
        const token = localStorage.getItem('token') || '';
        const response = await fetch('/api/conversations', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.conversations) {
                console.log(`✅ Loaded ${data.conversations.length} Telegram conversations`);
                window.renderConversations(data.conversations);
            }
        }
    } catch (error) {
        console.error('❌ Load Telegram conversations failed:', error);
    }
};

console.log('🚀 Telegram-style messaging system loaded');
