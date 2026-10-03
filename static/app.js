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
  Animals: '🐾',
  Vehicles: '🚗',
  Electronics: '💻',
  Furniture: '🪑',
  Food: '🍽️',
  Clothing: '👕',
  Other: '🧩',
};

let selectedFile = null;
let currentObjectURL = null;
let isLoading = false;

function clearError() {
  errorBox.textContent = '';
  errorBox.classList.add('hidden');
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}

function getConfidenceLabel(confidence) {
  if (confidence >= 70) return 'Confident';
  if (confidence >= 40) return 'Fairly sure';
  return 'Not sure';
}

function updateFilePreview(file) {
  if (currentObjectURL) {
    URL.revokeObjectURL(currentObjectURL);
  }

  currentObjectURL = URL.createObjectURL(file);
  preview.src = currentObjectURL;
  preview.classList.remove('hidden');
  dropzone.classList.add('is-filled');
  dropContent.classList.add('hidden');
}

function setSelectedFile(file, shouldAutoClassify = false) {
  clearError();
  results.classList.add('hidden');
  loadingSkeleton.classList.add('hidden');

  if (!ALLOWED.includes(file.type)) {
    selectedFile = null;
    classifyBtn.disabled = true;
    chooseAnotherBtn.classList.add('hidden');
    return showError('Only JPEG and PNG images are supported.');
  }

  if (file.size > MAX_BYTES) {
    selectedFile = null;
    classifyBtn.disabled = true;
    chooseAnotherBtn.classList.add('hidden');
    return showError('Image is too large. The limit is 10 MB.');
  }

  selectedFile = file;
  updateFilePreview(file);
  classifyBtn.disabled = false;
  chooseAnotherBtn.classList.remove('hidden');

  if (shouldAutoClassify) {
    handleClassify();
  }
}

function resetState() {
  selectedFile = null;
  fileInput.value = '';

  if (currentObjectURL) {
    URL.revokeObjectURL(currentObjectURL);
    currentObjectURL = null;
  }

  preview.removeAttribute('src');
  preview.classList.add('hidden');
  dropzone.classList.remove('is-filled', 'is-active');
  dropContent.classList.remove('hidden');
  chooseAnotherBtn.classList.add('hidden');
  results.classList.add('hidden');
  loadingSkeleton.classList.add('hidden');
  clearError();
  classifyBtn.disabled = true;
  btnLabel.textContent = 'Classify';
  spinner.classList.add('hidden');
  dropzone.focus();
}

function setLoading(on) {
  isLoading = on;
  classifyBtn.disabled = on || !selectedFile;
  chooseAnotherBtn.disabled = on;

  spinner.classList.toggle('hidden', !on);
  btnLabel.textContent = on ? 'Classifying…' : 'Classify';

  if (on) {
    results.classList.add('hidden');
    loadingSkeleton.classList.remove('hidden');
  } else {
    loadingSkeleton.classList.add('hidden');
  }
}

function createBarRow(label, value, isWinner) {
  const row = document.createElement('div');
  row.className = 'bar-row';

  const meta = document.createElement('div');
  meta.className = 'mb-1.5 flex items-center justify-between gap-3';

  const labelEl = document.createElement('span');
  labelEl.className = isWinner ? 'text-sm font-semibold text-[color:var(--text)]' : 'text-sm text-[color:var(--subtle-strong)]';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = isWinner ? 'text-sm font-semibold text-[color:var(--text)]' : 'text-sm text-[color:var(--subtle)]';
  valueEl.textContent = `${value.toFixed(1)}%`;

  meta.appendChild(labelEl);
  meta.appendChild(valueEl);

  const track = document.createElement('div');
  track.className = 'h-2.5 overflow-hidden rounded-full bg-[color:var(--bar)]';
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-label', label);
  track.setAttribute('aria-valuenow', String(value));
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');

  const fill = document.createElement('div');
  fill.className = isWinner ? 'confidence-fill h-full rounded-full bg-[color:var(--accent)]' : 'confidence-fill h-full rounded-full bg-[color:var(--subtle)]';
  fill.style.width = '0%';

  track.appendChild(fill);
  row.appendChild(meta);
  row.appendChild(track);

  requestAnimationFrame(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      fill.style.width = `${Math.max(value, 0)}%`;
      return;
    }
    fill.style.width = `${Math.max(value, 0)}%`;
  });

  return row;
}

