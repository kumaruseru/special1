/**
 * Security Utilities for Special1
 * Provides secure parsing, sanitization, and validation functions
 */

class SecurityUtils {
    /**
     * Safely parse JSON string with error handling
     * @param {string} str - JSON string to parse
     * @param {any} defaultValue - Default value if parsing fails
     * @returns {any} Parsed object or default value
     */
    static safeJSONParse(str, defaultValue = null) {
        try {
            if (!str || typeof str !== 'string') {
                return defaultValue;
            }
            return JSON.parse(str);
        } catch (error) {
            console.warn('SecurityUtils: JSON parse failed', { 
                error: error.message,
                str: str.substring(0, 100) + '...' // Log first 100 chars only
            });
            return defaultValue;
        }
    }

    /**
     * Safely parse JWT token
     * @param {string} token - JWT token
     * @returns {object|null} Decoded payload or null
     */
    static safeJWTParse(token) {
        try {
            if (!token || typeof token !== 'string') {
                return null;
            }
            
            const parts = token.split('.');
            if (parts.length !== 3) {
                throw new Error('Invalid JWT format');
            }
            
            const payload = atob(parts[1]);
            return JSON.parse(payload);
        } catch (error) {
            console.warn('SecurityUtils: JWT parse failed', { 
                error: error.message 
            });
            return null;
        }
    }

