import os

# Must be set before importing transformers. Railway is CPU-only and the
# installed TensorFlow native libraries can segfault during transformers backend
# discovery. SER and sentiment use PyTorch pipelines only.
os.environ.setdefault("TRANSFORMERS_NO_TF", "1")
os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("USE_FLAX", "0")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("HF_HOME", os.getenv("HF_HOME", os.getenv("TRANSFORMERS_CACHE", "/tmp/huggingface")))

# Keep local ML inference from oversubscribing small Railway containers.
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")

import shutil
import tempfile
from typing import Any, Callable
from openai import OpenAI
from dotenv import load_dotenv
from huggingface_hub import InferenceClient

load_dotenv()


class AIProviderConfigurationError(RuntimeError):
    """Raised when an AI provider client cannot be configured safely."""


def _bootstrap_ffmpeg_path() -> None:
    ffmpeg_path = os.getenv("FFMPEG_PATH", "").strip()

    if not ffmpeg_path:
        ffmpeg_path = shutil.which("ffmpeg") or ""

    if not ffmpeg_path:
        try:
            from imageio_ffmpeg import get_ffmpeg_exe  # type: ignore

            ffmpeg_path = get_ffmpeg_exe() or ""
        except Exception:
            ffmpeg_path = ""

    if not ffmpeg_path:
        return

    ffmpeg_dir = os.path.dirname(ffmpeg_path)

    # Some bundled binaries are not named "ffmpeg.exe" (e.g., ffmpeg-win-x86_64-v7.1.exe).
    # Transformers invokes "ffmpeg" by command name, so we provide a command alias.
    if shutil.which("ffmpeg") is None:
        alias_dir = os.path.join(tempfile.gettempdir(), "careerics_ffmpeg_bin")
        os.makedirs(alias_dir, exist_ok=True)
        alias_path = os.path.join(alias_dir, "ffmpeg.exe")

        if not os.path.exists(alias_path):
            shutil.copy2(ffmpeg_path, alias_path)

        ffmpeg_dir = alias_dir

    current_path = os.environ.get("PATH", "")

    if ffmpeg_dir and ffmpeg_dir not in current_path.split(os.pathsep):
        os.environ["PATH"] = f"{ffmpeg_dir}{os.pathsep}{current_path}" if current_path else ffmpeg_dir

    # Some libs read these env vars directly.
    os.environ.setdefault("FFMPEG_BINARY", ffmpeg_path)
    os.environ.setdefault("IMAGEIO_FFMPEG_EXE", ffmpeg_path)


_bootstrap_ffmpeg_path()

DS_TOKEN = os.getenv("DS_TOKEN")
HF_TOKEN = os.getenv("HF_TOKEN")
HF_ROUTER_TOKEN = HF_TOKEN or DS_TOKEN
AI_ROUTER_BASE_URL = os.getenv("AI_ROUTER_BASE_URL", "https://router.huggingface.co/v1")


def _require_hf_router_token() -> str:
    if HF_ROUTER_TOKEN:
        return HF_ROUTER_TOKEN

    raise AIProviderConfigurationError(
        "AI provider token is not configured. Set HF_TOKEN with Hugging Face Inference Providers permission."
    )


def is_hf_router_token_configured() -> bool:
    return bool(HF_ROUTER_TOKEN)


class _LazyObject:
    def __init__(self, factory: Callable[[], Any]) -> None:
        self._factory = factory
        self._instance: Any = None

    def _get(self) -> Any:
        if self._instance is None:
            self._instance = self._factory()
        return self._instance

    def __getattr__(self, name: str) -> Any:
        return getattr(self._get(), name)

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        return self._get()(*args, **kwargs)


def _build_pipeline(task: str, model: str):
    # Import transformers only when a specific pipeline is first used.
    from transformers import pipeline

    try:
        import torch

        torch.set_num_threads(1)
        torch.set_num_interop_threads(1)
    except Exception:
        pass

    return pipeline(
        task,
        model=model,
        framework="pt",
        device=-1,
    )


DS_Client = _LazyObject(
    lambda: OpenAI(
        base_url=AI_ROUTER_BASE_URL,
        api_key=_require_hf_router_token(),
    )
)

minimax_client = _LazyObject(
    lambda: OpenAI(
        base_url=AI_ROUTER_BASE_URL,
        api_key=_require_hf_router_token(),
    )
)

whisper_client = _LazyObject(
    lambda: InferenceClient(
        provider="hf-inference",
        api_key=_require_hf_router_token(),
    )
)

ser_client = _LazyObject(
    lambda: _build_pipeline("audio-classification", "superb/hubert-large-superb-er")
)

sentiment_client = _LazyObject(
    lambda: _build_pipeline("sentiment-analysis", "distilbert/distilbert-base-uncased-finetuned-sst-2-english")
)
