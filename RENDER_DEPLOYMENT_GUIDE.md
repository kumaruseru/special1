# 🚀 Hướng Dẫn Deploy Lên Render

## Tổng Quan
Hướng dẫn này sẽ giúp bạn deploy ứng dụng Cosmic Social Network lên Render platform.

## 📋 Yêu Cầu Trước Khi Deploy

### 1. Tài Khoản Cần Thiết
- [Render](https://render.com) - Platform hosting chính
- [MongoDB Atlas](https://www.mongodb.com/atlas) - Database MongoDB cloud
- [GitHub](https://github.com) - Lưu trữ source code

### 2. Chuẩn Bị Source Code
- Push code lên GitHub repository
- Đảm bảo tất cả file cần thiết đã được commit

## 🛠 Các Bước Deploy

### Bước 1: Setup MongoDB Atlas

1. **Tạo MongoDB Atlas Account**
   - Đăng ký tại [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Tạo một cluster mới (chọn FREE tier)

2. **Cấu Hình Database**
   - Tạo database user với username/password
   - Thêm IP address `0.0.0.0/0` vào whitelist (cho phép tất cả IP)
   - Lấy connection string: `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/cosmic_social_network`

### Bước 2: Deploy Web Service trên Render

1. **Tạo Web Service**
   - Đăng nhập vào [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect GitHub repository của bạn

2. **Cấu Hình Web Service**
   ```
   Name: cosmic-social-network
   Runtime: Node
   Build Command: npm install
   Start Command: node server-production.js
   ```

3. **Thiết Lập Environment Variables**
   ```
   NODE_ENV = production
   PORT = 10000
   MONGODB_URI = mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/cosmic_social_network
   JWT_SECRET = [tạo một chuỗi bí mật mạnh 64+ ký tự]
   CORS_ORIGIN = https://your-app-name.onrender.com
   ```

### Bước 3: Cấu Hình Advanced (Tùy Chọn)

#### Redis (Nếu cần caching)
1. Tạo Redis service trên Render:
   - New + → Redis
   - Plan: Free
   - Lấy Redis URL và thêm vào env vars

#### PostgreSQL (Nếu cần analytics)
1. Tạo PostgreSQL service:
   - New + → PostgreSQL
   - Plan: Free
   - Lấy DATABASE_URL và thêm vào env vars

### Bước 4: Domain và SSL

1. **Custom Domain (Tùy chọn)**
   - Settings → Custom Domains
   - Thêm domain của bạn
   - Cấu hình DNS records

2. **SSL Certificate**
   - Render tự động cấp SSL certificate miễn phí
   - HTTPS được bật mặc định

## 📁 Cấu Trúc File Quan Trọng

```
cosmic-social-network/
├── server-production.js     # Server cho production
├── package.json            # Dependencies
├── Dockerfile.render       # Docker config cho Render
├── build.sh               # Build script
├── render.yaml            # Render config (tùy chọn)
└── assets/                # Static files
```

## 🔧 Script Deploy Tự Động

Chạy script sau để chuẩn bị deploy:

```bash
# Cài đặt dependencies
npm install

# Kiểm tra lỗi
npm run lint

# Test local
npm start
```

## 🌐 Environment Variables Cần Thiết

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `10000` |
| `MONGODB_URI` | MongoDB connection | `mongodb+srv://...` |
| `JWT_SECRET` | JWT secret key | `your-super-secret-key-here` |
| `CORS_ORIGIN` | Allowed origins | `https://your-app.onrender.com` |

## 🚨 Troubleshooting

### Lỗi Database Connection
- Kiểm tra MongoDB Atlas whitelist IP
- Xác nhận connection string đúng format
- Đảm bảo database user có quyền đủ

### Lỗi Build Failed
- Kiểm tra `package.json` có đầy đủ dependencies
- Xem logs chi tiết trên Render dashboard
- Đảm bảo Node.js version tương thích

### Lỗi 503 Service Unavailable
- Kiểm tra health check endpoint `/health`
- Xem server logs để debug
- Xác nhận port binding đúng

## 📊 Monitoring

### Health Check
- Endpoint: `https://your-app.onrender.com/health`
- Response: Status, database connection, uptime

### Logs
- Xem logs real-time trên Render Dashboard
- Logs → Recent Logs
- Filter by severity level

## 💰 Chi Phí

### Free Tier Render
- 750 hours/month free
- Sleep after 15 minutes không hoạt động
- 500MB RAM, 0.1 CPU

### Paid Plans (Nếu cần)
- $7/month: No sleep, 512MB RAM
- $25/month: 2GB RAM, dedicated CPU

## 🔐 Bảo Mật

1. **Environment Variables**
   - Không hard-code secrets trong code
   - Sử dụng strong JWT secret
   - Rotate secrets định kỳ

2. **Database Security**
   - Sử dụng connection string với credentials
   - Enable MongoDB authentication
   - Regular backup

## 📝 Checklist Deploy

- [ ] Code đã được push lên GitHub
- [ ] MongoDB Atlas cluster đã được tạo
- [ ] Render web service đã được cấu hình
- [ ] Environment variables đã được thiết lập
- [ ] Health check endpoint hoạt động
- [ ] Database connection thành công
- [ ] Static files được serve đúng
- [ ] CORS đã được cấu hình
- [ ] SSL certificate hoạt động

## 🎉 Hoàn Thành

Sau khi deploy thành công, ứng dụng của bạn sẽ có thể truy cập tại:
`https://your-app-name.onrender.com`

### Test Deployment
1. Truy cập `/health` để kiểm tra status
2. Test đăng ký tài khoản mới
3. Test đăng nhập
4. Kiểm tra các tính năng chính

## 📞 Hỗ Trợ

- [Render Documentation](https://render.com/docs)
- [MongoDB Atlas Support](https://docs.atlas.mongodb.com/)
- [GitHub Issues](https://github.com/your-username/cosmic-social-network/issues)
