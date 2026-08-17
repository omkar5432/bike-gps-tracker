@echo off
echo Bike GPS Tracker Test Database Setup
echo ====================================

if exist "%cd%\backend\.env" (
    echo Loading .env file...
    call "%cd%\backend\.env"
) else (
    echo Error: .env file not found
    exit /b 1
)

if "%TEST_DATABASE_URL%"=="" (
    echo Error: TEST_DATABASE_URL not set in .env
    echo Please add TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/test_bike_gps
    exit /b 1
)

echo TEST_DATABASE_URL: %TEST_DATABASE_URL%
echo.
echo IMPORTANT: This script provides instructions only.
echo You need to manually set up PostgreSQL/PostGIS.
echo.
echo Step 1: Install PostgreSQL 15+ with PostGIS extension
echo   - Download from: https://www.postgresql.org/download/windows/
echo   - Or use Docker: docker run -d --name test_db -p 5432:5432 postgis/postgis:15-3.3
echo.
echo Step 2: Create the test database:
echo   psql -U postgres -c "CREATE DATABASE test_bike_gps;"
echo   psql -U postgres -d test_bike_gps -c "CREATE EXTENSION IF NOT EXISTS postgis;"
echo.
echo Step 3: Verify connection:
echo   psql -U postgres -h localhost -d test_bike_gps -c "SELECT PostGIS_Version();"
echo.
echo Step 4: Run tests:
echo   cd backend
echo   python -m pytest tests/test_device.py -v
echo.
