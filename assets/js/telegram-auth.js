/**
 * Telegram-inspired Authentication Manager
 * Based on Telegram's robust session management and auto-recovery mechanisms
 */

class TelegramAuthManager {
    constructor() {
        this.authState = {
            isAuthenticated: false,
            user: null,
            session: null,
            tokens: new Map(),
            lastRefresh: null,
            retryAttempts: 0,
            maxRetries: 3
        };
        
        this.config = {
            apiBaseUrl: window.location.origin,
            sessionTimeout: 30 * 24 * 60 * 60 * 1000, // 30 days like Telegram
            refreshThreshold: 5 * 60 * 1000, // Refresh if token expires in 5 mins
            retryDelay: 1000, // Start with 1 second
            maxRetryDelay: 30000 // Max 30 seconds like Telegram
        };

        this.initializeAuth();
    }

    /**
     * Initialize authentication state from localStorage
     * Similar to Telegram's session restoration
     */
    initializeAuth() {
        console.log('🔐 TelegramAuth: Initializing authentication state');
        
        try {
            // Try to restore session from multiple storage locations
            this.loadStoredSession();
            
            // Auto-refresh if needed
            if (this.authState.user && !this.hasValidToken()) {
                this.attemptTokenRefresh();
            }
        } catch (error) {
            console.error('❌ TelegramAuth: Init error:', error);
            this.clearAuthState();
        }
    }

