// === PRODUCTION REAL-TIME MESSAGING SYSTEM ===
class RealTimeMessaging {
    constructor() {
        this.socket = null;
        this.currentUser = this.getCurrentUser();
        this.currentChatId = this.getCurrentChatId();
        this.messages = [];
        this.onlineUsers = new Set();
        this.isConnected = false;
        this.typingUsers = new Set();
        this.errorHandler = new MessagingErrorHandler();
        
        this.initializeWebSocket();
        this.initializeUI();
        this.loadMessageHistory();
        this.updateChatLayout();
        
        setTimeout(() => {
            this.checkForDirectMessage();
        }, 100);
    }

    checkForDirectMessage() {
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('userId');
        const messageUserData = localStorage.getItem('message_user');
        
        if (messageUserData) {
            try {
                const messageUser = JSON.parse(messageUserData);
                
                if (messageUser && messageUser.name && messageUser.name !== 'undefined') {
                    this.startConversationWith(messageUser);
                }
                
                localStorage.removeItem('message_user');
            } catch (error) {
                this.errorHandler.logError('Error parsing message user data', error);
                localStorage.removeItem('message_user');
            }
        }
    }

    async startConversationWith(user) {
        if (!user || !user.name || user.name === 'undefined') {
            this.errorHandler.showUserError('Dữ liệu người dùng không hợp lệ');
            return;
        }
        
        this.showConversationPlaceholder(user);
        return;
        
        try {
            const token = localStorage.getItem('authToken');
            
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
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.switchToConversation(data.conversation);
                    this.showNotification(`Đã mở cuộc trò chuyện với ${user.name}`, 'success');
                }
            } else {
                this.showConversationPlaceholder(user);
            }
        } catch (error) {
            this.errorHandler.logError('Error starting conversation', error);
            this.showConversationPlaceholder(user);
        }
    }

    showConversationPlaceholder(user) {
        if (!user || !user.name) {
            this.errorHandler.showUserError('Thông tin người dùng không có');
            return;
        }
        
        this.currentChatId = user.id;
        this.updateChatHeader(user.name, user.avatar);
        
        const messagesContainer = document.getElementById('messages-container');
        
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-center py-8">
                    <div class="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
                        <span class="text-white text-2xl font-bold">${user.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <h3 class="text-xl font-bold text-white mb-2">${user.name}</h3>
                    <p class="text-gray-400 mb-4">Bắt đầu cuộc trò chuyện với ${user.name}</p>
                    <div class="bg-blue-600/20 border border-blue-500/30 rounded-lg p-4 max-w-md">
                        <p class="text-blue-300 text-sm">💡 Đây là đầu cuộc trò chuyện với ${user.name}. Hãy gửi tin nhắn đầu tiên!</p>
                    </div>
                </div>
            `;
        }
        
        this.showChatWindow();
        
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.placeholder = `Nhắn tin cho ${user.name}...`;
            messageInput.disabled = false;
        }
    }

    showChatWindow() {
        const chatWindow = document.getElementById('chat-window');
        const emptyPlaceholder = document.getElementById('empty-chat-placeholder');
        
        if (chatWindow && emptyPlaceholder) {
            emptyPlaceholder.classList.add('hidden');
            emptyPlaceholder.style.display = 'none';
            
            chatWindow.classList.remove('hidden');
            chatWindow.style.display = 'flex';
            chatWindow.style.setProperty('display', 'flex', 'important');
        }
    }

    updateChatHeader(userName, userAvatar) {
        document.querySelectorAll('#chat-window h2, #chat-window h3, .chat-header h2, .chat-header h3').forEach(el => {
            el.textContent = userName;
        });
        
        document.querySelectorAll('#chat-window img, .chat-header img').forEach(el => {
            el.src = userAvatar || `https://placehold.co/40x40/4F46E5/FFFFFF?text=${userName.charAt(0).toUpperCase()}`;
            el.alt = userName;
        });
        
        document.querySelectorAll('#chat-window .text-green-400, .chat-header .text-green-400').forEach(el => {
            el.textContent = 'Hoạt động';
        });
    }

    updateChatLayout() {
        const chatWindow = document.getElementById('chat-window');
        const emptyPlaceholder = document.getElementById('empty-chat-placeholder');
        
        if (!this.currentChatId) {
            if (chatWindow) {
                chatWindow.classList.add('hidden');
                chatWindow.style.display = 'none';
            }
            if (emptyPlaceholder) {
                emptyPlaceholder.classList.remove('hidden');
                emptyPlaceholder.style.display = 'flex';
            }
        } else {
            if (emptyPlaceholder) {
                emptyPlaceholder.classList.add('hidden');
                emptyPlaceholder.style.display = 'none';
            }
            if (chatWindow) {
                chatWindow.classList.remove('hidden');
                chatWindow.style.display = 'flex';
            }
        }
    }

    getCurrentUser() {
        try {
            return JSON.parse(localStorage.getItem('user') || '{}');
        } catch {
            return {};
        }
    }

    getCurrentChatId() {
        return localStorage.getItem('currentChatId') || null;
    }

    initializeWebSocket() {
        if (typeof io !== 'undefined') {
            try {
                this.socket = io();
                this.setupSocketEventListeners();
            } catch (error) {
                this.errorHandler.logError('WebSocket initialization failed', error);
            }
        }
    }

    setupSocketEventListeners() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            this.isConnected = true;
            this.updateConnectionStatus();
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.updateConnectionStatus();
        });

        this.socket.on('message', (data) => {
            this.handleIncomingMessage(data);
        });

        this.socket.on('userOnline', (userId) => {
            this.onlineUsers.add(userId);
            this.updateOnlineStatus();
        });

        this.socket.on('userOffline', (userId) => {
            this.onlineUsers.delete(userId);
            this.updateOnlineStatus();
        });

        this.socket.on('typing', (data) => {
            this.handleTyping(data);
        });

        this.socket.on('stopTyping', (data) => {
            this.handleStopTyping(data);
        });
    }

    handleIncomingMessage(messageData) {
        if (!messageData || !messageData.id) return;

        this.messages.push(messageData);
        this.renderMessage(messageData);
        this.scrollToBottom();
        
        if (messageData.senderId !== this.currentUser.id) {
            this.showNotification(`Tin nhắn từ ${messageData.senderName}`, messageData.content);
        }
    }

    renderMessage(messageData) {
        const messagesContainer = document.getElementById('messages-container');
        if (!messagesContainer) return;

        const isOwn = messageData.senderId === this.currentUser.id;
        const messageElement = document.createElement('div');
        messageElement.className = `message-item ${isOwn ? 'own' : 'other'} mb-4`;
        
        const timestamp = new Date(messageData.timestamp).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageElement.innerHTML = `
            <div class="flex ${isOwn ? 'justify-end' : 'justify-start'}">
                <div class="max-w-xs lg:max-w-md ${isOwn ? 'order-first' : 'order-last'}">
                    ${!isOwn ? `<div class="text-xs text-gray-400 mb-1 px-2">${this.escapeHtml(messageData.senderName)}</div>` : ''}
                    <div class="${isOwn ? 'bg-indigo-600 text-white' : 'bg-gray-700/50 text-gray-100'} rounded-lg p-3 shadow-sm">
                        <p class="break-words">${this.escapeHtml(messageData.content)}</p>
                    </div>
                    <div class="flex items-center gap-1 mt-1 px-2 text-xs text-gray-400">
                        <span>${timestamp}</span>
                        ${isOwn ? `<span class="ml-1">✓</span>` : ''}
                    </div>
                </div>
            </div>
        `;

        messagesContainer.appendChild(messageElement);
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('messages-container');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    handleTyping(data) {
        if (data.userId !== this.currentUser.id) {
            this.typingUsers.add(data.username);
            this.updateTypingIndicator();
        }
    }

    handleStopTyping(data) {
        this.typingUsers.delete(data.username);
        this.updateTypingIndicator();
    }

    updateTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (!typingIndicator) return;

        if (this.typingUsers.size === 0) {
            typingIndicator.classList.add('hidden');
            return;
        }

        const typingArray = Array.from(this.typingUsers);
        let typingText = '';
        
        if (typingArray.length === 1) {
            typingText = `${typingArray[0]} đang nhập...`;
        } else {
            typingText = `${typingArray.length} người đang nhập...`;
        }

        typingIndicator.innerHTML = `
            <div class="flex items-center space-x-2 px-4 py-2 text-sm text-gray-400">
                <div class="flex space-x-1">
                    <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 0.2s"></div>
                    <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 0.4s"></div>
                </div>
                <span>${typingText}</span>
            </div>
        `;
        typingIndicator.classList.remove('hidden');
    }

    updateConnectionStatus() {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.className = `flex items-center space-x-2 text-sm ${this.isConnected ? 'text-green-400' : 'text-red-400'}`;
            statusElement.innerHTML = `
                <div class="w-2 h-2 ${this.isConnected ? 'bg-green-400' : 'bg-red-400'} rounded-full"></div>
                <span>${this.isConnected ? 'Đã kết nối' : 'Mất kết nối'}</span>
            `;
        }
    }

    updateOnlineStatus() {
        // Update online user indicators
    }

    initializeUI() {
        this.initializeMessageInput();
        this.initializeSendButton();
    }

    initializeMessageInput() {
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            let typingTimer;
            messageInput.addEventListener('input', () => {
                if (this.socket && this.currentChatId) {
                    this.socket.emit('typing', {
                        chatId: this.currentChatId,
                        username: this.currentUser.name || 'Người dùng'
                    });

                    clearTimeout(typingTimer);
                    typingTimer = setTimeout(() => {
                        this.socket.emit('stopTyping', {
                            chatId: this.currentChatId,
                            username: this.currentUser.name || 'Người dùng'
                        });
                    }, 1000);
                }
            });
        }
    }

    initializeSendButton() {
        const sendButton = document.getElementById('send-button');
        if (sendButton) {
            sendButton.addEventListener('click', () => {
                this.sendMessage();
            });
        }
    }

    async sendMessage() {
        const messageInput = document.getElementById('message-input');
        if (!messageInput) return;

        const content = messageInput.value.trim();
        if (!content || !this.currentChatId) return;

        const message = {
            id: Date.now().toString(),
            content: content,
            senderId: this.currentUser.id || 'anonymous',
            senderName: this.currentUser.name || 'Người dùng',
            chatId: this.currentChatId,
            timestamp: new Date().toISOString()
        };

        this.renderMessage(message);
        messageInput.value = '';
        this.scrollToBottom();

        if (this.socket) {
            this.socket.emit('message', message);
        }

        try {
            await this.sendMessageToAPI(message);
        } catch (error) {
            this.errorHandler.logError('Failed to send message via API', error);
        }
    }

    async sendMessageToAPI(message) {
        const token = localStorage.getItem('authToken');
        
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                receiverId: this.currentChatId,
                content: message.content
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
    }

    loadMessageHistory() {
        // Load message history implementation
    }

    showNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: body,
                icon: '/assets/images/logo.png'
            });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    destroy() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// === ERROR HANDLING ===
