// Client-side Production Logger
class ClientLogger {
    constructor() {
        this.isProduction = window.location.hostname !== 'localhost' && 
                           window.location.hostname !== '127.0.0.1' &&
                           !window.location.hostname.includes('192.168.');
        this.logLevel = this.isProduction ? 'error' : 'debug';
        this.enableRemoteLogging = false; // Set to true to send logs to server
        
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
    }

    shouldLog(level) {
        return this.levels[level] <= this.levels[this.logLevel];
    }

    sanitizeData(data) {
        if (!data) return data;
        
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
        const sanitized = { ...data };
        
        Object.keys(sanitized).forEach(key => {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                sanitized[key] = '[REDACTED]';
            }
        });
        
        return sanitized;
    }

    formatMessage(level, message, data) {
        return {
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            message,
            data: this.sanitizeData(data),
            url: window.location.href,
            userAgent: navigator.userAgent
        };
    }

    async sendToServer(logEntry) {
        if (!this.enableRemoteLogging) return;
        
        try {
            await fetch('/api/logs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(logEntry)
            });
        } catch (error) {
            // Fail silently for logging errors
        }
    }

    log(level, message, data = {}) {
        if (!this.shouldLog(level)) return;

        const logEntry = this.formatMessage(level, message, data);

        // Always log errors and warnings to console, even in production
        if (level === 'error' || level === 'warn' || !this.isProduction) {
            const consoleMethod = console[level] || console.log;
            consoleMethod(`[${level.toUpperCase()}] ${message}`, data);
        }

        // Send critical errors to server
        if (level === 'error' && this.enableRemoteLogging) {
            this.sendToServer(logEntry);
        }
    }

    error(message, data = {}) {
        this.log('error', message, data);
    }

    warn(message, data = {}) {
        this.log('warn', message, data);
    }

    info(message, data = {}) {
        this.log('info', message, data);
    }

    debug(message, data = {}) {
        this.log('debug', message, data);
    }
}

// Create global logger instance
window.logger = new ClientLogger();

// Replace console methods in production
if (window.logger.isProduction) {
    const originalConsole = {
        log: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error,
        debug: console.debug
    };

    // Only allow errors and warnings in production
    console.log = () => {};
    console.info = () => {};
    console.debug = () => {};
    
    // Keep warn and error but filter sensitive data
    console.warn = (message, ...args) => {
        window.logger.warn(message, args);
    };
    
    console.error = (message, ...args) => {
        window.logger.error(message, args);
    };

    // Provide way to restore console for debugging
    window.restoreConsole = () => {
        Object.assign(console, originalConsole);
    };
}
