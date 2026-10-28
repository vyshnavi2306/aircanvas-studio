
const canvas = document.getElementById("drawingCanvas");
const ctx = canvas.getContext("2d");
const canvasWrap = document.getElementById("canvasWrap");

const colorPicker = document.getElementById("colorPicker");
const colorValue = document.getElementById("colorValue");
const brushSize = document.getElementById("brushSize");
const brushValue = document.getElementById("brushValue");

const penBtn = document.getElementById("penBtn");
const eraserBtn = document.getElementById("eraserBtn");
const mouseModeBtn = document.getElementById("mouseModeBtn");
const airModeBtn = document.getElementById("airModeBtn");
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const saveBtn = document.getElementById("saveBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");

const emptyState = document.getElementById("emptyState");
const statusText = document.getElementById("statusText");
const canvasPanel = document.getElementById("canvasPanel");

let isDrawing = false;
let inputMode = "mouse";
let activeTool = "pen";
let hasDrawing = false;
let history = [];

function resizeCanvas() {
  const rect = canvasWrap.getBoundingClientRect();

  if (!rect.width || !rect.height) return;

  const previousImage = canvas.width ? canvas.toDataURL() : null;
  const pixelRatio = window.devicePixelRatio || 1;

  canvas.width = Math.round(rect.width * pixelRatio);
  canvas.height = Math.round(rect.height * pixelRatio);

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (previousImage) {
    const image = new Image();

    image.onload = () => {
      ctx.drawImage(image, 0, 0, rect.width, rect.height);
    };

    image.src = previousImage;
  }
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

function getPoint(event) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function updateEmptyState() {
  emptyState.classList.toggle("is-hidden", hasDrawing);
}

function saveHistory() {
  history.push({
    image: canvas.toDataURL(),
    hadDrawing: hasDrawing
  });

  // Keep undo history from growing endlessly.
  if (history.length > 20) {
    history.shift();
  }

  undoBtn.disabled = history.length === 0;
}

function chooseTool(tool) {
  activeTool = tool;

  penBtn.classList.toggle("active", tool === "pen");
  eraserBtn.classList.toggle("active", tool === "eraser");

  penBtn.setAttribute("aria-pressed", String(tool === "pen"));
  eraserBtn.setAttribute("aria-pressed", String(tool === "eraser"));

  canvas.style.cursor = tool === "eraser" ? "cell" : "crosshair";
  statusText.textContent =
    tool === "pen" ? "Pen selected — make something!" : "Eraser selected.";
}


function setInputMode(mode) {
  inputMode = mode;
  isDrawing = false;
  ctx.beginPath();

  const isAir = mode === "air";

  mouseModeBtn.classList.toggle("active", !isAir);
  airModeBtn.classList.toggle("active", isAir);

  mouseModeBtn.setAttribute("aria-pressed", String(!isAir));
  airModeBtn.setAttribute("aria-pressed", String(isAir));

  // Stop any unfinished air stroke when switching modes.
  airPinching = false;
  lastAirPoint = null;
  smoothedAirPoint = null;

  if (airCursor) {
    airCursor.hidden = true;
  }

  if (isAir) {
    statusText.textContent = cameraStream
      ? "Air Mode: pinch your fingers to draw."
      : "Air Mode selected. Start your camera first.";

    cameraStatus.textContent = cameraStream
      ? "Air Mode selected. Show your hand and pinch to draw."
      : "Click Start camera to enable Air Mode.";
  } else {
    statusText.textContent = "Mouse Mode: click and drag to draw.";

    cameraStatus.textContent = cameraStream
      ? "Camera is on. Switch to Air Mode to draw with your hand."
      : "Your camera is off. Start it when you're ready.";
  }
}

penBtn.addEventListener("click", () => chooseTool("pen"));
eraserBtn.addEventListener("click", () => chooseTool("eraser"));
mouseModeBtn.addEventListener("click", () => setInputMode("mouse"));
airModeBtn.addEventListener("click", () => setInputMode("air"));

colorPicker.addEventListener("input", () => {
  colorValue.textContent = colorPicker.value.toUpperCase();
});

brushSize.addEventListener("input", () => {
  brushValue.textContent = `${brushSize.value} px`;
});

canvas.addEventListener("pointerdown", (event) => {
  if (inputMode !== "mouse") return;
  if (event.button !== 0 && event.pointerType === "mouse") return;

  canvas.setPointerCapture(event.pointerId);
  saveHistory();

  isDrawing = true;

  const point = getPoint(event);

  ctx.beginPath();
  ctx.moveTo(point.x, point.y);
  ctx.lineTo(point.x + 0.1, point.y + 0.1);

  ctx.lineWidth = Number(brushSize.value);
  ctx.strokeStyle = colorPicker.value;
  ctx.globalCompositeOperation =
    activeTool === "eraser" ? "destination-out" : "source-over";

  ctx.stroke();

  if (activeTool === "pen") {
    hasDrawing = true;
  }

  updateEmptyState();
  statusText.textContent = "Creating something...";
});

canvas.addEventListener("pointermove", (event) => {
  if (inputMode !== "mouse" || !isDrawing) return;

  const point = getPoint(event);

  ctx.lineTo(point.x, point.y);
  ctx.lineWidth = Number(brushSize.value);
  ctx.strokeStyle = colorPicker.value;
  ctx.globalCompositeOperation =
    activeTool === "eraser" ? "destination-out" : "source-over";

  ctx.stroke();

  if (activeTool === "pen") {
    hasDrawing = true;
    updateEmptyState();
  }
});

function stopDrawing() {
  isDrawing = false;
  ctx.beginPath();
  statusText.textContent = "Your canvas is ready.";
}

canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);

