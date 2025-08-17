#!/usr/bin/env node

/**
 * Health Check Script for Special1 Production
 * Checks server health, database connections, and critical services
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

class HealthChecker {
    constructor() {
        this.port = process.env.PORT || 3000;
        this.host = process.env.HOST || 'localhost';
        this.protocol = process.env.HTTPS === 'true' ? 'https' : 'http';
        this.timeout = 10000; // 10 seconds
        this.results = {
            timestamp: new Date().toISOString(),
            status: 'unknown',
            checks: {},
            performance: {},
            errors: []
        };
    }

    async runHealthCheck() {
        console.log('🏥 Starting Special1 Health Check...\n');
        
        const startTime = performance.now();
        
        try {
            // Check server availability
            await this.checkServer();
            
            // Check health endpoint
            await this.checkHealthEndpoint();
            
            // Check database status
            await this.checkDatabaseStatus();
            
            // Performance metrics
            this.calculatePerformance(startTime);
            
            // Determine overall status
            this.determineOverallStatus();
            
            // Output results
            this.displayResults();
            
            // Exit with appropriate code
            process.exit(this.results.status === 'healthy' ? 0 : 1);
            
        } catch (error) {
            this.results.errors.push(error.message);
            this.results.status = 'unhealthy';
            console.error('❌ Health check failed:', error.message);
            process.exit(1);
        }
    }

    async checkServer() {
        console.log('🔍 Checking server availability...');
        
        return new Promise((resolve, reject) => {
            const client = this.protocol === 'https' ? https : http;
            
            const options = {
                hostname: this.host,
                port: this.port,
                path: '/',
                method: 'GET',
                timeout: this.timeout,
                headers: {
                    'User-Agent': 'Special1-HealthCheck/1.0'
                }
            };

            const req = client.request(options, (res) => {
                this.results.checks.server = {
                    status: res.statusCode < 500 ? 'ok' : 'error',
                    statusCode: res.statusCode,
                    headers: {
                        'content-type': res.headers['content-type'],
                        'server': res.headers['server']
                    }
                };
                
                if (res.statusCode < 500) {
                    console.log('✅ Server is responding');
                    resolve();
                } else {
                    reject(new Error(`Server returned status ${res.statusCode}`));
                }
            });

            req.on('error', (error) => {
                this.results.checks.server = {
                    status: 'error',
                    error: error.message
                };
                reject(new Error(`Server connection failed: ${error.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Server connection timeout'));
            });

            req.end();
        });
    }

    async checkHealthEndpoint() {
        console.log('🔍 Checking health endpoint...');
        
        return new Promise((resolve, reject) => {
            const client = this.protocol === 'https' ? https : http;
            
            const options = {
                hostname: this.host,
                port: this.port,
                path: '/health',
                method: 'GET',
                timeout: this.timeout
            };

            const req = client.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const healthData = JSON.parse(data);
                        this.results.checks.health = {
                            status: res.statusCode === 200 ? 'ok' : 'error',
                            statusCode: res.statusCode,
                            data: healthData
                        };
                        
                        if (res.statusCode === 200) {
                            console.log('✅ Health endpoint is responding');
                            resolve();
                        } else {
                            reject(new Error(`Health endpoint returned status ${res.statusCode}`));
                        }
                    } catch (error) {
                        this.results.checks.health = {
                            status: 'error',
                            error: 'Invalid JSON response'
                        };
                        reject(new Error('Health endpoint returned invalid JSON'));
                    }
                });
            });

            req.on('error', (error) => {
                this.results.checks.health = {
                    status: 'error',
                    error: error.message
                };
                console.log('⚠️  Health endpoint not available (this is optional)');
                resolve(); // Health endpoint is optional
            });

            req.on('timeout', () => {
                req.destroy();
                console.log('⚠️  Health endpoint timeout (this is optional)');
                resolve(); // Health endpoint is optional
            });

            req.end();
        });
    }

    async checkDatabaseStatus() {
        console.log('🔍 Checking database status...');
        
        return new Promise((resolve, reject) => {
            const client = this.protocol === 'https' ? https : http;
            
            const options = {
                hostname: this.host,
                port: this.port,
                path: '/api/status',
                method: 'GET',
                timeout: this.timeout
            };

            const req = client.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const statusData = JSON.parse(data);
                        this.results.checks.database = {
                            status: res.statusCode === 200 ? 'ok' : 'error',
                            statusCode: res.statusCode,
                            data: statusData
                        };
                        
                        if (res.statusCode === 200) {
                            console.log('✅ Database status endpoint is responding');
                            resolve();
                        } else {
                            console.log('⚠️  Database status endpoint not available');
                            resolve(); // Database status is optional
                        }
                    } catch (error) {
                        console.log('⚠️  Database status endpoint returned invalid JSON');
                        resolve(); // Database status is optional
                    }
                });
            });

            req.on('error', (error) => {
                console.log('⚠️  Database status endpoint not available');
                resolve(); // Database status is optional
            });

            req.on('timeout', () => {
                req.destroy();
                console.log('⚠️  Database status endpoint timeout');
                resolve(); // Database status is optional
            });

            req.end();
        });
    }

    calculatePerformance(startTime) {
        const endTime = performance.now();
        this.results.performance = {
            totalTime: Math.round(endTime - startTime),
            responseTime: this.results.checks.server?.responseTime || 'N/A'
        };
    }

    determineOverallStatus() {
        const serverOk = this.results.checks.server?.status === 'ok';
        const hasErrors = this.results.errors.length > 0;
        
        if (serverOk && !hasErrors) {
            this.results.status = 'healthy';
        } else if (serverOk) {
            this.results.status = 'degraded';
        } else {
            this.results.status = 'unhealthy';
        }
    }

    displayResults() {
        console.log('\n📋 Health Check Results:');
        console.log('========================');
        console.log(`Overall Status: ${this.getStatusEmoji()} ${this.results.status.toUpperCase()}`);
        console.log(`Timestamp: ${this.results.timestamp}`);
        console.log(`Total Time: ${this.results.performance.totalTime}ms`);
        
        console.log('\n🔍 Check Details:');
        Object.entries(this.results.checks).forEach(([check, result]) => {
            const status = result.status === 'ok' ? '✅' : '❌';
            console.log(`${status} ${check}: ${result.status}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        });
        
        if (this.results.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.results.errors.forEach(error => {
                console.log(`   - ${error}`);
            });
        }
        
        console.log('\n' + '='.repeat(50));
    }

    getStatusEmoji() {
        switch (this.results.status) {
            case 'healthy': return '✅';
            case 'degraded': return '⚠️';
            case 'unhealthy': return '❌';
            default: return '❓';
        }
    }
}

// Run health check if this script is executed directly
if (require.main === module) {
    const healthChecker = new HealthChecker();
    healthChecker.runHealthCheck();
}

module.exports = HealthChecker;
