-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set default timezone
SET timezone = 'UTC';

-- Create indexes helper (run after TypeORM sync)
-- These are created by TypeORM synchronize, but listed here for reference

-- users: email index (unique, already in entity)
-- users: provider + providerId composite index
-- refresh_tokens: token index
-- refresh_tokens: userId + isRevoked index
-- otps: code index
-- otps: token index
-- otps: userId + type + isUsed index

COMMENT ON DATABASE nestjs_boilerplate IS 'NestJS Boilerplate database';