class MessagingErrorHandler {
    constructor() {
        this.errors = [];
    }

    logError(message, error) {
        const errorEntry = {
            timestamp: new Date(),
            message: message,
            error: error?.message || error
        };
        
        this.errors.push(errorEntry);
        
        if (window.productionLogger) {
            window.productionLogger.error(message, { error: errorEntry });
        }
    }

    showUserError(message) {
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-4 rounded-lg shadow-lg z-50 max-w-sm';
        toast.innerHTML = `
            <div class="flex items-center space-x-3">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-2">✕</button>
            </div>
        `;
        
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }
}

// === CALL MANAGEMENT SYSTEM ===
class CallManager {
    constructor() {
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.isCallActive = false;
        this.isMuted = false;
        this.isVideoEnabled = true;
        this.callType = null;
        this.voiceBars = [];
        this.callStartTime = null;
        this.callTimer = null;
        this.ringtone = null;
        
        this.initializeAudio();
        this.initializeCallControls();
    }

    initializeAudio() {
        try {
            this.ringtone = new Audio();
            this.ringtone.loop = true;
            this.ringtone.volume = 0.5;
        } catch (error) {
            // Silent fail for audio initialization
        }
    }

    initializeCallControls() {
        document.addEventListener('DOMContentLoaded', () => {
            this.bindCallEvents();
        });
    }