    /**
     * Load session data from localStorage
     * Telegram stores sessions in multiple locations for reliability
     */
    loadStoredSession() {
        const storageKeys = [
            'authToken', 'token', 'cosmic_token',
            'userData', 'currentUser', 'userInfo',
            'userName', 'userEmail', 'userId'
        ];

        const storedData = {};
        storageKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value) {
                storedData[key] = value;
            }
        });

        console.log('🔍 TelegramAuth: Stored data keys:', Object.keys(storedData));

        // Try to reconstruct user from available data
        if (storedData.userData) {
            try {
                this.authState.user = JSON.parse(storedData.userData);
            } catch (e) {
                console.warn('Invalid userData format');
            }
        }

        // Fallback user construction from separate fields
        if (!this.authState.user && (storedData.userName || storedData.userEmail)) {
            this.authState.user = {
                name: storedData.userName,
                email: storedData.userEmail,
                id: storedData.userId
            };
        }

        // Store available tokens
        ['authToken', 'token', 'cosmic_token'].forEach(tokenKey => {
            if (storedData[tokenKey]) {
                this.authState.tokens.set(tokenKey, storedData[tokenKey]);
            }
        });

        this.authState.isAuthenticated = !!this.authState.user;
        console.log('✅ TelegramAuth: Session loaded:', {
            hasUser: !!this.authState.user,
            tokenCount: this.authState.tokens.size,
            userName: this.authState.user?.name
        });
    }

    /**
     * Check if we have a valid token
     * Telegram checks token validity before each request
     */
    hasValidToken() {
        if (this.authState.tokens.size === 0) return false;

        // Try to validate token expiry if JWT
        for (let [key, token] of this.authState.tokens) {
            if (this.isTokenValid(token)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Validate JWT token expiry
     */
    isTokenValid(token) {
        if (!token) return false;

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const now = Date.now() / 1000;
            
            // Check if token expires soon (within refresh threshold)
            if (payload.exp && (payload.exp - now) * 1000 > this.config.refreshThreshold) {
                return true;
            }
        } catch (e) {
            // Non-JWT token, assume valid for now
            return true;
        }
        
        return false;
    }

    /**
     * Get the best available token
     * Telegram prioritizes tokens by recency and validity
     */
    getBestToken() {
        const tokenPreference = ['authToken', 'token', 'cosmic_token'];
        
        for (let key of tokenPreference) {
            const token = this.authState.tokens.get(key);
            if (token && this.isTokenValid(token)) {
                return token;
            }
        }
        
        // Return any available token as fallback
        return Array.from(this.authState.tokens.values())[0];
    }

    /**
     * Attempt token refresh with exponential backoff
     * Similar to Telegram's retry mechanism
     */
    async attemptTokenRefresh() {
        if (this.authState.retryAttempts >= this.config.maxRetries) {
            console.error('❌ TelegramAuth: Max retry attempts reached');
            this.handleAuthFailure();
            return false;
        }

        this.authState.retryAttempts++;
        const delay = Math.min(
            this.config.retryDelay * Math.pow(2, this.authState.retryAttempts - 1),
            this.config.maxRetryDelay
        );

        console.log(`🔄 TelegramAuth: Token refresh attempt ${this.authState.retryAttempts}/${this.config.maxRetries}`);

        try {
            const refreshData = this.getRefreshData();
            if (!refreshData) {
                throw new Error('No refresh data available');
            }

            const response = await fetch(`${this.config.apiBaseUrl}/api/refresh-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'TelegramAuth'
                },
                body: JSON.stringify(refreshData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.success && data.token) {
                this.handleRefreshSuccess(data);
                return true;
            } else {
                throw new Error(data.message || 'Token refresh failed');
            }

        } catch (error) {
            console.error(`❌ TelegramAuth: Refresh attempt ${this.authState.retryAttempts} failed:`, error);
            
            // Wait before next attempt
            if (this.authState.retryAttempts < this.config.maxRetries) {
                console.log(`⏳ TelegramAuth: Retrying in ${delay}ms`);
                setTimeout(() => this.attemptTokenRefresh(), delay);
            } else {
                this.handleAuthFailure();
            }
            
            return false;
        }
    }

    /**
     * Get data for token refresh
     */
    getRefreshData() {
        const refreshData = {};
        
        if (this.authState.user?.email) {
            refreshData.email = this.authState.user.email;
        }
        
        if (this.authState.user?.id) {
            refreshData.userId = this.authState.user.id;
        }

        // Fallback to stored email
        const storedEmail = localStorage.getItem('userEmail');
        if (!refreshData.email && storedEmail) {
            refreshData.email = storedEmail;
        }

        return Object.keys(refreshData).length > 0 ? refreshData : null;
    }

    /**
     * Handle successful token refresh
     */
    handleRefreshSuccess(data) {
        console.log('✅ TelegramAuth: Token refresh successful');
        
        // Store new token in all locations for redundancy
        if (data.token) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('authToken', data.token);
            this.authState.tokens.set('authToken', data.token);
            this.authState.tokens.set('token', data.token);
        }

        // Update user data if provided
        if (data.user) {
            this.authState.user = { ...this.authState.user, ...data.user };
            localStorage.setItem('userData', JSON.stringify(this.authState.user));
            localStorage.setItem('userName', data.user.name || '');
            localStorage.setItem('userEmail', data.user.email || '');
        }

        this.authState.isAuthenticated = true;
        this.authState.lastRefresh = Date.now();
        this.authState.retryAttempts = 0;

        // Dispatch success event
        window.dispatchEvent(new CustomEvent('telegramauth:refreshed', {
            detail: { user: this.authState.user, token: data.token }
        }));
    }

    /**
     * Handle authentication failure
     * Telegram gracefully handles auth failures with user notification
     */
    handleAuthFailure() {
        console.log('❌ TelegramAuth: Authentication failed completely');
        
        this.clearAuthState();
        
        // Show user-friendly notification like Telegram
        this.showAuthFailureNotification();
        
        // Redirect to login after delay
        setTimeout(() => {
            this.redirectToLogin();
        }, 3000);

        // Dispatch failure event
        window.dispatchEvent(new CustomEvent('telegramauth:failed'));
    }

    /**
     * Clear authentication state
     */
    clearAuthState() {
        this.authState = {
            isAuthenticated: false,
            user: null,
            session: null,
            tokens: new Map(),
            lastRefresh: null,
            retryAttempts: 0,
            maxRetries: 3
        };

        // Clear sensitive data from localStorage
        ['authToken', 'token', 'cosmic_token'].forEach(key => {
            localStorage.removeItem(key);
        });
    }

    /**
     * Show Telegram-style notification
     */
    showAuthFailureNotification() {
        // Remove existing notifications
        const existing = document.querySelector('.telegram-auth-notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = 'telegram-auth-notification fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg transition-all duration-300';
        notification.innerHTML = `
            <div class="flex items-center gap-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <div>
                    <div class="font-semibold">Phiên đăng nhập đã hết hạn</div>
                    <div class="text-sm opacity-90">Đang chuyển về trang đăng nhập...</div>
                </div>
            </div>
        `;

        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    /**
     * Redirect to login page
     */
    redirectToLogin() {
        const currentPath = window.location.pathname;
        const isInPagesFolder = currentPath.includes('/pages/');
        const loginPath = isInPagesFolder ? '../index.html' : './index.html';
        
        console.log('🔄 TelegramAuth: Redirecting to login');
        window.location.href = loginPath;
    }

    /**
     * Make authenticated API request with auto-retry
     * Similar to Telegram's request handling
     */
    async makeAuthenticatedRequest(url, options = {}) {
        const token = this.getBestToken();
        
        if (!token) {
            await this.attemptTokenRefresh();
            const newToken = this.getBestToken();
            if (!newToken) {
                throw new Error('No authentication token available');
            }
        }

        const requestOptions = {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${this.getBestToken()}`,
                'Content-Type': 'application/json'
            }
        };

        try {
            const response = await fetch(url, requestOptions);
            
            // Handle token expiry
            if (response.status === 401) {
                console.log('🔄 TelegramAuth: Token expired, attempting refresh');
                const refreshed = await this.attemptTokenRefresh();
                
                if (refreshed) {
                    // Retry with new token
                    requestOptions.headers['Authorization'] = `Bearer ${this.getBestToken()}`;
                    return await fetch(url, requestOptions);
                } else {
                    throw new Error('Authentication failed');
                }
            }

            return response;
        } catch (error) {
            console.error('❌ TelegramAuth: Request failed:', error);
            throw error;
        }
    }

    /**
     * Get current authentication state
     */
    getAuthState() {
        return {
            isAuthenticated: this.authState.isAuthenticated,
            user: this.authState.user,
            hasValidToken: this.hasValidToken(),
            tokenCount: this.authState.tokens.size
        };
    }
}

// Create global instance
window.telegramAuth = new TelegramAuthManager();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TelegramAuthManager;
}

console.log('✅ TelegramAuth: Manager initialized');
