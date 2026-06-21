import os
from pathlib import Path
from urllib.parse import quote_plus
from dotenv import load_dotenv

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(dotenv_path=_BACKEND_ROOT / ".env")

_CACHE_ROOT = _BACKEND_ROOT / ".cache"
os.environ.setdefault("HF_HOME", str(_CACHE_ROOT / "huggingface"))
os.environ.setdefault("TRANSFORMERS_CACHE", str(_CACHE_ROOT / "huggingface" / "transformers"))
os.environ.setdefault("TORCH_HOME", str(_CACHE_ROOT / "torch"))
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")


def _build_audio_paths(base_path: str) -> dict[str, str]:
    return {
        "questions": os.path.join(base_path, "questions"),
        "answers": os.path.join(base_path, "answers"),
        "followups": os.path.join(base_path, "followups"),
    }


def _resolve_audio_base(base_path: str) -> str:
    candidate = Path(base_path).expanduser()
    if candidate.is_absolute():
        return str(candidate)

    return str((_BACKEND_ROOT / candidate).resolve())


def _build_audio_url_paths(base_path: str) -> dict[str, str]:
    normalized_base = base_path.strip("/\\") or "audio"
    return {
        "questions": f"{normalized_base}/questions",
        "answers": f"{normalized_base}/answers",
        "followups": f"{normalized_base}/followups",
    }


class Settings:
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")

    DB_HOST = os.getenv("DB_HOST")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "postgres")
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD")

    SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL")
    DATABASE_URL = os.getenv("DATABASE_URL")

    if not DATABASE_URL and SUPABASE_DB_URL:
        DATABASE_URL = SUPABASE_DB_URL

    if not DATABASE_URL and DB_HOST and DB_PASSWORD:
        encoded_password = quote_plus(DB_PASSWORD)
        DATABASE_URL = (
            f"postgresql://{DB_USER}:{encoded_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}?sslmode=require"
        )

    AUDIO_BASE = _resolve_audio_base(os.getenv("AUDIO_BASE", "audio"))

    ROADMAP_IMPORT_BASE = os.getenv("ROADMAP_IMPORT_BASE")
    ROADMAP_IMPORT_ADMIN_TOKEN = os.getenv("ROADMAP_IMPORT_ADMIN_TOKEN")

    AUDIO_PATHS = _build_audio_paths(AUDIO_BASE)
    AUDIO_URL_PATHS = _build_audio_url_paths("audio")


settings = Settings()
