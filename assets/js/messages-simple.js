// Simple Messages Page Manager
class MessagesManager {
    constructor() {
        console.log('=== MESSAGES MANAGER INITIALIZED ===');
        
        // Prevent multiple initialization
        if (window.messagesManagerInitialized) {
            console.log('Messages Manager already initialized, skipping...');
            return;
        }
        window.messagesManagerInitialized = true;
        
        // Add debugging for page reload
        window.addEventListener('beforeunload', (event) => {
            console.log('🔄 Page is about to reload/unload');
            console.trace('Reload/unload stack trace');
        });
        
        // Add global error handlers to prevent reloads from uncaught errors
        window.addEventListener('error', (event) => {
            console.error('🚨 Global JavaScript error caught:', event.error);
            event.preventDefault();
            return false;
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            console.error('🚨 Unhandled promise rejection:', event.reason);
            event.preventDefault();
        });
        
        this.currentUser = null;
        this.activeConversation = null;
        // Use environment config for API URL
        this.apiBaseUrl = window.ENV_CONFIG ? window.ENV_CONFIG.apiBaseUrl : 'http://localhost:3000/api';
        
        // Audio system for call sounds
        this.audioSystem = {
            ringtone: null,
            callConnected: null,
            callEnded: null,
            notification: null
        };
        this.useInPageCall = true; // Use in-page call overlay by default
        
        // Initialize with a small delay to ensure DOM is ready
        setTimeout(async () => {
            try {
                console.log('🚀 Starting initialization...');
                this.initializeElements();
                
                // Load current user first (important for restoration)
                await this.loadCurrentUser();
                
                // Only proceed with app functionality if user is logged in
                if (this.currentUser) {
                    console.log('User logged in, loading app features...');
                    
                    // Load conversations
                    await this.loadConversations();
                    
                    // Check for direct message from URL or localStorage
                    this.checkForDirectMessage();
                    
                    // Try to restore active conversation after user is loaded
                    this.restoreActiveConversation();
                
                    // Note: Auto-refresh for messages is handled per conversation in setupMessageAutoRefresh()
                    console.log('✅ User loaded, ready for messaging');
                } else {
                    console.log('User not logged in, showing login prompt');
                }
                
                // Always setup event listeners
                this.setupEventListeners();
                
                // Initialize audio system
                this.initializeAudioSystem();
            } catch (error) {
                console.error('❌ Initialization error:', error);
            }
        }, 50);
    }

