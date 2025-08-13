// MongoDB Initialization Script
db = db.getSiblingDB('cosmic_social_network');

// Create collections
db.createCollection('users');
db.createCollection('posts');
db.createCollection('messages');
db.createCollection('notifications');
db.createCollection('sessions');

// Create indexes for better performance
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "firstName": 1, "lastName": 1 });
db.users.createIndex({ "createdAt": -1 });

db.posts.createIndex({ "userId": 1 });
db.posts.createIndex({ "createdAt": -1 });
db.posts.createIndex({ "tags": 1 });

db.messages.createIndex({ "senderId": 1, "receiverId": 1 });
db.messages.createIndex({ "createdAt": -1 });

db.notifications.createIndex({ "userId": 1 });
db.notifications.createIndex({ "read": 1 });
db.notifications.createIndex({ "createdAt": -1 });

db.sessions.createIndex({ "expires": 1 }, { expireAfterSeconds: 0 });

print('MongoDB initialization completed for cosmic_social_network database');
