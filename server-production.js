require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

// Telegram-inspired Socket.IO configuration for production
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    // Prioritize WebSocket with polling fallback (like Telegram)
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    
    // Connection reliability settings inspired by Telegram
    pingTimeout: 120000,        // 2 minutes (Telegram uses long timeouts)
    pingInterval: 30000,        // 30 seconds ping
    connectTimeout: 45000,      // Connection timeout
    upgradeTimeout: 30000,      // Transport upgrade timeout
    
    // Message delivery guarantees (Telegram-style)
    maxHttpBufferSize: 1e6,     // 1MB max message size
    httpCompression: true,       // Enable compression
    perMessageDeflate: true,     // WebSocket compression
    
    // Connection management
    maxConnectionsPerHost: 20,   // Limit connections per host
    destroyUpgradeTimeout: 1000  // Cleanup failed upgrades
});

const PORT = process.env.PORT || 10000;

// === Telegram-style Message Class ===
class TelegramMessage {
    constructor(data) {
        this.id = data.id;
        this.senderId = data.senderId;
        this.senderName = data.senderName;
        this.recipientId = data.recipientId;
        this.text = data.text;
        this.timestamp = data.timestamp;
        this.type = data.type || 'text';
        this.delivered = false;
        this.deliveredAt = null;
        this.retryCount = 0;
        this.maxRetries = 3;
    }
    
    markDelivered() {
        this.delivered = true;
        this.deliveredAt = Date.now();
    }
    
    canRetry() {
        return this.retryCount < this.maxRetries;
    }
    
    incrementRetry() {
        this.retryCount++;
    }
}

// === Connection Health Monitoring ===
const connectionHealthMap = new Map(); // socketId -> health data
const messageQueue = new Map(); // userId -> array of pending messages
const userPresence = new Map(); // userId -> presence data

// === WebRTC Signaling Server ===
const activeUsers = new Map(); // userId -> socketId
const activeCalls = new Map(); // callId -> call data
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

// Telegram-style heartbeat system
setInterval(() => {
    io.emit('ping'); // Server sends ping to all clients
}, 25000); // Every 25 seconds like Telegram