function undoDrawing() {
  if (!history.length) return;

  const previous = history.pop();
  const image = new Image();

  image.onload = () => {
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.drawImage(
      image,
      0,
      0,
      canvas.clientWidth,
      canvas.clientHeight
    );

    hasDrawing = previous.hadDrawing;
    updateEmptyState();
  };

  image.src = previous.image;
  undoBtn.disabled = history.length === 0;
  statusText.textContent = "Last action undone.";
}

undoBtn.addEventListener("click", undoDrawing);

clearBtn.addEventListener("click", () => {
  if (!hasDrawing) return;

  saveHistory();
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  hasDrawing = false;
  updateEmptyState();

  statusText.textContent = "Canvas cleared. Start again!";
});

saveBtn.addEventListener("click", () => {
  // Put the transparent drawing onto a white background for export.
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;

  const exportCtx = exportCanvas.getContext("2d");
  exportCtx.fillStyle = "#ffffff";
  exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  exportCtx.drawImage(canvas, 0, 0);

  exportCanvas.toBlob((blob) => {
    if (!blob) {
      statusText.textContent = "Couldn't save the image. Try again.";
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "my-aircanvas.png";
    link.click();

    URL.revokeObjectURL(url);
    statusText.textContent = "Your PNG has been saved!";
  }, "image/png");
});

fullscreenBtn.addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) {
      await canvasPanel.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch {
    statusText.textContent = "Fullscreen isn't available in this browser.";
  }
});

document.addEventListener("fullscreenchange", () => {
  fullscreenBtn.textContent = document.fullscreenElement
    ? "⛶ Exit fullscreen"
    : "⛶ Fullscreen";

  resizeCanvas();
});

document.addEventListener("keydown", (event) => {
  const isTyping = ["INPUT", "TEXTAREA"].includes(
    document.activeElement.tagName
  );

  if (event.ctrlKey && event.key.toLowerCase() === "z" && !isTyping) {
    event.preventDefault();
    undoDrawing();
  }
});


const webcam = document.getElementById("webcam");
const cameraPreview = document.getElementById("cameraPreview");
const cameraPlaceholder = document.getElementById("cameraPlaceholder");

const cameraStatus = document.getElementById("cameraStatus");

const cameraBadge = document.getElementById("cameraBadge");
const cameraBadgeText = document.getElementById("cameraBadgeText");

function setCameraBadge(state, label) {
  cameraBadge.classList.remove(
    "camera-off",
    "camera-live",
    "camera-detected",
    "camera-error"
  );

  cameraBadge.classList.add(`camera-${state}`);
  cameraBadgeText.textContent = label;
}

const startCameraBtn = document.getElementById("startCameraBtn");
const stopCameraBtn = document.getElementById("stopCameraBtn");

let cameraStream = null;

