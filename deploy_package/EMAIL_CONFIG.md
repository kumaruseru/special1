# 📧 Email Configuration for Cosmic Social Network

## SMTP Settings
- **Email:** noreply@cown.name.vn
- **Password:** Huong1505@
- **Domain:** cown.name.vn

## Usage
This email will be used for:
- User registration verification
- Password reset emails
- System notifications
- Welcome emails
- Security alerts

## Configuration Files
- `/config/email.js` - SMTP configuration
- `/config/email-templates/` - HTML email templates
- `.env` - Environment variables (for security)

⚠️ **Security Note:** 
Store password in environment variables in production, not in source code.
