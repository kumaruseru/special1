-- PostgreSQL initialization script for Cosmic Social Network
-- This script creates backup tables and analytics views

\echo 'Initializing PostgreSQL for Cosmic Social Network...'

-- Create database if not exists (this might not work in all environments)
-- SELECT 'CREATE DATABASE cosmic_social_network' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cosmic_social_network')\gexec

-- Create users backup table
CREATE TABLE IF NOT EXISTS users_backup (
    id SERIAL PRIMARY KEY,
    mongo_id VARCHAR(24) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(255) NOT NULL,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    birth_date JSONB,
    avatar TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    login_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_backup_email ON users_backup(email);
CREATE INDEX IF NOT EXISTS idx_users_backup_created_at ON users_backup(created_at);
CREATE INDEX IF NOT EXISTS idx_users_backup_mongo_id ON users_backup(mongo_id);

-- Create posts backup table
CREATE TABLE IF NOT EXISTS posts_backup (
    id SERIAL PRIMARY KEY,
    mongo_id VARCHAR(24) UNIQUE,
    user_id VARCHAR(24) NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT DEFAULT '',
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_posts_backup_user_id ON posts_backup(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_backup_created_at ON posts_backup(created_at DESC);

-- Create analytics table
CREATE TABLE IF NOT EXISTS user_analytics (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(24) NOT NULL,
    date DATE NOT NULL,
    login_count INTEGER DEFAULT 0,
    post_count INTEGER DEFAULT 0,
    like_given INTEGER DEFAULT 0,
    like_received INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_analytics_user_date ON user_analytics(user_id, date);

-- Create session logs table
CREATE TABLE IF NOT EXISTS session_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(24) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP,
    session_duration INTERVAL,
    device_info JSONB
);

CREATE INDEX IF NOT EXISTS idx_session_logs_user_id ON session_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_login_time ON session_logs(login_time DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_users_backup_updated_at 
    BEFORE UPDATE ON users_backup 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_backup_updated_at 
    BEFORE UPDATE ON posts_backup 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for analytics
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.mongo_id,
    u.email,
    u.first_name || ' ' || u.last_name AS full_name,
    u.login_count,
    u.last_login,
    u.created_at as registered_at,
    COUNT(p.id) as total_posts,
    COALESCE(SUM(p.like_count), 0) as total_likes_received,
    CASE 
        WHEN u.last_login > CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 'active'
        WHEN u.last_login > CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 'inactive'
        ELSE 'dormant'
    END as user_status
FROM users_backup u
LEFT JOIN posts_backup p ON u.mongo_id = p.user_id
GROUP BY u.id, u.mongo_id, u.email, u.first_name, u.last_name, u.login_count, u.last_login, u.created_at;

\echo 'PostgreSQL initialization completed successfully!'
