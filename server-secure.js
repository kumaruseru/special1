// Production Server with Security and Performance Optimizations
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

// Import utilities
const logger = require('./utils/logger');
const { validateEnvironment, getConfig } = require('./utils/config');
const { securityHeaders, authRateLimit, apiRateLimit } = require('./utils/security');

// Validate environment and get config
try {
    validateEnvironment();
    logger.info('Environment validation passed');
} catch (error) {
    logger.error('Environment validation failed', { error: error.message });
    process.exit(1);
}

const config = getConfig();

const app = express();
const server = http.createServer(app);

// Enhanced Socket.IO configuration for production
const io = socketIo(server, {
    cors: {
        origin: config.corsOrigin,
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingTimeout: 120000,
    pingInterval: 30000,
    connectTimeout: 45000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e6, // 1MB limit
    compression: true,
    perMessageDeflate: true
});

// Global error handlers
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason, promise });
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        mongoose.connection.close();
        process.exit(0);
    });
});

// Security middleware
if (config.rateLimiting.enabled) {
    app.use('/api/auth', authRateLimit);
    app.use('/api', apiRateLimit);
}

app.use(securityHeaders());
app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info('HTTP Request', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
    });
    
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    const healthData = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.nodeEnv,
        version: require('./package.json').version,
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        features: config.features
    };
    
    logger.debug('Health check accessed', healthData);
    res.json(healthData);
});

// Static file serving with caching
const staticOptions = {
    maxAge: config.nodeEnv === 'production' ? '1d' : '0',
    etag: true,
    lastModified: true
};

app.use('/assets', express.static(path.join(__dirname, 'assets'), staticOptions));
app.use('/pages', express.static(path.join(__dirname, 'pages'), staticOptions));
app.use('/components', express.static(path.join(__dirname, 'components'), staticOptions));
app.use(express.static(path.join(__dirname), staticOptions));

// Database connection with retry logic
let mongoConnection = null;

const connectToDatabase = async (retries = 5) => {
    try {
        const conn = await mongoose.connect(config.mongoUri, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            bufferMaxEntries: 0,
            maxPoolSize: 10,
            minPoolSize: 2
        });
        
        mongoConnection = conn;
        logger.info('Database connected successfully', {
            host: conn.connection.host,
            name: conn.connection.name
        });
        
        return conn;
    } catch (error) {
        logger.error('Database connection failed', { 
            error: error.message, 
            retries: retries - 1 
        });
        
        if (retries > 1) {
            logger.info('Retrying database connection in 5 seconds...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            return connectToDatabase(retries - 1);
        } else {
            throw error;
        }
    }
};

// Initialize database connection
connectToDatabase().catch(error => {
    logger.error('Failed to connect to database after all retries', { error: error.message });
    process.exit(1);
});

// Import and use existing routes and Socket.IO handlers
// (You would import your existing route handlers here)

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
        ip: req.ip
    });

    res.status(500).json({
        success: false,
        message: config.nodeEnv === 'production' 
            ? 'Internal server error' 
            : error.message
    });
});

// 404 handler
app.use('*', (req, res) => {
    logger.warn('404 - Route not found', {
        path: req.originalUrl,
        method: req.method,
        ip: req.ip
    });

    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Start server
const PORT = config.port;
server.listen(PORT, '0.0.0.0', () => {
    logger.info('Server started successfully', {
        port: PORT,
        environment: config.nodeEnv,
        features: config.features,
        pid: process.pid
    });
});

module.exports = { app, server, io, mongoose, logger, config };
