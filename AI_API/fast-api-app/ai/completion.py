import os

from ai.clients import DS_Client, minimax_client, whisper_client

AI_COMPLETION_TIMEOUT_SECONDS = float(os.getenv("AI_COMPLETION_TIMEOUT_SECONDS", "25"))


def minimax_response(prompt):
    completion = minimax_client.chat.completions.create(
        model="MiniMaxAI/MiniMax-M2",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        timeout=AI_COMPLETION_TIMEOUT_SECONDS,
    )
    raw_text = completion.choices[0].message.content.strip()
    return raw_text


def deepseek_response(prompt):
    response = DS_Client.chat.completions.create(
        model="deepseek-ai/DeepSeek-V3.2:novita",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        timeout=AI_COMPLETION_TIMEOUT_SECONDS,
    )
    raw_text = response.choices[0].message.content
    return raw_text


def transcribe(file_path: str) -> str:
    transcription = whisper_client.automatic_speech_recognition(
        file_path,
        model="openai/whisper-large-v3-turbo"
    )
    return transcription['text']
