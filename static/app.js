const $ = (id) => document.getElementById(id);

const dropzone = $("dropzone");
const fileInput = $("fileInput");
const preview = $("preview");
const classifyBtn = $("classifyBtn");
const chooseAnotherBtn = $("chooseAnotherBtn");
const tryAgainBtn = $("tryAgainBtn");
const spinner = $("spinner");
const btnLabel = $("btnLabel");
const errorBox = $("errorBox");
const results = $("results");
const loadingSkeleton = $("loadingSkeleton");
const dropContent = $("dropContent");
const categoryBadge = $("categoryBadge");
const topLabel = $("topLabel");
const topPercent = $("topPercent");
const guidanceText = $("guidanceText");
const confidenceStatus = $("confidenceStatus");
const tipBox = $("tipBox");
const mockNote = $("mockNote");
const barsWrap = $("bars");

const ALLOWED = ["image/jpeg", "image/png"];
const MAX_BYTES = 10 * 1024 * 1024;

const CATEGORY_ICONS = {
  Animals: "🐾",
  Vehicles: "🚗",
  Electronics: "💻",
  Furniture: "🪑",
  Food: "🍽️",
  Clothing: "👕",
  Other: "🧩",
};

let selectedFile = null;
let currentObjectURL = null;
let isLoading = false;


/* ============================================================
   ERROR HANDLING
   ============================================================ */

function clearError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}


/* ============================================================
   CONFIDENCE
   ============================================================ */

function getConfidenceLabel(confidence) {
  if (confidence >= 70) return "Confident";
  if (confidence >= 40) return "Fairly sure";
  return "Not sure";
}


/* ============================================================
   IMAGE PREVIEW
   ============================================================ */

function updateFilePreview(file) {
  if (currentObjectURL) {
    URL.revokeObjectURL(currentObjectURL);
  }

  currentObjectURL = URL.createObjectURL(file);

  preview.src = currentObjectURL;
  preview.classList.remove("hidden");

  dropzone.classList.add("is-filled");
  dropContent.classList.add("hidden");
}


/* ============================================================
   FILE SELECTION
   ============================================================ */

function setSelectedFile(file, shouldAutoClassify = false) {
  clearError();

  results.classList.add("hidden");
  loadingSkeleton.classList.add("hidden");

  if (!file) {
    selectedFile = null;
    classifyBtn.disabled = true;

    showError("Please select an image.");
    return;
  }

  /* Check file type */
  if (!ALLOWED.includes(file.type)) {
    selectedFile = null;
    classifyBtn.disabled = true;
    chooseAnotherBtn.classList.add("hidden");

    showError("Only JPEG and PNG images are supported.");
    return;
  }

  /* Check file size */
  if (file.size > MAX_BYTES) {
    selectedFile = null;
    classifyBtn.disabled = true;
    chooseAnotherBtn.classList.add("hidden");

    showError("Image is too large. The limit is 10 MB.");
    return;
  }

  /* Store selected file */
  selectedFile = file;

  updateFilePreview(file);

  classifyBtn.disabled = false;
  chooseAnotherBtn.classList.remove("hidden");

  /* Auto classify when image is pasted/dropped */
  if (shouldAutoClassify) {
    handleClassify();
  }
}


/* ============================================================
   RESET
   ============================================================ */

function resetState() {
  selectedFile = null;

  fileInput.value = "";

  if (currentObjectURL) {
    URL.revokeObjectURL(currentObjectURL);
    currentObjectURL = null;
  }

  preview.removeAttribute("src");
  preview.classList.add("hidden");

  dropzone.classList.remove("is-filled", "is-active");

  dropContent.classList.remove("hidden");

  chooseAnotherBtn.classList.add("hidden");

  results.classList.add("hidden");

  loadingSkeleton.classList.add("hidden");

  clearError();

  classifyBtn.disabled = true;

  btnLabel.textContent = "Classify";

  spinner.classList.add("hidden");

  if (mockNote) {
    mockNote.classList.add("hidden");
  }

  dropzone.focus();
}


/* ============================================================
   LOADING
   ============================================================ */

function setLoading(on) {
  isLoading = on;

  classifyBtn.disabled = on || !selectedFile;

  chooseAnotherBtn.disabled = on;

  spinner.classList.toggle("hidden", !on);

  btnLabel.textContent = on
    ? "Classifying…"
    : "Classify";

  if (on) {
    results.classList.add("hidden");
    loadingSkeleton.classList.remove("hidden");
  } else {
    loadingSkeleton.classList.add("hidden");
  }
}


