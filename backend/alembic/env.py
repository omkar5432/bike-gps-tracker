import os
import sys
from pathlib import Path
import logging
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# Ensure project root and backend directory are in sys.path
PROJECT_ROOT = str(Path(__file__).resolve().parents[2])
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

BACKEND_DIR = str(Path(__file__).resolve().parents[1])
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Optional: set up logging configuration if a "[loggers]" section exists.
if config.config_file_name is not None:
    try:
        fileConfig(config.config_file_name)
    except Exception as e:
        # If logging config is missing or malformed, fall back to basic config.
        logging.basicConfig(level=logging.INFO)
        logging.getLogger('alembic').info("Logging configuration not found in alembic.ini; using basic config.")

# add your model's MetaData object here
# for 'autogenerate' support
from backend.app.database.base import Base
# Import models to ensure they are registered with Base's metadata
from backend.app import models

target_metadata = Base.metadata

def get_url():
    return os.getenv("DATABASE_URL")

BIKE_TRACKER_TABLES = {"users", "devices", "locations", "trips", "geofences", "alerts"}

def include_object(object, name, type_, reflected, compare_to):
    if type_ == "table":
        return name in BIKE_TRACKER_TABLES
    return True

def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        url=get_url(),
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
