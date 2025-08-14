# 🚀 Deploy Nhanh Lên Render

## Tóm Tắt Nhanh

1. **Push code lên GitHub**
2. **Tạo MongoDB Atlas** (free tier)
3. **Tạo Render Web Service** từ GitHub repo
4. **Cấu hình Environment Variables**

## ⚡ Cấu Hình Render

### Build & Start Commands
```
Build Command: npm install
Start Command: node server-production.js
```

### Environment Variables (Bắt buộc)
```
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://nghiaht281003:Huong1505@special.7aeh83z.mongodb.net/cosmic_social_network?retryWrites=true&w=majority&appName=special
JWT_SECRET=f9e396d9e9c8e20d10429fa3414ee792570dc4eee89d07b9db0a5f320dae6206221d8f07bc30058e6f1a04b65ac93fb91e34fb076a200a6ebed5155472873e984
CORS_ORIGIN=https://your-app-name.onrender.com
```

## 🔗 Links Quan Trọng

- [Render Dashboard](https://dashboard.render.com)
- [MongoDB Atlas](https://cloud.mongodb.com)
- [Hướng dẫn chi tiết](./RENDER_DEPLOYMENT_GUIDE.md)

## ✅ Health Check

Sau khi deploy, test tại: `https://your-app.onrender.com/health`

## 📱 Test Production Local

```bash
# Set environment variables
$env:NODE_ENV="production"
$env:MONGODB_URI="your-mongodb-uri"
$env:JWT_SECRET="your-jwt-secret"

# Run production server
node server-production.js
```

## 🎯 Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] MongoDB Atlas cluster created
- [ ] Render web service connected
- [ ] Environment variables configured
- [ ] Health check working
- [ ] User registration/login tested