async function startCamera() {
  try {
    cameraStatus.textContent = "Requesting camera permission...";

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera access is unavailable. Try Chrome on localhost.");
    }

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user"
      },
      audio: false
    });

    webcam.srcObject = cameraStream;
    await webcam.play();

    cameraPreview.classList.add("camera-on");
    cameraPlaceholder.hidden = true;

    startCameraBtn.disabled = true;
    stopCameraBtn.disabled = false;

    cameraStatus.textContent =
      "Camera connected! Next up: hand tracking.";
    setCameraBadge("live", "Camera live");
    startHandTracking();
  } catch (error) {
    console.error("Camera error:", error);

    cameraStatus.textContent =
      error.name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access in Chrome."
        : "Camera couldn't start. Check browser permissions and try again.";
  }
}

function stopCamera() {
  stopHandTracking();
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  webcam.srcObject = null;
  cameraPreview.classList.remove("camera-on");
  cameraPlaceholder.hidden = false;

  startCameraBtn.disabled = false;
  stopCameraBtn.disabled = true;

  cameraStatus.textContent = "Your camera is off.";
  setCameraBadge("off", "Camera off");
}

startCameraBtn.addEventListener("click", startCamera);
stopCameraBtn.addEventListener("click", stopCamera);

window.addEventListener("beforeunload", stopCamera);


/* =========================================
   AIRCANVAS: MEDIAPIPE HAND TRACKING
   Pinch thumb + index finger to draw.
========================================= */

let handTracker = null;
let trackingLoopActive = false;
let smoothedAirPoint = null;
let lastAirPoint = null;
let airPinching = false;
let lastHandStatus = "";
let gestureStartTime = null;
let gestureTriggered = false;
let activeGesture = null;

const airCursor = document.getElementById("airCursor");

function updateHandStatus(message) {
  if (message !== lastHandStatus) {
    cameraStatus.textContent = message;
    lastHandStatus = message;
  }
}

async function startHandTracking() {
  if (!cameraStream || trackingLoopActive) return;

  try {
    if (typeof Hands === "undefined") {
      throw new Error(
        "MediaPipe did not load. Check your internet and refresh."
      );
    }

    if (!handTracker) {
      handTracker = new Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      handTracker.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6
      });

      handTracker.onResults(handleHandResults);
    }

    trackingLoopActive = true;
    updateHandStatus("Loading hand tracking... Show one hand to the camera.");
    processHandFrames();

  } catch (error) {
    console.error("Hand tracking setup error:", error);

    updateHandStatus(
      "Hand tracking couldn't start. Check your internet and refresh."
    );
  }
}

async function processHandFrames() {
  while (trackingLoopActive && cameraStream) {
    try {
      if (webcam.readyState >= 2) {
        await handTracker.send({ image: webcam });
      }
    } catch (error) {
      console.error("Hand tracking error:", error);
      trackingLoopActive = false;

      updateHandStatus(
        "Hand tracking stopped. Please refresh and try again."
      );

      return;
    }

    await new Promise(resolve => requestAnimationFrame(resolve));
  }
}


function isPeaceGesture(landmarks) {
  const indexUp = landmarks[8].y < landmarks[6].y - 0.02;
  const middleUp = landmarks[12].y < landmarks[10].y - 0.02;
  const ringCurled = landmarks[16].y > landmarks[14].y;
  const pinkyCurled = landmarks[20].y > landmarks[18].y;

  return indexUp && middleUp && ringCurled && pinkyCurled;
}


