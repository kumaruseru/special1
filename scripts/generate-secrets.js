#!/usr/bin/env node

/**
 * 🔐 CRYPTO SECRET GENERATOR - Special1
 * Generates cryptographically secure secrets for JWT and encryption
 */

const crypto = require('crypto');

class CryptoSecretGenerator {
    constructor() {
        this.log('🔐 Crypto Secret Generator for Special1', 'info');
        this.log('=' .repeat(50), 'info');
    }

    log(message, type = 'info') {
        const prefix = {
            'info': '💡',
            'success': '✅',
            'warning': '⚠️',
            'crypto': '🔐'
        };
        console.log(`${prefix[type]} ${message}`);
    }

    /**
     * Generate cryptographically secure random string
     * @param {number} length - Length of the secret
     * @param {boolean} alphanumeric - Use alphanumeric only (default: false)
     * @returns {string} - Secure random string
     */
    generateSecureSecret(length = 64, alphanumeric = false) {
        if (alphanumeric) {
            // Generate alphanumeric secret (Base62)
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let secret = '';
            
            for (let i = 0; i < length; i++) {
                const randomIndex = crypto.randomInt(0, chars.length);
                secret += chars[randomIndex];
            }
            
            return secret;
        } else {
            // Generate hex secret (more entropy)
            return crypto.randomBytes(length / 2).toString('hex');
        }
    }

    /**
     * Generate JWT secret with high entropy
     * @returns {string} - Secure JWT secret
     */
    generateJWTSecret() {
        // Combine multiple entropy sources for maximum security
        const timestamp = Date.now().toString(36);
        const randomHex = crypto.randomBytes(32).toString('hex');
        const randomBase64 = crypto.randomBytes(24).toString('base64').replace(/[+/=]/g, '');
        
        // Create a complex secret combining different formats
        const complexSecret = `${randomHex}${timestamp}${randomBase64}`;
        
        // Hash the combination for final secret (ensures fixed length and high entropy)
        return crypto.createHash('sha256').update(complexSecret).digest('hex');
    }

    /**
     * Generate encryption key (exactly 32 characters for AES-256)
     * @returns {string} - 32-character encryption key
     */
    generateEncryptionKey() {
        return crypto.randomBytes(16).toString('hex'); // 32 hex characters
    }

    /**
     * Generate session secret
     * @returns {string} - Session secret
     */
    generateSessionSecret() {
        return this.generateSecureSecret(48, true); // 48 alphanumeric characters
    }

    /**
     * Generate database password
     * @returns {string} - Strong database password
     */
    generateDatabasePassword() {
        const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const allChars = letters + numbers + symbols;
        
        let password = '';
        
        // Ensure at least one character from each type
        password += letters[crypto.randomInt(0, letters.length)];
        password += numbers[crypto.randomInt(0, numbers.length)];
        password += symbols[crypto.randomInt(0, symbols.length)];
        
        // Fill the rest (total 20 characters)
        for (let i = 3; i < 20; i++) {
            password += allChars[crypto.randomInt(0, allChars.length)];
        }
        
        // Shuffle the password
        return password.split('').sort(() => crypto.randomInt(-1, 2)).join('');
    }

    /**
     * Validate secret strength
     * @param {string} secret - Secret to validate
     * @returns {object} - Validation result
     */
    validateSecretStrength(secret) {
        const checks = {
            length: secret.length >= 32,
            entropy: this.calculateEntropy(secret) >= 4.0,
            mixed: /[A-Z]/.test(secret) && /[a-z]/.test(secret) && /[0-9]/.test(secret),
            noCommon: !this.isCommonSecret(secret)
        };
        
        const passed = Object.values(checks).filter(Boolean).length;
        const strength = passed === 4 ? 'EXCELLENT' : 
                        passed === 3 ? 'GOOD' : 
                        passed === 2 ? 'FAIR' : 'WEAK';
        
        return {
            strength,
            score: Math.round((passed / 4) * 100),
            checks,
            passed: passed === 4
        };
    }

