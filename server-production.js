require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 10000;

// === WebRTC Signaling Server ===
const activeUsers = new Map(); // userId -> socketId
const activeCalls = new Map(); // callId -> call data
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

io.on('connection', (socket) => {
    console.log('🔌 User connected:', socket.id);

    // === Real-time Messaging ===
    
    // Join chat room (guest or authenticated)
    socket.on('join_chat', (data) => {
        const { userId, username, avatar } = data;
        socket.userId = userId;
        socket.username = username;
        socket.avatar = avatar;
        
        // Join global chat room
        socket.join('global_chat');
        activeUsers.set(userId, { 
            socketId: socket.id, 
            username, 
            avatar,
            isAuthenticated: false 
        });
        
        console.log(`💬 User joined chat: ${username} (Guest)`);
        
        // Notify others about new user
        socket.to('global_chat').emit('user_joined', {
            userId,
            username,
            avatar
        });
        
        // Send current online users
        const onlineUsersList = Array.from(activeUsers.entries()).map(([id, user]) => ({
            userId: id,
            username: user.username,
            avatar: user.avatar,
            isAuthenticated: user.isAuthenticated
        }));
        
        socket.emit('online_users_update', onlineUsersList);
    });
    
    // Send message
    socket.on('send_message', (data) => {
        const { messageId, text, timestamp, chatId } = data;
        
        if (!socket.userId) {
            socket.emit('message_error', { error: 'User not authenticated for chat' });
            return;
        }
        
        const messageData = {
            id: messageId,
            senderId: socket.userId,
            senderName: socket.username,
            senderAvatar: socket.avatar,
            text: text,
            timestamp: timestamp,
            type: 'text',
            status: 'sent'
        };
        
        console.log(`💬 Message from ${socket.username}: ${text}`);
        
        // Broadcast to all users in chat room (except sender)
        socket.to('global_chat').emit('new_message', messageData);
        
        // Confirm message sent to sender
        socket.emit('message_sent', { messageId, status: 'sent' });
    });
    
    // Typing indicators
    socket.on('typing_start', (data) => {
        if (socket.userId && socket.username) {
            socket.to('global_chat').emit('typing_start', {
                userId: socket.userId,
                username: socket.username
            });
        }
    });
    
    socket.on('typing_stop', (data) => {
        if (socket.userId && socket.username) {
            socket.to('global_chat').emit('typing_stop', {
                userId: socket.userId,
                username: socket.username
            });
        }
    });
    
    // Leave chat
    socket.on('leave_chat', (data) => {
        if (socket.userId) {
            socket.to('global_chat').emit('user_left', {
                userId: socket.userId,
                username: socket.username
            });
        }
    });

    // === WebRTC Authentication & Calls ===

    // User authentication for WebRTC
    socket.on('authenticate', (data) => {
        const { token } = data;
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            socket.userId = decoded.userId;
            socket.username = decoded.username || `${decoded.firstName} ${decoded.lastName}`;
            socket.isAuthenticated = true;
            
            // Update in activeUsers map for both messaging and calling
            activeUsers.set(decoded.userId, { 
                socketId: socket.id, 
                username: socket.username,
                avatar: socket.avatar || `https://placehold.co/40x40/4F46E5/FFFFFF?text=${decoded.firstName?.charAt(0) || 'U'}${decoded.lastName?.charAt(0) || ''}`,
                isAuthenticated: true 
            });
            
            // Join chat room for authenticated users
            socket.join('global_chat');
            
            socket.emit('authenticated', { 
                userId: decoded.userId, 
                username: socket.username 
            });
            
            // Notify others about authenticated user
            socket.to('global_chat').emit('user_joined', {
                userId: decoded.userId,
                username: socket.username,
                avatar: socket.avatar,
                isAuthenticated: true
            });
            
            console.log(`✅ User authenticated for chat & WebRTC: ${socket.username} (${decoded.userId})`);
        } catch (error) {
            socket.emit('authentication_failed', { error: 'Invalid token' });
        }
    });

    // Initiate a call
    socket.on('initiate_call', (data) => {
        const { targetUserId, callType } = data; // callType: 'voice' or 'video'
        const callerId = socket.userId;
        const callerUsername = socket.username;
        
        if (!callerId || !targetUserId) {
            socket.emit('call_error', { error: 'Invalid user data' });
            return;
        }

        const targetUserData = activeUsers.get(targetUserId);
        if (!targetUserData) {
            socket.emit('call_error', { error: 'User is offline' });
            return;
        }

        // Create call session
        const callId = crypto.randomUUID();
        const callData = {
            callId,
            callerId,
            callerUsername,
            targetUserId,
            callType,
            status: 'ringing',
            startTime: new Date().toISOString()
        };

        activeCalls.set(callId, callData);

        // Notify target user
        io.to(targetUserData.socketId).emit('incoming_call', {
            callId,
            callerId,
            callerUsername,
            callType
        });

        // Confirm to caller
        socket.emit('call_initiated', { callId, callData });
        
        console.log(`📞 Call initiated: ${callerUsername} -> ${targetUserId} (${callType})`);
    });

    // Answer call
    socket.on('answer_call', (data) => {
        const { callId, answer } = data;
        const callData = activeCalls.get(callId);
        
        if (!callData) {
            socket.emit('call_error', { error: 'Call not found' });
            return;
        }

        if (answer === 'accept') {
            callData.status = 'accepted';
            activeCalls.set(callId, callData);

            const callerUserData = activeUsers.get(callData.callerId);
            if (callerUserData) {
                io.to(callerUserData.socketId).emit('call_accepted', { callId });
            }
            socket.emit('call_accepted', { callId });
            
            console.log(`✅ Call accepted: ${callId}`);
        } else {
            callData.status = 'declined';
            activeCalls.delete(callId);

            const callerUserData = activeUsers.get(callData.callerId);
            if (callerUserData) {
                io.to(callerUserData.socketId).emit('call_declined', { callId });
            }
            
            console.log(`❌ Call declined: ${callId}`);
        }
    });

    // WebRTC signaling events
    ['webrtc_offer', 'webrtc_answer', 'webrtc_ice_candidate'].forEach(eventName => {
        socket.on(eventName, (data) => {
            const { callId } = data;
            const callData = activeCalls.get(callId);
            
            if (!callData) {
                socket.emit('call_error', { error: 'Call not found' });
                return;
            }

            const targetUserId = socket.userId === callData.callerId 
                ? callData.targetUserId 
                : callData.callerId;
            
            const targetUserData = activeUsers.get(targetUserId);
            if (targetUserData) {
                io.to(targetUserData.socketId).emit(eventName, data);
            }
        });
    });

    // End call
    socket.on('end_call', (data) => {
        const { callId } = data;
        const callData = activeCalls.get(callId);
        
        if (callData) {
            const targetUserId = socket.userId === callData.callerId 
                ? callData.targetUserId 
                : callData.callerId;
            
            const targetUserData = activeUsers.get(targetUserId);
            if (targetUserData) {
                io.to(targetUserData.socketId).emit('call_ended', { callId });
            }
            
            activeCalls.delete(callId);
            console.log(`📞 Call ended: ${callId}`);
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        if (socket.userId) {
            // Remove from active users
            activeUsers.delete(socket.userId);
            
            // Notify chat users
            socket.to('global_chat').emit('user_left', {
                userId: socket.userId,
                username: socket.username
            });
            
            // End any active calls for this user
            for (const [callId, callData] of activeCalls.entries()) {
                if (callData.callerId === socket.userId || callData.targetUserId === socket.userId) {
                    const otherUserId = callData.callerId === socket.userId 
                        ? callData.targetUserId 
                        : callData.callerId;
                    
                    const otherUserData = activeUsers.get(otherUserId);
                    if (otherUserData) {
                        io.to(otherUserData.socketId).emit('call_ended', { callId, reason: 'user_disconnected' });
                    }
                    
                    activeCalls.delete(callId);
                }
            }
        }
        
        console.log('🔌 User disconnected:', socket.id);
    });
});

