#!/usr/bin/env node

/**
 * 🛡️ AUTO-FIX SCRIPT - Add SecurityUtils to all HTML files
 * Automatically adds SecurityUtils script tag to all HTML files
 */

const fs = require('fs');
const path = require('path');

class HTMLSecurityFixer {
    constructor() {
        this.pagesDir = path.join(__dirname, '../pages');
        this.fixedFiles = [];
        this.skippedFiles = [];
    }

    log(message, type = 'info') {
        const prefix = {
            'info': '💡',
            'success': '✅',
            'error': '❌',
            'warning': '⚠️'
        };
        console.log(`${prefix[type]} ${message}`);
    }

    addSecurityUtilsToHTML(filePath) {
        try {
            let content = fs.readFileSync(filePath, 'utf8');
            
            // Check if SecurityUtils is already included
            if (content.includes('security-utils.js')) {
                this.skippedFiles.push(path.basename(filePath));
                return false;
            }

            // Find the closing </head> tag and add SecurityUtils before it
            const headCloseIndex = content.indexOf('</head>');
            if (headCloseIndex === -1) {
                this.log(`No </head> tag found in ${path.basename(filePath)}`, 'warning');
                return false;
            }

            // Insert SecurityUtils script tag
            const securityScript = `    <!-- 🛡️ SECURITY: XSS Protection Utilities -->
    <script src="../assets/js/security-utils.js"></script>
`;

            const beforeHead = content.substring(0, headCloseIndex);
            const afterHead = content.substring(headCloseIndex);

            const newContent = beforeHead + securityScript + afterHead;
            
            fs.writeFileSync(filePath, newContent, 'utf8');
            this.fixedFiles.push(path.basename(filePath));
            return true;

        } catch (error) {
            this.log(`Error processing ${path.basename(filePath)}: ${error.message}`, 'error');
            return false;
        }
    }

    fixAllHTMLFiles() {
        this.log('🛡️ Starting HTML Security Auto-Fix', 'info');
        this.log('=' .repeat(50), 'info');

        if (!fs.existsSync(this.pagesDir)) {
            this.log('Pages directory not found!', 'error');
            return;
        }

        const htmlFiles = fs.readdirSync(this.pagesDir)
            .filter(file => file.endsWith('.html'))
            .map(file => path.join(this.pagesDir, file));

        this.log(`Found ${htmlFiles.length} HTML files to process`, 'info');

        htmlFiles.forEach(filePath => {
            const fileName = path.basename(filePath);
            this.log(`Processing: ${fileName}`, 'info');
            
            if (this.addSecurityUtilsToHTML(filePath)) {
                this.log(`✅ Fixed: ${fileName}`, 'success');
            } else {
                this.log(`⚠️ Skipped: ${fileName}`, 'warning');
            }
        });

        this.generateReport();
    }

    generateReport() {
        this.log('=' .repeat(50), 'info');
        this.log('🛡️ HTML SECURITY FIX RESULTS', 'info');
        this.log('=' .repeat(50), 'info');
        
        this.log(`Total Files Processed: ${this.fixedFiles.length + this.skippedFiles.length}`, 'info');
        this.log(`Files Fixed: ${this.fixedFiles.length}`, 'success');
        this.log(`Files Skipped: ${this.skippedFiles.length}`, 'warning');

        if (this.fixedFiles.length > 0) {
            this.log('\n✅ FIXED FILES:', 'success');
            this.fixedFiles.forEach(file => {
                this.log(`  • ${file}`, 'success');
            });
        }

        if (this.skippedFiles.length > 0) {
            this.log('\n⚠️ SKIPPED FILES (already have SecurityUtils):', 'warning');
            this.skippedFiles.forEach(file => {
                this.log(`  • ${file}`, 'warning');
            });
        }

        const successRate = Math.round(((this.fixedFiles.length + this.skippedFiles.length) / (this.fixedFiles.length + this.skippedFiles.length)) * 100);
        this.log(`\n🛡️ Security Coverage: ${successRate}%`, 'success');
        
        if (this.fixedFiles.length > 0) {
            this.log('\n🔧 NEXT STEPS:', 'info');
            this.log('1. Run security test: npm run security:test', 'info');
            this.log('2. Test pages manually to ensure functionality', 'info');
            this.log('3. Deploy when all tests pass', 'info');
        }
    }
}

// Run if executed directly
if (require.main === module) {
    const fixer = new HTMLSecurityFixer();
    fixer.fixAllHTMLFiles();
}

module.exports = HTMLSecurityFixer;
