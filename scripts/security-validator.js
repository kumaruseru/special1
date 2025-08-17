#!/usr/bin/env node

/**
 * Security Validation Script for Special1
 * Checks for common security vulnerabilities before deployment
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SecurityValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.passed = [];
        this.projectRoot = process.cwd();
    }

    async runAllChecks() {
        console.log('🔒 Running Special1 Security Validation...\n');

        // Environment checks
        this.checkEnvironmentVariables();
        this.checkJWTSecret();
        this.checkFilePermissions();
        
        // Code security checks
        await this.checkXSSVulnerabilities();
        await this.checkSQLInjection();
        await this.checkUnsafeJSONParsing();
        await this.checkHardcodedSecrets();
        
        // Configuration checks
        this.checkSecurityHeaders();
        this.checkCORSConfiguration();
        
        // Dependencies check
        await this.checkDependencyVulnerabilities();

        // Display results
        this.displayResults();
        
        // Exit with appropriate code
        const hasErrors = this.errors.length > 0;
        process.exit(hasErrors ? 1 : 0);
    }

    checkEnvironmentVariables() {
        console.log('🔍 Checking environment variables...');
        
        const requiredVars = [
            'JWT_SECRET',
            'MONGODB_URI',
            'NODE_ENV'
        ];

        const criticalVars = [
            'JWT_SECRET',
            'ENCRYPTION_KEY'
        ];

        let allPresent = true;

        requiredVars.forEach(varName => {
            if (!process.env[varName]) {
                this.errors.push(`Missing required environment variable: ${varName}`);
                allPresent = false;
            }
        });

        criticalVars.forEach(varName => {
            if (process.env[varName] && process.env[varName].includes('default')) {
                this.errors.push(`Security risk: ${varName} contains 'default' value`);
            }
        });

        if (allPresent) {
            this.passed.push('Required environment variables present');
        }
    }

    checkJWTSecret() {
        console.log('🔍 Checking JWT secret security...');
        
        const jwtSecret = process.env.JWT_SECRET;
        
        if (!jwtSecret) {
            this.errors.push('JWT_SECRET is not set');
            return;
        }

        if (jwtSecret === 'default_secret') {
            this.errors.push('CRITICAL: JWT_SECRET is using default value');
            return;
        }

        if (jwtSecret.length < 32) {
            this.errors.push(`JWT_SECRET too short: ${jwtSecret.length} chars (minimum 32)`);
            return;
        }

        if (jwtSecret.includes('your-') || jwtSecret.includes('change-')) {
            this.warnings.push('JWT_SECRET appears to be a template value');
        }

        // Check entropy
        const entropy = this.calculateEntropy(jwtSecret);
        if (entropy < 4.0) {
            this.warnings.push(`JWT_SECRET has low entropy: ${entropy.toFixed(2)} (recommend > 4.0)`);
        }

        this.passed.push('JWT_SECRET appears secure');
    }

    checkFilePermissions() {
        console.log('🔍 Checking file permissions...');
        
        const sensitiveFiles = [
            '.env',
            '.env.local',
            '.env.production',
            'server.js',
            'config/email.js'
        ];

        sensitiveFiles.forEach(filePath => {
            if (fs.existsSync(filePath)) {
                try {
                    const stats = fs.statSync(filePath);
                    const mode = stats.mode;
                    
                    // Check if file is world-readable (dangerous)
                    if (mode & parseInt('004', 8)) {
                        this.warnings.push(`File ${filePath} is world-readable`);
                    }
                    
                    // Check if file is world-writable (very dangerous)
                    if (mode & parseInt('002', 8)) {
                        this.errors.push(`File ${filePath} is world-writable`);
                    }
                } catch (error) {
                    this.warnings.push(`Could not check permissions for ${filePath}`);
                }
            }
        });

        this.passed.push('File permissions checked');
    }

    async checkXSSVulnerabilities() {
        console.log('🔍 Checking for XSS vulnerabilities...');
        
        const jsFiles = this.findJSFiles();
        let xssFound = false;

        for (const filePath of jsFiles) {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check for dangerous innerHTML usage
            const dangerousPatterns = [
                /\.innerHTML\s*=\s*[^;]+\$\{[^}]+\}/g,
                /\.innerHTML\s*=\s*.*\+.*user/gi,
                /document\.write\s*\(/g,
                /eval\s*\(/g
            ];

            dangerousPatterns.forEach((pattern, index) => {
                const matches = content.match(pattern);
                if (matches) {
                    matches.forEach(match => {
                        this.errors.push(`XSS vulnerability in ${filePath}: ${match.substring(0, 50)}...`);
                        xssFound = true;
                    });
                }
            });
        }

        if (!xssFound) {
            this.passed.push('No obvious XSS vulnerabilities found');
        }
    }

    async checkUnsafeJSONParsing() {
        console.log('🔍 Checking for unsafe JSON parsing...');
        
        const jsFiles = this.findJSFiles();
        let unsafeFound = false;

        for (const filePath of jsFiles) {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check for JSON.parse without try-catch
            const lines = content.split('\n');
            lines.forEach((line, index) => {
                if (line.includes('JSON.parse(') && 
                    !line.includes('try') && 
                    !this.isInTryCatch(content, index)) {
                    this.warnings.push(`Unsafe JSON.parse in ${filePath}:${index + 1}`);
                    unsafeFound = true;
                }
            });
        }

        if (!unsafeFound) {
            this.passed.push('JSON parsing appears safe');
        }
    }

    async checkHardcodedSecrets() {
        console.log('🔍 Checking for hardcoded secrets...');
        
        const files = [...this.findJSFiles(), ...this.findConfigFiles()];
        let secretsFound = false;

        const secretPatterns = [
            /password\s*[:=]\s*['""][^'"]+['"]/gi,
            /secret\s*[:=]\s*['""][^'"]+['"]/gi,
            /key\s*[:=]\s*['""][^'"]+['"]/gi,
            /token\s*[:=]\s*['""][^'"]+['"]/gi,
            /api[_-]?key\s*[:=]\s*['""][^'"]+['"]/gi
        ];

        for (const filePath of files) {
            const content = fs.readFileSync(filePath, 'utf8');
            
            secretPatterns.forEach(pattern => {
                const matches = content.match(pattern);
                if (matches) {
                    matches.forEach(match => {
                        // Skip obvious template values
                        if (!match.includes('your-') && 
                            !match.includes('change-') &&
                            !match.includes('xxx') &&
                            !match.includes('***')) {
                            this.warnings.push(`Possible hardcoded secret in ${filePath}: ${match.substring(0, 30)}...`);
                            secretsFound = true;
                        }
                    });
                }
            });
        }

        if (!secretsFound) {
            this.passed.push('No hardcoded secrets found');
        }
    }

    checkSecurityHeaders() {
        console.log('🔍 Checking security headers configuration...');
        
        const serverPath = path.join(this.projectRoot, 'server.js');
        if (!fs.existsSync(serverPath)) {
            this.warnings.push('server.js not found for security headers check');
            return;
        }

        const serverContent = fs.readFileSync(serverPath, 'utf8');
        
        const requiredHeaders = [
            'helmet',
            'contentSecurityPolicy',
            'X-Frame-Options',
            'X-Content-Type-Options'
        ];

        let headersFound = 0;
        requiredHeaders.forEach(header => {
            if (serverContent.includes(header)) {
                headersFound++;
            }
        });

        if (headersFound >= 2) {
            this.passed.push('Security headers configured');
        } else {
            this.warnings.push('Security headers may not be properly configured');
        }
    }

    checkCORSConfiguration() {
        console.log('🔍 Checking CORS configuration...');
        
        const serverPath = path.join(this.projectRoot, 'server.js');
        if (!fs.existsSync(serverPath)) {
            return;
        }

        const serverContent = fs.readFileSync(serverPath, 'utf8');
        
        if (serverContent.includes('origin: "*"')) {
            this.warnings.push('CORS configured to allow all origins (*)');
        } else if (serverContent.includes('cors')) {
            this.passed.push('CORS appears to be configured');
        } else {
            this.warnings.push('CORS configuration not found');
        }
    }

    async checkDependencyVulnerabilities() {
        console.log('🔍 Checking dependency vulnerabilities...');
        
        try {
            const { execSync } = require('child_process');
            const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
            const audit = JSON.parse(auditResult);
            
            if (audit.metadata.vulnerabilities.total > 0) {
                const high = audit.metadata.vulnerabilities.high || 0;
                const critical = audit.metadata.vulnerabilities.critical || 0;
                
                if (critical > 0) {
                    this.errors.push(`${critical} critical vulnerability(ies) in dependencies`);
                }
                if (high > 0) {
                    this.warnings.push(`${high} high severity vulnerability(ies) in dependencies`);
                }
            } else {
                this.passed.push('No dependency vulnerabilities found');
            }
        } catch (error) {
            this.warnings.push('Could not check dependency vulnerabilities');
        }
    }

    // Helper methods
    findJSFiles() {
        const jsFiles = [];
        const searchPaths = ['assets/js', 'config', '.'];
        
        searchPaths.forEach(searchPath => {
            if (fs.existsSync(searchPath)) {
                const files = fs.readdirSync(searchPath);
                files.forEach(file => {
                    if (file.endsWith('.js')) {
                        jsFiles.push(path.join(searchPath, file));
                    }
                });
            }
        });
        
        return jsFiles;
    }

    findConfigFiles() {
        const configFiles = [];
        const patterns = ['.env*', '*.json', '*.yml', '*.yaml'];
        
        patterns.forEach(pattern => {
            try {
                const files = fs.readdirSync('.').filter(file => 
                    file.match(pattern.replace('*', '.*'))
                );
                configFiles.push(...files);
            } catch (error) {
                // Ignore errors
            }
        });
        
        return configFiles;
    }

    isInTryCatch(content, lineIndex) {
        const lines = content.split('\n');
        
        // Look backwards for try statement
        for (let i = lineIndex; i >= 0; i--) {
            if (lines[i].trim().includes('try {')) {
                return true;
            }
            if (lines[i].trim().includes('catch') || 
                lines[i].trim().includes('function')) {
                break;
            }
        }
        
        return false;
    }

    calculateEntropy(str) {
        const freq = {};
        str.split('').forEach(char => {
            freq[char] = (freq[char] || 0) + 1;
        });
        
        let entropy = 0;
        const len = str.length;
        
        Object.values(freq).forEach(count => {
            const p = count / len;
            entropy -= p * Math.log2(p);
        });
        
        return entropy;
    }

    displayResults() {
        console.log('\n' + '='.repeat(60));
        console.log('🔒 SECURITY VALIDATION RESULTS');
        console.log('='.repeat(60));
        
        if (this.errors.length > 0) {
            console.log('\n❌ CRITICAL ISSUES (Must fix before deployment):');
            this.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error}`);
            });
        }
        
        if (this.warnings.length > 0) {
            console.log('\n⚠️  WARNINGS (Should fix soon):');
            this.warnings.forEach((warning, index) => {
                console.log(`${index + 1}. ${warning}`);
            });
        }
        
        if (this.passed.length > 0) {
            console.log('\n✅ PASSED CHECKS:');
            this.passed.forEach((pass, index) => {
                console.log(`${index + 1}. ${pass}`);
            });
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(`Summary: ${this.passed.length} passed, ${this.warnings.length} warnings, ${this.errors.length} errors`);
        
        if (this.errors.length === 0) {
            console.log('🎉 Security validation PASSED! Safe for deployment.');
        } else {
            console.log('🚨 Security validation FAILED! Fix critical issues before deployment.');
        }
        console.log('='.repeat(60));
    }
}

// Run validation if this script is executed directly
if (require.main === module) {
    const validator = new SecurityValidator();
    validator.runAllChecks();
}

module.exports = SecurityValidator;
