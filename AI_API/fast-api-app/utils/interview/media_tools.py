import os
import uuid
import subprocess
import shutil

from fastapi import HTTPException, UploadFile
from gtts import gTTS
from core.config import settings


def _resolve_ffmpeg_executable() -> str:
    env_path = os.environ.get("FFMPEG_PATH")
    if env_path:
        return env_path

    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg

    try:
        from imageio_ffmpeg import get_ffmpeg_exe  # type: ignore

        bundled_ffmpeg = get_ffmpeg_exe()
        if bundled_ffmpeg:
            return bundled_ffmpeg
    except Exception:
        pass

    raise RuntimeError(
        "ffmpeg executable not found. Install ffmpeg and ensure it is on PATH, "
        "set FFMPEG_PATH, or install imageio-ffmpeg."
    )


# ---------------------------------------------
# Text-to-Speech
# ---------------------------------------------
def _generate_tts(text: str, directory: str) -> str:
    os.makedirs(directory, exist_ok=True)

    filename = f"{uuid.uuid4()}.mp3"
    full_path = os.path.join(directory, filename)

    gTTS(text=text, lang="en").save(full_path)

    return filename


# ---------------------------------------------
# Persistent answer media helpers
# ---------------------------------------------
def _new_answer_media_path(suffix: str) -> str:
    answers_dir = settings.AUDIO_PATHS["answers"]
    os.makedirs(answers_dir, exist_ok=True)
    return os.path.join(answers_dir, f"{uuid.uuid4()}{suffix}")


# ---------------------------------------------
# Save Uploaded File
# ---------------------------------------------
async def save_uploaded_file(file: UploadFile) -> str:
    if not file.filename:
        raise ValueError("Uploaded file has no filename")

    file_ext = os.path.splitext(file.filename)[1].lower() or ".webm"
    file_path = _new_answer_media_path(file_ext)

    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    return file_path


# ---------------------------------------------
# File Cleanup
# ---------------------------------------------
def delete_files(*paths: str) -> None:
    for path in paths:
        try:
            if path and os.path.exists(path):
                os.remove(path)
        except OSError:
            pass


# ---------------------------------------------
# Media Conversion
# ---------------------------------------------
def convert_webm_to_wav(input_path: str) -> str:
    # Submit and evaluate happen in separate requests, so the converted assets
    # need to survive beyond the current request instead of living in tempfile.
    output_path = _new_answer_media_path(".wav")
    ffmpeg_cmd = _resolve_ffmpeg_executable()
    try:
        result = subprocess.run(
            [ffmpeg_cmd, "-y", "-i", input_path, output_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except FileNotFoundError as e:
        raise RuntimeError("Resolved ffmpeg executable could not be launched") from e

    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "ffmpeg failed converting to wav")

    return output_path

def convert_webm_to_mp4(input_path: str) -> str:
    output_path = _new_answer_media_path(".mp4")
    ffmpeg_cmd = _resolve_ffmpeg_executable()
    try:
        result = subprocess.run(
            [ffmpeg_cmd, "-y", "-i", input_path, output_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except FileNotFoundError as e:
        raise RuntimeError("Resolved ffmpeg executable could not be launched") from e

    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "ffmpeg failed converting to mp4")

    return output_path

def convert_audio_and_video(file_path: str) -> tuple[str, str]:
    try:
        mp4_path = convert_webm_to_mp4(file_path)
        if not os.path.exists(mp4_path):
            raise Exception("MP4 file not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Video conversion failed: {str(e)}")

    try:
        wav_path = convert_webm_to_wav(file_path)
        if not os.path.exists(wav_path):
            raise Exception("WAV file not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio conversion failed: {str(e)}")

    return mp4_path, wav_path

