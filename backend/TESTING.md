# Testing the Bike GPS Tracker Backend

## Overview

This document describes how to set up and run integration tests for the Bike GPS Tracker backend.

## Requirements

### Database Requirements

The test suite requires a PostgreSQL database with the PostGIS extension installed. SQLite is **NOT** supported because:

- The application uses PostgreSQL schemas (`bike_gps`)
- The application uses PostGIS geography types for spatial queries
- The application uses UUID types for user IDs

## Setting Up a Test Database

### Option 1: Using Docker (Recommended)

```bash
# Start a PostgreSQL container with PostGIS
docker run --rm -d \
  --name bike_gps_test_db \
  -e POSTGRES_USER=test_user \
  -e POSTGRES_PASSWORD=test_pass \
  -e POSTGRES_DB=test_bike_gps \
  -p 5433:5432 \
  postgis/postgis:15-3.3
```

Then set your `TEST_DATABASE_URL`:

```bash
# In .env file
TEST_DATABASE_URL=postgresql://test_user:test_pass@localhost:5433/test_bike_gps
```

### Option 2: Using a Local PostgreSQL

1. Install PostgreSQL 15+ with PostGIS extension
2. Create a test database:

```sql
CREATE USER test_user WITH PASSWORD 'test_pass';
CREATE DATABASE test_bike_gps OWNER test_user;
\c test_bike_gps
CREATE EXTENSION postgis;
```

3. Update your `.env` file:

```bash
TEST_DATABASE_URL=postgresql://test_user:test_pass@localhost:5432/test_bike_gps
```

### Option 3: Using WSL/Ubuntu

```bash
# Install PostgreSQL and PostGIS
sudo apt update
sudo apt install postgresql postgis

# Create test database
sudo -u postgres psql -c "CREATE USER test_user WITH PASSWORD 'test_pass';"
sudo -u postgres psql -c "CREATE DATABASE test_bike_gps OWNER test_user;"
sudo -u postgres psql -d test_bike_gps -c "CREATE EXTENSION postgis;"
```

## Running Tests

### Run All Tests

```bash
cd backend
pytest -v
```

### Run Specific Test File

```bash
# Device tests
pytest tests/test_device.py -v

# Location tests  
pytest tests/test_location.py -v

# Device registration tests
pytest tests/test_device_registration.py -v

# Device authentication tests
pytest tests/test_device_auth.py -v

# Location API tests
pytest tests/test_location_api.py -v
```

### Run Tests with Verbose Output

```bash
pytest -v --tb=short
```

## Important Notes

### DO NOT Use Production Database

The production Supabase database (`DATABASE_URL`) contains live data. The test suite will:

1. Drop and recreate the `bike_gps` schema
2. Create test data that may conflict with production data
3. Execute DDL operations that could affect production

**Always use a separate test database for development and CI/CD.**

### Database Schema

The test database must have:

1. PostgreSQL 15+ with PostGIS extension
2. A `bike_gps` schema (created by tests)
3. Tables: `devices`, `locations`, `trips`, `geofences`, `alerts`

### UUID Support

The tests use UUIDs for user IDs. Ensure your PostgreSQL is configured to support UUIDs (available by default in PostgreSQL 13+).

## Troubleshooting

### "PostGIS extension not found"

```bash
# Connect to your test database and run:
CREATE EXTENSION postgis;
```

### "database test_bike_gps does not exist"

Create the database:

```bash
# Using psql
createdb test_bike_gps

# Or using psql command
psql -c "CREATE DATABASE test_bike_gps;"
```

### "connection refused"

Ensure your PostgreSQL server is running and accessible:

```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Or for Docker
docker ps | grep bike_gps_test_db
```

### "FATAL: no pg_hba.conf entry"

Ensure your PostgreSQL allows connections from your test client. Update `pg_hba.conf`:

```
# IPv4 local connections:
host    all             all             127.0.0.1/32            md5
```

Then reload PostgreSQL:

```bash
pg_ctl reload -D /path/to/data
```
