from pathlib import Path
from dotenv import load_dotenv
import requests

# Load .env BEFORE importing anything else
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI, UploadFile, File
from preprocessing.preprocess import preprocess_from_bytes
from detection.inference import run_inference

app = FastAPI(
    title="Fire Safety CV API"
)

PROCESS_RESULT_URL = (
    "https://fire-safety-planning-quotation-system-53kf.onrender.com"
    "/api/ml/process-result"
)


@app.get("/")
def home():
    return {"status": "running"}


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    img_bytes = await file.read()

    img = preprocess_from_bytes(img_bytes)

    detections = run_inference(img)

    equipment_recommendations = []

    # NOTE:
    # This assumes each detection contains a key named "class".
    # If your inference.py uses a different key such as "label" or "name",
    # replace d["class"] accordingly.
    for d in detections:
        equipment_recommendations.append(
            {
                "item": d["class"],
                "qty": 1
            }
        )

    payload = {
        "projectName": "Floor Plan Detection",
        "equipment_recommendations": equipment_recommendations,
        "detections": detections,
        "review_flags": [],
        "rule_refs": []
    }

    response = requests.post(
        PROCESS_RESULT_URL,
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=30
    )

    return response.json()