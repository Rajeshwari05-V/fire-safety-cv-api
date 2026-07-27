from pathlib import Path
from ultralytics import YOLO


def train_model():
    # Project root: Fire-Safety-Planning-Quotation-System/member5-cv
    ROOT = Path(__file__).resolve().parent.parent

    # Dataset configuration
    DATA_YAML = ROOT / "data" / "Fire Safety Equipment Detection.v2i.yolov8" / "data.yaml"

    # Load YOLOv8 nano model
    model = YOLO("yolov8n.pt")

    # Train
    model.train(
        data=str(DATA_YAML),
        epochs=100,
        imgsz=640,
        batch=16
    )


if __name__ == "__main__":
    train_model()