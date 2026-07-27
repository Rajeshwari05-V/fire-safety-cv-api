import requests

url = "https://fire-safety-planning-quotation-system-53kf.onrender.com/api/ml/process-result"

payload = {
    "projectName": "Sample Project",
    "equipment_recommendations": [
        {
            "item": "Fire Alarm",
            "qty": 2
        }
    ],
    "detections": [],
    "review_flags": [],
    "rule_refs": []
}

response = requests.post(url, json=payload)

print("Status Code:", response.status_code)
print(response.text)