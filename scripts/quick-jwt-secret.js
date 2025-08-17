#!/usr/bin/env node

/**
 * 🔐 Quick JWT Secret Generator
 * Tạo JWT_SECRET mạnh cho production
 */

const crypto = require('crypto');

// Tạo JWT Secret 256-bit mạnh
function generateStrongJWTSecret() {
    // Base64URL encoding cho JWT standard compatibility
    const randomBytes = crypto.randomBytes(64); // 512 bits
    const base64Secret = randomBytes.toString('base64url');
    
    // Thêm timestamp để đảm bảo unique
    const timestamp = Date.now().toString(36);
    const mixedSecret = base64Secret + timestamp;
    
    // Hash để có độ dài cố định và entropy cao
    const finalSecret = crypto.createHash('sha256')
        .update(mixedSecret + crypto.randomUUID())
        .digest('hex');
    
    return finalSecret;
}

// Tạo encryption key
function generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex'); // 256-bit AES key
}

// Tạo session secret
function generateSessionSecret() {
    return crypto.randomBytes(64).toString('base64url');
}

// Validate strength
function validateSecret(secret) {
    const length = secret.length;
    const hasNumbers = /[0-9]/.test(secret);
    const hasLowercase = /[a-z]/.test(secret);
    const hasUppercase = /[A-Z]/.test(secret);
    const hasSpecial = /[^a-zA-Z0-9]/.test(secret);
    
    let score = 0;
    if (length >= 32) score += 25;
    if (length >= 64) score += 25;
    if (hasNumbers) score += 15;
    if (hasLowercase) score += 10;
    if (hasUppercase) score += 10;
    if (hasSpecial) score += 15;
    
    return {
        score,
        level: score >= 80 ? 'EXCELLENT' : score >= 60 ? 'GOOD' : 'FAIR'
    };
}

console.log('🔐 Enterprise JWT Secret Generator');
console.log('==================================\n');

// Generate secrets
const jwtSecret = generateStrongJWTSecret();
const encryptionKey = generateEncryptionKey();
const sessionSecret = generateSessionSecret();

// Validate
const jwtValidation = validateSecret(jwtSecret);

console.log('✅ JWT_SECRET Generated:');
console.log(`${jwtSecret}\n`);

console.log('📊 Security Analysis:');
console.log(`   Length: ${jwtSecret.length} characters`);
console.log(`   Strength: ${jwtValidation.level} (${jwtValidation.score}%)`);
console.log(`   Entropy: ~${(jwtSecret.length * 4).toFixed(1)} bits\n`);

console.log('🔑 Additional Secrets:');
console.log(`ENCRYPTION_KEY=${encryptionKey}`);
console.log(`SESSION_SECRET=${sessionSecret}\n`);

console.log('💾 .env Production Template:');
console.log('============================');
console.log(`# JWT Configuration`);
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`JWT_EXPIRES_IN=7d`);
console.log(`\n# Encryption`);
console.log(`ENCRYPTION_KEY=${encryptionKey}`);
console.log(`\n# Session Management`);
console.log(`SESSION_SECRET=${sessionSecret}`);
console.log(`SESSION_MAX_AGE=86400000`);
console.log(`\n# Security Headers`);
console.log(`BCRYPT_ROUNDS=12`);
console.log(`RATE_LIMIT_WINDOW=900000`);
console.log(`RATE_LIMIT_MAX=100`);

console.log('\n🚀 Ready for Production Deployment!');
