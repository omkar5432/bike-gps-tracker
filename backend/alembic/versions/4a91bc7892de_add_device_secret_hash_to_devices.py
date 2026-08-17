"""add device_secret_hash to devices

Revision ID: 4a91bc7892de
Revises: 3f85fc3495e3
Create Date: 2026-08-15 13:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '4a91bc7892de'
down_revision: Union[str, None] = '3f85fc3495e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('devices', sa.Column('device_secret_hash', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('devices', 'device_secret_hash')

