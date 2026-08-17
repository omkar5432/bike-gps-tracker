-- Setup script for Bike GPS Tracker test database
-- Run this script to create a dedicated test database with PostGIS

-- Create test database (run as superuser)
-- CREATE DATABASE test_bike_gps;

-- Connect to test database
-- \c test_bike_gps

-- Create test user (if needed)
-- CREATE USER test_user WITH PASSWORD 'test_pass';

-- Grant privileges
-- GRANT ALL PRIVILEGES ON DATABASE test_bike_gps TO test_user;

-- Enable PostGIS extension (required for geography types)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO test_user;

-- Grant table privileges
GRANT ALL ON ALL TABLES IN SCHEMA public TO test_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO test_user;
