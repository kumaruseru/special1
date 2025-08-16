# 📧 Email Integration Setup

## Production .env Configuration
```bash
EMAIL_USER=your_email@yourdomain.com
EMAIL_PASSWORD=your_app_password_here
EMAIL_HOST=smtp.yourdomain.com
EMAIL_PORT=587
DOMAIN=yourdomain.com
BASE_URL=https://yourdomain.com
```

## Required Dependencies
```bash
npm install nodemailer dotenv
```

## Usage in Server
```javascript
const { sendWelcomeEmail, sendPasswordResetEmail } = require('./config/email');

// Send welcome email on registration
await sendWelcomeEmail(userEmail, userName);

// Send password reset
await sendPasswordResetEmail(userEmail, resetToken, userName);
```

## Email Templates Available
- ✅ Welcome Email (registration)
- ✅ Password Reset Email
- ✅ Email Verification  
- ✅ Notification Emails (messages, friend requests, missed calls)

## Security Notes
- Password stored in environment variables
- TLS encryption enabled
- Secure SMTP configuration
- Rate limiting recommended

## Testing
Use the `testEmailConnection()` function to verify SMTP settings work correctly.
