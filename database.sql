-- PostgreSQL setup script for UyBor

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'makler',
    phone VARCHAR(50)
);

-- Insert default admin
INSERT INTO users (id, username, password, name, role) 
VALUES ('1', 'admin', 'uyboradmin777', 'Admin', 'admin')
ON CONFLICT (username) DO NOTHING;

CREATE TABLE IF NOT EXISTS listings (
    id VARCHAR(50) PRIMARY KEY,
    makler_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    loc_lat FLOAT,
    loc_lng FLOAT,
    address_text TEXT,
    price NUMERIC,
    currency VARCHAR(10),
    category VARCHAR(50),
    type VARCHAR(50),
    rooms INT,
    area NUMERIC,
    images JSONB DEFAULT '[]',
    description TEXT
);

CREATE TABLE IF NOT EXISTS archive (
    id VARCHAR(50) PRIMARY KEY,
    makler_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP,
    sold_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    loc_lat FLOAT,
    loc_lng FLOAT,
    address_text TEXT,
    price NUMERIC,
    currency VARCHAR(10),
    category VARCHAR(50),
    type VARCHAR(50),
    rooms INT,
    area NUMERIC,
    images JSONB DEFAULT '[]',
    description TEXT
);

CREATE TABLE IF NOT EXISTS requests (
    id VARCHAR(50) PRIMARY KEY,
    listing_id VARCHAR(50),
    makler_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
