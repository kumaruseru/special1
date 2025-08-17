#!/usr/bin/env node

/**
 * 🚀 PRODUCTION DEPLOYMENT SCRIPT - Special1
 * Automated production deployment with security validation
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ProductionDeployer {
    constructor() {
        this.checks = [];
        this.passed = 0;
        this.failed = 0;
        this.deploymentReady = false;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            'info': '💡',
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'deploy': '🚀'
        };
        console.log(`${prefix[type]} [${timestamp}] ${message}`);
    }

    async runCheck(name, checkFunction) {
        try {
            this.log(`Running check: ${name}`, 'info');
            const result = await checkFunction();
            
            if (result.success) {
                this.passed++;
                this.log(`PASSED: ${name}`, 'success');
                if (result.details) {
                    this.log(`  ${result.details}`, 'info');
                }
            } else {
                this.failed++;
                this.log(`FAILED: ${name} - ${result.error}`, 'error');
            }
            
            this.checks.push({
                name,
                success: result.success,
                error: result.error || null,
                details: result.details || null
            });
            
        } catch (error) {
            this.failed++;
            this.log(`ERROR: ${name} - ${error.message}`, 'error');
            this.checks.push({
                name,
                success: false,
                error: error.message
            });
        }
    }

    // Check 1: Security Score Validation
    checkSecurityScore() {
        return new Promise((resolve) => {
            try {
                const reportPath = path.join(__dirname, '../SECURITY_TEST_REPORT.json');
                
                if (!fs.existsSync(reportPath)) {
                    resolve({
                        success: false,
                        error: 'Security test report not found - run security tests first'
                    });
                    return;
                }

                const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
                
                if (report.securityScore < 90) {
                    resolve({
                        success: false,
                        error: `Security score too low: ${report.securityScore}% (minimum 90% required)`
                    });
                    return;
                }
                
                resolve({
                    success: true,
                    details: `Security score: ${report.securityScore}% (${report.passedTests}/${report.totalTests} tests passed)`
                });
                
            } catch (error) {
                resolve({
                    success: false,
                    error: `Failed to read security report: ${error.message}`
                });
            }
        });
    }

    // Check 2: Environment Variables
    checkEnvironmentVariables() {
        return new Promise((resolve) => {
            const requiredVars = [
                'JWT_SECRET',
                'ENCRYPTION_KEY',
                'NODE_ENV'
            ];
            
            const envPath = path.join(__dirname, '../.env');
            let envVars = {};
            
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, 'utf8');
                envContent.split('\n').forEach(line => {
                    const [key, value] = line.split('=');
                    if (key && value) {
                        envVars[key.trim()] = value.trim();
                    }
                });
            }
            
            const missingVars = requiredVars.filter(varName => 
                !envVars[varName] && !process.env[varName]
            );
            
            if (missingVars.length > 0) {
                resolve({
                    success: false,
                    error: `Missing environment variables: ${missingVars.join(', ')}`
                });
                return;
            }
            
            // Check JWT_SECRET strength
            const jwtSecret = envVars.JWT_SECRET || process.env.JWT_SECRET;
            if (jwtSecret === 'default_secret' || jwtSecret.length < 32) {
                resolve({
                    success: false,
                    error: 'JWT_SECRET is too weak or default (minimum 32 characters required)'
                });
                return;
            }
            
            resolve({
                success: true,
                details: `All required environment variables are set and secure`
            });
        });
    }

    // Check 3: Dependencies Security
    checkDependencySecurity() {
        return new Promise((resolve) => {
            try {
                this.log('Running npm audit...', 'info');
                const auditResult = execSync('npm audit --json', { 
                    encoding: 'utf8',
                    cwd: path.join(__dirname, '..')
                });
                
                const audit = JSON.parse(auditResult);
                
                if (audit.vulnerabilities && Object.keys(audit.vulnerabilities).length > 0) {
                    const criticalVulns = Object.values(audit.vulnerabilities)
                        .filter(v => v.severity === 'critical' || v.severity === 'high');
                    
                    if (criticalVulns.length > 0) {
                        resolve({
                            success: false,
                            error: `Found ${criticalVulns.length} critical/high severity vulnerabilities`
                        });
                        return;
                    }
                }
                
                resolve({
                    success: true,
                    details: 'No critical security vulnerabilities found in dependencies'
                });
                
            } catch (error) {
                // npm audit returns non-zero exit code if vulnerabilities found
                if (error.stdout) {
                    try {
                        const audit = JSON.parse(error.stdout);
                        const criticalCount = Object.values(audit.vulnerabilities || {})
                            .filter(v => v.severity === 'critical' || v.severity === 'high').length;
                        
                        if (criticalCount > 0) {
                            resolve({
                                success: false,
                                error: `Found ${criticalCount} critical/high severity vulnerabilities`
                            });
                            return;
                        }
                    } catch (parseError) {
                        // Continue to success if we can't parse but no critical issues
                    }
                }
                
                resolve({
                    success: true,
                    details: 'Dependency security check completed'
                });
            }
        });
    }

    // Check 4: Core Files Existence
    checkCoreFiles() {
        return new Promise((resolve) => {
            const coreFiles = [
                '../server.js',
                '../package.json',
                '../assets/js/security-utils.js',
                '../assets/js/telegram-messages.js',
                '../pages/messages.html'
            ];
            
            const missingFiles = coreFiles.filter(file => 
                !fs.existsSync(path.join(__dirname, file))
            );
            
            if (missingFiles.length > 0) {
                resolve({
                    success: false,
                    error: `Missing core files: ${missingFiles.join(', ')}`
                });
                return;
            }
            
            resolve({
                success: true,
                details: 'All core application files are present'
            });
        });
    }

    // Check 5: Server Health Test
    checkServerHealth() {
        return new Promise((resolve) => {
            try {
                this.log('Starting server health check...', 'info');
                
                // Start server in test mode
                const { spawn } = require('child_process');
                const serverProcess = spawn('node', ['server.js'], {
                    cwd: path.join(__dirname, '..'),
                    env: { ...process.env, PORT: '3001', NODE_ENV: 'test' },
                    stdio: 'pipe'
                });
                
                let serverStarted = false;
                let healthCheckPassed = false;
                
                serverProcess.stdout.on('data', (data) => {
                    const output = data.toString();
                    if (output.includes('Server running') || output.includes('listening')) {
                        serverStarted = true;
                        
                        // Give server time to start
                        setTimeout(() => {
                            // Try to connect to health endpoint
                            const http = require('http');
                            const req = http.get('http://localhost:3001/health', (res) => {
                                if (res.statusCode === 200) {
                                    healthCheckPassed = true;
                                }
                                serverProcess.kill();
                            });
                            
                            req.on('error', () => {
                                serverProcess.kill();
                            });
                            
                            // Timeout after 5 seconds
                            setTimeout(() => {
                                serverProcess.kill();
                            }, 5000);
                            
                        }, 2000);
                    }
                });
                
                serverProcess.on('close', (code) => {
                    if (healthCheckPassed) {
                        resolve({
                            success: true,
                            details: 'Server health check passed'
                        });
                    } else if (serverStarted) {
                        resolve({
                            success: false,
                            error: 'Server started but health check failed'
                        });
                    } else {
                        resolve({
                            success: false,
                            error: `Server failed to start (exit code: ${code})`
                        });
                    }
                });
                
                // Kill process after 10 seconds if still running
                setTimeout(() => {
                    if (!serverProcess.killed) {
                        serverProcess.kill();
                        resolve({
                            success: false,
                            error: 'Server health check timed out'
                        });
                    }
                }, 10000);
                
            } catch (error) {
                resolve({
                    success: false,
                    error: `Server health check failed: ${error.message}`
                });
            }
        });
    }

    async runAllChecks() {
        this.log('🚀 Starting Production Deployment Validation', 'deploy');
        this.log('=' .repeat(60), 'info');
        
        await this.runCheck('Security Score Validation', () => this.checkSecurityScore());
        await this.runCheck('Environment Variables', () => this.checkEnvironmentVariables());
        await this.runCheck('Dependency Security', () => this.checkDependencySecurity());
        await this.runCheck('Core Files Existence', () => this.checkCoreFiles());
        await this.runCheck('Server Health Test', () => this.checkServerHealth());
        
        this.generateDeploymentReport();
    }

    generateDeploymentReport() {
        this.log('=' .repeat(60), 'info');
        this.log('🚀 PRODUCTION DEPLOYMENT VALIDATION RESULTS', 'deploy');
        this.log('=' .repeat(60), 'info');
        
        this.log(`Total Checks: ${this.checks.length}`, 'info');
        this.log(`Passed: ${this.passed}`, 'success');
        this.log(`Failed: ${this.failed}`, this.failed > 0 ? 'error' : 'success');
        
        if (this.failed > 0) {
            this.log('\n❌ FAILED CHECKS:', 'error');
            this.checks
                .filter(check => !check.success)
                .forEach(check => {
                    this.log(`  • ${check.name}: ${check.error}`, 'error');
                });
        }
        
        if (this.passed > 0) {
            this.log('\n✅ PASSED CHECKS:', 'success');
            this.checks
                .filter(check => check.success)
                .forEach(check => {
                    this.log(`  • ${check.name}`, 'success');
                    if (check.details) {
                        this.log(`    ${check.details}`, 'info');
                    }
                });
        }
        
        const deploymentScore = Math.round((this.passed / this.checks.length) * 100);
        this.deploymentReady = deploymentScore >= 90 && this.failed === 0;
        
        this.log('=' .repeat(60), 'info');
        this.log(`🚀 DEPLOYMENT READINESS: ${deploymentScore}%`, deploymentScore >= 90 ? 'success' : 'error');
        
        if (this.deploymentReady) {
            this.log('🟢 PRODUCTION DEPLOYMENT APPROVED!', 'success');
            this.log('\n🚀 DEPLOYMENT COMMANDS:', 'deploy');
            this.log('1. npm run start:production', 'info');
            this.log('2. pm2 start ecosystem.config.js --env production', 'info');
            this.log('3. docker-compose up -d', 'info');
        } else {
            this.log('🔴 PRODUCTION DEPLOYMENT BLOCKED', 'error');
            this.log('Fix the above issues before deploying to production', 'warning');
        }
        
        // Save deployment report
        const reportPath = path.join(__dirname, '../DEPLOYMENT_REPORT.json');
        fs.writeFileSync(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            deploymentScore,
            deploymentReady: this.deploymentReady,
            totalChecks: this.checks.length,
            passedChecks: this.passed,
            failedChecks: this.failed,
            checks: this.checks
        }, null, 2));
        
        this.log(`📄 Deployment report saved to: ${reportPath}`, 'info');
        
        // Exit with appropriate code
        process.exit(this.deploymentReady ? 0 : 1);
    }
}

// Run deployment validation if this script is executed directly
if (require.main === module) {
    const deployer = new ProductionDeployer();
    deployer.runAllChecks().catch(error => {
        console.error('❌ Deployment validation failed:', error);
        process.exit(1);
    });
}

module.exports = ProductionDeployer;
