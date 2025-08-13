-- PostgreSQL Initialization Script
-- Analytics and Metrics Tables

-- User Analytics
CREATE TABLE user_analytics (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_id VARCHAR(255)
);

-- Post Analytics
CREATE TABLE post_analytics (
    id SERIAL PRIMARY KEY,
    post_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    interaction_type VARCHAR(50) NOT NULL, -- 'view', 'like', 'comment', 'share'
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- System Logs
CREATE TABLE system_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL, -- 'info', 'warning', 'error', 'debug'
    message TEXT NOT NULL,
    metadata JSONB,
    source VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Sessions (backup to Redis)
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    data JSONB,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Financial Transactions (if needed later)
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_user_analytics_user_id ON user_analytics(user_id);
CREATE INDEX idx_user_analytics_created_at ON user_analytics(created_at DESC);
CREATE INDEX idx_user_analytics_action_type ON user_analytics(action_type);

CREATE INDEX idx_post_analytics_post_id ON post_analytics(post_id);
CREATE INDEX idx_post_analytics_user_id ON post_analytics(user_id);
CREATE INDEX idx_post_analytics_created_at ON post_analytics(created_at DESC);

CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX idx_system_logs_source ON system_logs(source);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- Create views for common queries
CREATE VIEW daily_user_stats AS
SELECT 
    DATE(created_at) as date,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(*) as total_actions
FROM user_analytics 
GROUP BY DATE(created_at)
ORDER BY date DESC;

CREATE VIEW popular_posts AS
SELECT 
    post_id,
    COUNT(*) as interaction_count,
    COUNT(DISTINCT user_id) as unique_users
FROM post_analytics 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY post_id
ORDER BY interaction_count DESC;

COMMENT ON DATABASE cosmic_social_network IS 'Cosmic Social Network - Analytics and Transactional Data';

\echo 'PostgreSQL initialization completed for cosmic_social_network database';
