import os
import torch
from flask import Flask, request, jsonify, render_template
from PIL import Image
from torchvision import models

# ========================================
# Flask App
# ========================================

app = Flask(__name__)

# ========================================
# Configuration
# ========================================

DEVICE = torch.device("cpu")

print("========================================")
print("Object Classification System")
print("Device:", DEVICE)
print("========================================")


# ========================================
# Load Lightweight Classification Model
# ========================================

print("Loading classification model...")

try:
    weights = models.MobileNet_V3_Small_Weights.DEFAULT

    model = models.mobilenet_v3_small(
        weights=weights
    )

    model.eval()
    model.to(DEVICE)

    # Preprocessing provided by torchvision
    preprocess = weights.transforms()

    # ImageNet class names
    categories = weights.meta["categories"]

    print("Classification model loaded successfully!")

except Exception as e:
    print("ERROR: Could not load model")
    print(str(e))
    raise


# ========================================
# Home Page
# ========================================

@app.route("/")
def home():
    return render_template("index.html")


# ========================================
# Health Check
# ========================================

@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "device": str(DEVICE),
        "model": "MobileNetV3-Small"
    })


# ========================================
# Image Classification
# ========================================

@app.route("/classify", methods=["POST"])
def classify():

    # Check if image was uploaded
    if "image" not in request.files:
        return jsonify({
            "success": False,
            "error": "No image uploaded"
        }), 400

    file = request.files["image"]

    # Check filename
    if file.filename == "":
        return jsonify({
            "success": False,
            "error": "No image selected"
        }), 400

    try:

        # ========================================
        # Open Image
        # ========================================

        image = Image.open(file.stream).convert("RGB")

        # ========================================
        # Preprocess Image
        # ========================================

        input_tensor = preprocess(image)

        # Add batch dimension
        input_batch = input_tensor.unsqueeze(0)

        # Move to CPU
        input_batch = input_batch.to(DEVICE)

        # ========================================
        # Prediction
        # ========================================

        with torch.inference_mode():

            output = model(input_batch)

            probabilities = torch.nn.functional.softmax(
                output[0],
                dim=0
            )

        # ========================================
        # Get Top 5 Predictions
        # ========================================

        top5_prob, top5_catid = torch.topk(
            probabilities,
            5
        )

        predictions = []

        for probability, category_id in zip(
            top5_prob,
            top5_catid
        ):

            label = categories[category_id.item()]

            confidence = probability.item() * 100

            predictions.append({
                "label": label,
                "confidence": round(confidence, 2)
            })

        # ========================================
        # Best Prediction
        # ========================================

        best_prediction = predictions[0]

        return jsonify({

            "success": True,

            "prediction": best_prediction["label"],

            "confidence": best_prediction["confidence"],

            "predictions": predictions

        })

    except Exception as e:

        print("========================================")
        print("Classification Error")
        print(str(e))
        print("========================================")

        return jsonify({

            "success": False,

            "error": "Unable to classify image",

            "details": str(e)

        }), 500


# ========================================
# Error Handler
# ========================================

@app.errorhandler(404)
def page_not_found(error):

    return jsonify({
        "success": False,
        "error": "Page not found"
    }), 404


@app.errorhandler(500)
def internal_server_error(error):

    return jsonify({
        "success": False,
        "error": "Internal server error"
    }), 500


# ========================================
# Run Application
# ========================================

if __name__ == "__main__":

    port = int(
        os.environ.get(
            "PORT",
            10000
        )
    )

    print("========================================")
    print("Starting Flask Server")
    print("Host: 0.0.0.0")
    print("Port:", port)
    print("========================================")

    app.run(
        host="0.0.0.0",
        port=port
    )
