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
        
        // Length scoring
        if (secret.length >= 64) score += 40;
        else if (secret.length >= 48) score += 30;
        else if (secret.length >= 32) score += 20;
        
        // Character diversity
        const hasLower = /[a-z]/.test(secret);
        const hasUpper = /[A-Z]/.test(secret);
        const hasNumbers = /[0-9]/.test(secret);
        const hasSpecial = /[^a-zA-Z0-9]/.test(secret);
        
        if (hasLower) score += 10;
        if (hasUpper) score += 10;
        if (hasNumbers) score += 15;
        if (hasSpecial) score += 15;
        
        // Entropy estimation
        const uniqueChars = [...new Set(secret)].length;
        const entropyScore = (uniqueChars / secret.length) * 10;
        score += Math.min(entropyScore, 10);
        
        // Common patterns check
        if (/(.)\1{2,}/.test(secret)) {
            issues.push('Contains repeated characters');
            score -= 10;
        }
        
        if (/123|abc|password|secret|admin/i.test(secret)) {
            issues.push('Contains common patterns');
            score -= 20;
        }
        
        let level;
        if (score >= 85) level = 'EXCELLENT';
        else if (score >= 70) level = 'GOOD';
        else if (score >= 50) level = 'FAIR';
        else level = 'WEAK';
        
        return { score: Math.max(0, score), level, issues };
    }
    
    static testProductionSecret() {
        console.log('🔐 JWT Secret Security Validation');
        console.log('================================\n');
        
        // Test current production secret
        const prodSecret = 'f3d63f2338c852ca392f1dfa56f725ed0a57ba6e484f0fd419412122287725d4dd0b7381852c6940a2f54fe1da0cc52152465d921a6b734c449bee536cb3a1c5b3e089fc674a4067b9c111e35de787d5I3WDxvdEBiW6o4l0y5TqEZfM6vSxiVp_g_LPtfZkirA';
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