    restoreActiveConversation() {
        console.log('=== RESTORING ACTIVE CONVERSATION ===');
        
        // Prevent multiple restore attempts
        if (this.isRestoring) {
            console.log('Already restoring conversation, skipping...');
            return;
        }
        
        this.isRestoring = true;
        
        // Add retry counter to prevent infinite loops
        if (!this.restoreRetryCount) {
            this.restoreRetryCount = 0;
        }
        
        // Ensure current user is loaded first (max 5 retries)
        if (!this.currentUser && this.restoreRetryCount < 5) {
            console.log('Current user not loaded yet, waiting... (retry', this.restoreRetryCount + 1, '/5)');
            this.restoreRetryCount++;
            setTimeout(() => {
                this.isRestoring = false;
                this.restoreActiveConversation();
            }, 200);
            return;
        }
        
        if (!this.currentUser) {
            console.log('❌ Failed to load current user after 5 retries, skipping conversation restore');
            this.isRestoring = false;
            return;
        }
        
        try {
            const activeConvData = localStorage.getItem('activeConversation');
            if (activeConvData) {
                console.log('Found active conversation data:', activeConvData);
                const conversation = JSON.parse(activeConvData);
                
                // Restore the conversation after a short delay to ensure elements are ready
                setTimeout(async () => {
                    // Always fetch fresh user data from API to ensure we have latest info
                    try {
                        const token = localStorage.getItem('token');
                        if (token && conversation.user && conversation.user.id) {
                            const response = await fetch(`${this.apiBaseUrl}/users/${conversation.user.id}`, {
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/json'
                                }
                            });
                            
                            if (response.ok) {
                                const freshUserData = await response.json();
                                console.log('Fetched fresh user data for restoration:', freshUserData);
                                this.startConversationWith(freshUserData);
                            } else {
                                // Fallback to stored data if API fails
                                console.log('API failed, using stored data');
                                this.startConversationWith(conversation.user);
                            }
                        } else {
                            this.startConversationWith(conversation.user);
                        }
                    } catch (error) {
                        console.error('Error fetching fresh user data, using stored:', error);
                        this.startConversationWith(conversation.user);
                    }
                }, 100);
            } else {
                console.log('No active conversation data found');
            }
        } catch (error) {
            console.error('Error restoring active conversation:', error);
            localStorage.removeItem('activeConversation');
        }
    }

    async loadCurrentUser() {
        console.log('=== LOADING CURRENT USER ===');
        try {
            // Debug all tokens
            const token1 = localStorage.getItem('token');
            const token2 = localStorage.getItem('authToken');
            const isLoggedIn = localStorage.getItem('isLoggedIn');
            const userData = localStorage.getItem('userData');
            
            console.log('localStorage status:');
            console.log('- token:', token1 ? token1.substring(0, 20) + '...' : 'not found');
            console.log('- authToken:', token2 ? token2.substring(0, 20) + '...' : 'not found');
            console.log('- isLoggedIn:', isLoggedIn);
            console.log('- userData:', userData ? 'exists' : 'not found');
            console.log('- All keys:', Object.keys(localStorage));
            
            const token = token1 || token2;
            
            if (!token) {
                console.log('No token found, showing login prompt');
                this.showLoginPrompt();
                return;
            }

            console.log('Making profile request to:', `${this.apiBaseUrl}/profile/me`);
            const response = await fetch(`${this.apiBaseUrl}/profile/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Profile API response status:', response.status);

            if (response.ok) {
                const result = await response.json();
                this.currentUser = result.user || result;
                console.log('Current user loaded successfully:', this.currentUser);
            } else if (response.status === 401) {
                console.log('Token expired or invalid, showing login prompt');
                localStorage.removeItem('token');
                localStorage.removeItem('authToken');
                this.showLoginPrompt();
            } else {
                const errorText = await response.text();
                console.log('Failed to load current user, response:', response.status, errorText);
                this.showLoginPrompt();
            }
        } catch (error) {
            console.error('Error loading current user:', error);
            this.showLoginPrompt();
        }
    }

    showLoginPrompt() {
        console.log('Showing login prompt...');
        
        // Show a friendly login prompt in the conversations area
        if (this.conversationsList) {
            this.conversationsList.innerHTML = `
                <div class="p-8 text-center text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 opacity-50">
                        <path d="M9 12l2 2 4-4"/>
                        <path d="M12 1a3 3 0 0 0-3 3v9a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    </svg>
                    <h3 class="text-lg font-semibold mb-2 text-white">Cần đăng nhập</h3>
                    <p class="text-sm mb-4">Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại!</p>
                    <div class="space-y-2">
                        <a href="login.html" class="main-button px-6 py-2 rounded-full inline-flex items-center gap-2 block w-full justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                                <polyline points="10 17 15 12 10 7"/>
                                <line x1="15" x2="3" y1="12" y2="12"/>
                            </svg>
                            Đăng nhập lại
                        </a>
                        <button onclick="localStorage.clear(); location.reload();" class="text-xs text-gray-500 hover:text-white">
                            Xóa dữ liệu và tải lại
                        </button>
                    </div>
                </div>
            `;
        }
        
        // Also show in the chat area
        if (this.emptyChatPlaceholder) {
            this.emptyChatPlaceholder.innerHTML = `
                <div class="text-center text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 opacity-50">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                        <polyline points="10 17 15 12 10 7"/>
                        <line x1="15" x2="3" y1="12" y2="12"/>
                    </svg>
                    <h3 class="text-xl font-semibold mb-2">Phiên hết hạn</h3>
                    <p class="text-sm mb-4">Đăng nhập lại để sử dụng tính năng tin nhắn!</p>
                    <a href="login.html" class="main-button px-6 py-2 rounded-full inline-flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                            <polyline points="10 17 15 12 10 7"/>
                            <line x1="15" x2="3" y1="12" y2="12"/>
                        </svg>
                        Đăng nhập ngay
                    </a>
                </div>
            `;
            this.emptyChatPlaceholder.style.display = 'flex';
            this.emptyChatPlaceholder.classList.remove('hidden');
        }
        
        // Hide chat window if shown
        if (this.chatWindow) {
            this.chatWindow.style.display = 'none';
            this.chatWindow.classList.add('hidden');
        }
    }

    async loadConversations() {
        console.log('=== LOADING CONVERSATIONS ===');
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            console.log('Token available:', !!token);
            
            if (!token) {
                console.log('No token found, showing empty conversations');
                this.showEmptyConversations();
                return;
            }

            console.log('Fetching conversations from API...');
            const response = await fetch(`${this.apiBaseUrl}/conversations`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Conversations API response status:', response.status, response.statusText);

            if (response.ok) {
                const result = await response.json();
                console.log('Conversations API response:', result);
                
                // Handle different response structures
                const conversations = result.conversations || result.data || result;
                console.log('Parsed conversations:', conversations);
                
                this.renderConversations(conversations);
            } else {
                const errorText = await response.text();
                console.log('Failed to load conversations:', response.status, response.statusText, errorText);
                this.showEmptyConversations();
            }
        } catch (error) {
            console.error('Error loading conversations:', error);
            this.showEmptyConversations();
        }
    }

    renderConversations(conversations) {
        console.log('=== RENDERING CONVERSATIONS ===');
        console.log('Conversations list element:', this.conversationsList);
        console.log('Conversations data:', conversations);
        console.log('Conversations count:', conversations ? conversations.length : 'null/undefined');
        
        if (!this.conversationsList) {
            console.error('Conversations list element not found');
            return;
        }

        if (!conversations || conversations.length === 0) {
            console.log('No conversations found, showing empty state');
            this.showEmptyConversations();
            return;
        }

        console.log('Rendering', conversations.length, 'conversations');
        this.conversationsList.innerHTML = conversations.map(conv => `
            <div class="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-800/50 transition-colors conversation-item" 
                 data-user-id="${conv.otherUser.id}" data-user-data='${JSON.stringify(conv.otherUser)}'>
                <img src="${conv.otherUser.avatar || 'https://placehold.co/48x48/4F46E5/FFFFFF?text=' + (conv.otherUser.name ? conv.otherUser.name.charAt(0) : 'U')}" 
                     alt="${conv.otherUser.name}" class="w-12 h-12 rounded-full"/>
                <div class="flex-1">
                    <div class="flex justify-between items-center">
                        <h3 class="font-bold text-white">${conv.otherUser.name}</h3>
                        <p class="text-xs text-gray-400">${this.formatTime(conv.lastMessage?.createdAt)}</p>
                    </div>
                    <p class="text-sm text-gray-400 truncate">${conv.lastMessage?.content || 'Chưa có tin nhắn'}</p>
                </div>
            </div>
        `).join('');

        console.log('Conversations HTML generated successfully');

        // Add click listeners
        this.conversationsList.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', () => {
                const userData = JSON.parse(item.dataset.userData);
                this.startConversationWith(userData);
            });
        });
        
        console.log('Click listeners added to conversation items');
    }

    showEmptyConversations() {
        console.log('=== SHOWING EMPTY CONVERSATIONS ===');
        console.log('Conversations list element:', this.conversationsList);
        
        if (!this.conversationsList) {
            console.error('Conversations list element not found!');
            return;
        }
        
        // Clear all existing content including loading spinner
        this.conversationsList.innerHTML = '';
        
        // Add empty state content
        this.conversationsList.innerHTML = `
            <div class="p-8 text-center text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 opacity-50">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.3-4.3"/>
                </svg>
                <h3 class="text-lg font-semibold mb-2 text-white">Chưa có bạn bè</h3>
                <p class="text-sm mb-4">Hãy tìm kiếm và kết bạn với những người khác để bắt đầu trò chuyện!</p>
                <a href="discovery.html" class="main-button px-4 py-2 rounded-full inline-flex items-center gap-2 text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"/>
                        <path d="m21 21-4.3-4.3"/>
                    </svg>
                    Tìm bạn bè
                </a>
            </div>
        `;
        
        console.log('Empty conversations state displayed');
    }

    formatTime(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        // Less than 1 day ago
        if (diff < 24 * 60 * 60 * 1000) {
            return date.toLocaleTimeString('vi-VN', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
        
        // Less than 7 days ago
        if (diff < 7 * 24 * 60 * 60 * 1000) {
            return date.toLocaleDateString('vi-VN', { weekday: 'long' });
        }
        
        // More than 7 days ago
        return date.toLocaleDateString('vi-VN', { 
            day: '2-digit', 
            month: '2-digit' 
        });
    }

    initializeElements() {
        this.chatWindow = document.getElementById('chat-window');
        this.emptyChatPlaceholder = document.getElementById('empty-chat-placeholder');
        this.messagesContainer = document.getElementById('messages-container');
        this.messageInput = document.querySelector('.message-input');
        this.sendButton = document.querySelector('.send-button');
        this.chatHeader = document.getElementById('chat-header');
        this.conversationsList = document.getElementById('conversations-list');

        // Show empty chat placeholder by default, hide chat window
        if (this.chatWindow && this.emptyChatPlaceholder) {
            this.chatWindow.style.display = 'none';
            this.chatWindow.classList.add('hidden');
            this.emptyChatPlaceholder.style.display = 'flex';
            this.emptyChatPlaceholder.classList.remove('hidden');
        }

        // Disable input initially
        if (this.messageInput) {
            this.messageInput.disabled = true;
            this.messageInput.placeholder = 'Chọn cuộc trò chuyện để bắt đầu...';
        }

        console.log('Elements initialized:', {
            chatWindow: !!this.chatWindow,
            emptyChatPlaceholder: !!this.emptyChatPlaceholder,
            messagesContainer: !!this.messagesContainer,
            messageInput: !!this.messageInput
        });
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
                console.log('✅ Found message_user in localStorage:', messageUser);
                
                // Delay to ensure elements are ready
                setTimeout(() => {
                    console.log('Starting conversation from localStorage data...');
                    // Ensure elements are initialized
                    if (!this.chatWindow || !this.messagesContainer) {
                        console.log('Elements not ready, initializing...');
                        this.initializeElements();
                    }
                    this.startConversationWith(messageUser);
                }, 300);
                
                // Clean up localStorage
                localStorage.removeItem('message_user');
            } catch (error) {
                console.error('❌ Error parsing message user data:', error);
            }
        } else if (userId) {
            console.log('✅ Found userId in URL, fetching user data:', userId);
            this.fetchUserAndStartConversation(userId);
        } else {
            console.log('ℹ️  No direct message data found - showing normal messages page');
        }
    }

    async fetchUserAndStartConversation(userId) {
        try {
            console.log('=== FETCHING USER FOR CONVERSATION ===');
            console.log('User ID:', userId);
            
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            console.log('Using token:', token ? 'exists' : 'not found');
            
            if (!token) {
                console.error('No authentication token found');
                this.showLoginPrompt();
                return;
            }

            const response = await fetch(`${this.apiBaseUrl}/users/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('User API response status:', response.status);

            if (response.ok) {
                const result = await response.json();
                console.log('User API response:', result);
                
                // Handle different response formats
                const user = result.user || result;
                console.log('Parsed user for conversation:', user);
                
                if (user && user.id) {
                    this.startConversationWith(user);
                } else {
                    console.error('Invalid user data received');
                }
            } else {
                console.error('Failed to fetch user data, status:', response.status);
                const errorText = await response.text();
                console.error('Error response:', errorText);
            }
        } catch (error) {
            console.error('Error fetching user:', error);
        }
    }

    async startConversationWith(user) {
        console.log('=== STARTING CONVERSATION WITH ===', user);
        console.log('User data:', JSON.stringify(user, null, 2));
        
        // Validate user data before starting conversation
        if (!user || !user.id || user.id === 'undefined' || !user.name || user.name === 'undefined') {
            console.warn('Invalid user data provided to startConversationWith:', user);
            this.showEmptyPlaceholder();
            return;
        }
        
        // Store active conversation FIRST before loading messages
        this.activeConversation = { user };
        
        // Persist to localStorage for page reload
        localStorage.setItem('activeConversation', JSON.stringify(this.activeConversation));
        console.log('Active conversation saved to localStorage');
        
        // Ensure elements are initialized
        if (!this.chatWindow || !this.emptyChatPlaceholder) {
            console.error('Chat elements not initialized, retrying...');
            this.initializeElements();
        }
        
        // Show chat window FIRST
        this.showChatWindow();
        
        // Update header with user info
        this.updateChatHeader(user);
        
        // Load and show messages
        await this.loadAndShowMessages(user);
        
        // Enable input
        this.enableMessageInput(user);
        
        // Setup call buttons
        this.setupCallButtons();
        
        // Set up auto-refresh for receiving new messages
        this.setupMessageAutoRefresh(user);
        
        console.log('=== CONVERSATION STARTED SUCCESSFULLY ===');
    }

    setupCallButtons() {
        console.log('=== SETTING UP CALL BUTTONS ===');
        
        // Voice call button
        const voiceCallButtons = document.querySelectorAll('button[title="Gọi thoại"]');
        voiceCallButtons.forEach(button => {
            // Remove existing listeners
            button.replaceWith(button.cloneNode(true));
        });
        
        // Video call button  
        const videoCallButtons = document.querySelectorAll('button[title="Gọi video"]');
        videoCallButtons.forEach(button => {
            // Remove existing listeners
            button.replaceWith(button.cloneNode(true));
        });

        // Re-add listeners to fresh buttons
        const freshVoiceButtons = document.querySelectorAll('button[title="Gọi thoại"]');
        freshVoiceButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.initiateVoiceCall();
            });
        });

        const freshVideoButtons = document.querySelectorAll('button[title="Gọi video"]');
        freshVideoButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.initiateVideoCall();
            });
        });

        console.log('Call buttons setup completed:', {
            voiceButtons: freshVoiceButtons.length,
            videoButtons: freshVideoButtons.length
        });
    }

    setupMessageAutoRefresh(user) {
        // TEMPORARILY DISABLE AUTO-REFRESH TO PREVENT RELOAD ISSUES
        console.log('⚠️ Auto-refresh temporarily disabled to prevent page reload');
        return;
        
        // Clear existing interval if any
        if (this.messageRefreshInterval) {
            clearInterval(this.messageRefreshInterval);
        }
        
        // Set up auto-refresh every 10 seconds to get new messages (reduced frequency to prevent reload issues)
        this.messageRefreshInterval = setInterval(async () => {
            try {
                if (this.activeConversation && this.activeConversation.user.id === user.id) {
                    console.log('Auto-refreshing messages from cloud database...');
                    await this.loadAndShowMessages(user);
                }
            } catch (error) {
                console.error('❌ Error in auto-refresh, but continuing:', error);
                // Don't let auto-refresh errors break the app
            }
        }, 10000);
        
        console.log('Message auto-refresh enabled (every 10 seconds)');
    }

    stopMessageAutoRefresh() {
        if (this.messageRefreshInterval) {
            clearInterval(this.messageRefreshInterval);
            this.messageRefreshInterval = null;
            console.log('Message auto-refresh stopped');
        }
    }

    async loadAndShowMessages(user) {
        console.log('=== LOADING MESSAGES FOR ===', user?.name || 'unknown user');
        console.log('User ID:', user?.id);
        console.log('Current user ID:', this.currentUser?.id);
        
        // Validate user before proceeding
        if (!user || !user.id || user.id === 'undefined') {
            console.error('Invalid user provided to loadAndShowMessages:', user);
            return;
        }
        
        if (!this.messagesContainer) return;

        // Show loading state
        this.messagesContainer.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <div class="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p>Đang tải tin nhắn...</p>
            </div>
        `;

        // Load messages from API
        const messages = await this.loadMessages(user.id);
        console.log('Loaded messages count:', messages.length);
        
        if (messages.length === 0) {
            // Show welcome message if no messages
            this.showWelcomeMessage(user);
        } else {
            // Clear container and show messages
            this.messagesContainer.innerHTML = '';
            
            messages.forEach((message, index) => {
                console.log(`Adding message ${index + 1}:`, {
                    content: message.content,
                    isEncrypted: message.isEncrypted,
                    senderId: message.senderId,
                    currentUserId: this.currentUser?.id
                });
                
                // Server already decrypted the message content
                this.addMessageToUI({
                    text: message.content,
                    sender: message.senderId === this.currentUser?.id ? 'me' : user.name,
                    timestamp: new Date(message.createdAt),
                    id: message.id
                });
            });
            
            // Scroll to bottom
            setTimeout(() => {
                this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
            }, 100);
        }
        
        console.log('Messages loaded and displayed successfully');
    }

    showChatWindow() {
        console.log('=== SHOWING CHAT WINDOW ===');
        console.log('Elements found:', {
            chatWindow: !!this.chatWindow,
            placeholder: !!this.emptyChatPlaceholder
        });

        if (this.chatWindow && this.emptyChatPlaceholder) {
            // Hide placeholder
            this.emptyChatPlaceholder.style.display = 'none';
            this.emptyChatPlaceholder.classList.add('hidden');
            
            // Show chat window
            this.chatWindow.style.display = 'flex';
            this.chatWindow.classList.remove('hidden');
            
            console.log('Chat window shown successfully');
            console.log('Chat window display:', this.chatWindow.style.display);
            console.log('Placeholder display:', this.emptyChatPlaceholder.style.display);
        } else {
            console.error('Required elements not found for showChatWindow:', {
                chatWindow: !!this.chatWindow,
                placeholder: !!this.emptyChatPlaceholder
            });
        }
    }

    hideChatWindow() {
        console.log('=== HIDING CHAT WINDOW ===');
        
        if (this.chatWindow && this.emptyChatPlaceholder) {
            // Hide chat window
            this.chatWindow.style.display = 'none';
            this.chatWindow.classList.add('hidden');
            
            // Show placeholder
            this.emptyChatPlaceholder.style.display = 'flex';
            this.emptyChatPlaceholder.classList.remove('hidden');
            
            console.log('Chat window hidden, placeholder shown');
        }
    }

    updateChatHeader(user) {
        console.log('=== UPDATING CHAT HEADER ===', user?.name || user?.username);
        console.log('User data for header:', user);
        
        if (this.chatHeader) {
            const userInfoSection = this.chatHeader.querySelector('.flex.items-center.gap-4');
            if (userInfoSection) {
                // If user is invalid, show search message
                if (!user || !user.name || user.name === 'undefined') {
                    userInfoSection.innerHTML = `
                        <div class="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400">
                                <circle cx="11" cy="11" r="8"/>
                                <path d="m21 21-4.3-4.3"/>
                            </svg>
                        </div>
                        <div>
                            <h3 class="font-bold text-white">Tìm bạn bè</h3>
                            <p class="text-xs text-gray-400">Hãy khám phá và kết bạn</p>
                        </div>
                    `;
                } else {
                    const userName = user.name || user.username || 'Bạn bè mới';
                    const userInitial = userName.charAt(0).toUpperCase();
                    const avatarUrl = user.avatar || `https://placehold.co/40x40/4F46E5/FFFFFF?text=${userInitial}`;
                    
                    userInfoSection.innerHTML = `
                        <img src="${avatarUrl}" 
                             alt="${userName}" class="w-10 h-10 rounded-full"
                             onerror="this.src='https://placehold.co/40x40/4F46E5/FFFFFF?text=${userInitial}'">
                        <div>
                            <h3 class="font-bold text-white">${userName}</h3>
                            <p class="text-xs text-green-400">Hoạt động</p>
                        </div>
                    `;
                }
                console.log('Chat header updated successfully');
            } else {
                console.error('User info section not found in chat header');
            }
        } else {
            console.error('Chat header element not found');
        }
    }

    showWelcomeMessage(user) {
        console.log('=== SHOWING WELCOME MESSAGE ===');
        
        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = `
                <div class="text-center py-8 text-gray-400">
                    <img src="${user.avatar || 'https://placehold.co/80x80/4F46E5/FFFFFF?text=' + (user.name ? user.name.charAt(0) : 'U')}" 
                         alt="${user.name}" class="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-indigo-500">
                    <p class="text-lg font-semibold text-white mb-2">Bắt đầu cuộc trò chuyện với ${user.name}</p>
                    <p class="text-sm mb-4">Hãy gửi tin nhắn đầu tiên để bắt đầu!</p>
                </div>
            `;
            console.log('Welcome message displayed');
        }
    }

    showEmptyMessagesPlaceholder() {
        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-center text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 opacity-50">
                        <circle cx="11" cy="11" r="8"/>
                        <path d="m21 21-4.3-4.3"/>
                    </svg>
                    <h3 class="text-xl font-semibold mb-2">Chọn cuộc trò chuyện</h3>
                    <p class="text-sm mb-4">Chọn một cuộc trò chuyện từ danh sách bên trái hoặc tìm bạn bè mới!</p>
                    <a href="discovery.html" class="main-button px-6 py-2 rounded-full inline-flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"/>
                            <path d="m21 21-4.3-4.3"/>
                        </svg>
                        Tìm bạn bè
                    </a>
                </div>
            `;
        }
    }

    enableMessageInput(user) {
        console.log('=== ENABLING MESSAGE INPUT ===');
        
        if (this.messageInput) {
            if (!user || !user.name || user.name === 'undefined') {
                this.messageInput.disabled = true;
                this.messageInput.placeholder = 'Hãy tìm bạn bè để bắt đầu trò chuyện...';
                console.log('Message input disabled - no valid user');
            } else {
                this.messageInput.disabled = false;
                this.messageInput.placeholder = `Nhắn tin cho ${user.name}...`;
                console.log('Message input enabled for', user.name);
            }
        }
    }

    setupEventListeners() {
        // Send button click
        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => this.sendMessage());
        }

        // Enter key press
        if (this.messageInput) {
            this.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }

        // Voice call button
        const voiceCallButtons = document.querySelectorAll('button[title="Gọi thoại"]');
        voiceCallButtons.forEach(button => {
            button.addEventListener('click', () => this.initiateVoiceCall());
        });

        // Video call button  
        const videoCallButtons = document.querySelectorAll('button[title="Gọi video"]');
        videoCallButtons.forEach(button => {
            button.addEventListener('click', () => this.initiateVideoCall());
        });
    }

    // Call functionality
    initiateVoiceCall() {
        console.log('=== INITIATING VOICE CALL ===');
        
        if (!this.activeConversation?.user) {
            console.warn('No active conversation to call');
            this.showNotification('Hãy chọn một cuộc trò chuyện trước khi gọi', 'warning');
            return;
        }

        this.openCallWindow('voice');
    }

    initiateVideoCall() {
        console.log('=== INITIATING VIDEO CALL ===');
        
        if (!this.activeConversation?.user) {
            console.warn('No active conversation to call');
            this.showNotification('Hãy chọn một cuộc trò chuyện trước khi gọi', 'warning');
            return;
        }

        this.openCallWindow('video');
    }

    initializeAudioSystem() {
        console.log('=== INITIALIZING AUDIO SYSTEM ===');
        
        try {
            // Initialize AudioGenerator for real sounds
            this.audioSystem.generator = new AudioGenerator();
            this.audioSystem.currentRingtone = null;
            this.audioSystem.volume = 0.7;
            
            console.log('✅ Audio system initialized with real sound generation');
        } catch (error) {
            console.error('❌ Failed to initialize audio system:', error);
            // Fallback to basic audio
            this.initializeBasicAudio();
        }
    }
    
    initializeBasicAudio() {
        // Fallback initialization with basic Audio objects
        this.audioSystem.ringtone = new Audio();
        this.audioSystem.ringtone.loop = true;
        this.audioSystem.ringtone.volume = 0.7;
        
        this.audioSystem.callConnected = new Audio();
        this.audioSystem.callConnected.volume = 0.5;
        
        this.audioSystem.callEnded = new Audio();
        this.audioSystem.callEnded.volume = 0.5;
        
        this.audioSystem.notification = new Audio();
        this.audioSystem.notification.volume = 0.6;
        
        this.setAudioSources();
    }
    
    setAudioSources() {
        // Set ringtone (classic phone ring)
        this.audioSystem.ringtone.src = 'data:audio/wav;base64,UklGRvIBAABXQVZFZm10IAAAAAABAAABBAC4AQABBQAAAAVAEAAAE=' + 
            'EFVlhEhVaVVhVWlVYVVpVWFVaVVhVWlVYVVpVWFVaVVhVWlVYVVpVWFVaVVhVWlVYVVpVWFVaVVhVWlVYVVpVWFVaVVhVWlVYVVpVWFVaVVhVWlVYVVpVWFVaVVhVWlVYVVpVWFVaVVhVWlVYVVpVWFVaVVhVWlV';
        
        // Set call connected sound (short beep)
        this.audioSystem.callConnected.src = 'data:audio/wav;base64,UklGRsABAABXQVZFZm10IAAAAAABAAABBACJAQABBQAAAAVAEAAAE=';
        
        // Set call ended sound (disconnect tone)
        this.audioSystem.callEnded.src = 'data:audio/wav;base64,UklGRsACAABXQVZFZm10IAAAAAABAAABBACJAQABBQAAAAVAEAAAE=';
        
        // Set notification sound (message notification)
        this.audioSystem.notification.src = 'data:audio/wav;base64,UklGRsABAABXQVZFZm10IAAAAAABAAABBACJAQABBQAAAAVAEAAAE=';
        
        // Fallback: Try to use system notification sound
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            // Create system sounds using Web Audio API
            this.createSystemSounds();
        }
    }
    
    createSystemSounds() {
        try {
            // Create Audio Context for generating sounds
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                const audioCtx = new AudioContext();
                
                // Generate ringtone sound
                this.generateRingtone(audioCtx);
            }
        } catch (error) {
            console.log('Web Audio API not available, using fallback sounds');
        }
    }
    
    generateRingtone(audioCtx) {
        // Create a simple ringtone using oscillators
        const duration = 2; // 2 seconds
        const sampleRate = audioCtx.sampleRate;
        const frameCount = sampleRate * duration;
        const arrayBuffer = audioCtx.createBuffer(1, frameCount, sampleRate);
        const channelData = arrayBuffer.getChannelData(0);
        
        // Generate classic phone ring pattern
        for (let i = 0; i < frameCount; i++) {
            const t = i / sampleRate;
            const freq1 = 440; // A4 note
            const freq2 = 880; // A5 note
            
            // Create ring pattern (alternating tones)
            const pattern = Math.floor(t * 2) % 2;
            const freq = pattern === 0 ? freq1 : freq2;
            
            // Generate sine wave with envelope
            const envelope = Math.sin(t * Math.PI * 2) * 0.5 + 0.5;
            channelData[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.3;
        }
        
        // Convert buffer to blob and create audio URL
        this.bufferToAudioUrl(arrayBuffer).then(url => {
            if (url) {
                this.audioSystem.ringtone.src = url;
            }
        });
    }
    
    async bufferToAudioUrl(buffer) {
        try {
            // This is a simplified version - in real implementation,
            // you'd need to properly encode the audio buffer
            return null;
        } catch (error) {
            console.error('Failed to create audio URL:', error);
            return null;
        }
    }
    
    playRingtone() {
        console.log('🔊 Playing ringtone...');
        try {
            if (this.audioSystem.generator) {
                // Use real sound generation
                this.audioSystem.currentRingtone = this.audioSystem.generator.playSound('ringtone', true, this.audioSystem.volume);
                console.log('✅ Real ringtone started');
            } else if (this.audioSystem.ringtone) {
                // Fallback to Audio object
                this.audioSystem.ringtone.currentTime = 0;
                const playPromise = this.audioSystem.ringtone.play();
                if (playPromise) {
                    playPromise.catch(error => {
                        console.warn('Ringtone play failed:', error);
                        this.playSystemBeep();
                    });
                }
            } else {
                this.playSystemBeep();
            }
        } catch (error) {
            console.warn('Ringtone play error:', error);
            this.playSystemBeep();
        }
    }
    
    stopRingtone() {
        console.log('🔇 Stopping ringtone...');
        try {
            if (this.audioSystem.currentRingtone) {
                // Stop generated sound
                this.audioSystem.generator.stopSound(this.audioSystem.currentRingtone);
                this.audioSystem.currentRingtone = null;
                console.log('✅ Real ringtone stopped');
            } else if (this.audioSystem.ringtone) {
                // Stop fallback audio
                this.audioSystem.ringtone.pause();
                this.audioSystem.ringtone.currentTime = 0;
                console.log('✅ Fallback ringtone stopped');
            }
        } catch (error) {
            console.warn('Failed to stop ringtone:', error);
        }
    }
    
    playCallConnected() {
        console.log('📞 Playing call connected sound...');
        try {
            if (this.audioSystem.generator) {
                this.audioSystem.generator.playSound('callConnected', false, this.audioSystem.volume);
            } else if (this.audioSystem.callConnected) {
                this.audioSystem.callConnected.currentTime = 0;
                this.audioSystem.callConnected.play().catch(() => {
                    this.playSystemBeep();
                });
            } else {
                this.playSystemBeep();
            }
        } catch (error) {
            this.playSystemBeep();
        }
    }
    
    playCallEnded() {
        console.log('📵 Playing call ended sound...');
        try {
            if (this.audioSystem.generator) {
                this.audioSystem.generator.playSound('callEnded', false, this.audioSystem.volume);
            } else if (this.audioSystem.callEnded) {
                this.audioSystem.callEnded.currentTime = 0;
                this.audioSystem.callEnded.play().catch(() => {
                    this.playSystemBeep();
                });
            } else {
                this.playSystemBeep();
            }
        } catch (error) {
            this.playSystemBeep();
        }
    }
    
    playNotification() {
        console.log('🔔 Playing notification sound...');
        try {
            if (this.audioSystem.generator) {
                this.audioSystem.generator.playSound('notification', false, this.audioSystem.volume);
            } else if (this.audioSystem.notification) {
                this.audioSystem.notification.currentTime = 0;
                this.audioSystem.notification.play().catch(() => {
                    this.playSystemBeep();
                });
            } else {
                this.playSystemBeep();
            }
        } catch (error) {
            this.playSystemBeep();
        }
    }
    
    playSystemBeep() {
        // Fallback: Use system beep or create a simple beep sound
        try {
            // Create a simple beep using Web Audio API
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.5);
        } catch (error) {
            // Ultimate fallback: Console beep
            console.log('🔊 BEEP!');
        }
    }

    openCallWindow(callType) {
        console.log(`=== OPENING ${callType.toUpperCase()} CALL WINDOW ===`);
        
        const user = this.activeConversation.user;
        const callData = {
            type: callType,
            contact: user.name || user.username || 'Unknown Contact',
            contactId: user.id,
            state: 'outgoing',
            callId: Date.now().toString(),
            startTime: new Date().toISOString()
        };

        // Store call data for the call window
        localStorage.setItem('currentCall', JSON.stringify(callData));
        
        // Play ringtone for outgoing call
        this.playRingtone();
        
        // Stop ringtone after 30 seconds if call not answered
        setTimeout(() => {
            this.stopRingtone();
        }, 30000);
        
        // Calculate window position (center of screen)
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        const windowWidth = 800;
        const windowHeight = 600;
        const left = Math.round((screenWidth - windowWidth) / 2);
        const top = Math.round((screenHeight - windowHeight) / 2);

        // Window features
        const windowFeatures = [
            `width=${windowWidth}`,
            `height=${windowHeight}`,
            `left=${left}`,
            `top=${top}`,
            'resizable=yes',
            'scrollbars=no',
            'status=no',
            'menubar=no',
            'toolbar=no',
            'location=no'
        ].join(',');

        // Open call window
        const callWindow = window.open(
            '../pages/calls.html',
            `call_${callData.callId}`,
            windowFeatures
        );

        if (callWindow) {
            console.log('Call window opened successfully');
            this.showNotification(`Đang khởi tạo cuộc gọi ${callType} với ${user.name}...`, 'info');
            
            // Monitor call window for close event
            const checkClosed = setInterval(() => {
                if (callWindow.closed) {
                    console.log('Call window closed');
                    this.stopRingtone();
                    this.playCallEnded();
                    localStorage.removeItem('currentCall');
                    clearInterval(checkClosed);
                }
            }, 1000);
            
            // Focus the new window
            callWindow.focus();
        } else {
            console.error('Failed to open call window - popup blocked?');
            this.stopRingtone();
            this.showNotification('Không thể mở cửa sổ cuộc gọi. Vui lòng cho phép popup!', 'error');
        }
    }

    startCall(callType) {
        const user = this.activeConversation.user;
        const callData = {
            type: callType,
            contact: user.name || user.username || 'Unknown Contact',
            contactId: user.id,
            state: 'outgoing',
            callId: Date.now().toString(),
            startTime: new Date().toISOString()
        };

        // Store call data for the call window
        localStorage.setItem('currentCall', JSON.stringify(callData));
        
        console.log(`Starting ${callType} call with:`, user.name);
        
        // Option 1: Use in-page overlay (recommended)
        if (this.useInPageCall) {
            this.showInPageCall(callType, callData);
        } else {
            // Option 2: Open call window (original method)
            const callWindow = window.open(
                '../pages/calls.html',
                `call_${callData.callId}`,
                `width=800,height=600,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`
            );

            if (callWindow) {
                // Store reference for communication
                this.activeCallWindow = callWindow;
                
                // Show in-app notification
                this.showNotification(`Đang gọi ${callType === 'video' ? 'video' : 'thoại'} cho ${user.name}...`, 'info');
                
                // Monitor call window
                const checkClosed = setInterval(() => {
                    if (callWindow.closed) {
                        clearInterval(checkClosed);
                        this.activeCallWindow = null;
                        localStorage.removeItem('currentCall');
                        console.log('Call window closed');
                    }
                }, 1000);
            } else {
                console.error('Failed to open call window');
                this.showNotification('Không thể mở cửa sổ cuộc gọi. Vui lòng kiểm tra popup blocker.', 'error');
            }
        }
    }

    showInPageCall(callType, callData) {
        const overlayId = callType === 'video' ? 'video-call-overlay' : 'voice-call-overlay';
        const overlay = document.getElementById(overlayId);
        
        if (!overlay) {
            console.error(`Call overlay not found: ${overlayId}`);
            return;
        }

        // Update call status
        const statusElement = overlay.querySelector('#call-status, #video-call-status');
        if (statusElement) {
            statusElement.textContent = `Đang gọi ${callData.contact}...`;
        }

        // Show overlay
        overlay.classList.remove('hidden');
        
        // Setup call controls
        this.setupCallControls(overlay, callType, callData);
        
        // Start call timer (simulate connection after 3 seconds)
        setTimeout(() => {
            this.simulateCallConnection(overlay, callData);
        }, 3000);
    }

    setupCallControls(overlay, callType, callData) {
        // End call button
        const endButtons = overlay.querySelectorAll('#end-call-btn, #video-end-call-btn');
        endButtons.forEach(button => {
            button.onclick = () => this.endInPageCall(overlay);
        });

        // Mute button
        const muteButtons = overlay.querySelectorAll('#mute-btn, #video-mute-btn');
        muteButtons.forEach(button => {
            button.onclick = () => this.toggleMute(button);
        });

        // Video-specific controls
        if (callType === 'video') {
            const cameraButton = overlay.querySelector('#camera-toggle-btn');
            if (cameraButton) {
                cameraButton.onclick = () => this.toggleCamera(cameraButton);
            }

            const screenShareButton = overlay.querySelector('#screen-share-btn');
            if (screenShareButton) {
                screenShareButton.onclick = () => this.toggleScreenShare(screenShareButton);
            }
        }

        // Speaker button (voice call)
        const speakerButton = overlay.querySelector('#speaker-btn');
        if (speakerButton) {
            speakerButton.onclick = () => this.toggleSpeaker(speakerButton);
        }
    }

    simulateCallConnection(overlay, callData) {
        const statusElements = overlay.querySelectorAll('#call-status, #video-call-status');
        const timerElements = overlay.querySelectorAll('#call-timer, #video-call-timer');
        
        statusElements.forEach(element => {
            element.textContent = 'Đã kết nối';
            element.className = 'text-green-400';
        });

        timerElements.forEach(element => {
            element.classList.remove('hidden');
            this.startCallTimer(element);
        });
    }

    startCallTimer(timerElement) {
        let seconds = 0;
        this.callTimer = setInterval(() => {
            seconds++;
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    endInPageCall(overlay) {
        // Clear timer
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }

        // Hide overlay
        overlay.classList.add('hidden');
        
        // Clean up call data
        localStorage.removeItem('currentCall');
        
        // Show notification
        this.showNotification('Cuộc gọi đã kết thúc', 'info');
    }

    toggleMute(button) {
        const isMuted = button.classList.contains('muted');
        
        if (isMuted) {
            button.classList.remove('muted', 'bg-red-600');
            button.classList.add('bg-gray-700/80');
            button.title = 'Tắt tiếng';
        } else {
            button.classList.add('muted', 'bg-red-600');
            button.classList.remove('bg-gray-700/80');
            button.title = 'Bật tiếng';
        }
        
        // In a real app, this would mute/unmute the actual audio
        console.log('Toggle mute:', !isMuted);
    }

    toggleCamera(button) {
        const isCameraOff = button.classList.contains('camera-off');
        
        if (isCameraOff) {
            button.classList.remove('camera-off', 'bg-red-600');
            button.classList.add('bg-gray-700/80');
            button.title = 'Tắt camera';
        } else {
            button.classList.add('camera-off', 'bg-red-600');
            button.classList.remove('bg-gray-700/80');
            button.title = 'Bật camera';
        }
        
        // In a real app, this would turn camera on/off
        console.log('Toggle camera:', !isCameraOff);
    }

    toggleScreenShare(button) {
        const isSharing = button.classList.contains('sharing');
        
        if (isSharing) {
            button.classList.remove('sharing', 'bg-blue-600');
            button.classList.add('bg-gray-700/80');
            button.title = 'Chia sẻ màn hình';
        } else {
            button.classList.add('sharing', 'bg-blue-600');
            button.classList.remove('bg-gray-700/80');
            button.title = 'Dừng chia sẻ';
        }
        
        // In a real app, this would start/stop screen sharing
        console.log('Toggle screen share:', !isSharing);
    }

    toggleSpeaker(button) {
        const isSpeakerOn = button.classList.contains('speaker-on');
        
        if (isSpeakerOn) {
            button.classList.remove('speaker-on', 'bg-blue-600');
            button.classList.add('bg-gray-700/80');
            button.title = 'Loa ngoài';
        } else {
            button.classList.add('speaker-on', 'bg-blue-600');
            button.classList.remove('bg-gray-700/80');
            button.title = 'Loa trong';
        }
        
        console.log('Toggle speaker:', !isSpeakerOn);
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transition-all duration-300 transform translate-x-full`;
        
        // Style based on type
        switch(type) {
            case 'success':
                notification.className += ' bg-green-600 text-white';
                break;
            case 'warning':
                notification.className += ' bg-yellow-600 text-white';
                break;
            case 'error':
                notification.className += ' bg-red-600 text-white';
                break;
            default:
                notification.className += ' bg-blue-600 text-white';
        }

        notification.innerHTML = `
            <div class="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4"/>
                    <path d="M12 8h.01"/>
                </svg>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-auto text-white/70 hover:text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);

        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }, 5000);
    }

    async sendMessage() {
        console.log('=== SEND MESSAGE CALLED ===');
        console.log('Message input:', !!this.messageInput);
        console.log('Active conversation:', this.activeConversation);
        console.log('Current user:', this.currentUser);
        
        if (!this.messageInput || !this.activeConversation) {
            console.error('Cannot send message: missing input or conversation');
            console.log('messageInput exists:', !!this.messageInput);
            console.log('activeConversation exists:', !!this.activeConversation);
            return;
        }

        const messageText = this.messageInput.value.trim();
        if (!messageText) {
            console.log('Empty message, not sending');
            return;
        }

        console.log('Sending message:', messageText);
        
        // Generate temporary message ID
        const tempMessageId = 'temp_' + Date.now();

        try {
            // Show message immediately (optimistic update)
            this.addMessageToUI({
                text: messageText,
                sender: 'me',
                timestamp: new Date(),
                status: 'sending',
                id: tempMessageId
            });

            // Clear input
            this.messageInput.value = '';

            // Send to server
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            console.log('Using token:', token ? 'exists' : 'not found');
            
            if (!token) {
                console.warn('No authentication token found');
                this.updateMessageStatus(tempMessageId, 'failed');
                return;
            }
            
            const response = await fetch(`${this.apiBaseUrl}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    receiverId: this.activeConversation.user.id,
                    content: messageText // Send plain text - server will encrypt
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Message sent and saved to cloud database successfully:', result);
                
                // Update message status to sent
                this.updateMessageStatus(tempMessageId, 'sent');
                
                // IMPORTANT: Reload messages immediately to reflect changes from database
                console.log('Reloading messages from cloud database...');
                
                // Validate active conversation user before reloading
                if (this.activeConversation?.user?.id) {
                    await this.loadAndShowMessages(this.activeConversation.user);
                } else {
                    console.warn('Active conversation user is invalid, skipping message reload:', this.activeConversation?.user);
                }
                
                // Also reload conversations to show new conversation in sidebar
                console.log('Reloading conversations list...');
                setTimeout(() => {
                    this.loadConversations();
                }, 300);
                
            } else {
                const errorText = await response.text();
                console.error('Failed to send message:', response.status, response.statusText, errorText);
                this.updateMessageStatus(tempMessageId, 'failed');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.updateMessageStatus(tempMessageId, 'failed');
        }
    }

    async loadMessages(userId) {
        console.log('=== LOADING MESSAGES FROM CLOUD DATABASE ===');
        console.log('Target user ID:', userId);
        console.log('Current user ID:', this.currentUser?.id);
        
        // Validate userId before making API call
        if (!userId || userId === 'undefined') {
            console.error('Invalid user ID provided to loadMessages:', userId);
            return [];
        }
        
        try {
            // Debug localStorage tokens
            const token1 = localStorage.getItem('token');
            const token2 = localStorage.getItem('authToken');
            console.log('localStorage token:', token1 ? token1.substring(0, 20) + '...' : 'not found');
            console.log('localStorage authToken:', token2 ? token2.substring(0, 20) + '...' : 'not found');
            console.log('All localStorage keys:', Object.keys(localStorage));
            
            const token = token1 || token2;
            if (!token) {
                console.error('No authentication token found, cannot load messages');
                console.log('Available localStorage keys:', Object.keys(localStorage));
                console.log('Please login again to get a valid token');
                return [];
            }

            console.log('Making API request to cloud database:', `${this.apiBaseUrl}/messages/${userId}`);
            const response = await fetch(`${this.apiBaseUrl}/messages/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                cache: 'no-store' // Force fresh data from server
            });

            console.log('Database response status:', response.status);
            
            if (response.ok) {
                const result = await response.json();
                console.log('Raw API response:', result);
                
                // Extract messages from API response - server returns { success: true, messages: [...] }
                const messages = result.messages || result.data || (Array.isArray(result) ? result : []);
                console.log('Extracted messages array:', messages);
                
                if (!Array.isArray(messages)) {
                    console.error('Messages is not an array:', typeof messages, messages);
                    return [];
                }
                
                console.log('✅ Messages loaded from cloud database:', messages.length, 'messages');
                console.log('Message details:', messages.map(m => ({
                    id: m.id,
                    content: m.content?.substring(0, 50) + '...',
                    senderId: m.senderId,
                    createdAt: m.createdAt,
                    isEncrypted: m.isEncrypted
                })));
                
                // Store in localStorage as backup
                localStorage.setItem(`messages_${userId}`, JSON.stringify(messages));
                
                return messages;
            } else {
                const errorText = await response.text();
                console.error('Failed to load messages from database:', response.status, response.statusText);
                console.error('Error response:', errorText);
                
                // Try to load from localStorage as fallback
                const cachedMessages = localStorage.getItem(`messages_${userId}`);
                if (cachedMessages) {
                    console.log('Using cached messages as fallback');
                    const parsedMessages = JSON.parse(cachedMessages);
                    return Array.isArray(parsedMessages) ? parsedMessages : [];
                }
                
                return [];
            }
        } catch (error) {
            console.error('Error loading messages from database:', error);
            
            // Try to load from localStorage as fallback
            const cachedMessages = localStorage.getItem(`messages_${userId}`);
            if (cachedMessages) {
                console.log('Using cached messages as fallback due to error');
                const parsedMessages = JSON.parse(cachedMessages);
                return Array.isArray(parsedMessages) ? parsedMessages : [];
            }
            
            return [];
            
            return [];
        }
    }

    updateMessageStatus(messageId, status) {
        // Find message element and update status
        const messageElements = this.messagesContainer.querySelectorAll(`[data-message-id="${messageId}"]`);
        messageElements.forEach(element => {
            const statusElement = element.querySelector('.message-status');
            if (statusElement) {
                switch (status) {
                    case 'sending':
                        statusElement.textContent = '⏳';
                        break;
                    case 'sent':
                        statusElement.textContent = '✓';
                        break;
                    case 'failed':
                        statusElement.textContent = '❌';
                        element.style.opacity = '0.7';
                        break;
                }
            }
        });
    }

    addMessageToUI(message) {
        if (!this.messagesContainer) return;

        // Clear welcome message on first real message
        const welcomeMessage = this.messagesContainer.querySelector('.text-center');
        if (welcomeMessage && !welcomeMessage.querySelector('.animate-spin')) {
            this.messagesContainer.innerHTML = '';
        }

        const isMe = message.sender === 'me';
        
        // Play notification sound for incoming messages
        if (!isMe) {
            this.playNotification();
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex items-start gap-3 ${isMe ? 'justify-end' : ''} message`;
        messageDiv.dataset.messageId = message.id || 'temp';

        // Safety check for activeConversation
        const otherUserAvatar = this.activeConversation?.user?.avatar || 'https://placehold.co/32x32/8A2BE2/FFFFFF?text=U';
        const otherUserName = this.activeConversation?.user?.name || 'User';

        const avatarSrc = isMe 
            ? (this.currentUser?.avatar || 'https://placehold.co/32x32/4F46E5/FFFFFF?text=' + (this.currentUser?.name?.charAt(0) || 'Y'))
            : (otherUserAvatar || 'https://placehold.co/32x32/8A2BE2/FFFFFF?text=' + otherUserName.charAt(0));

        messageDiv.innerHTML = `
            ${!isMe ? `<img src="${avatarSrc}" alt="Avatar" class="w-8 h-8 rounded-full">` : ''}
            <div class="${isMe ? 'bg-indigo-600' : 'bg-gray-700/50'} p-3 rounded-lg ${isMe ? 'rounded-br-none' : 'rounded-tl-none'} max-w-xs md:max-w-md">
                <p class="text-white">${message.text}</p>
                <div class="flex items-center justify-between mt-1">
                    <span class="text-xs text-gray-300 opacity-70">
                        ${message.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    ${isMe ? `<span class="message-status text-xs ml-2">${this.getMessageStatusIcon(message.status)}</span>` : ''}
                </div>
            </div>
            ${isMe ? `<img src="${avatarSrc}" alt="You" class="w-8 h-8 rounded-full">` : ''}
        `;

        this.messagesContainer.appendChild(messageDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    getMessageStatusIcon(status) {
        switch (status) {
            case 'sending': return '⏳';
            case 'sent': return '✓';
            case 'delivered': return '✓✓';
            case 'failed': return '❌';
            default: return '✓';
        }
    }

}

// Initialize when DOM is ready
let messagesManager = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('=== DOM CONTENT LOADED ===');
    messagesManager = new MessagesManager();
    
    // Initialize 3D Cosmic Background
    initCosmicBackground();
});

// --- 3D Cosmic Background Script ---
function initCosmicBackground() {
    console.log('=== INITIALIZING 3D COSMIC BACKGROUND ===');
    
    // Check if THREE.js is available
    if (typeof THREE === 'undefined') {
        console.error('THREE.js is not loaded');
        return;
    }
    
    const canvas = document.getElementById('cosmic-bg');
    if (!canvas) {
        console.error('Cosmic background canvas not found');
        return;
    }

    try {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
        camera.position.z = 1;
        
        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Create stars
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
        
        // Mouse tracking
        let mouseX = 0;
        let mouseY = 0;
        document.addEventListener('mousemove', (event) => {
            mouseX = event.clientX;
            mouseY = event.clientY;
        });
        
        const clock = new THREE.Clock();
        
        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate);
            const elapsedTime = clock.getElapsedTime();
            
            // Rotate stars based on mouse movement
            stars.rotation.y = -mouseX * 0.00005;
            stars.rotation.x = -mouseY * 0.00005;
            
            // Adjust camera based on scroll position to create a parallax effect
            camera.position.z = 1 + (document.documentElement.scrollTop || document.body.scrollTop) * 0.001;
            
            renderer.render(scene, camera);
        };
        animate();
        
        // Handle window resize
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
        
        console.log('3D Cosmic background initialized successfully');
        
    } catch (error) {
        console.error('Error initializing 3D background:', error);
        // Fallback: hide the canvas if 3D fails
        canvas.style.display = 'none';
    }
}