// Simplified database connection for production
let mongoConnection = false;

// Initialize MongoDB connection (primary database)
async function initializeDatabase() {
    console.log('🔌 Initializing database connection...');

    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            console.warn('⚠️  MongoDB URI not provided. Running without database.');
            return;
        }

        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 10000,
        });
        
        mongoConnection = true;
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
    }

    console.log('📊 Database Status:', { mongodb: mongoConnection });
}

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(express.json());
app.use(express.static('.'));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.path} - ${new Date().toISOString()}`);
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

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidateHashedPassword) {
    return bcrypt.compare(candidateHashedPassword, this.password);
};

const User = mongoose.model('User', userSchema);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: mongoConnection ? 'Connected' : 'Disconnected',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Database status endpoint
app.get('/api/database-status', (req, res) => {
    res.json({
        mongodb: mongoConnection ? 'Connected' : 'Disconnected',
        environment: process.env.NODE_ENV || 'development'
    });
});

// Get user salt endpoint
app.post('/api/get-salt', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required!'
            });
        }

        if (!mongoConnection) {
            return res.status(503).json({
                success: false,
                message: 'Database not available'
            });
        }

        const user = await User.findOne({ email }).select('salt');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Email không tồn tại!'
            });
        }

        res.json({
            success: true,
            salt: user.salt
        });

    } catch (error) {
        console.error('💥 Get salt error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server. Vui lòng thử lại sau!'
        });
    }
});

// Register endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { firstName, lastName, email, password, confirmPassword, gender, birthDate, salt } = req.body;

        // Validation
        if (!firstName || !lastName || !email || !password || !confirmPassword || !gender || !birthDate || !salt) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ thông tin!'
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu không khớp!'
            });
        }

        if (!mongoConnection) {
            return res.status(503).json({
                success: false,
                message: 'Database not available'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
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
            return res.status(400).json({
                success: false,
                message: 'Bạn phải từ 13 tuổi trở lên để đăng ký!'
            });
        }

        // Create new user
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

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: newUser._id,
                email: newUser.email,
                firstName: newUser.firstName,
                lastName: newUser.lastName
            },
            process.env.JWT_SECRET || 'default-secret-key',
            { expiresIn: '24h' }
        );

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
        res.status(500).json({
            success: false,
            message: 'Lỗi server. Vui lòng thử lại sau!'
        });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập đầy đủ email và mật khẩu!'
            });
        }

        if (!mongoConnection) {
            return res.status(503).json({
                success: false,
                message: 'Database not available'
            });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Email hoặc mật khẩu không đúng!'
            });
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Email hoặc mật khẩu không đúng!'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName
            },
            process.env.JWT_SECRET || 'default-secret-key',
            { expiresIn: '24h' }
        );

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
        res.status(500).json({
            success: false,
            message: 'Lỗi server. Vui lòng thử lại sau!'
        });
    }
});

// JWT middleware for protected routes
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access token required'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }
        req.user = user;
        next();
    });
};

// Protected API endpoints
app.get('/api/profile/me', authenticateToken, async (req, res) => {
    try {
        if (!mongoConnection) {
            return res.status(503).json({
                success: false,
                message: 'Database not available'
            });
        }

        const user = await User.findById(req.user.userId).select('-password -salt');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                fullName: `${user.firstName} ${user.lastName}`,
                gender: user.gender,
                birthDate: user.birthDate,
                avatar: user.avatar || `https://placehold.co/96x96/4F46E5/FFFFFF?text=${user.firstName.charAt(0)}${user.lastName.charAt(0)}`,
                bio: user.bio,
                posts: 0,
                friendsCount: 0
            }
        });

    } catch (error) {
        console.error('💥 Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting profile'
        });
    }
});

