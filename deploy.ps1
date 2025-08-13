# 🚀 Deployment Script for Cosmic Social Network
# Deploy to cPanel hosting at cown.name.vn

Write-Host "🌌 Cosmic Social Network - Deployment Script" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Create deployment directory
$DEPLOY_DIR = "deploy_package"
Write-Host "📦 Creating deployment package..." -ForegroundColor Yellow

# Remove existing deployment directory
if (Test-Path $DEPLOY_DIR) {
    Remove-Item -Recurse -Force $DEPLOY_DIR
}
New-Item -ItemType Directory -Name $DEPLOY_DIR | Out-Null

# Copy essential files for static hosting
Write-Host "📁 Copying files..." -ForegroundColor Yellow

# Copy main HTML file
Copy-Item "index.html" $DEPLOY_DIR/

# Copy pages
Copy-Item -Recurse "pages" $DEPLOY_DIR/

# Copy assets
Copy-Item -Recurse "assets" $DEPLOY_DIR/

# Copy components
Copy-Item -Recurse "components" $DEPLOY_DIR/

# Copy test files
Copy-Item "test-audio.html" $DEPLOY_DIR/
Copy-Item "quick-ringtone-test.html" $DEPLOY_DIR/

# Copy configuration files
Copy-Item ".htaccess" $DEPLOY_DIR/
Copy-Item "404.html" $DEPLOY_DIR/

# Copy documentation
if (Test-Path "README.md") { Copy-Item "README.md" $DEPLOY_DIR/ }
if (Test-Path "DEPLOYMENT_GUIDE.md") { Copy-Item "DEPLOYMENT_GUIDE.md" $DEPLOY_DIR/ }

Write-Host "✅ Files copied successfully!" -ForegroundColor Green

# Remove server-side files that are not needed for static hosting
Write-Host "🗑️ Removing server-side files..." -ForegroundColor Yellow

$serverFiles = @(
    "$DEPLOY_DIR/server.js",
    "$DEPLOY_DIR/package.json",
    "$DEPLOY_DIR/package-lock.json", 
    "$DEPLOY_DIR/docker-compose.yml",
    "$DEPLOY_DIR/Dockerfile",
    "$DEPLOY_DIR/node_modules"
)

foreach ($file in $serverFiles) {
    if (Test-Path $file) {
        Remove-Item -Recurse -Force $file
    }
}

Write-Host "✅ Server-side files removed!" -ForegroundColor Green

# Create ZIP file for easy upload
Write-Host "📦 Creating ZIP file for upload..." -ForegroundColor Yellow

try {
    Compress-Archive -Path "$DEPLOY_DIR\*" -DestinationPath "cosmic-social-network-deploy.zip" -Force
    Write-Host "✅ ZIP file created!" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Could not create ZIP file. Please manually ZIP the contents of $DEPLOY_DIR" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Deployment package ready!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Upload 'cosmic-social-network-deploy.zip' to your cPanel File Manager"
Write-Host "2. Extract to public_html/ directory"  
Write-Host "3. Point domain cown.name.vn to your hosting"
Write-Host "4. Test the website functionality"
Write-Host "5. Set up SSL certificate in cPanel"
Write-Host ""
Write-Host "📁 Files ready in: $DEPLOY_DIR/" -ForegroundColor Green
if (Test-Path "cosmic-social-network-deploy.zip") {
    Write-Host "📦 ZIP file: cosmic-social-network-deploy.zip" -ForegroundColor Green
}
Write-Host ""
Write-Host "🌐 Your website will be live at: https://cown.name.vn" -ForegroundColor Magenta
