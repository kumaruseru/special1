require('dotenv').config();
const mongoose = require('mongoose');

// Direct test with your MongoDB Atlas connection string
const MONGODB_URI = 'mongodb+srv://nghiaht281003:Huong1505@special.7aeh83z.mongodb.net/cosmic_social_network?retryWrites=true&w=majority&appName=special';

async function testMongoConnection() {
    console.log('🔌 Testing MongoDB Atlas connection...');
    
    const mongoUri = MONGODB_URI;
    
    console.log('📡 Connecting to:', mongoUri.replace(/:[^:@]*@/, ':***@')); // Hide password in logs
    
    try {
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
        });
        
        console.log('✅ MongoDB connection successful!');
        console.log('📊 Connection details:');
        console.log(`   - Database: ${mongoose.connection.db.databaseName}`);
        console.log(`   - Host: ${mongoose.connection.host}`);
        console.log(`   - Port: ${mongoose.connection.port}`);
        
        // Test a simple query
        const admin = mongoose.connection.db.admin();
        const result = await admin.ping();
        console.log('🏓 Ping test:', result);
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:');
        console.error('Error:', error.message);
        console.error('Code:', error.code || 'N/A');
        
        if (error.message.includes('ENOTFOUND')) {
            console.error('\n💡 Troubleshooting ENOTFOUND:');
            console.error('1. Check if cluster URL is correct in connection string');
            console.error('2. Ensure cluster is running (not paused)');
            console.error('3. Check internet connection');
            console.error('4. Verify DNS resolution');
        }
        
        if (error.message.includes('authentication failed')) {
            console.error('\n💡 Troubleshooting Authentication:');
            console.error('1. Check username and password in connection string');
            console.error('2. Ensure database user exists in MongoDB Atlas');
            console.error('3. Check if password contains special characters (needs URL encoding)');
        }
        
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Connection closed');
    }
}

testMongoConnection();
