import os
from typing import NoReturn

from fastapi import HTTPException
from openai import APIConnectionError, APIStatusError, APITimeoutError, AuthenticationError, RateLimitError

from ai.clients import AIProviderConfigurationError, DS_Client, minimax_client, whisper_client

AI_COMPLETION_TIMEOUT_SECONDS = float(os.getenv("AI_COMPLETION_TIMEOUT_SECONDS", "60"))
AI_CHAT_MODEL = os.getenv("AI_CHAT_MODEL", "deepseek-ai/DeepSeek-V3.2:novita")
AI_EVALUATION_MODEL = os.getenv("AI_EVALUATION_MODEL", "MiniMaxAI/MiniMax-M2")
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "openai/whisper-large-v3-turbo")


def _raise_provider_http_error(error: Exception, feature_name: str) -> NoReturn:
    if isinstance(error, AIProviderConfigurationError):
        raise HTTPException(status_code=503, detail=str(error)) from error

    if isinstance(error, AuthenticationError):
        raise HTTPException(
            status_code=503,
            detail=f"{feature_name} AI provider is not authenticated. Please check backend AI provider configuration.",
        ) from error

    if isinstance(error, APITimeoutError):
        raise HTTPException(
            status_code=504,
            detail=f"{feature_name} AI provider timed out. Please try again.",
        ) from error

    if isinstance(error, RateLimitError):
        raise HTTPException(
            status_code=503,
            detail=f"{feature_name} AI provider is rate limited. Please try again later.",
        ) from error

    if isinstance(error, APIConnectionError):
        raise HTTPException(
            status_code=502,
            detail=f"{feature_name} AI provider could not be reached. Please try again later.",
        ) from error

    if isinstance(error, APIStatusError):
        if error.status_code in {401, 403}:
            detail = f"{feature_name} AI provider is not authenticated. Please check backend AI provider configuration."
            status_code = 503
        elif error.status_code in {408, 504}:
            detail = f"{feature_name} AI provider timed out. Please try again."
            status_code = 504
        elif error.status_code == 429:
            detail = f"{feature_name} AI provider is rate limited. Please try again later."
            status_code = 503
        else:
            detail = f"{feature_name} AI provider failed. Please try again later."
            status_code = 502

        raise HTTPException(status_code=status_code, detail=detail) from error

    raise error


def minimax_response(prompt):
    try:
        completion = minimax_client.chat.completions.create(
            model=AI_EVALUATION_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            timeout=AI_COMPLETION_TIMEOUT_SECONDS,
        )
    except Exception as error:
        _raise_provider_http_error(error, "Interview evaluation")

    raw_text = completion.choices[0].message.content.strip()
    return raw_text


def deepseek_response(prompt):
    try:
        response = DS_Client.chat.completions.create(
            model=AI_CHAT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            timeout=AI_COMPLETION_TIMEOUT_SECONDS,
        )
    except Exception as error:
        _raise_provider_http_error(error, "CV enhancement")

    raw_text = response.choices[0].message.content
    return raw_text


def transcribe(file_path: str) -> str:
    try:
        transcription = whisper_client.automatic_speech_recognition(
            file_path,
            model=WHISPER_MODEL,
        )
    except Exception as error:
        _raise_provider_http_error(error, "Speech transcription")

    return transcription["text"]