io.on('connection', (socket) => {
    console.log('🔌 Telegram-style connection established:', socket.id);
    
    // Initialize connection health monitoring
    connectionHealthMap.set(socket.id, {
        connectedAt: Date.now(),
        lastPing: Date.now(),
        latency: 0,
        quality: 'excellent'
    });
    
    // === Telegram-style Heartbeat System ===
    socket.on('pong', (data) => {
        const health = connectionHealthMap.get(socket.id);
        if (health) {
            const latency = Date.now() - health.lastPing;
            health.latency = latency;
            health.lastPing = Date.now();
            
            // Determine connection quality
            let quality = 'excellent';
            if (latency > 500) quality = 'poor';
            else if (latency > 200) quality = 'fair';
            else if (latency > 100) quality = 'good';
            
            health.quality = quality;
            
            // Send quality update to client
            socket.emit('connection_quality', { latency, quality });
        }
    });
    
    // === User Presence Management ===
    socket.on('update_presence', (data) => {
        if (socket.userId) {
            userPresence.set(socket.userId, {
                status: data.status,
                lastSeen: data.lastSeen,
                socketId: socket.id
            });
            
            // Broadcast presence update to other users
            socket.broadcast.emit('user_presence_update', {
                userId: socket.userId,
                status: data.status,
                lastSeen: data.lastSeen
            });
        }
    });
    
    // === Queue Message Requests ===
    socket.on('request_queued_messages', () => {
        if (socket.userId && messageQueue.has(socket.userId)) {
            const queuedMessages = messageQueue.get(socket.userId);
            if (queuedMessages.length > 0) {
                socket.emit('queued_messages', queuedMessages);
                messageQueue.delete(socket.userId); // Clear queue after delivery
            }
        }
    });
    
    // === Enhanced Telegram Message Handling ===
    socket.on('telegram_message', (messageData, callback) => {
        console.log('📨 Telegram-style message received:', messageData.id);
        
        try {
            const telegramMessage = new TelegramMessage(messageData);
            
            // Validate message
            if (!telegramMessage.text || !telegramMessage.senderId) {
                if (callback) callback({ success: false, error: 'Invalid message data' });
                return;
            }
            
            // Mark as delivered and send acknowledgment
            telegramMessage.markDelivered();
            
            // Send to recipient or broadcast to room
            if (messageData.recipientId && messageData.recipientId !== 'general') {
                // Direct message
                const recipientUser = activeUsers.get(messageData.recipientId);
                if (recipientUser) {
                    socket.to(recipientUser.socketId).emit('new_telegram_message', telegramMessage);
                } else {
                    // Queue message for offline user
                    if (!messageQueue.has(messageData.recipientId)) {
                        messageQueue.set(messageData.recipientId, []);
                    }
                    messageQueue.get(messageData.recipientId).push(telegramMessage);
                }
            } else {
                // Broadcast to global chat
                socket.to('global_chat').emit('new_telegram_message', telegramMessage);
            }
            
            // Send acknowledgment to sender
            if (callback) {
                callback({ 
                    success: true, 
                    messageId: telegramMessage.id,
                    deliveredAt: telegramMessage.deliveredAt 
                });
            }
            
            // Also send ack event for compatibility
            socket.emit('telegram_message_ack', {
                messageId: telegramMessage.id,
                deliveredAt: telegramMessage.deliveredAt,
                success: true
            });
            
        } catch (error) {
            console.error('❌ Error processing Telegram message:', error);
            if (callback) callback({ success: false, error: error.message });
        }
    });
    
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
    socket.on('send_message', async (data) => {
        console.log('📨 Received send_message event:', {
            hasMessageId: !!data.messageId,
            hasText: !!data.text,
            hasChatId: !!data.chatId,
            hasSenderId: !!data.senderId,
            chatId: data.chatId,
            text: data.text?.substring(0, 50) + (data.text?.length > 50 ? '...' : ''),
            socketUserId: socket.userId,
            socketUsername: socket.username
        });
        
        const { messageId, text, timestamp, chatId, recipientId } = data;
        
        if (!socket.userId) {
            console.error('❌ Socket user not authenticated:', {
                socketId: socket.id,
                hasUserId: !!socket.userId,
                hasUsername: !!socket.username
            });
            socket.emit('message_error', { error: 'User not authenticated for chat' });
            return;
        }
        
        try {
            // Create message data
            const messageData = {
                id: messageId,
                senderId: socket.userId,
                senderName: socket.username || 'Unknown User',
                senderAvatar: socket.avatar || null,
                text: text,
                timestamp: timestamp,
                type: 'text',
                status: 'sent',
                conversationId: chatId || recipientId || 'general'
            };
            
            console.log(`💬 Message from ${socket.username}: ${text}`);
            
            // Save to database if MongoDB is available
            if (mongoConnection && chatId) {
                try {
                    console.log('💾 Attempting to save message to database...', {
                        chatId: chatId,
                        chatIdType: typeof chatId,
                        senderId: socket.userId,
                        senderName: socket.username,
                        text: text
                    });
                    
                    const db = mongoConnection.db();
                    const messagesCollection = db.collection('messages');
                    const conversationsCollection = db.collection('conversations');
                    
                    // Save message to database
                    const dbMessageData = {
                        conversationId: chatId,
                        text: text,
                        senderId: socket.userId,
                        senderName: socket.username || 'Unknown User',
                        senderAvatar: socket.avatar || null,
                        timestamp: new Date(timestamp),
                        type: 'text'
                    };
                    
                    const result = await messagesCollection.insertOne(dbMessageData);
                    console.log('✅ Message saved to database:', result.insertedId);
                    
                    // Update conversation last message
                    const conversationUpdate = await conversationsCollection.updateOne(
                        { _id: new ObjectId(chatId) },
                        {
                            $set: {
                                lastMessage: {
                                    text: text,
                                    senderId: socket.userId,
                                    senderName: socket.username || 'Unknown User',
                                    timestamp: new Date(timestamp)
                                },
                                lastMessageTime: new Date(timestamp)
                            }
                        },
                        { upsert: true }
                    );
                    
                    console.log('✅ Conversation updated:', {
                        matched: conversationUpdate.matchedCount,
                        modified: conversationUpdate.modifiedCount,
                        upserted: conversationUpdate.upsertedCount
                    });
                    
                    messageData.id = result.insertedId.toString();
                    
                } catch (dbError) {
                    console.error('❌ Database save error:', dbError);
                    console.error('❌ Full error details:', {
                        message: dbError.message,
                        stack: dbError.stack,
                        chatId: chatId,
                        mongoConnection: !!mongoConnection
                    });
                }
            } else {
                console.log('⚠️ Message not saved - missing requirements:', {
                    hasMongoConnection: !!mongoConnection,
                    hasChatId: !!chatId
                });
            }
            
            // Broadcast to all users in the conversation
            if (chatId) {
                socket.to(chatId).emit('new_message', messageData);
                socket.to(chatId).emit('message', messageData);
                socket.to(chatId).emit('broadcast_message', messageData);
            } else {
                // Fallback to global chat
                socket.to('global_chat').emit('new_message', messageData);
            }
            
            // Confirm message sent to sender
            socket.emit('message_sent', { messageId, status: 'sent', savedId: messageData.id });
            
        } catch (error) {
            console.error('❌ Send message error:', error);
            socket.emit('message_error', { error: 'Failed to send message' });
        }
    });
    
    // Room management for conversations
    socket.on('join_room', (data) => {
        const { roomId } = data;
        if (roomId && socket.userId) {
            socket.join(roomId);
            console.log(`👥 User ${socket.username} joined room: ${roomId}`);
            
            // Notify others in the room that user joined
            socket.to(roomId).emit('user_joined_room', {
                userId: socket.userId,
                username: socket.username,
                roomId: roomId
            });
        }
    });
    
    socket.on('leave_room', (data) => {
        const { roomId } = data;
        if (roomId && socket.userId) {
            socket.leave(roomId);
            console.log(`👋 User ${socket.username} left room: ${roomId}`);
            
            // Notify others in the room that user left
            socket.to(roomId).emit('user_left_room', {
                userId: socket.userId,
                username: socket.username,
                roomId: roomId
            });
        }
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

    // === Enhanced Disconnect Handler (Telegram-style) ===
    socket.on('disconnect', (reason) => {
        console.log('🔌 Telegram-style disconnection:', socket.id, 'Reason:', reason);
        
        if (socket.userId) {
            // Update presence to offline with grace period (like Telegram)
            const now = Date.now();
            userPresence.set(socket.userId, {
                status: 'offline',
                lastSeen: now,
                disconnectedAt: now,
                socketId: null
            });
            
            // Broadcast presence update with delay (Telegram shows "last seen recently")
            setTimeout(() => {
                socket.broadcast.emit('user_presence_update', {
                    userId: socket.userId,
                    status: 'offline',
                    lastSeen: now
                });
            }, 5000); // 5 second delay before showing offline
            
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
        
        // Clean up connection health monitoring
        connectionHealthMap.delete(socket.id);
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

// Enhanced static file serving for production
app.use('/assets', express.static(path.join(__dirname, 'assets'), {
    maxAge: '1d', // Cache for 1 day
    etag: true
}));
app.use('/pages', express.static(path.join(__dirname, 'pages')));
app.use('/components', express.static(path.join(__dirname, 'components')));
app.use(express.static(path.join(__dirname), {
    maxAge: '1h' // Cache for 1 hour
}));

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
    console.log('Health check accessed at:', new Date().toISOString());
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: mongoConnection ? 'Connected' : 'Disconnected',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        message: 'Server is running'
    });
});

// Database status endpoint
app.get('/api/database-status', (req, res) => {
    console.log('Database status endpoint accessed');
    res.json({
        mongodb: mongoConnection ? 'Connected' : 'Disconnected',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
    console.log('API test endpoint accessed');
    res.json({ 
        message: 'API is working',
        server: 'production',
        timestamp: new Date().toISOString() 
    });
});

// Get user salt endpoint
app.post('/api/get-salt', async (req, res) => {
    console.log('Get salt endpoint accessed:', req.body);
    
    try {
        const { email } = req.body;

        if (!email) {
            console.log('No email provided in get-salt request');
            return res.status(400).json({
                success: false,
                message: 'Email is required!'
            });
        }

        if (!mongoConnection) {
            console.log('Database not available for get-salt request');
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

// Get users endpoint for discovery (public access for demo)
app.get('/api/users', async (req, res) => {
    try {
        console.log('📋 Users endpoint accessed:', req.query);
        const { limit = 10, filter = 'all' } = req.query;
        
        if (!mongoConnection) {
            console.log('Database not available, returning mock users');
            // Return mock users when database not available
            const mockUsers = [
                {
                    id: 'demo_1',
                    firstName: 'Alice',
                    lastName: 'Johnson', 
                    email: 'alice@example.com',
                    fullName: 'Alice Johnson',
                    avatar: 'https://placehold.co/80x80/4F46E5/FFFFFF?text=A'
                },
                {
                    id: 'demo_2',
                    firstName: 'Bob', 
                    lastName: 'Smith',
                    email: 'bob@example.com',
                    fullName: 'Bob Smith',
                    avatar: 'https://placehold.co/80x80/10B981/FFFFFF?text=B'
                },
                {
                    id: 'demo_3',
                    firstName: 'Carol',
                    lastName: 'Davis',
                    email: 'carol@example.com',
                    fullName: 'Carol Davis', 
                    avatar: 'https://placehold.co/80x80/F59E0B/FFFFFF?text=C'
                },
                {
                    id: 'demo_4',
                    firstName: 'David',
                    lastName: 'Wilson',
                    email: 'david@example.com',
                    fullName: 'David Wilson',
                    avatar: 'https://placehold.co/80x80/EF4444/FFFFFF?text=D'
                },
                {
                    id: 'demo_5',
                    firstName: 'Emma',
                    lastName: 'Brown',
                    email: 'emma@example.com', 
                    fullName: 'Emma Brown',
                    avatar: 'https://placehold.co/80x80/8B5CF6/FFFFFF?text=E'
                }
            ];
            
            return res.json({
                success: true,
                users: mockUsers.slice(0, parseInt(limit)),
                total: mockUsers.length,
                message: 'Demo users (database offline)'
            });
        }

        // Try to get real users from database
        const users = await User.find({})
            .select('firstName lastName email fullName')
            .limit(parseInt(limit))
            .lean();

        const formattedUsers = users.map(user => ({
            id: user._id.toString(),
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            fullName: user.fullName || `${user.firstName} ${user.lastName}`,
            avatar: `https://placehold.co/80x80/4F46E5/FFFFFF?text=${(user.firstName || 'U').charAt(0).toUpperCase()}`
        }));

        res.json({
            success: true,
            users: formattedUsers,
            total: formattedUsers.length,
            message: 'Users loaded successfully'
        });

    } catch (error) {
        console.error('❌ Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting users'
        });
    }
});

// Get user conversations
app.get('/api/conversations', authenticateToken, async (req, res) => {
    try {
        console.log('📬 Getting conversations for user:', req.user?.id);
        
        if (!mongoConnection) {
            console.log('Database not available for conversations');
            return res.status(503).json({
                success: false,
                message: 'Database not available'
            });
        }

        const userId = req.user.id;
        const db = mongoConnection.db();
        const conversationsCollection = db.collection('conversations');
        const usersCollection = db.collection('users');
        
        // Find conversations where user is a participant
        const conversations = await conversationsCollection.find({
            participantIds: userId
        }).sort({ lastMessageTime: -1 }).toArray();

        console.log(`Found ${conversations.length} conversations for user ${userId}`);
        
        // Enrich conversations with participant data
        const enrichedConversations = await Promise.all(
            conversations.map(async (conv) => {
                console.log('🔍 Processing conversation:', conv._id.toString());
                
                // Get other participant info
                const otherParticipantIds = conv.participantIds.filter(id => id !== userId);
                const participants = await usersCollection.find({
                    _id: { $in: otherParticipantIds.map(id => new ObjectId(id)) }
                }).toArray();

                const enrichedConv = {
                    id: conv._id.toString(),
                    participants: participants.map(user => ({
                        id: user._id.toString(),
                        name: user.name,
                        username: user.username,
                        email: user.email,
                        avatar: user.avatar || null,
                        online: false // TODO: Add online status tracking
                    })),
                    lastMessage: conv.lastMessage || null,
                    lastMessageTime: conv.lastMessageTime || conv.createdAt,
                    unreadCount: 0, // TODO: Implement unread count
                    createdAt: conv.createdAt
                };
                
                console.log('🔍 Enriched conversation:', {
                    id: enrichedConv.id,
                    participantCount: enrichedConv.participants.length,
                    hasLastMessage: !!enrichedConv.lastMessage
                });
                
                return enrichedConv;
            })
        );

        console.log('📤 Sending enriched conversations:', enrichedConversations.map(c => ({
            id: c.id,
            participantCount: c.participants?.length || 0
        })));

        res.json({
            success: true,
            conversations: enrichedConversations,
            message: 'Conversations loaded successfully'
        });

    } catch (error) {
        console.error('❌ Get conversations error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting conversations'
        });
    }
});

// Create or get conversation with another user
app.post('/api/conversations', authenticateToken, async (req, res) => {
    try {
        const { participantId } = req.body;
        const currentUserId = req.user.id;
        
        console.log('💬 Creating/getting conversation:', { currentUserId, participantId });
        
        if (!mongoConnection) {
            return res.status(503).json({
                success: false,
                message: 'Database not available'
            });
        }

        if (!participantId || participantId === currentUserId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid participant ID'
            });
        }

        const db = mongoConnection.db();
        const conversationsCollection = db.collection('conversations');
        const usersCollection = db.collection('users');
        
        // Check if conversation already exists
        const existingConversation = await conversationsCollection.findOne({
            participantIds: { $all: [currentUserId, participantId], $size: 2 }
        });

        if (existingConversation) {
            console.log('Found existing conversation:', existingConversation._id);
            
            // Get participant info
            const participants = await usersCollection.find({
                _id: { $in: [new ObjectId(currentUserId), new ObjectId(participantId)] }
            }).toArray();

            return res.json({
                success: true,
                conversation: {
                    id: existingConversation._id.toString(),
                    participants: participants.map(user => ({
                        id: user._id.toString(),
                        name: user.name,
                        username: user.username,
                        email: user.email,
                        avatar: user.avatar || null,
                        online: false
                    })),
                    lastMessage: existingConversation.lastMessage || null,
                    lastMessageTime: existingConversation.lastMessageTime,
                    createdAt: existingConversation.createdAt
                },
                message: 'Existing conversation found'
            });
        }

        // Create new conversation
        const newConversation = {
            participantIds: [currentUserId, participantId],
            createdAt: new Date(),
            lastMessage: null,
            lastMessageTime: null
        };

        const result = await conversationsCollection.insertOne(newConversation);
        console.log('Created new conversation:', result.insertedId);

        // Get participant info
        const participants = await usersCollection.find({
            _id: { $in: [new ObjectId(currentUserId), new ObjectId(participantId)] }
        }).toArray();

        res.json({
            success: true,
            conversation: {
                id: result.insertedId.toString(),
                participants: participants.map(user => ({
                    id: user._id.toString(),
                    name: user.name,
                    username: user.username,
                    email: user.email,
                    avatar: user.avatar || null,
                    online: false
                })),
                lastMessage: null,
                lastMessageTime: null,
                createdAt: newConversation.createdAt
            },
            message: 'New conversation created'
        });

    } catch (error) {
        console.error('❌ Create conversation error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating conversation'
        });
    }
});

// Get messages for a conversation
app.get('/api/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { since, limit = 50 } = req.query;
        
        console.log('📨 Getting messages for conversation:', conversationId);
        
        if (!mongoConnection) {
            return res.status(503).json({
                success: false,
                message: 'Database not available'
            });
        }

        const db = mongoConnection.db();
        const messagesCollection = db.collection('messages');
        const conversationsCollection = db.collection('conversations');
        
        // Verify user has access to this conversation
        const conversation = await conversationsCollection.findOne({
            _id: new ObjectId(conversationId),
            participantIds: req.user.id
        });
        
        if (!conversation) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        // Build query
        let query = { conversationId: conversationId };
        if (since) {
            query.timestamp = { $gt: new Date(parseInt(since)) };
        }
        
        // Get messages
        const messages = await messagesCollection
            .find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .toArray();
        
        // Format messages
        const formattedMessages = messages.reverse().map(msg => ({
            id: msg._id.toString(),
            text: msg.text,
            senderId: msg.senderId,
            senderName: msg.senderName,
            senderAvatar: msg.senderAvatar,
            timestamp: msg.timestamp,
            type: msg.type || 'text'
        }));
        
        res.json({
            success: true,
            messages: formattedMessages
        });
        
    } catch (error) {
        console.error('❌ Get messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting messages'
        });
    }
});

// Send message to a conversation
app.post('/api/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { text, type = 'text' } = req.body;
        
        console.log('💬 Sending message to conversation:', conversationId);
        
        if (!mongoConnection) {
            return res.status(503).json({
                success: false,
                message: 'Database not available'
            });
        }

        if (!text || text.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Message text is required'
            });
        }

        const db = mongoConnection.db();
        const messagesCollection = db.collection('messages');
        const conversationsCollection = db.collection('conversations');
        const usersCollection = db.collection('users');
        
        // Verify user has access to this conversation
        const conversation = await conversationsCollection.findOne({
            _id: new ObjectId(conversationId),
            participantIds: req.user.id
        });
        
        if (!conversation) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        // Get sender info
        const sender = await usersCollection.findOne({
            _id: new ObjectId(req.user.id)
        });
        
        // Create message
        const messageData = {
            conversationId: conversationId,
            text: text.trim(),
            senderId: req.user.id,
            senderName: sender?.name || sender?.username || 'Unknown User',
            senderAvatar: sender?.avatar || null,
            timestamp: new Date(),
            type: type
        };
        
        // Save message to database
        const result = await messagesCollection.insertOne(messageData);
        
        // Update conversation last message
        await conversationsCollection.updateOne(
            { _id: new ObjectId(conversationId) },
            {
                $set: {
                    lastMessage: {
                        text: text.trim(),
                        senderId: req.user.id,
                        senderName: messageData.senderName,
                        timestamp: messageData.timestamp
                    },
                    lastMessageTime: messageData.timestamp
                }
            }
        );
        
        // Format message for response
        const savedMessage = {
            id: result.insertedId.toString(),
            ...messageData,
            timestamp: messageData.timestamp.toISOString()
        };
        
        // Emit to Socket.IO clients
        io.to(conversationId).emit('new_message', savedMessage);
        io.to(conversationId).emit('message', savedMessage);
        io.to(conversationId).emit('broadcast_message', savedMessage);
        
        res.json({
            success: true,
            message: savedMessage
        });
        
    } catch (error) {
        console.error('❌ Send message error:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending message'
        });
    }
});

