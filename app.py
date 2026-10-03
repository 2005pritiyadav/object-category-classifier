import os
import io
import json
import traceback

from flask import Flask, render_template, request, jsonify
from PIL import Image

import torch
from torchvision import models, transforms


# ============================================================
# FLASK APP
# ============================================================

app = Flask(__name__)

# Maximum upload size: 10 MB
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024


# ============================================================
# DEVICE
# ============================================================

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print("========================================")
print("Object Classification System")
print("Device:", device)
print("========================================")


# ============================================================
# IMAGE TRANSFORMATION
# ============================================================

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])


# ============================================================
# MODEL
# ============================================================

print("Loading classification model...")

try:
    weights = models.ResNet50_Weights.DEFAULT

    model = models.resnet50(weights=weights)

    model.eval()
    model.to(device)

    categories = weights.meta["categories"]

    print("Model loaded successfully.")
    print("Number of classes:", len(categories))

except Exception as e:
    print("ERROR while loading model:")
    print(str(e))
    traceback.print_exc()

    model = None
    categories = []


# ============================================================
# CLASSIFICATION FUNCTION
# ============================================================

def classify_image(image):
    """
    Classifies an uploaded image using ResNet50.
    Returns top predictions.
    """

    if model is None:
        raise RuntimeError("Classification model could not be loaded.")

    # Convert image to RGB
    image = image.convert("RGB")

    # Apply preprocessing
    input_tensor = transform(image)

    # Add batch dimension
    input_batch = input_tensor.unsqueeze(0)

    # Move to CPU/GPU
    input_batch = input_batch.to(device)

    # Prediction
    with torch.no_grad():
        output = model(input_batch)

    # Convert logits to probabilities
    probabilities = torch.nn.functional.softmax(
        output[0],
        dim=0
    )

    # Get top 5 predictions
    top_probabilities, top_indices = torch.topk(
        probabilities,
        5
    )

    results = []

    for probability, index in zip(
        top_probabilities,
        top_indices
    ):
        class_name = categories[index.item()]
        confidence = float(probability.item() * 100)

        results.append({
            "label": class_name,
            "confidence": round(confidence, 2)
        })

    return results


# ============================================================
# HOME PAGE
# ============================================================

@app.route("/")
def home():
    return render_template("index.html")


# ============================================================
# CLASSIFY API
# ============================================================

@app.route("/classify", methods=["POST"])
def classify():

    try:

        # Check whether file exists
        if "image" not in request.files:

            return jsonify({
                "success": False,
                "error": "No image file was uploaded."
            }), 400

        file = request.files["image"]

        # Check filename
        if file.filename == "":

            return jsonify({
                "success": False,
                "error": "Please select an image."
            }), 400

        # Read image
        image_bytes = file.read()

        if not image_bytes:

            return jsonify({
                "success": False,
                "error": "The uploaded image is empty."
            }), 400

        # Open image
        image = Image.open(
            io.BytesIO(image_bytes)
        )

        # Classify
        results = classify_image(image)

        # Best prediction
        best_result = results[0]

        return jsonify({
            "success": True,

            "prediction": best_result["label"],

            "confidence": best_result["confidence"],

            "results": results
        })

    except Exception as e:

        print("========================================")
        print("CLASSIFICATION ERROR")
        print(str(e))
        traceback.print_exc()
        print("========================================")

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/health")
def health():

    return jsonify({
        "status": "ok",
        "model_loaded": model is not None,
        "device": str(device)
    })


# ============================================================
# ERROR HANDLERS
# ============================================================

@app.errorhandler(413)
def file_too_large(error):

    return jsonify({
        "success": False,
        "error": "File is too large. Maximum size is 10 MB."
    }), 413


@app.errorhandler(404)
def page_not_found(error):

    return jsonify({
        "success": False,
        "error": "Page not found."
    }), 404


@app.errorhandler(500)
def internal_server_error(error):

    return jsonify({
        "success": False,
        "error": "Internal server error."
    }), 500


# ============================================================
# RENDER / PRODUCTION SERVER
# ============================================================

if __name__ == "__main__":

    # Render provides PORT through environment variable.
    # Local development uses port 10000.
    port = int(os.environ.get("PORT", 10000))

    print("========================================")
    print("Starting Flask server")
    print("Host: 0.0.0.0")
    print("Port:", port)
    print("========================================")

    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )
