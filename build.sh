#!/bin/bash

# Render Build Script for Cosmic Social Network

echo "🚀 Starting Render build process..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run any build commands if needed
echo "🔧 Running build commands..."
npm run build

# Ensure all required directories exist
mkdir -p assets/css
mkdir -p assets/js
mkdir -p components
mkdir -p pages

echo "✅ Build completed successfully!"