// Get user posts endpoint
app.get('/api/posts/user/me', authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            posts: []
        });
    } catch (error) {
        console.error('💥 Get user posts error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting user posts'
        });
    }
});

// Get friends endpoint
app.get('/api/friends', authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            friends: []
        });
    } catch (error) {
        console.error('💥 Get friends error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting friends'
        });
    }
});

// Get feed endpoint
app.get('/api/posts', authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            posts: []
        });
    } catch (error) {
        console.error('💥 Get feed error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting feed'
        });
    }
});

// Create post endpoint
app.post('/api/posts', authenticateToken, async (req, res) => {
    try {
        const { content, images, taggedFriends, location } = req.body;
        
        res.json({
            success: true,
            message: 'Post created successfully',
            post: {
                id: Date.now().toString(),
                content,
                images: images || [],
                taggedFriends: taggedFriends || [],
                location: location || null,
                author: {
                    id: req.user.userId,
                    name: `${req.user.firstName} ${req.user.lastName}`,
                    avatar: 'https://placehold.co/48x48/4F46E5/FFFFFF?text=U'
                },
                createdAt: new Date().toISOString(),
                likesCount: 0,
                commentsCount: 0,
                isLiked: false
            }
        });
    } catch (error) {
        console.error('💥 Create post error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating post'
        });
    }
});

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Catch all other routes and serve index.html (for SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize database and start server
async function startServer() {
    await initializeDatabase();
    
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Cosmic Social Network server running on port ${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
        console.log(`🔌 WebRTC signaling server ready`);
    });
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});

startServer().catch(console.error);
