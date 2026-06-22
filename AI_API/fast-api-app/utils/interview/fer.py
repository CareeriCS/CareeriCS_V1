import gc
import logging
import os
from typing import Any

from fastapi import HTTPException

# Must be set before optional transformers/deepface imports. The Railway backend
# is CPU-only, and TensorFlow native imports have been segfaulting there.
os.environ.setdefault("TRANSFORMERS_NO_TF", "1")
os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("USE_FLAX", "0")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")

logger = logging.getLogger(__name__)

DeepFace = None
_deepface_checked = False
_emotion_pipeline = None
_emotion_pipeline_checked = False

SUPPORTED_EMOTIONS = {
    "happy",
    "sad",
    "angry",
    "neutral",
    "fear",
    "disgust",
    "surprise",
}


def _normalize_emotion(label: Any) -> str | None:
    if label is None:
        return None

    normalized = str(label).strip().lower()
    normalized = normalized.replace("label_", "").replace(" ", "_")

    aliases = {
        "anger": "angry",
        "angry": "angry",
        "happiness": "happy",
        "happy": "happy",
        "sadness": "sad",
        "sad": "sad",
        "fearful": "fear",
        "fear": "fear",
        "disgusted": "disgust",
        "disgust": "disgust",
        "surprised": "surprise",
        "surprise": "surprise",
        "neutral": "neutral",
    }

    return aliases.get(normalized, normalized if normalized in SUPPORTED_EMOTIONS else None)


def _get_deepface():
    global DeepFace
    global _deepface_checked

    if not _deepface_checked:
        _deepface_checked = True
        try:
            from deepface import DeepFace as _DeepFace  # type: ignore[import-not-found]

            DeepFace = _DeepFace
        except Exception as exc:
            logger.warning("DeepFace is unavailable for FER: %s", exc)
            DeepFace = None

    return DeepFace


def _get_emotion_pipeline():
    global _emotion_pipeline
    global _emotion_pipeline_checked

    if not _emotion_pipeline_checked:
        _emotion_pipeline_checked = True
        try:
            from transformers import pipeline

            try:
                import torch

                torch.set_num_threads(1)
                torch.set_num_interop_threads(1)
            except Exception:
                pass

            _emotion_pipeline = pipeline(
                "image-classification",
                model="trpakov/vit-face-expression",
                framework="pt",
                device=-1,
            )
        except Exception as exc:
            logger.warning("PyTorch FER pipeline is unavailable: %s", exc)
            _emotion_pipeline = None

    return _emotion_pipeline


def extract_frames_per_second(video_path: str, target_fps: float = 0.5):
    import cv2

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError("Cannot open video")

    video_fps = cap.get(cv2.CAP_PROP_FPS)
    if video_fps <= 0:
        raise RuntimeError("Invalid FPS")

    interval = max(1, int(round(video_fps / target_fps)))
    frames = []
    frame_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_count % interval == 0:
            frames.append(frame)
        frame_count += 1

    cap.release()
    return frames


def emotion_evaluation(emotion_list: list[str | None]) -> dict:
    result = {}

    cleaned_emotions = [
        emotion for emotion in (_normalize_emotion(item) for item in emotion_list)
        if emotion is not None
    ]

    total = len(cleaned_emotions)
    if total == 0:
        return result

    for emotion in cleaned_emotions:
        result[emotion] = result.get(emotion, 0) + 1

    for key in result:
        result[key] = round((result[key] / total) * 100, 2)

    return result


def _fer_with_pytorch_pipeline(images) -> list[str]:
    import cv2
    from PIL import Image

    classifier = _get_emotion_pipeline()
    if classifier is None:
        return []

    emotions_list = []

    for frame in images[:12]:
        try:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(rgb_frame)
            prediction = classifier(pil_image, top_k=1)

            if isinstance(prediction, list) and prediction:
                top_prediction = prediction[0]
                if isinstance(top_prediction, list) and top_prediction:
                    top_prediction = top_prediction[0]
                emotions_list.append(_normalize_emotion(top_prediction.get("label")))
        except Exception as exc:
            logger.warning("FER frame classification failed: %s", exc)

    return [emotion for emotion in emotions_list if emotion]


def _fer_with_deepface(images) -> list[str]:
    deepface_client = _get_deepface()
    if deepface_client is None:
        return []

    emotions_list = []

    for img in images[:12]:
        try:
            result = deepface_client.analyze(
                img_path=img,
                actions=["emotion"],
                enforce_detection=False,
            )
            if isinstance(result, list) and result:
                emotions_list.append(_normalize_emotion(result[0].get("dominant_emotion")))
        except Exception as exc:
            logger.warning("DeepFace frame analysis failed: %s", exc)

    return [emotion for emotion in emotions_list if emotion]


# ------ Detect Emotions ------
def fer(mp4_path: str) -> list[str]:
    try:
        images = extract_frames_per_second(mp4_path)
        if not images:
            logger.warning("FER found no frames in %s", mp4_path)
            return []

        try:
            emotions = _fer_with_pytorch_pipeline(images)
            if emotions:
                return emotions
        except Exception as exc:
            logger.warning("PyTorch FER failed, falling back to DeepFace: %s", exc)

        return _fer_with_deepface(images)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Emotion Detection failed: {str(e)}")
    finally:
        try:
            del images  # type: ignore[name-defined]
        except Exception:
            pass
        gc.collect()
