# Cosmic Social Network - Deployment Script
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

# Copy directories
Copy-Item -Recurse "pages" $DEPLOY_DIR/
Copy-Item -Recurse "assets" $DEPLOY_DIR/
Copy-Item -Recurse "components" $DEPLOY_DIR/

# Copy test files
Copy-Item "test-audio.html" $DEPLOY_DIR/
Copy-Item "quick-ringtone-test.html" $DEPLOY_DIR/

# Copy configuration files
Copy-Item ".htaccess" $DEPLOY_DIR/
Copy-Item "404.html" $DEPLOY_DIR/

# Copy documentation
if (Test-Path "README.md") { 
    Copy-Item "README.md" $DEPLOY_DIR/ 
}
if (Test-Path "DEPLOYMENT_GUIDE.md") { 
    Copy-Item "DEPLOYMENT_GUIDE.md" $DEPLOY_DIR/ 
}

Write-Host "✅ Files copied successfully!" -ForegroundColor Green

Write-Host "📦 Creating ZIP file for upload..." -ForegroundColor Yellow

# Create ZIP file
Compress-Archive -Path "$DEPLOY_DIR\*" -DestinationPath "cosmic-social-network-deploy.zip" -Force

Write-Host ""
Write-Host "🎉 Deployment package ready!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps for cPanel deployment:" -ForegroundColor Cyan
Write-Host "1. Login to your cPanel hosting account"
Write-Host "2. Open File Manager"
Write-Host "3. Upload 'cosmic-social-network-deploy.zip' to public_html/"
Write-Host "4. Extract the ZIP file in public_html/"
Write-Host "5. Point domain cown.name.vn to your hosting"
Write-Host "6. Test the website"
Write-Host "7. Set up SSL certificate"
Write-Host ""
Write-Host "📁 Files ready in: $DEPLOY_DIR/" -ForegroundColor Green
Write-Host "📦 ZIP file: cosmic-social-network-deploy.zip" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Your website will be live at: https://cown.name.vn" -ForegroundColor Magenta