    /**
     * Sanitize HTML content to prevent XSS
     * @param {string} str - HTML string to sanitize
     * @returns {string} Sanitized string
     */
    static sanitizeHTML(str) {
        if (!str || typeof str !== 'string') {
            return '';
        }
        
        // 🔥 ADVANCED XSS PROTECTION
        return str
            // Remove script tags completely
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            // Remove javascript: protocols
            .replace(/javascript:/gi, '')
            // Remove on* event handlers
            .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
            // Remove data: URLs that could contain scripts
            .replace(/data:\s*text\/html/gi, 'data:text/plain')
            // Remove potentially dangerous attributes
            .replace(/\s*(src|href)\s*=\s*["']?\s*javascript:/gi, '')
            // Escape HTML entities
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    /**
     * Safely set HTML content to prevent XSS
     * @param {HTMLElement} element - Target element
     * @param {string} content - Content to set
     */
    static safeSetHTML(element, content) {
        if (!element || !content) {
            return;
        }
        
        // Use textContent to prevent XSS
        element.textContent = content;
    }

    /**
     * Safely set innerHTML with basic sanitization
     * @param {HTMLElement} element - Target element  
     * @param {string} html - HTML content
     */
    static safeSetInnerHTML(element, html) {
        if (!element || !html) {
            return;
        }
        
        // Basic sanitization - remove script tags and event handlers
        const sanitized = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/\bon\w+\s*=\s*"[^"]*"/gi, '')
            .replace(/\bon\w+\s*=\s*'[^']*'/gi, '')
            .replace(/javascript:/gi, '');
            
        element.innerHTML = sanitized;
    }

    /**
     * Validate and sanitize user input
     * @param {string} input - User input
     * @param {object} options - Validation options
     * @returns {string} Sanitized input
     */
    static validateInput(input, options = {}) {
        if (!input || typeof input !== 'string') {
            return '';
        }
        
        const {
            maxLength = 1000,
            allowHTML = false,
            allowSpecialChars = true
        } = options;
        
        // Trim whitespace
        let sanitized = input.trim();
        
        // Limit length
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
        }
        
        // Remove HTML if not allowed
        if (!allowHTML) {
            sanitized = this.sanitizeHTML(sanitized);
        }
        
        // Remove special characters if not allowed
        if (!allowSpecialChars) {
            sanitized = sanitized.replace(/[^\w\s]/gi, '');
        }
        
        return sanitized;
    }

    /**
     * Secure localStorage operations
     */
    static secureStorage = {
        /**
         * Safely set item in localStorage
         * @param {string} key - Storage key
         * @param {any} value - Value to store
         * @returns {boolean} Success status
         */
        setItem(key, value) {
            try {
                if (!key || typeof key !== 'string') {
                    console.warn('SecurityUtils: Invalid storage key');
                    return false;
                }
                
                const serialized = JSON.stringify(value);
                localStorage.setItem(key, serialized);
                return true;
            } catch (error) {
                console.warn('SecurityUtils: Storage setItem failed', { 
                    key, 
                    error: error.message 
                });
                return false;
            }
        },

        /**
         * Safely get item from localStorage
         * @param {string} key - Storage key
         * @param {any} defaultValue - Default value if not found
         * @returns {any} Stored value or default
         */
        getItem(key, defaultValue = null) {
            try {
                if (!key || typeof key !== 'string') {
                    return defaultValue;
                }
                
                const item = localStorage.getItem(key);
                if (item === null) {
                    return defaultValue;
                }
                
                return SecurityUtils.safeJSONParse(item, defaultValue);
            } catch (error) {
                console.warn('SecurityUtils: Storage getItem failed', { 
                    key, 
                    error: error.message 
                });
                return defaultValue;
            }
        },

        /**
         * Remove item from localStorage
         * @param {string} key - Storage key
         */
        removeItem(key) {
            try {
                if (key && typeof key === 'string') {
                    localStorage.removeItem(key);
                }
            } catch (error) {
                console.warn('SecurityUtils: Storage removeItem failed', { 
                    key, 
                    error: error.message 
                });
            }
        },

        /**
         * Clear all localStorage (use with caution)
         */
        clear() {
            try {
                localStorage.clear();
            } catch (error) {
                console.warn('SecurityUtils: Storage clear failed', { 
                    error: error.message 
                });
            }
        }
    };

    /**
     * 🛡️ Safe element clearing - prevents XSS through innerHTML clearing
     * @param {HTMLElement} element - Element to clear
     */
    static safeClearElement(element) {
        if (!element || typeof element !== 'object') {
            console.warn('⚠️ SecurityUtils.safeClearElement: Invalid element provided');
            return;
        }

        try {
            // Remove all event listeners and child nodes safely
            while (element.firstChild) {
                element.removeChild(element.firstChild);
            }
            
            // Alternative safe clearing method
            element.textContent = '';
            
        } catch (error) {
            console.error('❌ SecurityUtils.safeClearElement failed:', error);
            // Fallback to innerHTML = '' if all else fails
            try {
                element.innerHTML = '';
            } catch (fallbackError) {
                console.error('❌ SecurityUtils.safeClearElement fallback failed:', fallbackError);
            }
        }
    }

    /**
     * Validate URL to prevent malicious redirects
     * @param {string} url - URL to validate
     * @returns {boolean} Is URL safe
     */
    static isValidURL(url) {
        try {
            if (!url || typeof url !== 'string') {
                return false;
            }
            
            const urlObj = new URL(url);
            
            // Only allow http and https protocols
            return ['http:', 'https:'].includes(urlObj.protocol);
        } catch (error) {
            return false;
        }
    }

    /**
     * Generate secure random string
     * @param {number} length - String length
     * @returns {string} Random string
     */
    static generateSecureRandom(length = 32) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * chars.length);
            result += chars[randomIndex];
        }
        
        return result;
    }

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} Is valid email
     */
    static isValidEmail(email) {
        if (!email || typeof email !== 'string') {
            return false;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim().toLowerCase());
    }

    /**
     * Validate password strength
     * @param {string} password - Password to validate
     * @returns {object} Validation result
     */
    static validatePassword(password) {
        const result = {
            isValid: false,
            score: 0,
            issues: []
        };
        
        if (!password || typeof password !== 'string') {
            result.issues.push('Password is required');
            return result;
        }
        
        // Check length
        if (password.length < 8) {
            result.issues.push('Password must be at least 8 characters long');
        } else {
            result.score += 1;
        }
        
        // Check for lowercase
        if (!/[a-z]/.test(password)) {
            result.issues.push('Password must contain lowercase letters');
        } else {
            result.score += 1;
        }
        
        // Check for uppercase
        if (!/[A-Z]/.test(password)) {
            result.issues.push('Password must contain uppercase letters');
        } else {
            result.score += 1;
        }
        
        // Check for numbers
        if (!/\d/.test(password)) {
            result.issues.push('Password must contain numbers');
        } else {
            result.score += 1;
        }
        
        // Check for special characters
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            result.issues.push('Password must contain special characters');
        } else {
            result.score += 1;
        }
        
        result.isValid = result.score >= 4 && result.issues.length === 0;
        return result;
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.SecurityUtils = SecurityUtils;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecurityUtils;
}