function renderResults(data) {
  const sortedCategories = [...(data.categories || [])].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  const winner = data.prediction || sortedCategories[0] || { label: 'Other', confidence: 0 };
  const icon = CATEGORY_ICONS[winner.label] || CATEGORY_ICONS.Other;

  categoryBadge.textContent = icon;
  topLabel.textContent = winner.label;
  topPercent.textContent = Number(winner.confidence || 0).toFixed(1);
  guidanceText.textContent = `${getConfidenceLabel(Number(winner.confidence || 0))}`;
  confidenceStatus.textContent = getConfidenceLabel(Number(winner.confidence || 0));

  if (data.mock) {
    mockNote.classList.remove('hidden');
  } else {
    mockNote.classList.add('hidden');
  }

  const confidence = Number(winner.confidence || 0);
  const tipMessage = winner.label === 'Other' && confidence < 40
    ? 'Tip: avoid screenshots, keep the subject isolated, and use bright, even lighting with a simple background.'
    : confidence >= 70
      ? 'Great result: the image looks clear and the main subject is easy to identify.'
      : confidence >= 40
        ? 'This is a reasonable match. A clearer photo or a single main subject may improve accuracy.'
        : 'This is a weak match. Try a clearer photo with one main object and better lighting.';

  tipBox.textContent = tipMessage;
  tipBox.classList.remove('hidden');

  barsWrap.textContent = '';
  sortedCategories.forEach((category, index) => {
    const row = createBarRow(category.label, Number(category.confidence || 0), category.label === winner.label && index === 0);
    barsWrap.appendChild(row);
  });

  results.classList.remove('hidden');
  results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function handleClassify() {
  if (!selectedFile || isLoading) {
    return;
  }

  clearError();
  setLoading(true);

  const form = new FormData();
  form.append('file', selectedFile);

  try {
    const response = await fetch('/predict', {
      method: 'POST',
      body: form,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Classification failed. Please try another photo.');
    }

    renderResults(data);
  } catch (error) {
    const message = error && error.message ? error.message : 'Something went wrong while classifying the image.';
    showError(`${message} Try a different image or a clearer photo.`);
  } finally {
    setLoading(false);
  }
}

function handlePaste(event) {
  if (!event.clipboardData || !event.clipboardData.items) {
    return;
  }

  const items = Array.from(event.clipboardData.items || []);
  const imageItem = items.find((item) => item.type.startsWith('image/'));

  if (!imageItem) {
    return;
  }

  event.preventDefault();
  const file = imageItem.getAsFile();
  if (file) {
    setSelectedFile(file, true);
  }
}

function handleDrop(event) {
  event.preventDefault();
  dropzone.classList.remove('is-active');

  const [file] = Array.from(event.dataTransfer.files || []);
  if (file) {
    setSelectedFile(file, true);
  }
}

function handleDragOver(event) {
  event.preventDefault();
  dropzone.classList.add('is-active');
}

function handleDragLeave(event) {
  if (!dropzone.contains(event.relatedTarget)) {
    dropzone.classList.remove('is-active');
  }
}

function handleKeyboardOpen(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    fileInput.click();
  }
}

fileInput.addEventListener('change', () => {
  const [file] = Array.from(fileInput.files || []);
  if (file) {
    setSelectedFile(file, false);
  }
});

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', handleKeyboardOpen);
dropzone.addEventListener('dragenter', handleDragOver);
dropzone.addEventListener('dragover', handleDragOver);
dropzone.addEventListener('dragleave', handleDragLeave);
dropzone.addEventListener('drop', handleDrop);
document.addEventListener('paste', handlePaste);

classifyBtn.addEventListener('click', handleClassify);
chooseAnotherBtn.addEventListener('click', resetState);
tryAgainBtn.addEventListener('click', resetState);

resetState();
