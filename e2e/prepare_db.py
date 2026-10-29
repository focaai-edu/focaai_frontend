"""Prepara o banco do e2e (#11): cria o banco se faltar e as tabelas (create_all).

Roda com o Python do backend, no diretório do backend. Recusa qualquer banco cujo
nome não termine em _test: o e2e nunca toca no banco de desenvolvimento.
"""
import os
import sys

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

url = make_url(os.environ['DATABASE_URL'])
if not (url.database or '').endswith('_test'):
    sys.exit(f'e2e: DATABASE_URL precisa apontar para um banco *_test (veio {url.database!r}).')

admin = create_engine(url.set(database='postgres'), isolation_level='AUTOCOMMIT')
with admin.connect() as conn:
    exists = conn.execute(text('SELECT 1 FROM pg_database WHERE datname = :n'), {'n': url.database}).scalar()
    if not exists:
        conn.execute(text(f'CREATE DATABASE "{url.database}"'))
admin.dispose()

sys.path.insert(0, os.getcwd())
from app import create_app, db  # noqa: E402

app = create_app()
with app.app_context():
    db.create_all()
print(f'e2e: banco {url.database} pronto')
