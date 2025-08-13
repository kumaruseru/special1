require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

// Multi-database clients
const Redis = require('redis');
const { Pool } = require('pg');
const neo4j = require('neo4j-driver');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection status
let connections = {
    mongodb: false,
    redis: false,
    postgresql: false,
    neo4j: false
};

// Database clients
let redisClient;
let pgPool;
let neo4jDriver;

// Initialize database connections
async function initializeDatabases() {
    console.log('🔌 Initializing database connections...');

    // MongoDB Connection
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://admin:password123@mongodb:27017/cosmic_social_network?authSource=admin');
        connections.mongodb = true;
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
    }

    // Redis Connection
    try {
        redisClient = Redis.createClient({
            url: process.env.REDIS_URL || 'redis://redis:6379',
            password: 'password123'
        });
        
        redisClient.on('error', (err) => console.error('Redis Client Error:', err));
        redisClient.on('connect', () => {
            connections.redis = true;
            console.log('✅ Redis connected successfully');
        });
        
        await redisClient.connect();
    } catch (error) {
        console.error('❌ Redis connection failed:', error.message);
    }

    // PostgreSQL Connection
    try {
        pgPool = new Pool({
            connectionString: process.env.POSTGRES_URL || 'postgresql://postgres:password123@postgres:5432/cosmic_social_network',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        await pgPool.query('SELECT NOW()');
        connections.postgresql = true;
        console.log('✅ PostgreSQL connected successfully');
    } catch (error) {
        console.error('❌ PostgreSQL connection failed:', error.message);
    }

    // Neo4j Connection
    try {
        neo4jDriver = neo4j.driver(
            process.env.NEO4J_URI || 'bolt://neo4j:7687',
            neo4j.auth.basic(
                process.env.NEO4J_USER || 'neo4j',
                process.env.NEO4J_PASSWORD || 'password123'
            )
        );

        const session = neo4jDriver.session();
        await session.run('RETURN 1');
        await session.close();
        connections.neo4j = true;
        console.log('✅ Neo4j connected successfully');
    } catch (error) {
        console.error('❌ Neo4j connection failed:', error.message);
    }

    console.log('📊 Database Connection Status:', connections);
}

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.static('.'));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.path} - ${new Date().toISOString()}`);
    if (req.body && Object.keys(req.body).length > 0) {
        const logBody = { ...req.body };
        if (logBody.password) logBody.password = '[HIDDEN]';
        if (logBody.confirmPassword) logBody.confirmPassword = '[HIDDEN]';
        console.log('📄 Request body:', logBody);
    }
    next();
});

// User Schema (MongoDB)
const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    salt: {
        type: String,
        required: true
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other'],
        required: true
    },
    birthDate: {
        day: { type: Number, required: true },
        month: { type: Number, required: true },
        year: { type: Number, required: true }
    },
    avatar: {
        type: String,
        default: ''
    },
    bio: {
        type: String,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Hash password before saving (client already sends hashed password)
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    // Password is already hashed from client (SHA256), now we add bcrypt for double protection
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Compare password method (password comes pre-hashed from client)
userSchema.methods.comparePassword = async function(candidateHashedPassword) {
    // candidateHashedPassword is already SHA256 hashed from client
    // We need to bcrypt hash it to compare with stored password
    return bcrypt.compare(candidateHashedPassword, this.password);
};

const User = mongoose.model('User', userSchema);

// Utility functions for multi-database operations
async function logUserAnalytics(userId, actionType, metadata = {}) {
    if (connections.postgresql) {
        try {
            await pgPool.query(
                'INSERT INTO user_analytics (user_id, action_type, metadata) VALUES ($1, $2, $3)',
                [userId, actionType, JSON.stringify(metadata)]
            );
        } catch (error) {
            console.error('Failed to log user analytics:', error.message);
        }
    }
}

async function cacheUserSession(sessionId, userData) {
    if (connections.redis) {
        try {
            await redisClient.setEx(`session:${sessionId}`, 86400, JSON.stringify(userData)); // 24 hours
        } catch (error) {
            console.error('Failed to cache user session:', error.message);
        }
    }
}

async function createUserRelationship(userId1, userId2, relationshipType) {
    if (connections.neo4j) {
        const session = neo4jDriver.session();
        try {
            await session.run(
                'MERGE (u1:User {id: $userId1}) MERGE (u2:User {id: $userId2}) MERGE (u1)-[:' + relationshipType + ']->(u2)',
                { userId1, userId2 }
            );
        } catch (error) {
            console.error('Failed to create user relationship:', error.message);
        } finally {
            await session.close();
        }
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        databases: connections,
        uptime: process.uptime()
    });
});

// Database status endpoint
app.get('/api/database-status', (req, res) => {
    res.json({
        connections,
        services: {
            mongodb: connections.mongodb ? 'Connected' : 'Disconnected',
            redis: connections.redis ? 'Connected' : 'Disconnected',
            postgresql: connections.postgresql ? 'Connected' : 'Disconnected',
            neo4j: connections.neo4j ? 'Connected' : 'Disconnected'
        }
    });
});

// Get user salt endpoint (for secure login)
app.post('/api/get-salt', async (req, res) => {
    try {
        console.log('🔐 Get salt request for:', req.body.email);
        const { email } = req.body;

        if (!email) {
            console.log('❌ No email provided for salt request');
            return res.status(400).json({
                success: false,
                message: 'Email is required!'
            });
        }

        // Find user and return salt
        const user = await User.findOne({ email }).select('salt');
        if (!user) {
            console.log('❌ User not found for salt request:', email);
            return res.status(404).json({
                success: false,
                message: 'Email không tồn tại!'
            });
        }

        console.log('✅ Salt found for user:', email);
        res.json({
            success: true,
            salt: user.salt
        });

    } catch (error) {
        console.error('💥 Get salt error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Lỗi server. Vui lòng thử lại sau!',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Register endpoint
app.post('/api/register', async (req, res) => {
    try {
        console.log('📝 Registration request received:', { ...req.body, password: '[HIDDEN]', confirmPassword: '[HIDDEN]' });
        
        const { firstName, lastName, email, password, confirmPassword, gender, birthDate, salt } = req.body;

        // Validation
        if (!firstName || !lastName || !email || !password || !confirmPassword || !gender || !birthDate || !salt) {
            console.log('❌ Validation failed: Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ thông tin!'
            });
        }

        if (password !== confirmPassword) {
            console.log('❌ Validation failed: Password mismatch');
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu không khớp!'
            });
        }

        // Check if user already exists
        console.log('🔍 Checking if user exists with email:', email);
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log('❌ User already exists');
            return res.status(400).json({
                success: false,
                message: 'Email này đã được đăng ký!'
            });
        }

        // Validate birth date
        const birth = new Date(birthDate.year, birthDate.month - 1, birthDate.day);
        const today = new Date();
        const age = today.getFullYear() - birth.getFullYear();
        
        if (age < 13) {
            console.log('❌ Validation failed: Age under 13');
            return res.status(400).json({
                success: false,
                message: 'Bạn phải từ 13 tuổi trở lên để đăng ký!'
            });
        }

        // Create new user in MongoDB
        console.log('👤 Creating new user...');
        const newUser = new User({
            firstName,
            lastName,
            email,
            password,
            salt,
            gender,
            birthDate
        });

        await newUser.save();
        console.log('✅ User created successfully:', newUser._id);

        // Log analytics in PostgreSQL
        await logUserAnalytics(newUser._id.toString(), 'user_registered', {
            email,
            gender,
            age
        });

        // Create user node in Neo4j
        await createUserRelationship(newUser._id.toString(), newUser._id.toString(), 'SELF');

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: newUser._id,
                email: newUser.email 
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        // Cache session in Redis
        await cacheUserSession(token, {
            userId: newUser._id.toString(),
            email: newUser.email,
            fullName: `${newUser.firstName} ${newUser.lastName}`
        });

        console.log('🎉 Registration successful for:', email);
        res.status(201).json({
            success: true,
            message: 'Đăng ký thành công!',
            user: {
                id: newUser._id,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                email: newUser.email,
                fullName: `${newUser.firstName} ${newUser.lastName}`,
                gender: newUser.gender,
                birthDate: newUser.birthDate
            },
            token
        });

    } catch (error) {
        console.error('💥 Registration error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Lỗi server. Vui lòng thử lại sau!',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        console.log('🔑 Login request for:', req.body.email);
        const { email, password } = req.body;

        if (!email || !password) {
            console.log('❌ Missing email or password');
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập đầy đủ email và mật khẩu!'
            });
        }

        // Find user
        console.log('🔍 Looking for user:', email);
        const user = await User.findOne({ email });
        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({
                success: false,
                message: 'Email hoặc mật khẩu không đúng!'
            });
        }

        console.log('👤 User found, checking password...');
        // Check password (password is already hashed from client)
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            console.log('❌ Password validation failed for:', email);
            return res.status(401).json({
                success: false,
                message: 'Email hoặc mật khẩu không đúng!'
            });
        }

        console.log('✅ Password valid, generating token...');
        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user._id,
                email: user.email 
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        // Log analytics
        await logUserAnalytics(user._id.toString(), 'user_login', {
            email,
            loginTime: new Date()
        });

        // Cache session
        await cacheUserSession(token, {
            userId: user._id.toString(),
            email: user.email,
            fullName: `${user.firstName} ${user.lastName}`
        });

        console.log('🎉 Login successful for:', email);
        res.json({
            success: true,
            message: 'Đăng nhập thành công!',
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                fullName: `${user.firstName} ${user.lastName}`,
                gender: user.gender,
                avatar: user.avatar,
                bio: user.bio
            },
            token
        });

    } catch (error) {
        console.error('💥 Login error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Lỗi server. Vui lòng thử lại sau!',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize databases and start server
async function startServer() {
    await initializeDatabases();
    
    app.listen(PORT, () => {
        console.log(`🚀 Cosmic Social Network server running on http://localhost:${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 Management UIs:`);
        console.log(`   - Mongo Express: http://localhost:8083`);
        console.log(`   - pgAdmin: http://localhost:8082`);
        console.log(`   - Redis Commander: http://localhost:8081`);
        console.log(`   - Neo4j Browser: http://localhost:7474`);
    });
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down gracefully...');
    
    if (redisClient) await redisClient.quit();
    if (pgPool) await pgPool.end();
    if (neo4jDriver) await neo4jDriver.close();
    await mongoose.connection.close();
    
    process.exit(0);
});

startServer().catch(console.error);
