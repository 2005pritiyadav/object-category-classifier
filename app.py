"""Object Category Classification from Images - Flask backend.

Run:  python app.py
Fast mock mode (no model download):  MOCK_MODE=1 python app.py
"""
import hashlib
import io
import os
import re

from flask import Flask, jsonify, render_template, request
from PIL import Image, UnidentifiedImageError

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB upload limit

ALLOWED_TYPES = {"image/jpeg", "image/png"}
MOCK_MODE = os.environ.get("MOCK_MODE") == "1"

# ---------------------------------------------------------------------------
# Predefined categories. Animals are ImageNet classes 0-397 (no keywords needed).
# Edit the keyword sets to change what each category contains.
# ---------------------------------------------------------------------------
KEYWORDS = {
    "Vehicles": {
        "car", "cab", "van", "truck", "bus", "jeep", "limousine", "convertible",
        "minivan", "pickup", "trolleybus", "tractor", "bicycle", "scooter",
        "moped", "airliner", "warplane", "airship", "ship", "liner", "canoe",
        "boat", "yawl", "schooner", "train", "locomotive", "streetcar",
        "ambulance", "wagon", "motorcycle", "speedboat", "submarine",
        "catamaran", "trimaran", "snowmobile",
    },
    "Electronics": {
        "laptop", "notebook", "computer", "monitor", "screen", "television",
        "telephone", "ipod", "mouse", "keyboard", "remote", "disc", "modem",
        "printer", "projector", "radio", "camera", "joystick", "speaker",
        "desktop", "pay-phone",
    },
    "Furniture": {
        "chair", "couch", "table", "desk", "bookcase", "wardrobe", "crib",
        "bassinet", "cradle", "throne", "chiffonier", "bench", "cabinet",
        "chest", "sofa", "stool",
    },
    "Food": {
        "pizza", "cheeseburger", "hotdog", "bagel", "pretzel", "burrito",
        "guacamole", "carbonara", "espresso", "banana", "orange", "lemon",
        "strawberry", "pineapple", "pomegranate", "fig", "broccoli",
        "cauliflower", "zucchini", "cucumber", "cabbage", "artichoke", "cream",
        "meat", "potpie", "trifle", "dough", "consomme", "apple", "jackfruit",
        "squash", "eggnog",
    },
    "Clothing": {
        "jersey", "jean", "sweatshirt", "cardigan", "suit", "gown", "bikini",
        "trunks", "sandal", "loafer", "boot", "shoe", "hat", "sombrero",
        "bonnet", "cloak", "coat", "miniskirt", "overskirt", "hoopskirt",
        "kimono", "poncho", "abaya", "sock", "brassiere", "pajama", "vest",
        "cap", "helmet",
    },
}
CATEGORIES = ["Animals", "Vehicles", "Electronics", "Furniture", "Food", "Clothing", "Other"]

_model = None
_preprocess = None
_labels = None
_class_category = None


def category_of(idx: int, name: str) -> str:
    if idx <= 397:
        return "Animals"
    tokens = set(re.findall(r"[a-z\-]+", name.lower()))
    for category, words in KEYWORDS.items():
        if tokens & words:
            return category
    return "Other"


def load_model():
    """Load MobileNetV3 once, on first request."""
    global _model, _preprocess, _labels, _class_category
    if _model is not None:
        return
    from torchvision import models  # imported lazily so MOCK_MODE needs no torch

    weights = models.MobileNet_V3_Large_Weights.DEFAULT
    _model = models.mobilenet_v3_large(weights=weights).eval()
    _preprocess = weights.transforms()
    _labels = weights.meta["categories"]
    _class_category = [category_of(i, n) for i, n in enumerate(_labels)]


def classify_real(img: Image.Image):
    import torch

    load_model()
    with torch.no_grad():
        probs = _model(_preprocess(img).unsqueeze(0)).softmax(1)[0]

    totals = {c: 0.0 for c in CATEGORIES}
    for i, p in enumerate(probs.tolist()):
        totals[_class_category[i]] += p

    top = probs.topk(3)
    matches = [
        {"label": _labels[i], "confidence": round(p * 100, 2)}
        for p, i in zip(top.values.tolist(), top.indices.tolist())
    ]
    return totals, matches


def classify_mock(img_bytes: bytes):
    """Deterministic fake scores derived from the image bytes (for quick demos)."""
    digest = hashlib.sha256(img_bytes).digest()
    raw = [digest[i] + 1 for i in range(len(CATEGORIES))]
    raw[digest[-1] % len(CATEGORIES)] += 400  # make one category clearly win
    total = sum(raw)
    return {c: v / total for c, v in zip(CATEGORIES, raw)}, []


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/predict")
def predict():
    try:
        file = request.files.get("file")

        if file is None or file.filename == "":
            return jsonify({
                "success": False,
                "error": "No file was uploaded."
            }), 400

        if file.mimetype not in ALLOWED_TYPES:
            return jsonify({
                "success": False,
                "error": "Only JPEG and PNG images are supported."
            }), 415

        data = file.read()

        if not data:
            return jsonify({
                "success": False,
                "error": "The uploaded file is empty."
            }), 400

        try:
            img = Image.open(io.BytesIO(data)).convert("RGB")
        except (UnidentifiedImageError, OSError):
            return jsonify({
                "success": False,
                "error": "That file could not be read as an image."
            }), 400

        # Run classification
        if MOCK_MODE:
            totals, matches = classify_mock(data)
        else:
            totals, matches = classify_real(img)

        categories = sorted(
            (
                {
                    "label": c,
                    "confidence": round(p * 100, 2)
                }
                for c, p in totals.items()
            ),
            key=lambda x: x["confidence"],
            reverse=True,
        )

        return jsonify({
            "success": True,
            "prediction": categories[0],
            "categories": categories,
            "top_matches": matches,
            "mock": MOCK_MODE,
        }), 200

    except Exception as e:
        import traceback

        print("========== PREDICTION ERROR ==========")
        traceback.print_exc()
        print("=======================================")

        return jsonify({
            "success": False,
            "error": f"Prediction failed: {str(e)}"
        }), 500

@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "mock_mode": MOCK_MODE
    })

@app.errorhandler(413)
def too_large(_):
    return jsonify(error="Image is too large. The limit is 10 MB."), 413


if __name__ == "__main__":
       app.run(debug=True, port=5002)