    /**
     * Calculate entropy of a string
     * @param {string} str - String to analyze
     * @returns {number} - Entropy value
     */
    calculateEntropy(str) {
        const freq = {};
        for (const char of str) {
            freq[char] = (freq[char] || 0) + 1;
        }
        
        let entropy = 0;
        const len = str.length;
        
        for (const count of Object.values(freq)) {
            const p = count / len;
            entropy -= p * Math.log2(p);
        }
        
        return entropy;
    }

    /**
     * Check if secret is commonly used
     * @param {string} secret - Secret to check
     * @returns {boolean} - True if common
     */
    isCommonSecret(secret) {
        const commonSecrets = [
            'default_secret',
            'secret',
            'password',
            'admin',
            'jwt_secret',
            '123456',
            'secret123',
            'your_jwt_secret_here'
        ];
        
        return commonSecrets.some(common => 
            secret.toLowerCase().includes(common.toLowerCase())
        );
    }

    /**
     * Generate all required secrets for Special1
     */
    generateAllSecrets() {
        this.log('Generating cryptographically secure secrets...', 'crypto');
        
        const secrets = {
            JWT_SECRET: this.generateJWTSecret(),
            ENCRYPTION_KEY: this.generateEncryptionKey(),
            SESSION_SECRET: this.generateSessionSecret(),
            DB_PASSWORD: this.generateDatabasePassword(),
            API_KEY: this.generateSecureSecret(40, true),
            REFRESH_TOKEN_SECRET: this.generateJWTSecret()
        };

        this.log('\n🔐 GENERATED SECRETS:', 'crypto');
        this.log('=' .repeat(70), 'info');

        // Display secrets with validation
        for (const [name, secret] of Object.entries(secrets)) {
            const validation = this.validateSecretStrength(secret);
            this.log(`\n${name}:`, 'info');
            this.log(`${secret}`, 'success');
            this.log(`Length: ${secret.length} | Strength: ${validation.strength} (${validation.score}%)`, 
                validation.passed ? 'success' : 'warning');
        }

        this.log('\n🛡️ SECURITY VALIDATION:', 'crypto');
        this.log('=' .repeat(50), 'info');
        
        let allValid = true;
        for (const [name, secret] of Object.entries(secrets)) {
            const validation = this.validateSecretStrength(secret);
            if (validation.passed) {
                this.log(`✅ ${name}: ${validation.strength}`, 'success');
            } else {
                this.log(`❌ ${name}: ${validation.strength}`, 'warning');
                allValid = false;
            }
        }

        if (allValid) {
            this.log('\n🎉 All secrets meet security requirements!', 'success');
        } else {
            this.log('\n⚠️ Some secrets need regeneration', 'warning');
        }

        // Generate .env template
        this.generateEnvTemplate(secrets);
        
        return secrets;
    }

