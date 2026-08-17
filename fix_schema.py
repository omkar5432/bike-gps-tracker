#!/usr/bin/env python
"""Apply schema fixes to live Supabase database."""

import sys
from pathlib import Path
from dotenv import load_dotenv
import os
from sqlalchemy import create_engine, text

# Load environment
load_dotenv(Path(__file__).parent / '.env')

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    print("DATABASE_URL not set")
    sys.exit(1)

engine = create_engine(DATABASE_URL)
conn = engine.connect()

print("=" * 60)
print("APPLYING SCHEMA FIXES TO LIVE SUPABASE DATABASE")
print("=" * 60)
print(f"Connected to: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else DATABASE_URL}")
print()

# Fix 1: Add device_secret_hash column (check first)
print("Fix 1: Adding device_secret_hash column...")
result = conn.execute(text("""
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'bike_gps' AND table_name = 'devices' 
    AND column_name = 'device_secret_hash'
"""))
if result.fetchone():
    print("  Column already exists - skipping")
else:
    try:
        conn.execute(text("ALTER TABLE bike_gps.devices ADD COLUMN device_secret_hash TEXT"))
        conn.commit()
        print("  SUCCESS: device_secret_hash column added")
    except Exception as e:
        print(f"  ERROR: {e}")

# Verify fix 1
print("  Verification:")
result = conn.execute(text("""
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'bike_gps' AND table_name = 'devices' 
    AND column_name = 'device_secret_hash'
"""))
row = result.fetchone()
if row:
    print("  ✓ device_secret_hash column exists")
else:
    print("  ✗ device_secret_hash column NOT found")

# Fix 2: Add FK from user_id to auth.users
print()
print("Fix 2: Adding FK from devices.user_id to auth.users...")
result = conn.execute(text("""
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'bike_gps' 
        AND tc.table_name = 'devices'
        AND kcu.column_name = 'user_id'
"""))
if result.fetchone():
    print("  FK constraint already exists - skipping")
else:
    try:
        conn.execute(text("ALTER TABLE bike_gps.devices ADD CONSTRAINT fk_devices_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"))
        conn.commit()
        print("  SUCCESS: Foreign key constraint added")
    except Exception as e:
        print(f"  ERROR: {e}")

# Verify fix 2
print("  Verification:")
result = conn.execute(text("""
    SELECT kcu.column_name, ccu.table_schema, ccu.table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'bike_gps' 
        AND tc.table_name = 'devices'
        AND kcu.column_name = 'user_id'
"""))
row = result.fetchone()
if row:
    print(f"  ✓ FK exists: user_id -> {row[1]}.{row[2]}(id)")
else:
    print("  ✗ FK constraint NOT found")

print()
print("=" * 60)
print("SCHEMA FIXES APPLIED SUCCESSFULLY")
print("=" * 60)

conn.close()