// Token refresh endpoint for users with valid user data
app.post('/api/refresh-token', async (req, res) => {
    try {
        const { email, userId } = req.body;
        console.log('🔄 Token refresh request:', { email, userId });
        
        if (!email && !userId) {
            return res.status(400).json({
                success: false,
                message: 'Email or userId required'
            });
        }

        if (!mongoConnection) {
            console.log('Database not available for token refresh');
            return res.status(503).json({
                success: false,
                message: 'Database not available'
            });
        }

        const db = mongoConnection.db();
        const usersCollection = db.collection('users');

        // Find user by email or ID
        const user = userId ? 
            await usersCollection.findOne({ _id: new ObjectId(userId) }) :
            await usersCollection.findOne({ email: email });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Generate new token
        const token = jwt.sign(
            { userId: user._id.toString(), email: user.email },
            process.env.JWT_SECRET || 'cosmic-social-secret-2024',
            { expiresIn: '30d' }
        );

        console.log('✅ Token refreshed for:', user.email);
        
        res.json({
            success: true,
            token: token,
            user: {
                id: user._id.toString(),
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                name: user.name || `${user.firstName} ${user.lastName}`.trim(),
                username: user.username,
                avatar: user.avatar
            },
            message: 'Token refreshed successfully'
        });

    } catch (error) {
        console.error('❌ Token refresh error:', error);
        res.status(500).json({
            success: false,
            message: 'Error refreshing token'
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
    console.log('🚀 Starting Cosmic Social Network server...');
    console.log('📍 Node version:', process.version);
    console.log('📍 Environment:', process.env.NODE_ENV || 'development');
    console.log('📍 Port:', PORT);
    
    try {
        await initializeDatabase();
        console.log('✅ Database initialization complete');
        
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Cosmic Social Network server running on port ${PORT}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
            console.log(`🔌 WebRTC signaling server ready`);
            console.log('✅ Server startup complete');
        });
    } catch (error) {
        console.error('💥 Server startup failed:', error);
        process.exit(1);
    }
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
