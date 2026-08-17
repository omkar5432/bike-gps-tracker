"""initial migration

Revision ID: 3f85fc3495e3
Revises: 
Create Date: 2026-08-15 12:56:58.195261

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '3f85fc3495e3'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Ensure PostGIS extension is enabled
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    # 2. Ensure users table exists and has updated_at
    op.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """)
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_email ON users (email);")

    # 3. Create devices table
    op.create_table('devices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('device_id', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('imei', sa.String(length=50), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='OFFLINE'),
        sa.Column('last_seen', sa.DateTime(timezone=True), nullable=True),
        sa.Column('device_secret_hash', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('device_id', name='uq_device_device_id'),
        sa.UniqueConstraint('imei', name='uq_device_imei')
    )
    op.create_index('ix_device_device_id', 'devices', ['device_id'], unique=False)

    # 4. Create locations table with PostGIS Geography Point
    op.create_table('locations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('speed', sa.Float(), nullable=True),
        sa.Column('altitude', sa.Float(), nullable=True),
        sa.Column('battery', sa.Float(), nullable=True),
        sa.Column('gps_accuracy', sa.Float(), nullable=True),
        sa.Column('satellites', sa.Integer(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('geom', geoalchemy2.types.Geography(geometry_type='POINT', srid=4326, dimension=2, from_text='ST_GeogFromText', name='geography', nullable=False), nullable=False),
        sa.CheckConstraint('latitude >= -90 AND latitude <= 90', name='ck_latitude_range'),
        sa.CheckConstraint('longitude >= -180 AND longitude <= 180', name='ck_longitude_range'),
        sa.CheckConstraint('speed >= 0', name='ck_speed_non_negative'),
        sa.CheckConstraint('battery >= 0', name='ck_battery_non_negative'),
        sa.CheckConstraint('satellites >= 0', name='ck_satellites_non_negative'),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_location_device_timestamp', 'locations', ['device_id', 'timestamp'], unique=False)

    # 5. Create trips table
    op.create_table('trips',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('start_location_id', sa.Integer(), nullable=True),
        sa.Column('end_location_id', sa.Integer(), nullable=True),
        sa.Column('distance_km', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('max_speed', sa.Float(), nullable=True),
        sa.Column('avg_speed', sa.Float(), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('distance_km >= 0', name='ck_trip_distance_non_negative'),
        sa.CheckConstraint('max_speed >= 0', name='ck_trip_max_speed_non_negative'),
        sa.CheckConstraint('avg_speed >= 0', name='ck_trip_avg_speed_non_negative'),
        sa.CheckConstraint('duration_seconds >= 0', name='ck_trip_duration_non_negative'),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['start_location_id'], ['locations.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['end_location_id'], ['locations.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_trip_device_start_time', 'trips', ['device_id', 'start_time'], unique=False)

    # 6. Create geofences table
    op.create_table('geofences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('radius_meters', sa.Float(), nullable=False, server_default='100.0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('geom', geoalchemy2.types.Geography(geometry_type='POINT', srid=4326, dimension=2, from_text='ST_GeogFromText', name='geography', nullable=False), nullable=False),
        sa.CheckConstraint('latitude >= -90 AND latitude <= 90', name='ck_geofence_latitude_range'),
        sa.CheckConstraint('longitude >= -180 AND longitude <= 180', name='ck_geofence_longitude_range'),
        sa.CheckConstraint('radius_meters > 0', name='ck_geofence_radius_positive'),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_geofence_device_id', 'geofences', ['device_id'], unique=False)

    # 7. Create alerts table
    op.create_table('alerts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=False, server_default='MEDIUM'),
        sa.Column('message', sa.String(length=255), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('is_resolved', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')", name='ck_alert_severity_allowed_values'),
        sa.CheckConstraint("type IN ('GEOFENCE_ENTER', 'GEOFENCE_EXIT', 'LOW_BATTERY', 'SPEEDING', 'TAMPER', 'FALL_DETECTED', 'MOVEMENT_UNAUTHORIZED', 'DEVICE_OFFLINE')", name='ck_alert_type_allowed_values'),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_alert_device_timestamp', 'alerts', ['device_id', 'timestamp'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_alert_device_timestamp', table_name='alerts')
    op.drop_table('alerts')
    op.drop_index('ix_geofence_device_id', table_name='geofences')
    op.drop_index('idx_geofences_geom', table_name='geofences', postgresql_using='gist')
    op.drop_table('geofences')
    op.drop_index('ix_trip_device_start_time', table_name='trips')
    op.drop_table('trips')
    op.drop_index('ix_location_device_timestamp', table_name='locations')
    op.drop_index('idx_locations_geom', table_name='locations', postgresql_using='gist')
    op.drop_table('locations')
    op.drop_index('ix_device_device_id', table_name='devices')
    op.drop_table('devices')
