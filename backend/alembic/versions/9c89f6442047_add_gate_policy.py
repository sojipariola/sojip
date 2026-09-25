"""add_gate_policy

Revision ID: 9c89f6442047
Revises: 64a5641b1058
Create Date: 2026-09-22 11:41:04.114616

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '9c89f6442047'
down_revision: Union[str, None] = '64a5641b1058'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column(
            "gate_policy",
            sa.String(20),
            nullable=False,
            server_default="flexible",
        ),
    )
    op.add_column(
        "projects",
        sa.Column("gate_policy_override", sa.String(20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("projects", "gate_policy_override")
    op.drop_column("tenants", "gate_policy")
