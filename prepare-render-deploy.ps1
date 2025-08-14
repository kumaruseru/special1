#!/usr/bin/env powershell

# Render Deployment Preparation Script for Windows PowerShell

Write-Host "🚀 Chuẩn bị deploy Cosmic Social Network lên Render..." -ForegroundColor Green

# Check if Git is available
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Git không được tìm thấy. Vui lòng cài đặt Git trước." -ForegroundColor Red
    exit 1
}

# Check if Node.js is available
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js không được tìm thấy. Vui lòng cài đặt Node.js trước." -ForegroundColor Red
    exit 1
}

Write-Host "📦 Kiểm tra dependencies..." -ForegroundColor Yellow
npm install

Write-Host "🧪 Kiểm tra lỗi syntax..." -ForegroundColor Yellow
node -c server-production.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Có lỗi syntax trong server-production.js" -ForegroundColor Red
    exit 1
}

Write-Host "📝 Kiểm tra package.json..." -ForegroundColor Yellow
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Không tìm thấy package.json" -ForegroundColor Red
    exit 1
}

Write-Host "🔍 Kiểm tra file cần thiết..." -ForegroundColor Yellow
$requiredFiles = @(
    "server-production.js",
    "package.json",
    "index.html",
    "RENDER_DEPLOYMENT_GUIDE.md"
)

foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "❌ Không tìm thấy file: $file" -ForegroundColor Red
        exit 1
    }
}

Write-Host "📊 Thống kê project..." -ForegroundColor Yellow
$jsFiles = (Get-ChildItem -Recurse -Filter "*.js" | Measure-Object).Count
$htmlFiles = (Get-ChildItem -Recurse -Filter "*.html" | Measure-Object).Count
$cssFiles = (Get-ChildItem -Recurse -Filter "*.css" | Measure-Object).Count

Write-Host "   JavaScript files: $jsFiles" -ForegroundColor Cyan
Write-Host "   HTML files: $htmlFiles" -ForegroundColor Cyan
Write-Host "   CSS files: $cssFiles" -ForegroundColor Cyan

Write-Host ""
Write-Host "✅ Tất cả kiểm tra hoàn tất!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Các bước tiếp theo:" -ForegroundColor Yellow
Write-Host "1. Đảm bảo code đã được push lên GitHub" -ForegroundColor White
Write-Host "2. Đọc hướng dẫn trong RENDER_DEPLOYMENT_GUIDE.md" -ForegroundColor White
Write-Host "3. Tạo MongoDB Atlas cluster" -ForegroundColor White
Write-Host "4. Tạo Render web service và connect với GitHub repo" -ForegroundColor White
Write-Host "5. Cấu hình environment variables trên Render" -ForegroundColor White
Write-Host ""
Write-Host "🔗 Helpful links:" -ForegroundColor Yellow
Write-Host "   - Render Dashboard: https://dashboard.render.com" -ForegroundColor Cyan
Write-Host "   - MongoDB Atlas: https://cloud.mongodb.com" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎉 Ready for deployment!" -ForegroundColor Green
