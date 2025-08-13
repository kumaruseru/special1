# 🚀 Deploy Guide: Cosmic Social Network to cPanel Hosting

## 📋 Deployment Checklist

### 1. Prepare Files for Upload
- ✅ All HTML, CSS, JS files ready
- ✅ Audio system implemented
- ✅ Static assets organized
- ✅ Remove server-side dependencies (Node.js files)

### 2. cPanel Hosting Setup
**Domain:** cown.name.vn
**Hosting:** cPanel

### 3. Files to Upload to cPanel
```
public_html/
├── index.html
├── pages/
│   ├── home.html
│   ├── messages.html
│   ├── discovery.html
│   ├── profile.html
│   ├── calls.html
│   ├── maps.html
│   ├── settings.html
│   ├── login.html
│   ├── register.html
│   ├── forgot-password.html
│   ├── reset-password.html
│   └── friend-profile.html
├── assets/
│   ├── css/
│   ├── js/
│   └── images/
├── components/
├── test-audio.html
├── quick-ringtone-test.html
└── .htaccess (for URL rewriting)
```

### 4. Files to EXCLUDE (Server-side only)
- ❌ server.js
- ❌ package.json
- ❌ node_modules/
- ❌ docker-compose.yml
- ❌ Dockerfile
- ❌ .env files

### 5. Required Modifications for Static Hosting
- Convert API calls to localStorage/client-side storage
- Remove Node.js server dependencies
- Add .htaccess for clean URLs
- Configure for static hosting environment

## 🛠️ Deployment Steps

1. **Create deployment package**
2. **Upload via cPanel File Manager**
3. **Configure .htaccess**
4. **Test functionality**
5. **Set up SSL certificate**

---
*Generated for Cosmic Social Network deployment*
