#!/usr/bin/env node

/**
 * 🔐 JWT Secret Validation Test
 * Kiểm tra độ mạnh của JWT_SECRET
 */

const fs = require('fs');
const path = require('path');

class JWTSecretValidator {
    static validateStrength(secret) {
        if (!secret || secret.length < 32) {
            return { score: 0, level: 'WEAK', issues: ['Too short (< 32 chars)'] };
        }

        let score = 0;
        const issues = [];
        
        // Length scoring - enhanced for 100%
        if (secret.length >= 128) score += 40;
        else if (secret.length >= 64) score += 30;
        else if (secret.length >= 48) score += 25;
        else if (secret.length >= 32) score += 20;
        
        // Character diversity - enhanced
        const hasLower = /[a-z]/.test(secret);
        const hasUpper = /[A-Z]/.test(secret);
        const hasNumbers = /[0-9]/.test(secret);
        const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(secret);
        
        if (hasLower) score += 15;
        if (hasUpper) score += 15;
        if (hasNumbers) score += 15;
        if (hasSpecial) score += 15;
        
        // Perfect entropy bonus
        const uniqueChars = [...new Set(secret)].length;
        const entropyRatio = uniqueChars / secret.length;
        if (entropyRatio >= 0.5) score += 10;
        else if (entropyRatio >= 0.3) score += 5;
        
        // No common patterns
        if (!/123|abc|password|secret|admin|test|user/i.test(secret)) {
            score += 10;
        } else {
            issues.push('Contains common patterns');
            score -= 20;
        }
        
        let level;
        if (score >= 100) level = 'PERFECT';
        else if (score >= 85) level = 'EXCELLENT';
        else if (score >= 70) level = 'GOOD';
        else if (score >= 50) level = 'FAIR';
        else level = 'WEAK';
        
        return { score: Math.min(100, Math.max(0, score)), level, issues };
    }
    
    static testProductionSecret() {
        console.log('🔐 JWT Secret Security Validation');
        console.log('================================\n');
        
        // Test JWT_SECRET from environment variable (secure)
        const prodSecret = process.env.JWT_SECRET || '';
        
        if (!prodSecret) {
            console.log('❌ JWT_SECRET not found in environment variables');
            console.log('💡 Please set JWT_SECRET environment variable');
            console.log('💡 Example: JWT_SECRET=your_secret_here node validate-jwt-secret.js');
            return false;
        }
        
        const validation = this.validateStrength(prodSecret);
        
        console.log('✅ Production JWT_SECRET Analysis:');
        console.log(`   Secret: ${prodSecret.substring(0, 16)}...${prodSecret.substring(-8)}`);
        console.log(`   Length: ${prodSecret.length} characters`);
        console.log(`   Strength: ${validation.level} (${validation.score}%)`);
        console.log(`   Entropy: ~${(prodSecret.length * 4)} bits`);
        
        if (validation.issues.length > 0) {
            console.log('⚠️  Issues found:');
            validation.issues.forEach(issue => console.log(`   - ${issue}`));
        } else {
            console.log('✅ No security issues detected');
        }
        
        console.log('\n📋 Security Recommendations:');
        if (validation.score >= 80) {
            console.log('✅ Secret meets enterprise security standards');
            console.log('✅ Safe for production deployment');
        } else {
            console.log('⚠️  Consider regenerating with stronger parameters');
        }
        
        console.log('\n🔒 Additional Security Notes:');
        console.log('   - Rotate JWT secrets every 90 days');
        console.log('   - Store secrets in secure environment variables');
        console.log('   - Never commit secrets to version control');
        console.log('   - Use different secrets for dev/staging/production');
        
        return validation.score >= 80;
    }
}

// Run validation
const isSecure = JWTSecretValidator.testProductionSecret();
process.exit(isSecure ? 0 : 1);
