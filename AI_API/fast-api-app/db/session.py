from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.config import settings
from core.observability import install_sqlalchemy_query_observability


def _make_engine(url: str):
    connect_args = {}
    if url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}
    return create_engine(url, connect_args=connect_args, pool_pre_ping=True)


database_url = (settings.DATABASE_URL or "").strip()
if not database_url:
    raise RuntimeError(
        "DATABASE_URL is not configured. Set SUPABASE_DB_URL or DATABASE_URL in AI_API/fast-api-app/.env"
    )

# Some providers expose postgres://; SQLAlchemy expects postgresql://.
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

engine = _make_engine(database_url)
install_sqlalchemy_query_observability(engine)


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
