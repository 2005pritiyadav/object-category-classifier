# Image Sorter - Object Category Classification

Upload a JPEG/PNG and get a predicted category (Animals, Vehicles, Electronics,
Furniture, Food, Clothing, Other) with a confidence score for every category.

## Structure
```
image-sorter/
  app.py              Flask server and /predict endpoint
  requirements.txt
  templates/index.html
  static/app.js
```

## Setup (Python 3.9+)
```
cd image-sorter
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
Open http://127.0.0.1:5000

The first prediction downloads the MobileNetV3 weights (about 20 MB), so it is
slower than later ones. The page loads Tailwind from a CDN, so it needs internet.

## Quick demo without the model
```
MOCK_MODE=1 python app.py       # Windows PowerShell: $env:MOCK_MODE=1; python app.py
```
Mock mode returns placeholder scores and does not need torch.

## API
POST /predict  (multipart form, field name "file")
Returns: { prediction: {label, confidence}, categories: [...], top_matches: [...], mock: bool }

## Changing the categories
Edit KEYWORDS and CATEGORIES in app.py. Animals are ImageNet classes 0-397.
Anything unmatched falls into "Other".
# object-category-classifier
