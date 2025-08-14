// Environment Configuration for Cosmic Social Network
// This file automatically detects if running locally or in production

class EnvironmentConfig {
    constructor() {
        // Auto-detect environment based on hostname
        this.isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        this.isDevelopment = !this.isProduction;
        
        // API Base URL configuration
        if (this.isProduction) {
            // In production, use the same origin (Render URL)
            this.apiBaseUrl = `${window.location.origin}/api`;
        } else {
            // In development, use localhost with port 3000 or 8080
            this.apiBaseUrl = 'http://localhost:3000/api';
        }
        
        console.log('🌍 Environment Configuration:');
        console.log(`   - Environment: ${this.isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
        console.log(`   - API Base URL: ${this.apiBaseUrl}`);
        console.log(`   - Current Origin: ${window.location.origin}`);
        console.log(`   - Hostname: ${window.location.hostname}`);
    }
    
    // Get API URL with endpoint
    getApiUrl(endpoint = '') {
        return `${this.apiBaseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    }
    
    // Check if running in production
    isProductionEnvironment() {
        return this.isProduction;
    }
    
    // Check if running in development
    isDevelopmentEnvironment() {
        return this.isDevelopment;
    }
    
    // Get WebSocket URL (for future real-time features)
    getWebSocketUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = this.isProduction ? window.location.host : 'localhost:3000';
        return `${protocol}//${host}`;
    }
}

// Create global environment config instance
window.ENV_CONFIG = new EnvironmentConfig();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnvironmentConfig;
}