/* ============================================================
   RESULT BAR
   ============================================================ */

function createBarRow(label, value, isWinner) {
  const row = document.createElement("div");

  row.className = "bar-row";

  const meta = document.createElement("div");

  meta.className =
    "mb-1.5 flex items-center justify-between gap-3";

  const labelEl = document.createElement("span");

  labelEl.className = isWinner
    ? "text-sm font-semibold text-[color:var(--text)]"
    : "text-sm text-[color:var(--subtle-strong)]";

  labelEl.textContent = label;

  const valueEl = document.createElement("span");

  valueEl.className = isWinner
    ? "text-sm font-semibold text-[color:var(--text)]"
    : "text-sm text-[color:var(--subtle)]";

  valueEl.textContent = `${value.toFixed(1)}%`;

  meta.appendChild(labelEl);
  meta.appendChild(valueEl);

  const track = document.createElement("div");

  track.className =
    "h-2.5 overflow-hidden rounded-full bg-[color:var(--bar)]";

  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-label", label);
  track.setAttribute("aria-valuenow", String(value));
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");

  const fill = document.createElement("div");

  fill.className = isWinner
    ? "confidence-fill h-full rounded-full bg-[color:var(--accent)]"
    : "confidence-fill h-full rounded-full bg-[color:var(--subtle)]";

  fill.style.width = "0%";

  track.appendChild(fill);

  row.appendChild(meta);
  row.appendChild(track);

  requestAnimationFrame(() => {
    const reduceMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

    if (reduceMotion) {
      fill.style.width = `${Math.max(value, 0)}%`;
      return;
    }

    fill.style.width = `${Math.max(value, 0)}%`;
  });

  return row;
}


/* ============================================================
   RENDER RESULTS
   ============================================================ */

function renderResults(data) {

  /*
   * The Flask app returns:
   *
   * {
   *   success: true,
   *   prediction: "...",
   *   confidence: 95.4,
   *   results: [
   *      {
   *        label: "...",
   *        confidence: 95.4
   *      }
   *   ]
   * }
   *
   * Convert "results" into the format expected by the UI.
   */

  const categories = Array.isArray(data.results)
    ? data.results
    : Array.isArray(data.categories)
      ? data.categories
      : [];

  const sortedCategories = [...categories].sort(
    (a, b) =>
      Number(b.confidence || 0) -
      Number(a.confidence || 0)
  );

  let winner;

  if (data.prediction) {

    const matchingResult = sortedCategories.find(
      (item) =>
        item.label === data.prediction
    );

    winner = matchingResult || {
      label: data.prediction,
      confidence: Number(data.confidence || 0)
    };

  } else {

    winner =
      sortedCategories[0] || {
        label: "Other",
        confidence: 0
      };
  }

  const winnerConfidence =
    Number(winner.confidence || data.confidence || 0);

  const icon =
    CATEGORY_ICONS[winner.label] ||
    CATEGORY_ICONS.Other;


  /* Main result */

  categoryBadge.textContent = icon;

  topLabel.textContent = winner.label;

  topPercent.textContent =
    winnerConfidence.toFixed(1);

  guidanceText.textContent =
    getConfidenceLabel(winnerConfidence);

  confidenceStatus.textContent =
    getConfidenceLabel(winnerConfidence);


  /* Mock result */

  if (data.mock) {
    mockNote.classList.remove("hidden");
  } else {
    mockNote.classList.add("hidden");
  }


  /* Tip */

  let tipMessage;

  if (
    winner.label === "Other" &&
    winnerConfidence < 40
  ) {

    tipMessage =
      "Tip: avoid screenshots, keep the subject isolated, and use bright, even lighting with a simple background.";

  } else if (winnerConfidence >= 70) {

    tipMessage =
      "Great result: the image looks clear and the main subject is easy to identify.";

  } else if (winnerConfidence >= 40) {

    tipMessage =
      "This is a reasonable match. A clearer photo or a single main subject may improve accuracy.";

  } else {

    tipMessage =
      "This is a weak match. Try a clearer photo with one main object and better lighting.";
  }

  tipBox.textContent = tipMessage;

  tipBox.classList.remove("hidden");


  /* Confidence bars */

  barsWrap.textContent = "";

  sortedCategories.forEach(
    (category, index) => {

      const categoryConfidence =
        Number(category.confidence || 0);

      const row = createBarRow(
        category.label,
        categoryConfidence,
        category.label === winner.label &&
        index === 0
      );

      barsWrap.appendChild(row);
    }
  );


  /* Show results */

  results.classList.remove("hidden");

  results.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}


