// MongoDB initialization script
print('🚀 Initializing MongoDB for Cosmic Social Network...');

// Switch to the cosmic_social_network database
db = db.getSiblingDB('cosmic_social_network');

// Create admin user
db.createUser({
  user: 'admin',
  pwd: 'cosmic123',
  roles: [
    {
      role: 'readWrite',
      db: 'cosmic_social_network'
    }
  ]
});

// Create collections with validators
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['firstName', 'lastName', 'email', 'password', 'salt', 'gender', 'birthDate'],
      properties: {
        firstName: {
          bsonType: 'string',
          description: 'First name is required'
        },
        lastName: {
          bsonType: 'string',
          description: 'Last name is required'
        },
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
          description: 'Email must be a valid email address'
        },
        password: {
          bsonType: 'string',
          minLength: 6,
          description: 'Password must be at least 6 characters'
        },
        salt: {
          bsonType: 'string',
          description: 'Salt is required for password hashing'
        },
        gender: {
          bsonType: 'string',
          enum: ['male', 'female', 'other'],
          description: 'Gender must be male, female, or other'
        },
        birthDate: {
          bsonType: 'object',
          required: ['day', 'month', 'year'],
          properties: {
            day: {
              bsonType: 'int',
              minimum: 1,
              maximum: 31
            },
            month: {
              bsonType: 'int',
              minimum: 1,
              maximum: 12
            },
            year: {
              bsonType: 'int',
              minimum: 1900,
              maximum: 2025
            }
          }
        }
      }
    }
  }
});

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ createdAt: 1 });
db.users.createIndex({ lastLogin: 1 });

// Create posts collection
db.createCollection('posts');
db.posts.createIndex({ userId: 1 });
db.posts.createIndex({ createdAt: -1 });

// Create relationships collection
db.createCollection('relationships');
db.relationships.createIndex({ followerId: 1, followingId: 1 }, { unique: true });

print('✅ MongoDB initialization completed successfully!');
