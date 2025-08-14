# 🚀 Deploy to Render Guide

## Prerequisites
1. GitHub account
2. Render account (free tier available)
3. MongoDB Atlas account (free tier available)

## Step 1: Prepare Repository
```bash
# Make sure all changes are committed
git add .
git commit -m "Add Telegram-style messaging and Render deployment config"
git push origin main
```

## Step 2: Configure Environment Variables on Render

### Required Variables:
- `NODE_ENV=production`
- `PORT=10000`
- `JWT_SECRET` (Generate a secure random string)
- `MONGODB_URI` (Get from MongoDB Atlas)

### Optional Variables:
- `EMAIL_HOST=smtp.gmail.com`
- `EMAIL_PORT=587`
- `EMAIL_SECURE=false`
- `EMAIL_USER=your-email@gmail.com`
- `EMAIL_PASS=your-app-password`

## Step 3: MongoDB Atlas Setup
1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create free cluster
3. Create database user
4. Whitelist IP: 0.0.0.0/0 (for Render)
5. Get connection string

## Step 4: Deploy on Render
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `cosmic-social-network`
   - **Root Directory**: `.` (leave blank)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run production`
   - **Node Version**: Latest

## Step 5: Add Environment Variables
In Render dashboard:
1. Go to Environment tab
2. Add all required variables
3. Deploy

## Step 6: Test Deployment
- Your app will be available at: `https://your-app-name.onrender.com`
- Check logs for any errors
- Test messaging functionality

## Features Deployed:
✅ Telegram-style Socket.IO messaging
✅ Connection health monitoring
✅ Message delivery guarantees
✅ User presence tracking
✅ WebRTC video/voice calls
✅ Real-time messaging
✅ User authentication
✅ Responsive design

## Troubleshooting:
- Check Render logs for errors
- Verify MongoDB connection string
- Ensure all environment variables are set
- Check if port 10000 is correctly configured
