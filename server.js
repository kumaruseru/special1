require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

// Email functionality
const { 
    sendWelcomeEmail, 
    sendPasswordResetEmail, 
    sendVerificationEmail, 
    sendNotificationEmail,
    testEmailConnection 
} = require('./config/email');

// Multi-database clients
const Redis = require('redis');
const { Pool } = require('pg');
const neo4j = require('neo4j-driver');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3001;

// Encryption utilities for messages
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-secret-key-here!';
const IV_LENGTH = 16; // For AES, this is always 16

// Encryption functions
function encryptMessage(text) {
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        return text; // Return original if encryption fails
    }
}

function decryptMessage(text) {
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = textParts.join(':');
        const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        return text; // Return original if decryption fails
    }
}

function encryptMessage(text) {
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        return text; // Return original if encryption fails
    }
}

function decryptMessage(text) {
    try {
        const textParts = text.split(':');
        if (textParts.length < 2) {
            return text; // Not encrypted format
        }
        
        const iv = Buffer.from(textParts[0], 'hex');
        const encryptedText = textParts[1];
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        return text; // Return original if decryption fails
    }
}

// Database connections
let redisClient;
let pgPool;
let neo4jDriver;
let mongoConnected = false;
let redisConnected = false;
let pgConnected = false;
let neo4jConnected = false;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
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

// Connect to MongoDB
let isMongoConnected = false;
mongoose.connect(process.env.MONGODB_URI)
.then(() => {
    console.log('✅ Connected to MongoDB Atlas successfully!');
    isMongoConnected = true;
})
.catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('⚠️  Running in fallback mode - using memory storage');
    isMongoConnected = false;
});

// In-memory storage fallback
let memoryUsers = [];

// User Schema
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
    },
    resetPasswordToken: {
        type: String,
        default: undefined
    },
    resetPasswordExpiry: {
        type: Date,
        default: undefined
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: {
        type: String,
        default: undefined
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

// Message Schema
const messageSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read'],
        default: 'sent'
    },
    isEncrypted: {
        type: Boolean,
        default: false
    }
});

const Message = mongoose.model('Message', messageSchema);

// Friend Request Schema
const friendRequestSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    },
    message: {
        type: String,
        default: '',
        trim: true
    }
}, {
    timestamps: true
});

// Ensure one friend request per pair
friendRequestSchema.index({ senderId: 1, receiverId: 1 }, { unique: true });

const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema);

// Friendship Schema
const friendshipSchema = new mongoose.Schema({
    user1Id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    user2Id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'blocked'],
        default: 'active'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Ensure one friendship per pair (with consistent ordering)
friendshipSchema.index({ user1Id: 1, user2Id: 1 }, { unique: true });

const Friendship = mongoose.model('Friendship', friendshipSchema);

// Post Schema
const postSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    images: [{
        filename: String,
        originalName: String,
        mimetype: String,
        size: Number,
        url: String
    }],
    taggedFriends: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        name: String,
        username: String
    }],
    location: {
        name: String,
        address: String,
        coordinates: {
            lat: Number,
            lng: Number
        }
    },
    likes: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    comments: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        content: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for efficient querying
postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ isDeleted: 1, createdAt: -1 });

const Post = mongoose.model('Post', postSchema);

// Routes

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

        // Create new user
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

        // Send welcome email
        const userName = `${newUser.firstName} ${newUser.lastName}`;
        try {
            await sendWelcomeEmail(newUser.email, userName);
            console.log('📧 Welcome email sent to:', newUser.email);
        } catch (emailError) {
            console.error('📧 Failed to send welcome email:', emailError);
            // Don't fail registration if email fails
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: newUser._id,
                email: newUser.email 
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

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

// Forgot Password endpoint
app.post('/api/forgot-password', async (req, res) => {
    try {
        console.log('🔐 Forgot password request received for:', req.body.email);
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập email!'
            });
        }

        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            // Don't reveal if user exists or not for security
            return res.status(200).json({
                success: true,
                message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được email reset password.'
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Save reset token to user
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpiry = resetTokenExpiry;
        await user.save();

        // Send reset email
        const userName = `${user.firstName} ${user.lastName}`;
        try {
            await sendPasswordResetEmail(user.email, resetToken, userName);
            console.log('📧 Password reset email sent to:', user.email);
        } catch (emailError) {
            console.error('📧 Failed to send reset email:', emailError);
            return res.status(500).json({
                success: false,
                message: 'Không thể gửi email. Vui lòng thử lại!'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Email reset password đã được gửi!'
        });

    } catch (error) {
        console.error('💥 Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server. Vui lòng thử lại sau!'
        });
    }
});