function handleHandResults(results) {
  if (!cameraStream) return;

  const detectedHands = results.multiHandLandmarks;
  const hasHand = detectedHands && detectedHands.length > 0;

  // Update the camera status badge.
  if (typeof setCameraBadge === "function") {
    setCameraBadge(
      hasHand ? "detected" : "live",
      hasHand ? "Hand detected" : "Camera live"
    );
  }

  // If no hand is visible, reset the tracking state.
  if (!hasHand) {
    airCursor.hidden = true;
    airPinching = false;
    lastAirPoint = null;
    smoothedAirPoint = null;
    activeGesture = null;
    gestureStartTime = null;
    gestureTriggered = false;

    updateHandStatus(
      inputMode === "air"
        ? "No hand detected. Show your hand to the camera."
        : "Camera is on. Switch to Air Mode when ready."
    );

    return;
  }

  const landmarks = detectedHands[0];

  // Mouse Mode does not draw with hand movements.
  if (inputMode !== "air") {
    airCursor.hidden = true;
    airPinching = false;
    lastAirPoint = null;
    smoothedAirPoint = null;
    activeGesture = null;
    gestureStartTime = null;
    gestureTriggered = false;

    updateHandStatus(
      "Hand detected! Switch to Air Mode to draw with your hand."
    );

    return;
  }

  // Landmark 8 is the index fingertip.
  // Landmark 4 is the thumb tip.
  const indexTip = landmarks[8];
  const thumbTip = landmarks[4];

  // Detect the pinch gesture used for drawing.
  const pinchDistance = Math.hypot(
    indexTip.x - thumbTip.x,
    indexTip.y - thumbTip.y
  );

  const pinching = pinchDistance < 0.055;

  // Only the peace sign triggers a tool switch.
  // Open palm simply counts as a detected hand.
  const peaceSign =
    isPeaceGesture(landmarks) && !pinching;

  if (peaceSign) {
    if (activeGesture !== "peace") {
      activeGesture = "peace";
      gestureStartTime = performance.now();
      gestureTriggered = false;
    }

    const heldTime =
      performance.now() - gestureStartTime;

    if (heldTime >= 1000 && !gestureTriggered) {
      // End the current stroke before switching tools.
      airPinching = false;
      lastAirPoint = null;

      const nextTool =
        activeTool === "pen" ? "eraser" : "pen";

      chooseTool(nextTool);

      statusText.textContent =
        `Switched to ${nextTool === "pen" ? "Pen" : "Eraser"}!`;

      gestureTriggered = true;
    }

    updateHandStatus(
      gestureTriggered
        ? "Tool switched! Relax your hand to switch again."
        : "Hold the peace sign for one second to switch tools."
    );
  } else {
    // Return to a neutral hand pose before switching again.
    activeGesture = null;
    gestureStartTime = null;
    gestureTriggered = false;
  }

  // Convert fingertip position to canvas coordinates.
  const rect = canvas.getBoundingClientRect();

  const rawPoint = {
    x: (1 - indexTip.x) * rect.width,
    y: indexTip.y * rect.height
  };

  // Smooth small movements to reduce cursor jitter.
  if (!smoothedAirPoint) {
    smoothedAirPoint = rawPoint;
  } else {
    smoothedAirPoint = {
      x: smoothedAirPoint.x * 0.4 + rawPoint.x * 0.6,
      y: smoothedAirPoint.y * 0.4 + rawPoint.y * 0.6
    };
  }

  const point = smoothedAirPoint;

  // Update the on-screen fingertip cursor.
  airCursor.hidden = false;
  airCursor.style.left = `${point.x}px`;
  airCursor.style.top = `${point.y}px`;
  airCursor.classList.toggle("is-drawing", pinching);

  // Save the current canvas before a new stroke begins.
  if (pinching && !airPinching) {
    saveHistory();
    lastAirPoint = { ...point };
  }

  // Draw or erase while the fingers remain pinched.
  if (pinching && airPinching && lastAirPoint) {
    ctx.beginPath();
    ctx.moveTo(lastAirPoint.x, lastAirPoint.y);
    ctx.lineTo(point.x, point.y);

    ctx.lineWidth = Number(brushSize.value);
    ctx.strokeStyle = colorPicker.value;

    ctx.globalCompositeOperation =
      activeTool === "eraser"
        ? "destination-out"
        : "source-over";

    ctx.stroke();

    if (activeTool === "pen") {
      hasDrawing = true;
      updateEmptyState();
    }

    statusText.textContent =
      activeTool === "eraser"
        ? "Air erasing..."
        : "Air drawing...";
  }

  if (pinching) {
    lastAirPoint = { ...point };

    updateHandStatus(
      "Pinching! Move your hand to draw."
    );
  } else {
    lastAirPoint = null;

    // Don't overwrite the peace-sign instructions.
    // An open palm needs no special action.
    if (!peaceSign) {
      updateHandStatus(
        "Hand detected! Pinch to draw or show a peace sign to switch tools."
      );
    }
  }

  airPinching = pinching;
}

function stopHandTracking() {
  trackingLoopActive = false;
  airPinching = false;
  lastAirPoint = null;
  smoothedAirPoint = null;

  if (airCursor) {
    airCursor.hidden = true;
    airCursor.classList.remove("is-drawing");
  }
}