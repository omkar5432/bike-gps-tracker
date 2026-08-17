# Test Database Setup Guide

## Overview

The Bike GPS Tracker integration tests require a PostgreSQL database with the PostGIS extension installed. DO NOT use the production Supabase database for testing.

## Quick Start (Windows)

### Step 1: Download and Install PostgreSQL + PostGIS

1. Download PostgreSQL 15+ installer from: https://www.postgresql.org/download/windows/
2. Also download PostGIS: https://postgis.net/windows_installers/
3. Install PostgreSQL first, then PostGIS

### Step 2: Create Test Database

Open pgAdmin or psql and run:

```sql
CREATE DATABASE test_bike_gps;
CREATE EXTENSION IF NOT EXISTS postgis;
GRANT ALL PRIVILEGES ON DATABASE test_bike_gps TO postgres_user;
```

### Step 3: Configure Environment

Update `backend/.env`:

```bash
TEST_DATABASE_URL=postgresql://postgres_user:postgres_password@localhost:5432/test_bike_gps
```

### Step 4: Run Tests

```bash
cd backend
python -m pytest tests/test_device.py -v
```

## Docker Setup (Linux/Mac/Windows)

```bash
# Start PostgreSQL with PostGIS
docker run --rm -d \
  --name bike_gps_test_db \
  -e POSTGRES_USER=postgres_user \
  -e POSTGRES_PASSWORD=postgres_password \
  -e POSTGRES_DB=test_bike_gps \
  -p 5432:5432 \
  postgis/postgis:15-3.3

# Update .env
TEST_DATABASE_URL=postgresql://postgres_user:postgres_password@localhost:5432/test_bike_gps
```

## Troubleshooting

### "PostGIS extension not found"

```sql
-- Connect to test database and run:
CREATE EXTENSION IF NOT EXISTS postgis;
```

### Connection refused

Ensure PostgreSQL is running:
```bash
# Linux/Mac
sudo systemctl status postgresql

# Windows
net start postgresql-x64-15
```

### Password authentication failed

Update pg_hba.conf to allow password auth:
```
host    all             all             127.0.0.1/32            md5
```

Then reload PostgreSQL.

## Security Notes

- The test database will have the `bike_gps` schema created and dropped during test runs
- DO NOT use this database for production data
- Use a separate database user for testing
- Keep test database credentials separate from production
