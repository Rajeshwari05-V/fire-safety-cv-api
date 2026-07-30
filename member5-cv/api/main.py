from pathlib import Path
from dotenv import load_dotenv
import requests
from fastapi.middleware.cors import CORSMiddleware
import fitz  # PyMuPDF
import cv2
import numpy as np

# Load .env before importing project modules
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI, UploadFile, File
from preprocessing.preprocess import preprocess_from_bytes
from detection.inference import run_inference

app = FastAPI(title="Fire Safety CV API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Teammate's backend endpoint
PROCESS_RESULT_URL = (
    "https://fire-safety-planning-quotation-system-53kf.onrender.com/api/ml/process-result"
)


@app.get("/")
def home():
    return {
        "status": "running",
        "service": "Fire Safety CV API"
    }


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    try:
        # Read uploaded file
        file_bytes = await file.read()

        # ==========================
        # Handle PDF uploads
        # ==========================
        if (
            file.content_type == "application/pdf"
            or file.filename.lower().endswith(".pdf")
        ):
            pdf = fitz.open(stream=file_bytes, filetype="pdf")

            if len(pdf) == 0:
                raise Exception("PDF contains no pages.")

            page = pdf.load_page(0)

            # Render first page at higher resolution
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))

            img = np.frombuffer(pix.samples, dtype=np.uint8)
            img = img.reshape(pix.height, pix.width, pix.n)

            # Convert RGB/RGBA to OpenCV BGR
            if pix.n == 4:
                image = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
            else:
                image = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

        # ==========================
        # Handle JPG / PNG uploads
        # ==========================
        else:
            image = preprocess_from_bytes(file_bytes)

        # Run YOLO inference
        detections = run_inference(image)

        # Count detected equipment
        equipment_count = {}

        for detection in detections:
            label = detection.get("type") or detection.get("class")

            if label:
                equipment_count[label] = equipment_count.get(label, 0) + 1

        # Convert YOLO labels into quotation-service equipment names
        equipment_mapping = {
            "fire_extinguisher": "fire_extinguisher_dry_powder",
            "fire_extinguisher_dry_powder": "fire_extinguisher_dry_powder",
            "smoke_detector": "smoke_detector",
            "emergency_light": "emergency_light",
            "fire_alarm": "fire_alarm",
        }

        # Build equipment recommendations
        equipment_recommendations = []

        for label, qty in equipment_count.items():
            equipment_recommendations.append(
                {
                    "item": equipment_mapping.get(label, label),
                    "qty": qty,
                }
            )

        # Never send an empty list
        if not equipment_recommendations:
            equipment_recommendations = [
                {
                    "item": "fire_extinguisher_dry_powder",
                    "qty": 1,
                }
            ]

        # JSON payload expected by quotation-service
        payload = {
            "projectName": "Floor Plan Detection",
            "equipment_recommendations": equipment_recommendations,
            "detections": detections,
            "review_flags": [],
            "rule_refs": [],
        }

        print("\n========== SENDING PAYLOAD ==========")
        print(payload)
        print("=====================================\n")

        response = requests.post(
            PROCESS_RESULT_URL,
            json=payload,
            headers={
                "Content-Type": "application/json"
            },
            timeout=30
        )

        print("\n========== BACKEND RESPONSE ==========")
        print("Status Code:", response.status_code)
        print("Body:", response.text)
        print("======================================\n")

        try:
            backend_response = response.json()
        except Exception:
            backend_response = response.text

        return {
            "success": response.ok,
            "status_code": response.status_code,
            "backend_response": backend_response,
            "detections": detections
        }

    except requests.exceptions.RequestException as e:
        print("\n========== REQUEST ERROR ==========")
        print(e)
        print("===================================\n")

        return {
            "success": False,
            "message": "Failed to send results to quotation-service",
            "error": str(e)
        }

    except Exception as e:
        print("\n========== DETECTION ERROR ==========")
        print(e)
        print("=====================================\n")

        return {
            "success": False,
            "message": "Detection pipeline failed",
            "error": str(e)
        }