// Reset Password endpoint
app.post('/api/reset-password', async (req, res) => {
    try {
        console.log('🔐 Reset password request received');
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Token và mật khẩu mới là bắt buộc!'
            });
        }

        // Find user with valid reset token
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpiry: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Token không hợp lệ hoặc đã hết hạn!'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        
        // Update user password and clear reset token
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpiry = undefined;
        await user.save();

        console.log('✅ Password reset successful for:', user.email);
        res.status(200).json({
            success: true,
            message: 'Mật khẩu đã được cập nhật thành công!'
        });

    } catch (error) {
        console.error('💥 Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server. Vui lòng thử lại sau!'
        });
    }
});

// Email test endpoint (for development)
app.post('/api/test-email', async (req, res) => {
    try {
        const { type, email, name } = req.body;
        
        let result;
        switch (type) {
            case 'welcome':
                result = await sendWelcomeEmail(email || 'test@example.com', name || 'Test User');
                break;
            case 'reset':
                result = await sendPasswordResetEmail(email || 'test@example.com', 'test-token-123', name || 'Test User');
                break;
            case 'verify':
                result = await sendVerificationEmail(email || 'test@example.com', 'verify-token-123', name || 'Test User');
                break;
            case 'notification':
                result = await sendNotificationEmail(email || 'test@example.com', name || 'Test User', 'new_message', 'You have a new message from the cosmic network!');
                break;
            case 'connection':
                result = await testEmailConnection();
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email test type. Use: welcome, reset, verify, notification, or connection'
                });
        }
        
        res.json({
            success: result.success,
            message: result.success ? 'Email sent successfully!' : 'Failed to send email',
            details: result
        });
        
    } catch (error) {
        console.error('Email test error:', error);
        res.status(500).json({
            success: false,
            message: 'Email test failed',
            error: error.message
        });
    }
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const authHeader = req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    console.log('🔐 Token verification - Auth header:', !!authHeader, 'Token:', !!token);
    
    if (!token) {
        console.log('❌ No token provided');
        return res.status(401).json({
            success: false,
            message: 'Access denied. No token provided.'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('✅ Token verified for user:', decoded.userId);
        req.user = decoded;
        next();
    } catch (error) {
        console.log('❌ Token verification failed:', error.message);
        return res.status(400).json({
            success: false,
            message: 'Invalid token.'
        });
    }
};

// Get all users for discovery (protected route)
app.get('/api/users', verifyToken, async (req, res) => {
    try {
        console.log('👥 Getting users list...');
        const { search, filter, limit = 20, skip = 0 } = req.query;
        const currentUserId = req.user.userId;

        let query = { _id: { $ne: currentUserId }, isActive: true };

        // Search by name or email
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { firstName: searchRegex },
                { lastName: searchRegex },
                { email: searchRegex },
                { bio: searchRegex }
            ];
        }

        // Apply filters (friends, suggested, etc.)
        if (filter === 'friends') {
            // TODO: Implement friends relationship when friendship system is ready
            query.friends = { $in: [currentUserId] };
        }

        const users = await User.find(query)
            .select('firstName lastName email avatar bio gender createdAt')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        // Get friend requests to check status
        const sentRequests = await FriendRequest.find({ 
            senderId: currentUserId, 
            status: 'pending' 
        }).select('receiverId');
        
        const receivedRequests = await FriendRequest.find({ 
            receiverId: currentUserId, 
            status: 'pending' 
        }).select('senderId');

        const sentRequestUserIds = sentRequests.map(req => req.receiverId.toString());
        const receivedRequestUserIds = receivedRequests.map(req => req.senderId.toString());

        const totalUsers = await User.countDocuments(query);

        console.log(`✅ Found ${users.length} users`);
        res.json({
            success: true,
            users: users.map(user => {
                const userId = user._id.toString();
                return {
                    id: user._id,
                    name: `${user.firstName} ${user.lastName}`,
                    username: user.email.split('@')[0],
                    email: user.email,
                    avatar: user.avatar || `https://placehold.co/60x60/8A2BE2/FFFFFF?text=${user.firstName.charAt(0)}${user.lastName.charAt(0)}`,
                    bio: user.bio || `Xin chào! Tôi là ${user.firstName}`,
                    gender: user.gender,
                    joinDate: user.createdAt,
                    isOnline: false, // TODO: Implement real online status
                    followers: '0', // TODO: Count real followers
                    isFriend: false, // TODO: Check actual friendship status
                    friendRequestSent: sentRequestUserIds.includes(userId),
                    friendRequestReceived: receivedRequestUserIds.includes(userId)
                };
            }),
            pagination: {
                total: totalUsers,
                limit: parseInt(limit),
                skip: parseInt(skip),
                hasMore: totalUsers > (parseInt(skip) + parseInt(limit))
            }
        });

    } catch (error) {
        console.error('💥 Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server. Vui lòng thử lại sau!',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get user profile by ID (protected route)
app.get('/api/users/:id', verifyToken, async (req, res) => {
    try {
        console.log('👤 Getting user profile:', req.params.id);
        const userId = req.params.id;
        const currentUserId = req.user.userId;

        if (userId === currentUserId) {
            // Get current user's own profile
            const user = await User.findById(userId).select('-password -salt');
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Người dùng không tồn tại!'
                });
            }

            return res.json({
                success: true,
                user: {
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    name: `${user.firstName} ${user.lastName}`,
                    username: user.email.split('@')[0],
                    email: user.email,
                    avatar: user.avatar,
                    bio: user.bio,
                    gender: user.gender,
                    birthDate: user.birthDate,
                    joinDate: user.createdAt,
                    isActive: user.isActive
                }
            });
        } else {
            // Get another user's public profile
            const user = await User.findById(userId).select('firstName lastName email avatar bio gender createdAt');
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Người dùng không tồn tại!'
                });
            }

            return res.json({
                success: true,
                user: {
                    id: user._id,
                    name: `${user.firstName} ${user.lastName}`,
                    username: user.email.split('@')[0],
                    email: user.email,
                    avatar: user.avatar || `https://placehold.co/60x60/8A2BE2/FFFFFF?text=${user.firstName.charAt(0)}${user.lastName.charAt(0)}`,
                    bio: user.bio || `Xin chào! Tôi là ${user.firstName}`,
                    gender: user.gender,
                    joinDate: user.createdAt,
                    isOnline: false,
                    followers: '0',
                    isFriend: false // TODO: Check actual friendship status
                }
            });
        }

    } catch (error) {
        console.error('💥 Get user profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server. Vui lòng thử lại sau!',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get current user profile (protected route)
app.get('/api/profile/me', verifyToken, async (req, res) => {
    try {
        console.log('👤 Getting current user profile:', req.user.userId);
        const user = await User.findById(req.user.userId).select('-password -salt');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Người dùng không tồn tại!'
            });
        }

        // Get user statistics (real data from database)
        const stats = {
            posts: 0, // TODO: Count actual posts from database
            following: 0, // TODO: Count actual following relationships
            followers: 0  // TODO: Count actual followers
        };

        return res.json({
            success: true,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                name: `${user.firstName} ${user.lastName}`,
                username: user.email.split('@')[0],
                email: user.email,
                avatar: user.avatar || `https://placehold.co/128x128/4F46E5/FFFFFF?text=${user.firstName.charAt(0)}${user.lastName.charAt(0)}`,
                bio: user.bio || `Xin chào! Tôi là ${user.firstName} ${user.lastName}`,
                gender: user.gender,
                birthDate: user.birthDate,
                joinDate: user.createdAt,
                isActive: user.isActive,
                stats
            }
        });

    } catch (error) {
        console.error('💥 Get current user profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server. Vui lòng thử lại sau!',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Messages endpoints
// Send a message
app.post('/api/messages', verifyToken, async (req, res) => {
    try {
        console.log('💬 Sending message:', { ...req.body, content: req.body.isEncrypted ? '[ENCRYPTED]' : req.body.content });
        
        const { receiverId, content, isEncrypted } = req.body;
        
        if (!receiverId || !content) {
            return res.status(400).json({
                success: false,
                message: 'Receiver ID và nội dung tin nhắn là bắt buộc!'
            });
        }

        // Verify receiver exists
        const receiver = await User.findById(receiverId);
        if (!receiver) {
            return res.status(404).json({
                success: false,
                message: 'Người nhận không tồn tại!'
            });
        }

        // Create new message with encryption
        const encryptedContent = encryptMessage(content.trim());
        
        const message = new Message({
            senderId: req.user.userId,
            receiverId: receiverId,
            content: encryptedContent,
            isEncrypted: true
        });

        const savedMessage = await message.save();

        // Populate sender info for response
        await savedMessage.populate('senderId', 'firstName lastName email');

        console.log('✅ Message sent successfully:', savedMessage._id, isEncrypted ? '(encrypted)' : '(plain text)');

        res.json({
            success: true,
            message: 'Tin nhắn đã được gửi!',
            data: {
                id: savedMessage._id,
                senderId: savedMessage.senderId._id,
                receiverId: savedMessage.receiverId,
                content: savedMessage.content,
                createdAt: savedMessage.createdAt,
                status: savedMessage.status,
                sender: {
                    id: savedMessage.senderId._id,
                    name: `${savedMessage.senderId.firstName} ${savedMessage.senderId.lastName}`,
                    email: savedMessage.senderId.email
                }
            }
        });

    } catch (error) {
        console.error('💥 Send message error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server. Vui lòng thử lại sau!',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Send friend request
app.post('/api/friend-requests', verifyToken, async (req, res) => {
    try {
        console.log('👋 Friend request from:', req.user.userId, 'to:', req.body.receiverId);
        const { receiverId, message } = req.body;
        
        if (!receiverId) {
            return res.status(400).json({
                success: false,
                message: 'Receiver ID is required'
            });
        }

        // Check if receiver exists
        const receiver = await User.findById(receiverId);
        if (!receiver) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if already friends or request exists
        const existingRequest = await FriendRequest.findOne({
            $or: [
                { senderId: req.user.userId, receiverId: receiverId },
                { senderId: receiverId, receiverId: req.user.userId }
            ]
        });

        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: existingRequest.status === 'pending' ? 'Friend request already sent' : 'Already connected'
            });
        }

        const friendRequest = new FriendRequest({
            senderId: req.user.userId,
            receiverId: receiverId,
            message: message || ''
        });

        await friendRequest.save();

        res.json({
            success: true,
            message: 'Friend request sent successfully',
            friendRequest: friendRequest
        });

    } catch (error) {
        console.error('💥 Send friend request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get friend requests (incoming)
app.get('/api/friend-requests', verifyToken, async (req, res) => {
    try {
        console.log('📋 Getting friend requests for user:', req.user.userId);
        
        const friendRequests = await FriendRequest.find({
            receiverId: req.user.userId,
            status: 'pending'
        }).populate('senderId', 'firstName lastName email avatar')
          .sort({ createdAt: -1 });

        const formattedRequests = friendRequests.map(request => ({
            id: request._id,
            sender: {
                id: request.senderId._id,
                name: `${request.senderId.firstName} ${request.senderId.lastName}`,
                email: request.senderId.email,
                avatar: request.senderId.avatar || `https://placehold.co/48x48/4F46E5/FFFFFF?text=${request.senderId.firstName.charAt(0)}${request.senderId.lastName.charAt(0)}`
            },
            message: request.message,
            createdAt: request.createdAt,
            status: request.status
        }));

        res.json({
            success: true,
            friendRequests: formattedRequests,
            count: formattedRequests.length
        });

    } catch (error) {
        console.error('💥 Get friend requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Accept or reject friend request
app.put('/api/friend-requests/:requestId', verifyToken, async (req, res) => {
    try {
        console.log('📝 Friend request action:', req.params.requestId, req.body.action);
        const { requestId } = req.params;
        const { action } = req.body; // 'accept' or 'reject'
        
        if (!['accept', 'reject'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid action. Must be "accept" or "reject"'
            });
        }

        const friendRequest = await FriendRequest.findOne({
            _id: requestId,
            receiverId: req.user.userId,
            status: 'pending'
        });

        if (!friendRequest) {
            return res.status(404).json({
                success: false,
                message: 'Friend request not found or already processed'
            });
        }

        friendRequest.status = action === 'accept' ? 'accepted' : 'rejected';
        await friendRequest.save();

        // If accepted, create friendship
        if (action === 'accept') {
            // Ensure consistent ordering (smaller ObjectId as user1Id)
            const user1Id = friendRequest.senderId < friendRequest.receiverId ? friendRequest.senderId : friendRequest.receiverId;
            const user2Id = friendRequest.senderId < friendRequest.receiverId ? friendRequest.receiverId : friendRequest.senderId;
            
            // Check if friendship already exists
            const existingFriendship = await Friendship.findOne({
                user1Id: user1Id,
                user2Id: user2Id
            });

            if (!existingFriendship) {
                const friendship = new Friendship({
                    user1Id: user1Id,
                    user2Id: user2Id,
                    status: 'active'
                });

                await friendship.save();
                console.log('✅ Friendship created:', friendship._id);
            }
        }

        res.json({
            success: true,
            message: `Friend request ${action}ed successfully`,
            friendRequest: {
                id: friendRequest._id,
                status: friendRequest.status
            }
        });

    } catch (error) {
        console.error('💥 Friend request action error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get friends list
app.get('/api/friends', verifyToken, async (req, res) => {
    try {
        console.log('👥 Getting friends for user:', req.user.userId);

        // Find all friendships where current user is involved
        const friendships = await Friendship.find({
            $or: [
                { user1Id: req.user.userId },
                { user2Id: req.user.userId }
            ],
            status: 'active'
        }).populate('user1Id', 'firstName lastName email avatar')
          .populate('user2Id', 'firstName lastName email avatar');

        // Format the response to get friend's info
        const friends = friendships.map(friendship => {
            const isUser1 = friendship.user1Id._id.toString() === req.user.userId;
            const friend = isUser1 ? friendship.user2Id : friendship.user1Id;
            
            return {
                id: friend._id,
                name: `${friend.firstName} ${friend.lastName}`,
                username: friend.email.split('@')[0], // Use email prefix as username
                avatar: friend.avatar || `https://placehold.co/40x40/4F46E5/FFFFFF?text=${friend.firstName.charAt(0)}${friend.lastName.charAt(0)}`,
                email: friend.email,
                friendshipId: friendship._id,
                friendsSince: friendship.createdAt
            };
        });

        res.json({
            success: true,
            friends: friends,
            count: friends.length
        });

    } catch (error) {
        console.error('💥 Get friends error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Search friends
app.get('/api/friends/search', verifyToken, async (req, res) => {
    try {
        const { q } = req.query;
        console.log('🔍 Searching friends for user:', req.user.userId, 'query:', q);

        if (!q || q.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const searchQuery = q.trim();
        
        // Find all friendships where current user is involved
        const friendships = await Friendship.find({
            $or: [
                { user1Id: req.user.userId },
                { user2Id: req.user.userId }
            ],
            status: 'active'
        }).populate('user1Id', 'firstName lastName email avatar')
          .populate('user2Id', 'firstName lastName email avatar');

        // Filter friends based on search query
        const friends = friendships
            .map(friendship => {
                const isUser1 = friendship.user1Id._id.toString() === req.user.userId;
                const friend = isUser1 ? friendship.user2Id : friendship.user1Id;
                
                return {
                    id: friend._id,
                    name: `${friend.firstName} ${friend.lastName}`,
                    username: friend.email.split('@')[0],
                    avatar: friend.avatar || `https://placehold.co/40x40/4F46E5/FFFFFF?text=${friend.firstName.charAt(0)}${friend.lastName.charAt(0)}`,
                    email: friend.email,
                    friendshipId: friendship._id,
                    friendsSince: friendship.createdAt
                };
            })
            .filter(friend => {
                const name = friend.name.toLowerCase();
                const username = friend.username.toLowerCase();
                const email = friend.email.toLowerCase();
                const query = searchQuery.toLowerCase();
                
                return name.includes(query) || username.includes(query) || email.includes(query);
            });

        res.json({
            success: true,
            friends: friends,
            count: friends.length,
            query: searchQuery
        });

    } catch (error) {
        console.error('💥 Search friends error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get conversations (list of users the current user has exchanged messages with)
app.get('/api/conversations', verifyToken, async (req, res) => {
    try {
        console.log('💬 Getting conversations for user:', req.user.userId);

        // Check if MongoDB is connected
        if (!isMongoConnected) {
            console.log('📝 MongoDB not connected, returning empty conversations');
            return res.json({
                success: true,
                conversations: [],
                message: 'Database not available, no conversations to show'
            });
        }

        // Find all messages where user is sender or receiver
        const messages = await Message.find({
            $or: [
                { senderId: req.user.userId },
                { receiverId: req.user.userId }
            ]
        }).populate('senderId receiverId', 'firstName lastName email avatar')
          .sort({ createdAt: -1 });

        console.log(`Found ${messages.length} messages for conversations`);

        // Group messages by conversation partner
        const conversationsMap = new Map();

        messages.forEach(message => {
            const partnerId = message.senderId._id.toString() === req.user.userId 
                ? message.receiverId._id.toString()
                : message.senderId._id.toString();
            
            if (!conversationsMap.has(partnerId)) {
                const partner = message.senderId._id.toString() === req.user.userId 
                    ? message.receiverId 
                    : message.senderId;
                
                // Decrypt message content if encrypted
                let messageContent = message.content;
                if (message.isEncrypted) {
                    try {
                        console.log('Decrypting message for conversation preview...');
                        messageContent = decryptMessage(message.content);
                        console.log('Decryption successful for preview');
                    } catch (decryptError) {
                        console.error('Failed to decrypt message for preview:', decryptError);
                        messageContent = '[Tin nhắn đã mã hóa]';
                    }
                } else {
                    console.log('Message not encrypted, using as-is for preview');
                }
                
                conversationsMap.set(partnerId, {
                    partnerId: partnerId,
                    otherUser: {
                        id: partner._id,
                        name: `${partner.firstName} ${partner.lastName}`,
                        email: partner.email,
                        avatar: partner.avatar || `https://placehold.co/48x48/4F46E5/FFFFFF?text=${partner.firstName.charAt(0)}${partner.lastName.charAt(0)}`
                    },
                    lastMessage: {
                        content: messageContent,
                        createdAt: message.createdAt,
                        senderId: message.senderId._id,
                        isEncrypted: message.isEncrypted || false
                    }
                });
            }
        });

        const conversations = Array.from(conversationsMap.values());

        console.log(`✅ Found ${conversations.length} conversations`);

        res.json({
            success: true,
            conversations: conversations
        });

    } catch (error) {
        console.error('💥 Get conversations error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server. Vui lòng thử lại sau!',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get messages with a specific user
app.get('/api/messages/:userId', verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;
        console.log('💬 Getting messages between:', req.user.userId, 'and', userId);

        const messages = await Message.find({
            $or: [
                { senderId: req.user.userId, receiverId: userId },
                { senderId: userId, receiverId: req.user.userId }
            ]
        }).populate('senderId receiverId', 'firstName lastName email avatar')
          .sort({ createdAt: 1 });

        console.log(`✅ Found ${messages.length} messages`);

        const formattedMessages = messages.map(message => {
            // Decrypt content if encrypted
            let content = message.content;
            if (message.isEncrypted) {
                content = decryptMessage(message.content);
            }
            
            return {
                id: message._id,
                content: content,
                senderId: message.senderId._id,
                receiverId: message.receiverId._id,
                createdAt: message.createdAt,
                status: message.status,
                isEncrypted: message.isEncrypted || false,
                isFromCurrentUser: message.senderId._id.toString() === req.user.userId,
                sender: {
                    id: message.senderId._id,
                    name: `${message.senderId.firstName} ${message.senderId.lastName}`,
                    avatar: message.senderId.avatar || `https://placehold.co/40x40/4F46E5/FFFFFF?text=${message.senderId.firstName.charAt(0)}`
                }
            };
        });

        res.json({
            success: true,
            messages: formattedMessages
        });

    } catch (error) {
        console.error('💥 Get messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server. Vui lòng thử lại sau!',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Create a new post
app.post('/api/posts', verifyToken, async (req, res) => {
    try {
        console.log('📝 Creating new post for user:', req.user.userId);
        console.log('📄 Request body:', req.body);
        const { content, images, taggedFriends, location } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Nội dung bài viết không được để trống'
            });
        }

        if (content.length > 500) {
            return res.status(400).json({
                success: false,
                message: 'Nội dung bài viết không được vượt quá 500 ký tự'
            });
        }

        const post = new Post({
            userId: req.user.userId,
            content: content.trim(),
            images: images || [],
            taggedFriends: taggedFriends || [],
            location: location || null
        });

        await post.save();

        // Populate user information for response
        await post.populate('userId', 'firstName lastName avatar email');

        const formattedPost = {
            id: post._id,
            content: post.content,
            images: post.images,
            taggedFriends: post.taggedFriends,
            location: post.location,
            author: {
                id: post.userId._id,
                name: `${post.userId.firstName} ${post.userId.lastName}`,
                avatar: post.userId.avatar || `https://placehold.co/40x40/4F46E5/FFFFFF?text=${post.userId.firstName.charAt(0)}${post.userId.lastName.charAt(0)}`
            },
            likes: post.likes || [],
            comments: post.comments || [],
            createdAt: post.createdAt,
            updatedAt: post.updatedAt
        };

        console.log('✅ Post created successfully:', post._id);

        res.status(201).json({
            success: true,
            message: 'Đăng bài viết thành công!',
            post: formattedPost
        });

    } catch (error) {
        console.error('💥 Create post error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi đăng bài viết',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get feed posts
app.get('/api/posts', verifyToken, async (req, res) => {
    try {
        console.log('📰 Getting feed posts for user:', req.user.userId);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Get posts from user and their friends
        const userFriendships = await Friendship.find({
            $or: [
                { user1Id: req.user.userId },
                { user2Id: req.user.userId }
            ],
            status: 'active'
        });

        // Extract friend IDs
        const friendIds = userFriendships.map(friendship => {
            return friendship.user1Id.toString() === req.user.userId 
                ? friendship.user2Id 
                : friendship.user1Id;
        });

        // Include current user's posts too
        const userIds = [req.user.userId, ...friendIds];

        // Get posts from user and friends
        const posts = await Post.find({
            userId: { $in: userIds },
            isDeleted: false
        })
        .populate('userId', 'firstName lastName avatar email')
        .populate('taggedFriends.userId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

        const formattedPosts = posts.map(post => ({
            id: post._id,
            content: post.content,
            images: post.images || [],
            taggedFriends: post.taggedFriends || [],
            location: post.location,
            author: {
                id: post.userId._id,
                name: `${post.userId.firstName} ${post.userId.lastName}`,
                avatar: post.userId.avatar || `https://placehold.co/40x40/4F46E5/FFFFFF?text=${post.userId.firstName.charAt(0)}${post.userId.lastName.charAt(0)}`
            },
            likes: post.likes || [],
            comments: post.comments || [],
            likesCount: (post.likes || []).length,
            commentsCount: (post.comments || []).length,
            isLiked: (post.likes || []).some(like => like.userId.toString() === req.user.userId),
            createdAt: post.createdAt,
            updatedAt: post.updatedAt
        }));

        res.json({
            success: true,
            posts: formattedPosts,
            pagination: {
                page,
                limit,
                total: await Post.countDocuments({
                    userId: { $in: userIds },
                    isDeleted: false
                }),
                hasMore: formattedPosts.length === limit
            }
        });

    } catch (error) {
        console.error('💥 Get posts error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi tải feed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get all posts for admin/debug  
app.get('/api/posts/all', verifyToken, async (req, res) => {
    try {
        console.log('🔍 Admin: Fetching ALL posts from database...');
        
        const posts = await Post.find({})
            .populate('userId', 'firstName lastName email avatar')
            .sort({ createdAt: -1 })
            .limit(50);

        console.log('📊 Total posts in database:', posts.length);
        console.log('👥 Posts by users:', posts.map(p => ({ 
            id: p._id, 
            user: p.userId?.firstName + ' ' + p.userId?.lastName,
            content: p.content.substring(0, 50) + '...',
            createdAt: p.createdAt 
        })));

        res.json({
            success: true,
            totalPosts: posts.length,
            posts: posts.map(post => ({
                _id: post._id,
                content: post.content,
                images: post.images || [],
                taggedFriends: post.taggedFriends || [],
                location: post.location || null,
                author: {
                    id: post.userId._id,
                    name: `${post.userId.firstName} ${post.userId.lastName}`,
                    email: post.userId.email,
                    avatar: post.userId.avatar || `https://placehold.co/96x96/4F46E5/FFFFFF?text=${post.userId.firstName?.charAt(0)}${post.userId.lastName?.charAt(0)}`
                },
                createdAt: post.createdAt,
                updatedAt: post.updatedAt,
                likesCount: post.likesCount || 0,
                commentsCount: post.commentsCount || 0,
                isLiked: false
            }))
        });
    } catch (error) {
        console.error('❌ Error fetching all posts:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching posts',
            error: error.message
        });
    }
});

// Get current user's posts
app.get('/api/posts/user/me', verifyToken, async (req, res) => {
    try {
        console.log('📰 Getting posts for current user:', req.user.userId);
        console.log('👤 User info:', req.user);
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        console.log('📄 Pagination:', { page, limit, skip });

        // Get posts from current user only
        const posts = await Post.find({
            userId: req.user.userId,
            isDeleted: false
        })
        .populate('userId', 'firstName lastName avatar email')
        .populate('taggedFriends.userId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

        console.log('📊 Found user posts:', posts.length);
        console.log('📝 User posts details:', posts.map(p => ({
            id: p._id,
            content: p.content.substring(0, 50) + '...',
            userId: p.userId._id,
            createdAt: p.createdAt
        })));

        const formattedPosts = posts.map(post => ({
            id: post._id,
            content: post.content,
            images: post.images || [],
            taggedFriends: post.taggedFriends || [],
            location: post.location,
            author: {
                id: post.userId._id,
                name: `${post.userId.firstName} ${post.userId.lastName}`,
                avatar: post.userId.avatar || `https://placehold.co/40x40/4F46E5/FFFFFF?text=${post.userId.firstName.charAt(0)}${post.userId.lastName.charAt(0)}`
            },
            likes: post.likes || [],
            comments: post.comments || [],
            likesCount: (post.likes || []).length,
            commentsCount: (post.comments || []).length,
            isLiked: (post.likes || []).some(like => like.userId.toString() === req.user.userId),
            createdAt: post.createdAt,
            updatedAt: post.updatedAt
        }));

        res.json({
            success: true,
            posts: formattedPosts,
            pagination: {
                page,
                limit,
                total: await Post.countDocuments({
                    userId: req.user.userId,
                    isDeleted: false
                }),
                hasMore: formattedPosts.length === limit
            }
        });

    } catch (error) {
        console.error('💥 Get user posts error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi tải bài viết',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve pages directory specifically 
app.use('/pages', express.static(path.join(__dirname, 'pages')));

// === WebRTC Signaling Server ===
const activeUsers = new Map(); // userId -> socketId
const activeCalls = new Map(); // callId -> call data

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
            socket.username = decoded.username;
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
                username: decoded.username 
            });
            
            // Notify others about authenticated user
            socket.to('global_chat').emit('user_joined', {
                userId: decoded.userId,
                username: socket.username,
                avatar: socket.avatar,
                isAuthenticated: true
            });
            
            console.log(`✅ User authenticated for chat & WebRTC: ${decoded.username} (${decoded.userId})`);
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

            // Notify both users
            const callerUserData = activeUsers.get(callData.callerId);
            if (callerUserData) {
                io.to(callerUserData.socketId).emit('call_accepted', { callId });
            }
            socket.emit('call_accepted', { callId });
            
            console.log(`✅ Call accepted: ${callId}`);
        } else {
            callData.status = 'declined';
            activeCalls.delete(callId);

            // Notify caller
            const callerUserData = activeUsers.get(callData.callerId);
            if (callerUserData) {
                io.to(callerUserData.socketId).emit('call_declined', { callId });
            }
            
            console.log(`❌ Call declined: ${callId}`);
        }
    });

    // WebRTC signaling
    socket.on('webrtc_offer', (data) => {
        const { callId, offer } = data;
        const callData = activeCalls.get(callId);
        
        if (!callData) {
            socket.emit('call_error', { error: 'Call not found' });
            return;
        }

        // Forward offer to the other user
        const targetUserId = socket.userId === callData.callerId 
            ? callData.targetUserId 
            : callData.callerId;
        
        const targetUserData = activeUsers.get(targetUserId);
        if (targetUserData) {
            io.to(targetUserData.socketId).emit('webrtc_offer', { callId, offer });
        }
    });

    socket.on('webrtc_answer', (data) => {
        const { callId, answer } = data;
        const callData = activeCalls.get(callId);
        
        if (!callData) {
            socket.emit('call_error', { error: 'Call not found' });
            return;
        }

        // Forward answer to the other user
        const targetUserId = socket.userId === callData.callerId 
            ? callData.targetUserId 
            : callData.callerId;
        
        const targetUserData = activeUsers.get(targetUserId);
        if (targetUserData) {
            io.to(targetUserData.socketId).emit('webrtc_answer', { callId, answer });
        }
    });

    socket.on('webrtc_ice_candidate', (data) => {
        const { callId, candidate } = data;
        const callData = activeCalls.get(callId);
        
        if (!callData) {
            socket.emit('call_error', { error: 'Call not found' });
            return;
        }

        // Forward ICE candidate to the other user
        const targetUserId = socket.userId === callData.callerId 
            ? callData.targetUserId 
            : callData.callerId;
        
        const targetUserData = activeUsers.get(targetUserId);
        if (targetUserData) {
            io.to(targetUserData.socketId).emit('webrtc_ice_candidate', { callId, candidate });
        }
    });

    // End call
    socket.on('end_call', (data) => {
        const { callId } = data;
        const callData = activeCalls.get(callId);
        
        if (callData) {
            // Notify the other user
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

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Cosmic Social Network server running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔌 WebRTC signaling server ready`);
});
