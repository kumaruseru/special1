#!/usr/bin/env node

/**
 * 🔐 Secure JWT Secret Test Runner
 * Kiểm tra JWT_SECRET từ .env file một cách an toàn
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env.production
function loadEnvFile(envPath) {
    if (!fs.existsSync(envPath)) {
        console.log(`❌ Environment file not found: ${envPath}`);
        return false;
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [key, ...valueParts] = trimmed.split('=');
            const value = valueParts.join('=');
            process.env[key.trim()] = value.trim();
        }
    }
    
    return true;
}

console.log('🔐 Secure JWT Secret Validation Runner');
console.log('=====================================\n');

// Load production environment
const envPath = path.join(__dirname, '../.env.production');
const envLoaded = loadEnvFile(envPath);

if (!envLoaded) {
    console.log('💡 Please ensure .env.production exists in project root');
    process.exit(1);
}

// Check if JWT_SECRET is loaded
if (!process.env.JWT_SECRET) {
    console.log('❌ JWT_SECRET not found in .env.production');
    console.log('💡 Please add JWT_SECRET to your .env.production file');
    process.exit(1);
}

console.log('✅ Environment loaded successfully');
console.log('✅ JWT_SECRET found in environment');
console.log(`📄 Testing secret from: ${envPath}\n`);

// Run the validation
require('./validate-jwt-secret.js');
