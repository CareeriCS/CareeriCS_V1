import json
import sys


def main() -> None:
    request = json.loads(sys.stdin.read())
    analysis_type = request["analysis_type"]
    payload = request["payload"]

    if analysis_type == "fer":
        from utils.interview.fer import fer, emotion_evaluation

        result = emotion_evaluation(fer(payload["path"]))
    elif analysis_type == "ser":
        from utils.interview.ser import ser

        result = ser(payload["path"])
    elif analysis_type == "sentiment":
        from utils.interview.sentiment import sentiment_analysis

        result = sentiment_analysis(payload["text"])
    else:
        raise ValueError(f"Unsupported analysis type: {analysis_type}")

    print(json.dumps({"result": result}))


if __name__ == "__main__":
    main()