    bindCallEvents() {
        const muteBtn = document.getElementById('mute-btn');
        const videoMuteBtn = document.getElementById('video-mute-btn');
        const cameraToggleBtn = document.getElementById('camera-toggle-btn');
        const speakerBtn = document.getElementById('speaker-btn');
        const endCallBtn = document.getElementById('end-call-btn');

        if (muteBtn) muteBtn.addEventListener('click', () => this.toggleMute());
        if (videoMuteBtn) videoMuteBtn.addEventListener('click', () => this.toggleMute());
        if (cameraToggleBtn) cameraToggleBtn.addEventListener('click', () => this.toggleCamera());
        if (speakerBtn) speakerBtn.addEventListener('click', () => this.toggleSpeaker());
        if (endCallBtn) endCallBtn.addEventListener('click', () => this.endCall());
    }

    async startCall(callType, targetUser) {
        this.callType = callType;
        
        try {
            const constraints = {
                audio: true,
                video: callType === 'video'
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            const localVideo = document.getElementById('local-video');
            if (localVideo && this.localStream) {
                localVideo.srcObject = this.localStream;
            }

            this.isCallActive = true;
            this.startCallTimer();
            
            if (this.callType === 'voice') {
                this.setupAudioVisualization();
            }

        } catch (error) {
            this.handleCallError('Không thể truy cập thiết bị âm thanh/video');
        }
    }

    setupAudioVisualization() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(this.localStream);
            const analyser = audioContext.createAnalyser();
            
            source.connect(analyser);
            analyser.fftSize = 256;
            
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            const animateVoiceBars = () => {
                if (!this.isCallActive) return;
                
                analyser.getByteFrequencyData(dataArray);
                
                this.voiceBars.forEach((bar, index) => {
                    const value = dataArray[index * 10] || 0;
                    const height = Math.max(4, (value / 255) * 30);
                    bar.style.height = `${height}px`;
                });
                
                requestAnimationFrame(animateVoiceBars);
            };
            
            animateVoiceBars();
        } catch (error) {
            // Silent fail for audio visualization
        }
    }

    startCallTimer() {
        const timerElement = document.getElementById('call-timer');
        if (!timerElement) return;

        this.callStartTime = Date.now();
        timerElement.classList.remove('hidden');
        
        this.callTimer = setInterval(() => {
            const elapsed = Date.now() - this.callStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            timerElement.textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    toggleMute() {
        if (!this.localStream) return;
        
        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            audioTracks[0].enabled = !audioTracks[0].enabled;
            this.isMuted = !this.isMuted;
            
            const muteBtns = [document.getElementById('mute-btn'), document.getElementById('video-mute-btn')];
            muteBtns.forEach(btn => {
                if (btn) {
                    btn.classList.toggle('bg-red-600', this.isMuted);
                    btn.classList.toggle('bg-gray-700', !this.isMuted);
                }
            });
        }
    }

    toggleCamera() {
        if (!this.localStream) return;
        
        const videoTracks = this.localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            videoTracks[0].enabled = !videoTracks[0].enabled;
            this.isVideoEnabled = !this.isVideoEnabled;
            
            const cameraBtn = document.getElementById('camera-toggle-btn');
            if (cameraBtn) {
                cameraBtn.classList.toggle('bg-red-600', !this.isVideoEnabled);
                cameraBtn.classList.toggle('bg-gray-700', this.isVideoEnabled);
            }
        }
    }

    toggleSpeaker() {
        // Toggle speaker implementation
    }

    endCall() {
        this.isCallActive = false;
        
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        localStorage.removeItem('currentCall');
        
        // Play call end sound
        this.playCallEndSound();
        
        // Redirect to messages after a short delay
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 1000);
    }

    playCallEndSound() {
        try {
            if (window.audioGenerator) {
                const endSound = window.audioGenerator.createCallEndedSound();
                window.audioGenerator.playSound(endSound);
            }
        } catch (error) {
            // Silent fail for audio
        }
    }

    handleCallError(message) {
        if (window.realTimeMessaging?.errorHandler) {
            window.realTimeMessaging.errorHandler.showUserError(message);
        }
    }
}

