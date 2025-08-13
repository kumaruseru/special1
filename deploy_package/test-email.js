// Email Test Script for Cosmic Social Network
// Test the email configuration with noreply@cown.name.vn

const { sendWelcomeEmail, sendPasswordResetEmail, sendVerificationEmail, testEmailConnection } = require('./config/email');

async function runEmailTests() {
    console.log('🧪 Starting Email System Tests...\n');

    // Test 1: Check SMTP connection
    console.log('1️⃣ Testing SMTP Connection...');
    const connectionTest = await testEmailConnection();
    console.log(connectionTest.success ? '✅ Connection successful' : '❌ Connection failed:', connectionTest.error || '');
    console.log('');

    // Test 2: Send welcome email
    console.log('2️⃣ Testing Welcome Email...');
    const testEmail = 'test@example.com'; // Replace with real email for testing
    const welcomeResult = await sendWelcomeEmail(testEmail, 'Test User');
    console.log(welcomeResult.success ? '✅ Welcome email sent' : '❌ Welcome email failed:', welcomeResult.error || '');
    console.log('');

    // Test 3: Send verification email
    console.log('3️⃣ Testing Verification Email...');
    const verifyResult = await sendVerificationEmail(testEmail, 'test-token-123', 'Test User');
    console.log(verifyResult.success ? '✅ Verification email sent' : '❌ Verification email failed:', verifyResult.error || '');
    console.log('');

    // Test 4: Send password reset email
    console.log('4️⃣ Testing Password Reset Email...');
    const resetResult = await sendPasswordResetEmail(testEmail, 'reset-token-456', 'Test User');
    console.log(resetResult.success ? '✅ Password reset email sent' : '❌ Password reset email failed:', resetResult.error || '');
    console.log('');

    console.log('🎉 Email tests completed!');
    console.log('');
    console.log('📧 Email Configuration Summary:');
    console.log('- Email: noreply@cown.name.vn');
    console.log('- Domain: cown.name.vn');
    console.log('- SMTP Host: smtp.cown.name.vn');
    console.log('- Port: 587 (TLS)');
    console.log('- Templates: Welcome, Verification, Password Reset, Notifications');
}

// Run tests if called directly
if (require.main === module) {
    runEmailTests().catch(console.error);
}

module.exports = { runEmailTests };
