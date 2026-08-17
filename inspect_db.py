#!/usr/bin/env python
"""Read-only database schema inspection script."""

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

def print_table_schema(schema, table):
    """Print full table schema."""
    print(f"\n{'=' * 60}")
    print(f"=== {schema}.{table} ===")
    print('=' * 60)
    
    # Columns
    result = conn.execute(text(f"""
        SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length,
            numeric_precision,
            numeric_scale
        FROM information_schema.columns
        WHERE table_schema = '{schema}' AND table_name = '{table}'
        ORDER BY ordinal_position
    """))
    print("\nColumns:")
    print(f"{'Column':<30} {'Type':<25} {'Nullable':<10} {'Default'}")
    print("-" * 90)
    for row in result.fetchall():
        col_name, col_type, is_nullable, col_default, max_len, num_prec, num_scale = row
        type_info = col_type
        if max_len:
            type_info = f"{col_type}({max_len})"
        if num_prec:
            type_info = f"{col_type}({num_prec},{num_scale})"
        print(f"{col_name:<30} {type_info:<25} {is_nullable:<10} {col_default or ''}")
    
    # Primary key
    result = conn.execute(text(f"""
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema = '{schema}' AND tc.table_name = '{table}'
    """))
    pk_cols = [row[0] for row in result.fetchall()]
    if pk_cols:
        print(f"\nPrimary Key: {', '.join(pk_cols)}")
    
    # Foreign keys
    result = conn.execute(text(f"""
        SELECT 
            kcu.column_name,
            ccu.table_schema AS foreign_table_schema,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = '{schema}' AND tc.table_name = '{table}'
        ORDER BY kcu.column_name
    """))
    fks = result.fetchall()
    if fks:
        print(f"\nForeign Keys:")
        for row in fks:
            col_name, fk_schema, fk_table, fk_col = row
            print(f"  {col_name} -> {fk_schema}.{fk_table}({fk_col})")
    else:
        print(f"\nForeign Keys: None")
    
    # Unique constraints
    result = conn.execute(text(f"""
        SELECT kcu.column_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'UNIQUE'
            AND tc.table_schema = '{schema}' AND tc.table_name = '{table}'
    """))
    ucs = result.fetchall()
    if ucs:
        print(f"\nUnique Constraints:")
        for row in ucs:
            print(f"  {row[1]}: {row[0]}")
    
    # Check constraints
    result = conn.execute(text(f"""
        SELECT cc.constraint_name, cc.check_clause
        FROM information_schema.table_constraints tc
        JOIN information_schema.check_constraints cc
            ON tc.constraint_name = cc.constraint_name
        WHERE tc.constraint_type = 'CHECK'
            AND tc.table_schema = '{schema}' AND tc.table_name = '{table}'
    """))
    ccs = result.fetchall()
    if ccs:
        print(f"\nCheck Constraints:")
        for row in ccs:
            print(f"  {row[0]}: {row[1]}")
    
    # Indexes
    result = conn.execute(text(f"""
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = '{schema}' AND tablename = '{table}'
    """))
    indexes = result.fetchall()
    if indexes:
        print(f"\nIndexes:")
        for row in indexes:
            print(f"  {row[0]}")

# Inspect all Bike GPS tables
print("LIVE SUPABASE DATABASE SCHEMA INSPECTION (READ-ONLY)")
print("=" * 60)
print(f"Connected to: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else DATABASE_URL}")

print_table_schema('bike_gps', 'devices')
print_table_schema('bike_gps', 'locations')
print_table_schema('bike_gps', 'trips')
print_table_schema('bike_gps', 'geofences')
print_table_schema('bike_gps', 'alerts')

# Check auth.users exists (for FK reference)
print("\n" + "=" * 60)
print("=== Checking auth.users (Supabase system table) ===")
print("=" * 60)
try:
    result = conn.execute(text("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'users'
    """))
    row = result.fetchone()
    if row:
        print(f"auth.users exists: YES")
    else:
        print(f"auth.users exists: NO (may be in different schema)")
except Exception as e:
    print(f"Error checking auth.users: {e}")

# Check for auth.users location
print("\n" + "=" * 60)
print("=== Checking auth.users location ===")
print("=" * 60)
result = conn.execute(text("""
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_name = 'users'
    ORDER BY table_schema
"""))
users_locations = result.fetchall()
if users_locations:
    for row in users_locations:
        print(f"  {row[0]}.{row[1]}")
else:
    print("  users table not found")

# Check for legacy public tables
print("\n" + "=" * 60)
print("=== Checking public schema for legacy tables ===")
print("=" * 60)
result = conn.execute(text("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
        AND table_name IN ('devices', 'locations', 'trips', 'geofences', 'alerts', 'users')
    ORDER BY table_name
"""))
legacy_tables = [row[0] for row in result.fetchall()]
if legacy_tables:
    print(f"Legacy tables in public: {', '.join(legacy_tables)}")
else:
    print("No legacy bike GPS tables found in public schema")

conn.close()
print("\n" + "=" * 60)
print("INSPECTION COMPLETE")
print("=" * 60)