/* ============================================================
   CLASSIFICATION
   ============================================================ */

async function handleClassify() {

  if (!selectedFile || isLoading) {
    return;
  }

  clearError();

  setLoading(true);


  /*
   * Create FormData.
   *
   * IMPORTANT:
   * "image" must match app.py:
   *
   * request.files["image"]
   */

  const formData = new FormData();

  formData.append(
    "image",
    selectedFile
  );


  try {

    /*
     * Send image to Flask.
     *
     * IMPORTANT:
     * app.py uses:
     *
     * @app.route("/classify", methods=["POST"])
     */

    const response = await fetch(
      "/classify",
      {
        method: "POST",
        body: formData
      }
    );


    /*
     * Read response as text first.
     * This helps debug Render errors.
     */

    const text = await response.text();

    console.log(
      "Classification HTTP status:",
      response.status
    );

    console.log(
      "Classification response:",
      text
    );


    let data;

    try {

      data = JSON.parse(text);

    } catch (jsonError) {

      console.error(
        "Invalid JSON from server:",
        text
      );

      throw new Error(
        `Server returned invalid JSON (HTTP ${response.status}).`
      );
    }


    /*
     * Check HTTP status.
     */

    if (!response.ok) {

      throw new Error(
        data.error ||
        "Classification failed."
      );
    }


    /*
     * Check Flask success flag.
     */

    if (data.success === false) {

      throw new Error(
        data.error ||
        "Classification failed."
      );
    }


    /*
     * Display results.
     */

    renderResults(data);

  } catch (error) {

    console.error(
      "Classification error:",
      error
    );

    const message =
      error && error.message
        ? error.message
        : "Something went wrong while classifying the image.";

    showError(message);

  } finally {

    setLoading(false);
  }
}


/* ============================================================
   PASTE IMAGE
   ============================================================ */

function handlePaste(event) {

  if (
    !event.clipboardData ||
    !event.clipboardData.items
  ) {
    return;
  }

  const items =
    Array.from(
      event.clipboardData.items || []
    );

  const imageItem =
    items.find(
      (item) =>
        item.type.startsWith("image/")
    );

  if (!imageItem) {
    return;
  }

  event.preventDefault();

  const file =
    imageItem.getAsFile();

  if (file) {
    setSelectedFile(
      file,
      true
    );
  }
}


/* ============================================================
   DRAG & DROP
   ============================================================ */

function handleDrop(event) {

  event.preventDefault();

  dropzone.classList.remove(
    "is-active"
  );

  const [file] =
    Array.from(
      event.dataTransfer.files || []
    );

  if (file) {

    setSelectedFile(
      file,
      true
    );
  }
}


function handleDragOver(event) {

  event.preventDefault();

  dropzone.classList.add(
    "is-active"
  );
}


function handleDragLeave(event) {

  if (
    !dropzone.contains(
      event.relatedTarget
    )
  ) {

    dropzone.classList.remove(
      "is-active"
    );
  }
}


/* ============================================================
   KEYBOARD
   ============================================================ */

function handleKeyboardOpen(event) {

  if (
    event.key === "Enter" ||
    event.key === " "
  ) {

    event.preventDefault();

    fileInput.click();
  }
}


/* ============================================================
   FILE INPUT
   ============================================================ */

fileInput.addEventListener(
  "change",
  () => {

    const [file] =
      Array.from(
        fileInput.files || []
      );

    if (file) {

      setSelectedFile(
        file,
        false
      );
    }
  }
);


/* ============================================================
   EVENT LISTENERS
   ============================================================ */

dropzone.addEventListener(
  "click",
  () => fileInput.click()
);

dropzone.addEventListener(
  "keydown",
  handleKeyboardOpen
);

dropzone.addEventListener(
  "dragenter",
  handleDragOver
);

dropzone.addEventListener(
  "dragover",
  handleDragOver
);

dropzone.addEventListener(
  "dragleave",
  handleDragLeave
);

dropzone.addEventListener(
  "drop",
  handleDrop
);

document.addEventListener(
  "paste",
  handlePaste
);


classifyBtn.addEventListener(
  "click",
  handleClassify
);

chooseAnotherBtn.addEventListener(
  "click",
  resetState
);

tryAgainBtn.addEventListener(
  "click",
  resetState
);


/* ============================================================
   INITIAL STATE
   ============================================================ */

resetState();
