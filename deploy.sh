#!/bin/bash

# 🚀 Deployment Script for Cosmic Social Network
# Deploy to cPanel hosting at cown.name.vn

echo "🌌 Cosmic Social Network - Deployment Script"
echo "============================================="

# Create deployment directory
DEPLOY_DIR="deploy_package"
echo "📦 Creating deployment package..."

# Remove existing deployment directory
rm -rf $DEPLOY_DIR
mkdir $DEPLOY_DIR

# Copy essential files for static hosting
echo "📁 Copying files..."

# Copy main HTML file
cp index.html $DEPLOY_DIR/

# Copy pages
cp -r pages $DEPLOY_DIR/

# Copy assets
cp -r assets $DEPLOY_DIR/

# Copy components
cp -r components $DEPLOY_DIR/

# Copy test files
cp test-audio.html $DEPLOY_DIR/
cp quick-ringtone-test.html $DEPLOY_DIR/

# Copy configuration files
cp .htaccess $DEPLOY_DIR/
cp 404.html $DEPLOY_DIR/

# Copy documentation
cp README.md $DEPLOY_DIR/
cp DEPLOYMENT_GUIDE.md $DEPLOY_DIR/

echo "✅ Files copied successfully!"

# Remove server-side files that are not needed for static hosting
echo "🗑️ Removing server-side files..."
rm -f $DEPLOY_DIR/server.js
rm -f $DEPLOY_DIR/package.json
rm -f $DEPLOY_DIR/package-lock.json
rm -f $DEPLOY_DIR/docker-compose.yml
rm -f $DEPLOY_DIR/Dockerfile
rm -rf $DEPLOY_DIR/node_modules

echo "✅ Server-side files removed!"

# Create ZIP file for easy upload
echo "📦 Creating ZIP file for upload..."
cd $DEPLOY_DIR
zip -r ../cosmic-social-network-deploy.zip .
cd ..

echo "🎉 Deployment package ready!"
echo ""
echo "📋 Next steps:"
echo "1. Upload 'cosmic-social-network-deploy.zip' to your cPanel"
echo "2. Extract to public_html/ directory"
echo "3. Point domain cown.name.vn to hosting"
echo "4. Test the website"
echo "5. Set up SSL certificate"
echo ""
echo "📁 Files ready in: $DEPLOY_DIR/"
echo "📦 ZIP file: cosmic-social-network-deploy.zip"
echo ""
echo "🌐 Your website will be live at: https://cown.name.vn"
