"""add_teacher_notes

Revision ID: a1b2c3d4e5f6
Revises: 58d4eef4bd92
Create Date: 2026-09-24 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '58d4eef4bd92'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'teacher_notes',
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('phase', sa.String(length=50), nullable=False),
        sa.Column('author_id', sa.UUID(), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('links', postgresql.JSONB(astext_type=sa.Text()),
                  server_default='[]', nullable=False),
        sa.Column('is_published', sa.Boolean(), server_default='true',
                  nullable=False),
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'),
                  nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'],
                                ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'],
                                ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_teacher_notes_tenant_id'), 'teacher_notes',
                    ['tenant_id'], unique=False)
    op.create_index(op.f('ix_teacher_notes_phase'), 'teacher_notes',
                    ['phase'], unique=False)
    # One published note per (tenant, phase). Drafts can coexist.
    op.create_index(
        'uq_teacher_notes_tenant_phase_published',
        'teacher_notes',
        ['tenant_id', 'phase'],
        unique=True,
        postgresql_where=sa.text('is_published = true'),
    )


def downgrade() -> None:
    op.drop_index('uq_teacher_notes_tenant_phase_published',
                  table_name='teacher_notes')
    op.drop_index(op.f('ix_teacher_notes_phase'), table_name='teacher_notes')
    op.drop_index(op.f('ix_teacher_notes_tenant_id'), table_name='teacher_notes')
    op.drop_table('teacher_notes')