// === GLOBAL INITIALIZATION ===
let realTimeMessaging;
let callManager;

document.addEventListener('DOMContentLoaded', () => {
    try {
        realTimeMessaging = new RealTimeMessaging();
        window.realTimeMessaging = realTimeMessaging;
    } catch (error) {
        // Silent fail
    }

    try {
        callManager = new CallManager();
    } catch (error) {
        // Silent fail
    }

    // Monitor active calls
    const monitorActiveCalls = () => {
        setInterval(() => {
            const activeCall = localStorage.getItem('currentCall');
            const callStatusIndicator = document.getElementById('call-status-indicator');
            
            if (activeCall) {
                const callData = JSON.parse(activeCall);
                if (!callStatusIndicator) {
                    const indicator = document.createElement('div');
                    indicator.id = 'call-status-indicator';
                    indicator.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2';
                    indicator.innerHTML = `
                        <div class="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        <span>Cuộc gọi đang diễn ra</span>
                        <button onclick="window.open('calls.html', '_blank')" class="ml-2 text-sm underline">Mở</button>
                    `;
                    document.body.appendChild(indicator);
                }
            } else {
                if (callStatusIndicator) {
                    callStatusIndicator.remove();
                }
            }
        }, 1000);
    };

    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    monitorActiveCalls();
});

window.addEventListener('beforeunload', () => {
    if (realTimeMessaging) {
        realTimeMessaging.destroy();
    }
});

// === UTILITIES ===
function clearChatHistory() {
    const messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
    }
    
    localStorage.removeItem('chatHistory');
    
    if (realTimeMessaging) {
        realTimeMessaging.messages = [];
    }
}

function exportChatHistory() {
    if (!realTimeMessaging || !realTimeMessaging.messages.length) {
        alert('Không có lịch sử chat để xuất');
        return;
    }

    const history = realTimeMessaging.messages.map(msg => ({
        timestamp: new Date(msg.timestamp).toLocaleString('vi-VN'),
        sender: msg.senderName,
        content: msg.content
    }));

    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
}
