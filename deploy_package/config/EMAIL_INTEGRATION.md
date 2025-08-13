# 📧 Email Integration Setup

## Production .env Configuration
```bash
EMAIL_USER=noreply@cown.name.vn
EMAIL_PASSWORD=Huong1505@
EMAIL_HOST=smtp.cown.name.vn
EMAIL_PORT=587
DOMAIN=cown.name.vn
BASE_URL=https://cown.name.vn
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
