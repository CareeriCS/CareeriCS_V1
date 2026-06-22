import json
import sys

from utils.util import fer, ser, emotion_evaluation, sentiment_analysis


def main() -> None:
    request = json.loads(sys.stdin.read())
    analysis_type = request["analysis_type"]
    payload = request["payload"]

    if analysis_type == "fer":
        result = emotion_evaluation(fer(payload["path"]))
    elif analysis_type == "ser":
        result = ser(payload["path"])
    elif analysis_type == "sentiment":
        result = sentiment_analysis(payload["text"])
    else:
        raise ValueError(f"Unsupported analysis type: {analysis_type}")

    print(json.dumps({"result": result}))


if __name__ == "__main__":
    main()
