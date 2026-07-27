from pathlib import Path
from dotenv import load_dotenv
import requests

# Load .env BEFORE importing project modules
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI, UploadFile, File
from preprocessing.preprocess import preprocess_from_bytes
from detection.inference import run_inference

app = FastAPI(title="Fire Safety CV API")

PROCESS_RESULT_URL = (
    "https://fire-safety-planning-quotation-system-53kf.onrender.com"
    "/api/ml/process-result"
)


@app.get("/")
def home():
    return {"status": "running"}


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    # Read uploaded image
    img_bytes = await file.read()

    # Preprocess image
    img = preprocess_from_bytes(img_bytes)

    # Run YOLO inference
    detections = run_inference(img)

    # Build equipment recommendations
    equipment_recommendations = []

    equipment_count = {}

    for detection in detections:
        item = detection["type"]

        equipment_count[item] = equipment_count.get(item, 0) + 1

    for item, qty in equipment_count.items():
        equipment_recommendations.append(
            {
                "item": item,
                "qty": qty
            }
        )

    payload = {
        "projectName": "Floor Plan Detection",
        "equipment_recommendations": equipment_recommendations,
        "detections": detections,
        "review_flags": [],
        "rule_refs": []
    }

    print("\nSending payload:")
    print(payload)

    response = requests.post(
        PROCESS_RESULT_URL,
        json=payload,
        headers={
            "Content-Type": "application/json"
        },
        timeout=30
    )

    print("\nStatus Code:", response.status_code)
    print("Response:", response.text)

    return response.json()