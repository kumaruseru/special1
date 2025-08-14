# Render Deployment Configuration

## Build Command
```
npm install
```

## Start Command  
```
npm start
```

## Environment Variables (set in Render dashboard):
- NODE_ENV=production
- PORT=10000 (optional, Render will set this automatically)
- MONGODB_URI=your_mongodb_connection_string
- JWT_SECRET=your_secret_key
- CORS_ORIGIN=https://your-app-name.onrender.com

## Notes:
1. Make sure to set MONGODB_URI in Render environment variables
2. Generate a strong JWT_SECRET (32+ characters)
3. Update CORS_ORIGIN with your actual Render URL
4. The app will run on the port provided by Render automatically

## Render Settings:
- Environment: Node
- Build Command: npm install  
- Start Command: npm start
- Root Directory: / (default)
- Auto-Deploy: Yes (recommended)
