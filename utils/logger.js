// Production Logger System
const fs = require('fs');
const path = require('path');

class ProductionLogger {
    constructor(options = {}) {
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.enableFileLog = process.env.LOG_FILE_ENABLED === 'true';
        this.logFilePath = process.env.LOG_FILE_PATH || './logs/app.log';
        this.enableConsole = process.env.NODE_ENV !== 'production';
        
        // Create logs directory if it doesn't exist
        if (this.enableFileLog) {
            const logDir = path.dirname(this.logFilePath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
        }
        
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

    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            message,
            pid: process.pid,
            ...meta
        };
        return JSON.stringify(logEntry);
    }

    writeToFile(formattedMessage) {
        if (this.enableFileLog) {
            fs.appendFileSync(this.logFilePath, formattedMessage + '\n');
        }
    }

    log(level, message, meta = {}) {
        if (!this.shouldLog(level)) return;

        const formattedMessage = this.formatMessage(level, message, meta);
        
        // Write to file
        this.writeToFile(formattedMessage);
        
        // Console output only in development
        if (this.enableConsole) {
            const consoleMethod = console[level] || console.log;
            consoleMethod(`[${level.toUpperCase()}] ${message}`, meta);
        }
    }

    info(message, meta = {}) {
        this.log('info', message, meta);
    }

    error(message, meta = {}) {
        this.log('error', message, meta);
    }

    warn(message, meta = {}) {
        this.log('warn', message, meta);
    }

    debug(message, meta = {}) {
        this.log('debug', message, meta);
    }

    // Security-aware logging - filters sensitive data
    secureLog(level, message, data = {}) {
        const sanitizedData = this.sanitizeData(data);
        this.log(level, message, sanitizedData);
    }

    sanitizeData(data) {
        const sanitized = { ...data };
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'session'];
        
        Object.keys(sanitized).forEach(key => {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                sanitized[key] = '[REDACTED]';
            }
        });
        
        return sanitized;
    }
}

// Create singleton instance
const logger = new ProductionLogger();

module.exports = logger;