    /**
     * Generate .env template with generated secrets
     */
    generateEnvTemplate(secrets) {
        const envTemplate = `# 🔐 SPECIAL1 - PRODUCTION ENVIRONMENT CONFIGURATION
# Generated on: ${new Date().toISOString()}
# Security Level: ENTERPRISE GRADE

# ================================
# 🛡️ SECURITY CONFIGURATION
# ================================

# JWT Authentication (REQUIRED - 64 characters hex)
JWT_SECRET=${secrets.JWT_SECRET}

# AES Encryption Key (REQUIRED - exactly 32 characters)
ENCRYPTION_KEY=${secrets.ENCRYPTION_KEY}

# Session Management (RECOMMENDED)
SESSION_SECRET=${secrets.SESSION_SECRET}

# Refresh Token Secret (RECOMMENDED)
REFRESH_TOKEN_SECRET=${secrets.REFRESH_TOKEN_SECRET}

# API Security (OPTIONAL)
API_KEY=${secrets.API_KEY}

# ================================
# 🚀 APPLICATION CONFIGURATION
# ================================

# Environment
NODE_ENV=production

# Server Configuration
PORT=3000
HOST=localhost

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# ================================
# 🗄️ DATABASE CONFIGURATION
# ================================

# MongoDB
MONGODB_URI=mongodb://localhost:27017/special1
MONGODB_USER=special1_user
MONGODB_PASSWORD=${secrets.DB_PASSWORD}

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=special1
POSTGRES_USER=special1_user
POSTGRES_PASSWORD=${secrets.DB_PASSWORD}

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=${secrets.DB_PASSWORD}

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=${secrets.DB_PASSWORD}

# ================================
# 📧 EMAIL CONFIGURATION
# ================================

# SMTP Settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Email Templates
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=Special1 Team

# ================================
# 🔧 LOGGING & MONITORING
# ================================

# Logging
LOG_LEVEL=warn
LOG_FILE=logs/app.log
LOG_MAX_SIZE=10mb
LOG_MAX_FILES=5

# Health Check
HEALTH_CHECK_INTERVAL=30000

# ================================
# 🔒 SECURITY HEADERS
# ================================

# CSP Configuration
CSP_DEFAULT_SRC="'self'"
CSP_SCRIPT_SRC="'self' 'unsafe-inline' https://cdn.tailwindcss.com"
CSP_STYLE_SRC="'self' 'unsafe-inline' https://fonts.googleapis.com"

# ================================
# ⚠️ SECURITY WARNINGS
# ================================

# 🚨 IMPORTANT SECURITY NOTES:
# 1. Never commit this file to version control
# 2. Keep secrets secure and rotate regularly
# 3. Use different secrets for different environments
# 4. Monitor for unauthorized access attempts
# 5. Enable audit logging in production

# 📋 SECURITY CHECKLIST:
# □ JWT_SECRET is unique and 64+ characters
# □ ENCRYPTION_KEY is exactly 32 characters
# □ Database passwords are strong and unique
# □ CORS_ORIGIN matches your domain
# □ Rate limiting is configured appropriately
# □ Logging is enabled for security monitoring
`;

        const fs = require('fs');
        const path = require('path');
        
        try {
            fs.writeFileSync(path.join(__dirname, '../.env.secure'), envTemplate);
            this.log('\n📄 Generated .env.secure file with all secrets', 'success');
            this.log('⚠️ Copy .env.secure to .env and customize as needed', 'warning');
            this.log('🔒 Keep this file secure and never commit to version control', 'warning');
        } catch (error) {
            this.log(`\n❌ Failed to write .env file: ${error.message}`, 'warning');
        }
    }

    /**
     * Quick JWT secret generation (for command line usage)
     */
    quickJWTSecret() {
        const secret = this.generateJWTSecret();
        const validation = this.validateSecretStrength(secret);
        
        this.log('🔐 QUICK JWT SECRET GENERATION', 'crypto');
        this.log('=' .repeat(50), 'info');
        this.log(`\nJWT_SECRET=${secret}`, 'success');
        this.log(`\nLength: ${secret.length} characters`, 'info');
        this.log(`Strength: ${validation.strength} (${validation.score}%)`, 
            validation.passed ? 'success' : 'warning');
        this.log(`Entropy: ${this.calculateEntropy(secret).toFixed(2)} bits per character`, 'info');
        
        if (validation.passed) {
            this.log('\n✅ Secret meets security requirements!', 'success');
            this.log('🔒 Copy the JWT_SECRET value to your .env file', 'info');
        } else {
            this.log('\n⚠️ Regenerating for better security...', 'warning');
            return this.quickJWTSecret(); // Regenerate if not strong enough
        }
        
        return secret;
    }
}

// Command line interface
if (require.main === module) {
    const generator = new CryptoSecretGenerator();
    
    const args = process.argv.slice(2);
    
    if (args.includes('--jwt-only') || args.includes('-j')) {
        generator.quickJWTSecret();
    } else {
        generator.generateAllSecrets();
    }
}

module.exports = CryptoSecretGenerator;
