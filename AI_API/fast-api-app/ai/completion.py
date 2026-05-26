from ai.clients import *

def minimax_response(prompt):
    completion = minimax_client.chat.completions.create(
        model="MiniMaxAI/MiniMax-M2",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    raw_text = completion.choices[0].message.content.strip()
    return raw_text


def deepseek_response(prompt):
    response = DS_Client.chat.completions.create(
        model="deepseek-ai/DeepSeek-V3.2:novita",
        messages=[{"role": "user", "content": prompt}],
        temperature=0
    )
    raw_text = response.choices[0].message.content
    return raw_text


def transcribe(file_path: str) -> str:
    transcription = whisper_client.automatic_speech_recognition(
        file_path,
        model="openai/whisper-large-v3-turbo"
    )
    return transcription['text']