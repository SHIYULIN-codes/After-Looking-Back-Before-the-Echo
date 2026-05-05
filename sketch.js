// Reflection / Rumination
// Camera-based single-modal interaction
// Input: head position, head rotation, body distance, and eye-closed state
// Head movement is the main control; iris position only adds a small correction
// Press C to reset the current front-facing head position

let cnv;
let video;
let faceNet = null;
let faces = [];

const camW = 640;
const camH = 480;

// Camera and model state
// The camera image is not displayed directly; only recognition data is used.
// The viewer sees traces of attention rather than their own face.
let camOn = false;
let detecting = false;
let camMsg = "Waiting to load";

// Distance thresholds
// Dual enter / exit thresholds reduce jitter at mode boundaries,
// making approaching and moving away feel like state changes rather than sudden jumps.
const farIn = 0.17;
const farOut = 0.205;
const closeIn = 0.28;
const closeOut = 0.235;

// Fragment count and lifespan
// Fragments do not disappear immediately.
// Their lifespan and fade time show changes in memory weight.
const maxFrags = 18;
const fragLife = 11500;
const fragFade = 6500;
const openFragLife = 32000;
const openFragFade = 9000;
const blockLife = 7600;
const blockRad = 88;

// Close-mode parameters
const keyRad = 135;
const keySize = 24;
const splitGap = 950;
const closeGrace = 900;

let lastCloseMs = 0;

// Head-control parameters
// Head displacement and head rotation provide the main control.
// Iris movement is only a light adjustment to avoid unstable eye tracking dominating the interaction.
const headXSign = 1;
const headYSign = 1;

const posXGain = 0.95;
const posYGain = 0.9;
const turnXGain = 2.6;
const turnYGain = 7.2;
const irisXGain = 0.08;
const irisYGain = 0.06;

// Small-movement filtering
const posDeadX = 0.012;
const posDeadY = 0.012;
const turnDeadX = 0.018;
const turnDeadY = 0.008;

const microDead = 7;
const microSoft = 22;

const calTime = 900;

// Eye-closed detection parameters
// Eye-closed detection includes a pitch limit to reduce false triggers caused by glasses,
// looking upward, or looking downward.
const eyeCloseIn = 0.28;
const eyeCloseOut = 0.34;
const eyeHold = 300;
const pitchBlock = 0.085;
const eyeClear = 0.24;

// Interaction timing
// Different dwell times correspond to different mental actions:
// scanning, looking, following, looping, and pausing.
const spawnGap = 1350;
const fragNeed = 2000;
const keyNeed = 6000;
const optNeed = 850;
const loopNeed = 10000;
const pauseNeed = 1800;

const zoneNeed = 3000;
const zoneSpeed = 1.65;

const calmNeed = 1600;
const calmGap = 12000;

// Distance-pause state
let calmMs = 0;
let calmVis = 0;
let calmDone = false;
let calmEndMs = 0;

let calmCardA = 0;
let zoneA = 0;

let calmPhase = 0;
let calmDriftX = 24;
let calmDriftY = 16;

// Eye state
let eyeLowMs = 0;
let eyeSmooth = 1;
let leftEyeSmooth = 1;
let rightEyeSmooth = 1;

// Current mode and flow
let mode = "none";
let lastMode = "none";
let flow = "collect";

let echoText = "";
let noteText = "Keep a normal distance. Let your gaze move slowly across the page.";

// Memory fragments
let frags = [];
let focusFrag = null;
let core = "";

// Close-mode keyword
let key = {
  text: "",
  x: 0,
  y: 0,
  vx: 0.72,
  vy: 0.48,
  followMs: 0,
  lastSplitMs: 0
};

let splits = [];
let vers = [];

// Rumination option counts
let optCounts = {
  again: 0,
  angle: 0,
  stop: 0
};

let activeOpt = "";
let lastOpt = "";
let optStartMs = 0;
let loopStartMs = 0;
let loopReady = false;

// Pause flow
let pauseMs = 0;
let pauseDone = false;

// Distance zones
let zones = [];
let zonesDoneAt = 0;

// Records, ghosts, and gaze traces
// The record layer preserves process traces.
// Mode switching does not erase memory; it changes visibility and weight.
let records = [];
let ghosts = [];
let traces = [];

const traceGap = 20;
const traceSizeMin = 7.8;
const traceSizeMax = 9.8;
const traceMax = 300;

// Attention cursor
let gaze = {
  x: 0,
  y: 0,
  tx: 0,
  ty: 0
};

// Cursor filter
let gazeGate = {
  ready: false,
  tx: 0,
  ty: 0
};

// Camera detection result
let cam = {
  hasFace: false,
  distance: "not_detected",
  faceW: 0,
  eyesClosed: false,
  eyeRatio: 1,
  leftEyeRatio: 1,
  rightEyeRatio: 1,
  eyeBlocked: false,
  turnX: 0,
  turnY: 0
};

// Front-facing calibration baseline
let head0 = {
  ready: false,
  calibrating: false,
  startMs: 0,
  samples: [],
  posX: 0,
  posY: 0,
  turnX: 0,
  turnY: 0
};

let loopHeat = 0;
let lastTraceMs = 0;
let lastFragMs = 0;

let loopHintA = 0;

// Memory receding animation
let receding = false;
let memClosed = false;
let recedeP = 0;
let recedeStart = 0;

// Archived memory cycles
let archive = [];
let cycle = 1;

// Page layout
let ui = {
  margin: 18,

  topX: 42,
  topY: 38,
  topW: 390,
  topH: 118,

  mainX: 18,
  mainY: 18,
  mainW: 1000,
  mainH: 680,

  modeX: 42,
  modeY: 0,
  modeW: 1000,
  modeH: 46
};

// Handwritten-style font stacks
// These use local handwritten fonts first.
// If Patrick Hand, Kalam, or Caveat are loaded in HTML, they will be used automatically.
const memoryFont = "Patrick Hand, Kalam, Segoe Print, Bradley Hand ITC, Comic Sans MS, cursive";
const systemFont = "Kalam, Patrick Hand, Ink Free, Segoe Print, Comic Sans MS, cursive";
const distanceFont = "Caveat, Patrick Hand, Bradley Hand ITC, Segoe Print, Comic Sans MS, cursive";
const thoughtFont = "Caveat, Patrick Hand, Segoe Print, Comic Sans MS, cursive";

// Mode names
const modeNames = {
  ordinary: "Normal Distance",
  close: "Close Distance",
  far: "Far Distance",
  none: "No Face Detected"
};

// Flow names
const flowNames = {
  collect: "Gaze Leaves Fragments",
  expand: "Look and Arrange",
  follow: "Follow the Enlarged Keyword",
  ruminate: "Rumination Loop",
  pause: "Close Eyes to Pause",
  calm: "Distance Pause",
  redistribute: "Redistribute Memory",
  recede: "Memory Recedes",
  closed: "New Attention Cycle"
};

// Initial fragment texts
const fragPool = [
  "a detail still glowing in an old work",
  "a sentence at the edge of a note",
  "an idea that could still continue",
  "an unfinished sketch with a direction",
  "a trace of revision left at the time",
  "a keyword circled on the page",
  "a composition that worked by accident",
  "a version number in an old folder",
  "a judgement understood only later",
  "a sentence in the project statement that could be adjusted",
  "an unselected image with quiet potential",
  "a part that felt almost there",
  "an old version compared too many times",
  "a concept not yet clearly explained",
  "an unfinished annotation",
  "a place in the work that tried too hard",
  "an experiment worth keeping",
  "a question repeated in the notes",
  "an uncertain but interesting title",
  "a place where the old note suddenly stopped",
  "a sentence I once circled",
  "a part in the draft that explained too much",
  "a slight shift of rhythm in the old work",
  "a structure that still felt uncertain",
  "a choice that became clearer later",
  "a possibility I did not unfold at the time",
  "a paragraph that could be reorganised",
  "a useful attempt beside a small mistake",
  "an intuition preserved in the old work",
  "a piece of material not yet named"
];

// Repetition prevention
let recentEventTypes = [];
let recentEventLines = [];
let recentRecords = [];

// Load FaceMesh
function preload() {
  if (typeof ml5 !== "undefined" && ml5.faceMesh) {
    faceNet = ml5.faceMesh({
      maxFaces: 1,
      flipped: true
    });

    camMsg = "Model loaded";
  } else {
    camMsg = "ml5 not loaded";
  }
}

// Initialise canvas and camera
function setup() {
  cnv = createCanvas(windowWidth, windowHeight);
  textFont(memoryFont);

  gaze.x = width / 2;
  gaze.y = height / 2;
  gaze.tx = width / 2;
  gaze.ty = height / 2;

  gazeGate.ready = true;
  gazeGate.tx = width / 2;
  gazeGate.ty = height / 2;

  resetZones();
  calmPhase = random(TWO_PI);
  updateLayout();

  video = createCapture(VIDEO, function () {
    camOn = true;
    camMsg = "Camera started";
    startFaceSoon();
  });

  video.size(camW, camH);
  video.hide();

  if (video && video.elt) {
    video.elt.onloadeddata = function () {
      camOn = true;
      startFaceSoon();
    };
  }
}

// Main loop
function draw() {
  updateCam();
  updateMode();
  updateGaze();
  updateLayout();

  if (receding) {
    updateRecedeAnim();
    drawRecedeScene();
    drawRecords();
    drawModeBar();
    return;
  }

  updateFlow();

  drawBg();
  drawPage();
  drawArchive();
  drawTrace();
  drawFlow();
  drawEchoLayer();
  drawRecords();
  drawModeBar();
  drawGazeDot();
}

// Recalculate layout after window resize
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateLayout();
}

// Manually recalibrate front-facing head position
function keyPressed() {
  if (key === "c" || key === "C") {
    startHeadCal();
  }
}

// Receive detection results
function gotFaces(results) {
  faces = results || [];
}

// Start detection after a short delay
function startFaceSoon() {
  setTimeout(startFace, 650);
}

// Start FaceMesh detection
function startFace() {
  if (detecting) return;

  if (!faceNet || !faceNet.detectStart) {
    camMsg = "FaceMesh unavailable";
    noteText = "FaceMesh did not start successfully.";
    return;
  }

  if (!video || !camOn) {
    camMsg = "Waiting for camera";
    setTimeout(startFace, 500);
    return;
  }

  try {
    faceNet.detectStart(video, gotFaces);
    detecting = true;
    camMsg = "Detecting";
    noteText = "Keep a normal distance. Let your gaze move slowly across the page.";
  } catch (err) {
    camMsg = "Detection failed to start";
    noteText = "FaceMesh detection failed to start. Please check ml5, camera permission, and browser settings.";
    console.error(err);
  }
}

// Update camera input
function updateCam() {
  if (!faces || faces.length === 0) {
    keepCloseLoss();
    return;
  }

  let kps = getKps(faces[0]);

  if (!kps || kps.length < 468) {
    keepCloseLoss();
    return;
  }

  let box = getFaceBox(kps);
  let faceW = box.w / camW;

  cam.hasFace = true;
  cam.faceW = faceW;
  cam.distance = readDistance(faceW);

  let faceCenter = {
    x: box.x + box.w / 2,
    y: box.y + box.h / 2
  };

  let eyeMid = avgPts(kps, [33, 133, 362, 263]);
  let leftEyeMid = avgPts(kps, [33, 133]);
  let rightEyeMid = avgPts(kps, [362, 263]);
  let nose = kps[1] || eyeMid;

  let eyeSpan = max(1, ptDist(kps[33], kps[263]));

  let rawPosX = faceCenter.x / camW - 0.5;
  let rawPosY = faceCenter.y / camH - 0.5;

  let rawTurnX = (nose.x - eyeMid.x) / eyeSpan;
  let rawTurnY = (nose.y - eyeMid.y) / max(1, box.h);

  cam.turnX = rawTurnX;
  cam.turnY = rawTurnY;

  if (!head0.ready && !head0.calibrating) {
    startHeadCal();
  }

  updateHeadCal(rawPosX, rawPosY, rawTurnX, rawTurnY);

  let iris = getIris(kps, leftEyeMid, rightEyeMid);

  let dxPos = deadZone(rawPosX - head0.posX, posDeadX) * posXGain;
  let dyPos = deadZone(rawPosY - head0.posY, posDeadY) * posYGain;

  let dxTurn = deadZone(rawTurnX - head0.turnX, turnDeadX) * turnXGain;
  let dyTurn = deadZone(rawTurnY - head0.turnY, turnDeadY) * turnYGain;

  let nx = 0.5 + headXSign * (dxPos + dxTurn) + iris.x * irisXGain;
  let ny = 0.5 + headYSign * (dyPos + dyTurn) + iris.y * irisYGain;

  if (head0.calibrating) {
    nx = 0.5;
    ny = 0.5;
  }

  let targetX = nx * width;
  let targetY = ny * height;

  setGaze(targetX, targetY, false);
  updateEyes(kps, rawTurnY);
}

// Update eye-closed state
function updateEyes(kps, rawTurnY) {
  let leftEye = eyeOpen(kps, [33, 160, 158, 133, 153, 144]);
  let rightEye = eyeOpen(kps, [362, 385, 387, 263, 373, 380]);

  leftEyeSmooth = lerp(leftEyeSmooth, leftEye, 0.26);
  rightEyeSmooth = lerp(rightEyeSmooth, rightEye, 0.26);

  eyeSmooth = (leftEyeSmooth + rightEyeSmooth) / 2;

  cam.eyeRatio = eyeSmooth;
  cam.leftEyeRatio = leftEyeSmooth;
  cam.rightEyeRatio = rightEyeSmooth;

  let pitchDelta = rawTurnY - head0.turnY;

  let blocked =
    abs(pitchDelta) > pitchBlock ||
    head0.calibrating;

  cam.eyeBlocked = blocked;

  let clearlyClosed =
    eyeSmooth < eyeClear &&
    leftEyeSmooth < eyeCloseOut &&
    rightEyeSmooth < eyeCloseOut;

  let probablyClosed =
    eyeSmooth < eyeCloseIn &&
    leftEyeSmooth < eyeCloseOut &&
    rightEyeSmooth < eyeCloseOut;

  let closedCandidate =
    clearlyClosed ||
    (!blocked && probablyClosed);

  let eitherEyeOpen =
    leftEyeSmooth > eyeCloseOut ||
    rightEyeSmooth > eyeCloseOut;

  let stepMs = min(deltaTime || 16, 60);

  if (cam.eyesClosed) {
    if (eitherEyeOpen) {
      eyeLowMs = 0;
      cam.eyesClosed = false;
    }

    return;
  }

  if (closedCandidate) {
    eyeLowMs += stepMs;
  } else {
    eyeLowMs = max(0, eyeLowMs - stepMs * 1.6);
  }

  if (eyeLowMs >= eyeHold) {
    cam.eyesClosed = true;
  }
}

// Briefly preserve close mode to reduce face-loss jumps
function keepCloseLoss() {
  if (lastMode === "close" && millis() - lastCloseMs < closeGrace) {
    cam.hasFace = true;
    cam.distance = "close";
    cam.eyesClosed = false;
    cam.eyeRatio = 1;
    cam.leftEyeRatio = 1;
    cam.rightEyeRatio = 1;
    cam.eyeBlocked = false;
    return;
  }

  cam.hasFace = false;
  cam.distance = "not_detected";
  cam.eyesClosed = false;
  cam.eyeRatio = 1;
  cam.leftEyeRatio = 1;
  cam.rightEyeRatio = 1;
  cam.eyeBlocked = false;

  eyeLowMs = 0;
  eyeSmooth = 1;
  leftEyeSmooth = 1;
  rightEyeSmooth = 1;
}

// Start head calibration
function startHeadCal() {
  head0.ready = false;
  head0.calibrating = true;
  head0.startMs = millis();
  head0.samples = [];

  gaze.tx = width / 2;
  gaze.ty = height / 2;

  gazeGate.ready = true;
  gazeGate.tx = width / 2;
  gazeGate.ty = height / 2;

  eyeLowMs = 0;
  cam.eyesClosed = false;

  noteText = "Keep your face forward and sit naturally. The system is calibrating the head centre.";
}

// Record front-facing baseline values
function updateHeadCal(posX, posY, turnX, turnY) {
  if (!head0.calibrating) return;

  head0.samples.push({
    posX: posX,
    posY: posY,
    turnX: turnX,
    turnY: turnY
  });

  if (millis() - head0.startMs < calTime) return;

  head0.posX = avgSample(head0.samples, "posX");
  head0.posY = avgSample(head0.samples, "posY");
  head0.turnX = avgSample(head0.samples, "turnX");
  head0.turnY = avgSample(head0.samples, "turnY");

  head0.ready = true;
  head0.calibrating = false;
  head0.samples = [];

  noteText = "Calibration complete. You can now guide attention on the page with your head direction.";
}

// Average calibration samples
function avgSample(list, name) {
  if (!list || list.length === 0) return 0;

  let sum = 0;

  for (let item of list) {
    sum += item[name];
  }

  return sum / list.length;
}

// Basic dead-zone filter
function deadZone(value, zone) {
  if (abs(value) < zone) return 0;

  if (value > 0) return value - zone;
  return value + zone;
}

// Set target cursor position and suppress tiny jitter
function setGaze(x, y, instant) {
  let limited = clampGaze(x, y);

  x = limited.x;
  y = limited.y;

  if (instant || !gazeGate.ready) {
    gazeGate.ready = true;
    gazeGate.tx = x;
    gazeGate.ty = y;
    gaze.tx = x;
    gaze.ty = y;
    return;
  }

  let dx = x - gazeGate.tx;
  let dy = y - gazeGate.ty;
  let d = sqrt(dx * dx + dy * dy);

  if (d < microDead) {
    gaze.tx = gazeGate.tx;
    gaze.ty = gazeGate.ty;
    return;
  }

  let soft = constrain(
    (d - microDead) / (microSoft - microDead),
    0.22,
    1
  );

  gazeGate.tx = lerp(gazeGate.tx, x, soft);
  gazeGate.ty = lerp(gazeGate.ty, y, soft);

  gaze.tx = gazeGate.tx;
  gaze.ty = gazeGate.ty;
}

// Read distance mode from face width
function readDistance(faceW) {
  let current = cam.distance;

  if (current === "close") {
    if (faceW < closeOut) return "ordinary";
    return "close";
  }

  if (current === "far") {
    if (faceW > farOut) return "ordinary";
    return "far";
  }

  if (faceW > closeIn) return "close";
  if (faceW < farIn) return "far";

  return "ordinary";
}

// Update current mode
function updateMode() {
  if (!cam.hasFace) {
    mode = "none";
    return;
  }

  if (cam.distance === "close") {
    mode = "close";
    lastCloseMs = millis();
  } else if (cam.distance === "far") {
    mode = "far";
  } else {
    mode = "ordinary";
  }

  lastMode = mode;
}

// Smooth cursor and generate gaze traces
function updateGaze() {
  let smooth = mode === "close" ? 0.2 : 0.16;

  if (head0.calibrating) {
    smooth = 0.08;
  }

  if (!isFinite(gaze.tx) || !isFinite(gaze.ty)) {
    gaze.tx = width / 2;
    gaze.ty = height / 2;
  }

  if (!isFinite(gaze.x) || !isFinite(gaze.y)) {
    gaze.x = width / 2;
    gaze.y = height / 2;
  }

  let d = dist(gaze.x, gaze.y, gaze.tx, gaze.ty);

  if (d < 14) {
    smooth *= 0.55;
  }

  gaze.x = lerp(gaze.x, gaze.tx, smooth);
  gaze.y = lerp(gaze.y, gaze.ty, smooth);

  let limited = clampGaze(gaze.x, gaze.y);

  gaze.x = limited.x;
  gaze.y = limited.y;

  if (!isFinite(gaze.x) || !isFinite(gaze.y)) {
    let b = gazeBox();

    gaze.x = b.x + b.w / 2;
    gaze.y = b.y + b.h / 2;
  }

  if (!cam.hasFace) return;

  if (millis() - lastTraceMs > 50) {
    traces.push({
      x: gaze.x + random(-1.8, 1.8),
      y: gaze.y + random(-1.4, 1.4),
      born: millis(),
      mode: mode,
      flow: flow,
      word: makeTraceWord(mode, flow),
      wordSize: random(traceSizeMin, traceSizeMax),
      rotOffset: random(-0.16, 0.16),
      sideOffset: random(-2.4, 2.4)
    });

    lastTraceMs = millis();
  }

  if (traces.length > traceMax) {
    traces.shift();
  }
}

// Dispatch interaction logic by current flow
function updateFlow() {
  if (!cam.hasFace) {
    noteText = "Please face the camera.";
    updateFarUi();
    updateLoopHint();
    return;
  }

  if (head0.calibrating) {
    noteText = "Calibrating the head centre. Please keep your face forward and stay still.";
    updateFarUi();
    updateLoopHint();
    return;
  }

  if (flow === "collect") updateCollect();
  else if (flow === "expand") updateExpand();
  else if (flow === "follow") updateFollow();
  else if (flow === "ruminate") updateLoop();
  else if (flow === "pause") updatePause();
  else if (flow === "calm") updateCalm();
  else if (flow === "redistribute") updateRedistribute();
  else if (flow === "recede") updateRecede();

  updateFarUi();
  updateLoopHint();
}

// Rumination hint opacity
function updateLoopHint() {
  let target =
    flow === "ruminate" && !loopReady
      ? 1
      : 0;

  let speed = target === 1 ? 0.08 : 0.035;

  loopHintA = lerp(loopHintA, target, speed);

  if (loopHintA < 0.01) {
    loopHintA = 0;
  }
}

// Distance interface fade in / fade out
function updateFarUi() {
  let step = deltaTime || 16;

  let zoneTarget =
    mode === "far" &&
    flow === "redistribute" &&
    !cam.eyesClosed
      ? 1
      : 0;

  let calmCardTarget =
    mode === "far" &&
    (flow === "calm" || flow === "redistribute") &&
    !calmDone
      ? 1
      : 0;

  let zoneFadeSpeed = zoneTarget === 1
    ? constrain(step * 0.0022, 0.035, 0.12)
    : constrain(step * 0.00032, 0.0045, 0.014);

  let calmFadeSpeed = calmCardTarget === 1
    ? constrain(step * 0.004, 0.06, 0.18)
    : constrain(step * 0.00045, 0.0065, 0.018);

  zoneA = lerp(zoneA, zoneTarget, zoneFadeSpeed);
  calmCardA = lerp(calmCardA, calmCardTarget, calmFadeSpeed);

  if (zoneA < 0.006 && zoneTarget === 0 && flow !== "redistribute") {
    for (let z of zones) {
      if (!z.done) {
        z.hoverStartMs = 0;
        z.progress = 0;
      }
    }
  }
}

// Normal distance: collect fragments
function updateCollect() {
  updateFragLife();

  if (mode === "close" && frags.length > 0) {
    enterFollow();
    return;
  }

  if (mode === "far") {
    if (cam.eyesClosed) {
      enterCalm();
      return;
    }

    enterRedistribute();
    return;
  }

  if (mode !== "ordinary") {
    noteText = "Return to a normal distance. The fragments will continue to surface.";
    return;
  }

  if (archive.length > 0) {
    noteText = "Present: the previous memory has receded into the background. New fragments can still appear and be arranged as events.";
  } else {
    noteText = "Present: let attention slowly move across old works or old notes. Leave the material here first, including what still holds value.";
  }

  if (frags.length > 0) {
    updateFragDwell();
  }

  trySpawnFrag();

  if (frags.length >= 4) {
    flow = "expand";
    echoText = "";
  }
}

// Normal distance: arrange fragments
function updateExpand() {
  updateFragLife();

  if (mode === "close" && frags.length > 0) {
    enterFollow();
    return;
  }

  if (mode === "far") {
    if (cam.eyesClosed) {
      enterCalm();
      return;
    }

    enterRedistribute();
    return;
  }

  if (mode !== "ordinary") {
    noteText = "Keep a normal distance first. When you move closer, the nearest fragment will become a keyword.";
    return;
  }

  updateFragDwell();
  trySpawnFrag();

  if (focusFrag && frags.length < maxFrags) {
    noteText = "Present: the fragment has been arranged into an event outline. It describes a creative process, not a judgement of the self.";
  } else if (frags.length >= maxFrags) {
    noteText = "Present: old fragments will fade gradually. When blank space appears, attention can leave new material again.";
  } else {
    noteText = "Present: scan the blank areas to generate fragments, or look at one fragment to arrange it into an event outline.";
  }
}

// Close distance: follow keyword
function updateFollow() {
  if (mode === "ordinary") {
    flow = "expand";
    key.followMs = max(0, key.followMs - deltaTime * 1.4);
    echoText = "";
    noteText = "Present: return to the event itself. Continue arranging fragments instead of asking where the self was not enough.";
    return;
  }

  if (mode === "far") {
    if (cam.eyesClosed) {
      enterCalm();
      return;
    }

    enterRedistribute();
    return;
  }

  moveKey();

  let d = dist(gaze.x, gaze.y, key.x, key.y);

  if (d < keyRad) {
    key.followMs += deltaTime;

    if (millis() - key.lastSplitMs > splitGap) {
      let thought = makeSplitText(key.text);

      splits.push({
        text: thought,
        ox: random(-110, 110),
        oy: random(-78, 78),
        born: millis(),
        phase: random(TWO_PI)
      });

      key.lastSplitMs = millis();
    }

    echoText = "";
    noteText = "Caught: this word still looks like a reasonable question, but it is becoming heavier and pulling attention toward excessive cause-seeking.";
  } else {
    key.followMs = max(0, key.followMs - deltaTime * 1.2);
    echoText = "";
    noteText = "The keyword has appeared. Follow it again and the text will continue to split.";
  }

  if (key.followMs >= keyNeed) {
    enterLoop();
  }
}

// Close distance: rumination loop
function updateLoop() {
  updateLoopHeat();

  if (mode === "far" && loopReady) {
    enterPause();
    return;
  }

  if (mode !== "close") {
    if (loopReady) {
      noteText = "";
    } else {
      noteText = "The echo has not loosened yet. Return to close distance and let the loop complete.";
    }

    return;
  }

  let opt = readOption();

  if (opt === "") {
    activeOpt = "";
    optStartMs = 0;
  } else {
    if (opt !== activeOpt) {
      activeOpt = opt;
      optStartMs = millis();
    }

    let dwell = millis() - optStartMs;

    if (dwell > optNeed) {
      optCounts[opt]++;
      optStartMs = millis();

      if (lastOpt !== "" && lastOpt !== opt) {
        loopHeat = min(1, loopHeat + 0.1);
      } else {
        loopHeat = min(1, loopHeat + 0.055);
      }

      lastOpt = opt;
      addVer(opt);
    }
  }

  let enoughTime = millis() - loopStartMs >= loopNeed;

  let enoughCounts =
    optCounts.again >= 3 &&
    optCounts.angle >= 3 &&
    optCounts.stop >= 3;

  loopReady = enoughTime && enoughCounts;

  if (loopReady) {
    noteText = "";
  } else {
    noteText = "The echo has not loosened yet.";
  }
}

// Far distance: close eyes to pause
function updatePause() {
  if (mode !== "far") {
    pauseMs = max(0, pauseMs - deltaTime * 0.8);
    noteText = "Move farther away.";
    return;
  }

  if (cam.eyesClosed) {
    pauseMs += deltaTime;

    echoText = "";
    noteText = "Keep your eyes closed. After the pause, attention will move from self-judgement toward the mechanism behind it.";

    if (pauseMs >= pauseNeed && !pauseDone) {
      pauseDone = true;
      enterRedistribute();
    }
  } else {
    pauseMs = max(0, pauseMs - deltaTime * 1.2);

    if (cam.eyeBlocked) {
      noteText = "Move farther away and close your eyes. When the head angle is too large, the system reduces eye-closed sensitivity.";
    } else {
      noteText = "Move farther away and close your eyes. Let the excessive cause-seeking pause first.";
    }

    echoText = "";
  }
}

// Enter distance eye-closed pause
function enterCalm() {
  if (flow !== "calm") {
    calmMs = 0;
    calmDone = false;
    calmEndMs = 0;
    echoText = "";

    addRecord("Moved farther away with eyes closed. Old fragments begin to fade.");
  }

  flow = "calm";
  noteText = "Distance: stay farther away and close your eyes. Pause the questioning first, and let old thoughts lose weight.";
}

// Update distance eye-closed pause
function updateCalm() {
  if (mode !== "far") {
    calmMs = 0;
    updateCalmVis(0);

    calmDone = false;
    calmEndMs = 0;

    flow = frags.length >= 4 ? "expand" : "collect";
    noteText = "After returning to a normal distance, new attention can continue to leave fragments.";
    return;
  }

  if (!cam.eyesClosed) {
    enterRedistribute();
    return;
  }

  updateFarPause();
}

// Distance-pause countdown and repeat trigger
// This function was modified with the assistance of ChatGPT 
function updateFarPause() {
  updateFragLife();

  if (calmDone) {
    updateCalmVis(0);

    if (calmEndMs === 0) {
      calmEndMs = millis();
    }

    let waitMs = millis() - calmEndMs;
    let leftSec = max(0, ceil((calmGap - waitMs) / 1000));

    noteText =
      "Pause complete. Old noise has faded. If you stay in far mode, the eye-closed prompt will return in about " +
      leftSec +
      " seconds.";

    if (waitMs >= calmGap) {
      calmMs = 0;
      calmDone = false;
      calmEndMs = 0;

      echoText = "";
      noteText = "The eye-closed prompt has returned. You can close your eyes again to let old noise lose more weight.";

      addRecord("In far mode, the eye-closed pause prompt appears again.");
    }

    return;
  }

  if (!cam.eyesClosed) {
    calmMs = max(0, calmMs - deltaTime * 0.9);
    updateCalmVis(0.12);

    if (cam.eyeBlocked) {
      noteText = "Distance: the head angle is large. If eye closing does not trigger, return slightly to a natural angle.";
    } else {
      noteText = "Distance: closing your eyes can create a pause and let old thoughts step out of judgement.";
    }

    return;
  }

  calmMs += deltaTime;
  updateCalmVis(1);
  lightenFrags();

  let p = constrain(calmMs / calmNeed, 0, 1);

  noteText = "Eye-closed pause. Overweighted old fragments are being quieted: " + floor(p * 100) + "%";

  if (calmMs >= calmNeed) {
    calmDone = true;
    calmEndMs = millis();

    addRecord("The weight of old fragments is reduced, and blank space returns to the page.");
  }
}

// Smooth pause-layer visibility
function updateCalmVis(target) {
  let step = constrain((deltaTime || 16) * 0.0032, 0.04, 0.18);
  calmVis = lerp(calmVis, target, step);
}

// Reduce fragment weight
function lightenFrags() {
  let t = constrain((deltaTime || 16) * 0.0012, 0.012, 0.055);

  for (let frag of frags) {
    if (frag.weight === undefined) frag.weight = 1;

    let targetWeight = frag.expanded ? 0.48 : 0.28;
    frag.weight = lerp(frag.weight, targetWeight, t);
  }

  for (let s of splits) {
    if (s.weight === undefined) s.weight = 1;
    s.weight = lerp(s.weight, 0.18, t);
  }
}

// Far distance: redistribute memory
function updateRedistribute() {
  updateFragLife();

  if (mode !== "far") {
    calmMs = 0;
    updateCalmVis(0);

    calmDone = false;
    calmEndMs = 0;

    flow = frags.length >= 4 ? "expand" : "collect";
    noteText = "The redistribution zones are receding into the background. After returning to a normal distance, new attention can continue to leave fragments.";
    return;
  }

  updateFarPause();

  if (cam.eyesClosed) {
    return;
  }

  let cards = zoneCards();
  let activeZone = null;

  for (let i = 0; i < cards.length; i++) {
    let c = cards[i];

    if (inRect(gaze.x, gaze.y, c.x, c.y, c.w, c.h)) {
      activeZone = zones[i];
      break;
    }
  }

  for (let z of zones) {
    if (z !== activeZone || z.done) {
      z.hoverStartMs = 0;
      z.progress = z.done ? 1 : 0;
    }
  }

  if (activeZone && !activeZone.done) {
    if (activeZone.hoverStartMs === 0) {
      activeZone.hoverStartMs = millis();
    }

    activeZone.progress = constrain(
      (millis() - activeZone.hoverStartMs) / zoneNeed,
      0,
      1
    );

    if (activeZone.progress * zoneSpeed >= 1) {
      activeZone.progress = 1;
      completeZone(activeZone);
    }
  }

  let allDone = zones.every(z => z.done);

  if (allDone && zonesDoneAt === 0) {
    zonesDoneAt = millis();

    echoText = "";
    noteText = "All four areas have been seen. The memory will recede into the background.";

    addRecord("All four areas are complete. Memory begins to find an exit.");
  }

  if (zonesDoneAt > 0 && millis() - zonesDoneAt > 1500) {
    enterRecede();
  }

  if (!allDone) {
    noteText = "Distance: look toward the pale areas. Attention will move from self-judgement toward mechanism, fact, next step, and what can be left aside.";
  }
}

// Memory receding stage
function updateRecede() {
  echoText = "";
  noteText = "This memory is receding into the background. It does not disappear; it becomes lighter experience material.";
}

// Find fragment to enlarge
function keySource() {
  if (focusFrag) return focusFrag;
  if (!frags || frags.length === 0) return null;

  let closest = null;
  let closestD = 99999;

  for (let frag of frags) {
    let d = dist(gaze.x, gaze.y, frag.x, frag.y);

    if (d < closestD) {
      closestD = d;
      closest = frag;
    }
  }

  return closest;
}

// Enter keyword-following flow
function enterFollow() {
  let sourceFrag = keySource();

  if (!sourceFrag) {
    noteText = "There is no fragment to enlarge yet. Return to a normal distance and let the gaze leave several fragments first.";
    return;
  }

  flow = "follow";

  focusFrag = sourceFrag;
  focusFrag.expanded = true;
  focusFrag.expandedBorn = millis();

  if (!focusFrag.answer) {
    focusFrag.answer = makeEventLine(focusFrag.text);
  }

  let source = sourceFrag.text || "the enlarged detail";
  core = source;

  let b = gazeBox();

  key.text = source;
  key.x = b.x + b.w * 0.52;
  key.y = b.y + b.h * 0.48;
  key.vx = random([-0.72, 0.72]);
  key.vy = random([-0.48, 0.48]);
  key.followMs = 0;
  key.lastSplitMs = millis();

  splits = [];
  ghosts = [];

  echoText = "";
  noteText = "Caught: the keyword has been pushed to the foreground. It still looks like a problem that can be revised, but it is starting to become heavy.";

  addRecord("A keyword is pushed to the foreground: " + source);
}

// Enter rumination loop
function enterLoop() {
  flow = "ruminate";

  vers = [];

  optCounts = {
    again: 0,
    angle: 0,
    stop: 0
  };

  activeOpt = "";
  lastOpt = "";
  optStartMs = 0;
  loopStartMs = millis();
  loopReady = false;
  loopHintA = 1;
  loopHeat = 0.18;

  echoText = "";
  noteText = "The echo has not loosened yet.";

  addVer("again");
  addRecord("The rumination loop begins.");
}

// Enter eye-closed pause
function enterPause() {
  flow = "pause";

  pauseMs = 0;
  pauseDone = false;

  echoText = "";
  noteText = "Distance: move farther away and close your eyes. Let the loop pause first.";

  addRecord("After moving farther away, the loop slows down.");
}

// Enter redistribution
function enterRedistribute() {
  if (flow !== "redistribute") {
    if (!zones || zones.length === 0 || zoneA < 0.05 || zonesDoneAt > 0) {
      resetZones();
      zonesDoneAt = 0;
    }

    echoText = "";
    noteText = "Distance: look toward the pale areas to generate responses. Closing your eyes will quiet old fragments.";

    addRecord("After moving farther away, the memory is redistributed.");
  }

  flow = "redistribute";
}

// Enter memory receding
function enterRecede() {
  flow = "recede";

  echoText = "";
  noteText = "The memory recedes into the background. A new attention cycle will begin afterward.";

  addRecord("Memory recedes into the background.");

  setTimeout(startRecedeAnim, 1400);
}

// Generate new fragment
function spawnFrag() {
  if (!makeFragRoom()) return;

  let label = fragPool[floor(random(fragPool.length))];

  frags.push({
    text: label,
    x: gaze.x + random(-24, 24),
    y: gaze.y + random(-20, 20),
    expanded: false,
    expandedBorn: 0,
    answer: "",
    hoverStartMs: 0,
    progress: 0,
    born: millis(),
    weight: 1
  });

  echoText = "";
  noteText = "Present: it is only a memory fragment. Let it stay first, without rushing to explain the cause or judge its value.";

  addRecord("Attention leaves a fragment: " + label);
  lastFragMs = millis();
}

// Time gaze dwell on fragments
function updateFragDwell() {
  let closest = null;
  let closestD = 99999;

  for (let frag of frags) {
    if (frag.expanded) continue;

    let d = dist(gaze.x, gaze.y, frag.x, frag.y);

    if (d < closestD) {
      closestD = d;
      closest = frag;
    }
  }

  for (let frag of frags) {
    if (frag !== closest || frag.expanded) {
      frag.hoverStartMs = 0;
      frag.progress = frag.expanded ? 1 : 0;
    }
  }

  if (!closest || closestD > 115) return;

  if (closest.hoverStartMs === 0) {
    closest.hoverStartMs = millis();
  }

  closest.progress = constrain(
    (millis() - closest.hoverStartMs) / fragNeed,
    0,
    1
  );

  if (closest.progress >= 1) {
    expandFrag(closest);
  }
}

// Expand fragment into event description
function expandFrag(frag) {
  frag.expanded = true;
  frag.expandedBorn = millis();
  frag.answer = makeEventLine(frag.text);

  focusFrag = frag;
  core = frag.text;
  flow = "expand";

  echoText = "";
  noteText = "Present: the fragment has been arranged into an event outline. It points to a creative process, not a self-evaluation.";

  addRecord("The fragment is arranged into an event description: " + frag.answer);
}

// Generate event line by fragment type
// This function was modified with the assistance of ChatGPT 
function makeEventLine(fragText) {
  let f = String(fragText || "this fragment");
  let type = eventType(f);

  let pools = {
    light: [
      f + " is still glowing; the old work has not fully closed.",
      "The gaze rests on " + f + ", and a small part of the old judgement becomes lighter.",
      f + " rises from the old work like a place where something can still continue.",
      "The old work does not leave only problems; " + f + " still supports it.",
      f + " feels like a small area that has not gone dark, keeping warmth in the act of looking back.",
      "This light does not give an answer, but it lets the old work breathe again."
    ],

    note: [
      f + " is like a door left at the edge of the note, where an old thought can enter again.",
      "In the old note, " + f + " has not ended; it waits quietly on the page.",
      f + " gently connects a past thought back to the present.",
      "This old note does not provide an answer; it leaves an entrance that can still be looked through.",
      f + " stays at the margin like a prompt not yet unfolded.",
      "The old note loosens here, and the earlier line of thought opens a narrow gap."
    ],

    draft: [
      f + " stops halfway, like a direction not yet unfolded.",
      "The draft was not finished, but " + f + " still keeps a place to go.",
      f + " is not an absence; it feels more like a line not yet followed to the end.",
      "The old sketch pauses here, and also leaves a possibility here.",
      f + " was never completed, yet it still points toward a shape that could continue.",
      "The draft stops here, as if leaving the next step gently to the present."
    ],

    version: [
      f + " gives the old work layers; choices once settled over each other.",
      "Between the versions, " + f + " is still moving, like a revision not yet cooled.",
      f + " breaks the result back into process, turning the work into a series of choices again.",
      "Old versions have not disappeared; they leave a faint echo around " + f + ".",
      f + " turns the result back into process, and judgement becomes lighter for a moment.",
      "Several versions overlap here, as if old choices have not fully settled."
    ],

    structure: [
      f + " keeps the problem inside the work, where it can still be moved, adjusted, and rearranged.",
      "This part of the structure is not stable, but it does not overturn the whole work.",
      f + " is like a loosened node waiting to be placed again.",
      "The old work opens a gap here, and also shows where revision can continue.",
      f + " lets the structure loosen for a moment, giving the next revision an entrance.",
      "The problem stays inside the work and has not expanded into a conclusion about the self."
    ],

    concept: [
      f + " is close to the core, but has not yet found its clearest position.",
      "In the old statement, " + f + " has not hardened; the concept is still looking for its edge.",
      f + " is like a temporary name, allowing the work to show its direction again.",
      "This sentence is not clear enough yet, but it is already close to what the work wants to say.",
      f + " is not a final expression, but a moving coordinate for the concept.",
      "The concept does not close here; it only needs to be arranged more lightly."
    ],

    problem: [
      f + " is a local heaviness, not the conclusion of the whole work.",
      "There is something unstable here, but a useful attempt still sits beside it.",
      "After " + f + " is seen, the problem becomes concrete and therefore more workable.",
      "The old work wrinkles here, but it does not lose everything because of it.",
      f + " is a problem that can return to the hand; it does not need to become an evaluation.",
      "This part becomes heavy, but it still belongs inside the work."
    ],

    possibility: [
      f + " is like unused material that can still be opened again.",
      "The old work loosens around " + f + ", and a new possibility begins to enter.",
      f + " does not demand an answer; it leaves a direction that can still be tested.",
      "This material has not sunk away; it can still be carried into the next attempt.",
      f + " feels like preserved room, keeping the old work from ending completely.",
      "A possibility shows itself here, without needing to be proved immediately."
    ],

    visual: [
      f + " gives the image breath again; the relationships are still adjusting slowly.",
      "The rhythm of the old work shifts lightly around " + f + ".",
      f + " is not simply a mistake; it feels like a visual relation that has not fully settled.",
      "The image leaves a small tilt here, still worth looking at.",
      f + " makes the image tremble slightly, and the relationships become visible again.",
      "This visual shift does not close the work; it keeps a small unfinished space inside it."
    ],

    pause: [
      f + " stays there like a sentence not yet written to the end.",
      "The old work breaks at " + f + ", and also keeps an entrance there.",
      "This pause does not close anything; it simply has not continued yet.",
      f + " is like a folded corner, reminding the work that another page remains.",
      "The place where it stopped has not disappeared; it keeps the next step on the page.",
      f + " creates a small pause, letting the act of looking back slow down."
    ],

    general: [
      f + " is placed back into the whole, and the old work shows an event line again.",
      "After the gaze stops, " + f + " is no longer only a fragment; it becomes an entrance into looking back.",
      f + " gently connects with other material, and the old work begins to form again.",
      "This fragment does not offer a conclusion; it makes the past process visible again.",
      f + " rises from scattered material like the beginning of a return.",
      "The old work reconnects here, though it has not been fully explained."
    ]
  };

  let pool = pools[type] || pools.general;
  return pickEventLine(type, pool);
}

// Identify fragment type
function eventType(f) {
  let t = String(f || "").toLowerCase();

  if (t.includes("glowing") || t.includes("useful") || t.includes("worked")) return "light";
  if (t.includes("note") || t.includes("annotation") || t.includes("edge") || t.includes("circled") || t.includes("margin")) return "note";
  if (t.includes("sketch") || t.includes("draft") || t.includes("unfinished")) return "draft";
  if (t.includes("version") || t.includes("number") || t.includes("compared")) return "version";
  if (t.includes("revision") || t.includes("adjust") || t.includes("structure") || t.includes("choice")) return "structure";
  if (t.includes("concept") || t.includes("title") || t.includes("statement") || t.includes("sentence") || t.includes("paragraph")) return "concept";
  if (t.includes("mistake") || t.includes("almost") || t.includes("uncertain") || t.includes("too hard")) return "problem";
  if (t.includes("possibility") || t.includes("potential") || t.includes("experiment") || t.includes("intuition")) return "possibility";
  if (t.includes("composition") || t.includes("image") || t.includes("rhythm") || t.includes("shift")) return "visual";
  if (t.includes("stopped") || t.includes("not yet") || t.includes("not clearly")) return "pause";

  return "general";
}

// Avoid repeated event lines
function pickEventLine(type, pool) {
  let options = [];

  for (let i = 0; i < pool.length; i++) {
    let id = type + "_" + i;

    if (!recentEventLines.includes(id)) {
      options.push({
        text: pool[i],
        id: id
      });
    }
  }

  if (options.length === 0) {
    for (let i = 0; i < pool.length; i++) {
      options.push({
        text: pool[i],
        id: type + "_" + i
      });
    }
  }

  if (
    recentEventTypes.length > 0 &&
    recentEventTypes[recentEventTypes.length - 1] === type &&
    options.length > 1
  ) {
    options = options.slice(1).concat(options.slice(0, 1));
  }

  let picked = options[floor(random(options.length))];

  recentEventTypes.push(type);
  recentEventLines.push(picked.id);

  if (recentEventTypes.length > 8) {
    recentEventTypes.shift();
  }

  if (recentEventLines.length > 12) {
    recentEventLines.shift();
  }

  return picked.text;
}

// Avoid repeated record lines
function pickRecord(pool) {
  let options = [];

  for (let item of pool) {
    if (!recentRecords.includes(item)) {
      options.push(item);
    }
  }

  if (options.length === 0) {
    options = pool.slice();
  }

  let picked = options[floor(random(options.length))];

  recentRecords.push(picked);

  if (recentRecords.length > 18) {
    recentRecords.shift();
  }

  return picked;
}

// Move keyword
function moveKey() {
  key.x += key.vx;
  key.y += key.vy;

  let b = gazeBox();

  let minX = b.x + 64;
  let maxX = b.x + b.w - 64;
  let minY = b.y + 64;
  let maxY = b.y + b.h - 96;

  if (key.x < minX || key.x > maxX) key.vx *= -1;
  if (key.y < minY || key.y > maxY) key.vy *= -1;

  key.x = constrain(key.x, minX, maxX);
  key.y = constrain(key.y, minY, maxY);
}

// Natural decay of rumination heat
function updateLoopHeat() {
  loopHeat = max(0, loopHeat - 0.0009 * deltaTime);
}

// Generate split text around the keyword
// This function was modified with the assistance of ChatGPT 
function makeSplitText(word) {
  let w = word || "this detail";

  let pool = [
    w + " was once only an adjustable part, but it begins to look like key evidence for the whole work.",
    "Attention is still trying to understand " + w + ", but the question shifts toward why it was not done better at the time.",
    "A reasonable thought of revision approaches " + w + ", then becomes another comparison with the old version.",
    w + " opens again, as if the most correct version is still missing.",
    "This detail grows larger, while other effective parts recede. The work is compressed into one local problem.",
    "Attention has not fully lost control. It still resembles reflection, but reflection is becoming excessive cause-seeking.",
    "A new explanation appears beside " + w + ": maybe I did not think clearly enough then.",
    "Similar sentences from the old notes move closer to " + w + ", making it seem more and more important.",
    "One revision suggestion turns into a chain of why, and the problem moves from the work to the maker.",
    w + " has just been arranged, then becomes heavier through another comparison.",
    "This local part starts asking for a better version, as if leaving is impossible before finding it.",
    w + " is no longer only a detail. It begins to be misread as proof of ability, judgement, and choice.",
    "Reasonable reflection still continues on the surface, but it points less toward a next step and more toward whether I was not enough.",
    "Even a part worth keeping is drawn into comparison, as if anything short of the best cannot stand.",
    w + " grows large enough to cover other material, and even useful attempts become less believable.",
    "It looks like an ordinary problem, but begins to pull the whole old work toward one single standard.",
    "Attention circles around " + w + ", and the longer it looks, the more it seems like evidence that must be explained.",
    "What could have been revised next time is mistaken for something that must be solved immediately.",
    "Old versions are opened again and again, as if every choice must be proved once more.",
    "A local flaw is enlarged, and the useful attempt beside it temporarily darkens.",
    "A concrete problem is becoming an oversized standard.",
    "Comparison keeps moving closer, trying to find the whole cause inside this detail.",
    "Reflection still keeps the shape of arrangement, but it is already turning back toward self-judgement.",
    "The other parts of the old work move behind it, leaving this detail brighter and heavier."
  ];

  return pool[floor(random(pool.length))];
}

// Add one rumination version
function addVer(type) {
  let n = vers.length + 1;
  let ver = "Version " + nf(n, 2);
  let d = core || key.text || "this detail";

  let textValue = "";

  if (type === "again") {
    textValue =
      ver + " Look again\n" +
      d + " is placed back at the centre.\n" +
      "At first it seems like a reasonable revision point, then becomes: why was it not done better then?";
  }

  if (type === "angle") {
    textValue =
      ver + " Think from another angle\n" +
      "The new angle does not make the problem more concrete. It produces another higher standard.\n" +
      "Attention begins searching for the best version that does not exist.";
  }

  if (type === "stop") {
    textValue =
      ver + " Let it stop here\n" +
      "The attempt to stop looking back is also written into the loop.\n" +
      "It becomes a new self-judgement: why can I not even let this go?";
  }

  vers.push({
    text: textValue,
    type: type,
    born: millis()
  });

  echoText = "";
  addRecord(textValue);
}

// Read currently gazed option
function readOption() {
  let cards = optionCards();

  for (let card of cards) {
    if (inRect(gaze.x, gaze.y, card.x, card.y, card.w, card.h)) {
      return card.id;
    }
  }

  return "";
}

// Reset distance zones
function resetZones() {
  zones = [
    {
      id: "what",
      label: "What happened",
      answer: "",
      done: false,
      hoverStartMs: 0,
      progress: 0,
      nx: random(0.16, 0.32),
      ny: random(0.24, 0.38),
      phase: random(TWO_PI),
      drift: random(26, 42)
    },
    {
      id: "felt",
      label: "What I felt",
      answer: "",
      done: false,
      hoverStartMs: 0,
      progress: 0,
      nx: random(0.66, 0.84),
      ny: random(0.22, 0.40),
      phase: random(TWO_PI),
      drift: random(26, 42)
    },
    {
      id: "next",
      label: "What I can do next",
      answer: "",
      done: false,
      hoverStartMs: 0,
      progress: 0,
      nx: random(0.15, 0.34),
      ny: random(0.62, 0.78),
      phase: random(TWO_PI),
      drift: random(26, 42)
    },
    {
      id: "rest",
      label: "What does not need to be solved now",
      answer: "",
      done: false,
      hoverStartMs: 0,
      progress: 0,
      nx: random(0.66, 0.86),
      ny: random(0.60, 0.78),
      phase: random(TWO_PI),
      drift: random(26, 42)
    }
  ];
}

// Complete one distance zone
function completeZone(zone) {
  zone.done = true;
  zone.answer = zoneLine(zone.id);

  echoText = "";
  noteText = "This area has become clearer. Look toward another pale area.";

  addRecord(zone.label + ": " + zone.answer);
}

// Generate distance-zone response
function zoneLine(id) {
  let d = core || key.text || "this detail";

  if (id === "what") {
    return "I am looking back at " + d + " in an old note.\nIt is a specific trace of making, not a final conclusion about the self.";
  }

  if (id === "felt") {
    return "Regret, tension, care, or the wish to revise it better may all bring attention back here.\nThese feelings are real, but they are not the same as the facts.";
  }

  if (id === "next") {
    return "The next step can return to something workable: keep one effective part, adjust one structure, rewrite one sentence, or simply record the problem.\nReasonable reflection only needs one concrete direction.";
  }

  if (id === "rest") {
    return "The maximised version, excessive cause-seeking, and self-evaluation can be left aside for now.\nThis memory can become background experience instead of staying at the centre.";
  }

  return "This area is gently seen.";
}

// Try to generate a fragment
function trySpawnFrag() {
  let b = gazeBox();

  let inside = inRect(
    gaze.x,
    gaze.y,
    b.x,
    b.y + 12,
    b.w,
    b.h - 84
  );

  if (!inside) return;
  if (nearFrag(blockRad)) return;

  if (millis() - lastFragMs > spawnGap) {
    spawnFrag();
  }
}

// Check whether a nearby fragment already exists
function nearFrag(radius) {
  for (let frag of frags) {
    if (!blocksSpawn(frag)) continue;

    let d = dist(gaze.x, gaze.y, frag.x, frag.y);

    if (d < radius) {
      return true;
    }
  }

  return false;
}

// Remove expired fragments
function updateFragLife() {
  frags = frags.filter(frag => {
    if (frag === focusFrag) return true;

    if (frag.expanded) {
      let age = millis() - (frag.expandedBorn || frag.born);
      return age < openFragLife + openFragFade;
    }

    let age = millis() - frag.born;
    return age < fragLife + fragFade;
  });
}

// Decide whether a fragment blocks new generation
function blocksSpawn(frag) {
  if (frag === focusFrag) return true;
  if (frag.expanded) return true;

  let age = millis() - frag.born;
  return age < blockLife;
}

// Calculate fragment opacity
function fragAlpha(frag) {
  if (frag === focusFrag) return 1;

  if (frag.expanded) {
    let age = millis() - (frag.expandedBorn || frag.born);

    if (age <= openFragLife) return 1;

    return constrain(
      1 - (age - openFragLife) / openFragFade,
      0,
      1
    );
  }

  let age = millis() - frag.born;

  if (age <= fragLife) return 1;

  return constrain(
    1 - (age - fragLife) / fragFade,
    0,
    1
  );
}

// Make room for a new fragment
function makeFragRoom() {
  if (frags.length < maxFrags) return true;

  let oldestIndex = -1;
  let oldestAge = -1;

  for (let i = 0; i < frags.length; i++) {
    let frag = frags[i];

    if (frag === focusFrag) continue;
    if (frag.expanded) continue;

    let age = millis() - frag.born;

    if (age > oldestAge) {
      oldestAge = age;
      oldestIndex = i;
    }
  }

  if (oldestIndex === -1) {
    for (let i = 0; i < frags.length; i++) {
      let frag = frags[i];

      if (frag === focusFrag) continue;

      let age = millis() - frag.born;

      if (age > oldestAge) {
        oldestAge = age;
        oldestIndex = i;
      }
    }
  }

  if (oldestIndex !== -1) {
    frags.splice(oldestIndex, 1);
    return true;
  }

  return false;
}

// Calculate interface layout
function updateLayout() {
  ui.margin = 18;

  ui.mainX = ui.margin;
  ui.mainY = ui.margin;
  ui.mainW = width - ui.margin * 2;
  ui.mainH = height - ui.margin * 2;

  ui.topX = ui.mainX + 24;
  ui.topY = ui.mainY + 20;
  ui.topW = min(390, ui.mainW * 0.36);
  ui.topH = 118;

  ui.modeX = ui.mainX + 24;
  ui.modeW = ui.mainW - 48;
  ui.modeH = 44;
  ui.modeY = ui.mainY + ui.mainH - ui.modeH - 18;
}

// Cursor activity area
function gazeBox() {
  let pad = 42;

  return {
    x: ui.mainX + pad,
    y: ui.mainY + pad,
    w: ui.mainW - pad * 2,
    h: ui.mainH - pad * 2
  };
}

// Keep cursor inside the page
function clampGaze(x, y) {
  let b = gazeBox();

  return {
    x: constrain(x, b.x, b.x + b.w),
    y: constrain(y, b.y, b.y + b.h)
  };
}

// Draw background
function drawBg() {
  if (flow === "ruminate") {
    background(52, 34, 34);
  } else if (flow === "pause") {
    background(238, 232, 218);
  } else if (flow === "calm") {
    background(224, 230, 228);
  } else if (flow === "redistribute") {
    background(232, 238, 229);
  } else if (flow === "recede") {
    background(229, 235, 241);
  } else {
    background(236, 230, 216);
  }

  drawGrain();

  if (calmVis > 0.02) {
    push();
    noStroke();
    fill(150, 170, 168, 42 * calmVis);
    rect(0, 0, width, height);
    pop();
  }
}

// Paper grain
function drawGrain() {
  push();
  noStroke();

  for (let i = 0; i < 120; i++) {
    fill(80, 60, 40, random(3, 8));
    ellipse(random(width), random(height), random(0.5, 1.5));
  }

  pop();
}

// Opacity helper
function colA(c, a) {
  return color(red(c), green(c), blue(c), alpha(c) * a);
}

// Draw tape
function drawTape(x, y, w, rot = 0, a = 1) {
  push();

  translate(x, y);
  rotate(rot);

  noStroke();
  fill(246, 230, 166, 116 * a);
  rect(-w / 2, -8, w, 16, 2);

  stroke(255, 255, 255, 45 * a);
  strokeWeight(1);
  line(-w / 2 + 6, -3, w / 2 - 6, -3);

  pop();
}

// Draw note paper
// Notes, tape, and folded corners turn interface controls into old note material.
function drawNote(x, y, w, h, paper, border, rot = 0, a = 1, tape = true, fold = true) {
  push();

  translate(x + w / 2, y + h / 2);
  rotate(rot);

  drawingContext.shadowOffsetX = 0;
  drawingContext.shadowOffsetY = 7;
  drawingContext.shadowBlur = 20;
  drawingContext.shadowColor = "rgba(70,50,35," + 0.16 * a + ")";

  rectMode(CENTER);
  noStroke();
  fill(colA(paper, a));
  rect(0, 0, w, h, 3);

  drawingContext.shadowBlur = 0;

  if (fold) {
    let f = min(22, w * 0.14, h * 0.24);

    noStroke();
    fill(255, 255, 245, 45 * a);
    triangle(
      w / 2 - f,
      -h / 2,
      w / 2,
      -h / 2,
      w / 2,
      -h / 2 + f
    );

    stroke(colA(border, a * 0.55));
    strokeWeight(1);
    line(w / 2 - f, -h / 2, w / 2, -h / 2 + f);
  }

  stroke(colA(border, a));
  strokeWeight(1);
  noFill();
  rect(0, 0, w, h, 3);

  if (tape) {
    let tapeW = min(92, max(54, w * 0.34));
    let tapeH = 15;

    noStroke();
    fill(246, 230, 166, 104 * a);
    rect(0, -h / 2 - 1, tapeW, tapeH, 2);

    stroke(255, 255, 255, 38 * a);
    strokeWeight(1);
    line(-tapeW / 2 + 7, -h / 2 - 4, tapeW / 2 - 7, -h / 2 - 4);
  }

  pop();
}

// Horizontal progress bar
function drawBar(x, y, w, h, p, col, a = 1) {
  push();

  let progress = constrain(p, 0, 1);

  noStroke();
  fill(red(col), green(col), blue(col), 38 * a);
  rect(x, y, w, h, 2);

  fill(red(col), green(col), blue(col), 150 * a);
  rect(x, y, w * progress, h, 2);

  pop();
}

// Gaze focus ring progress
function drawFocusRing(cx, cy, w, h, p, col, a = 1) {
  let progress = constrain(p, 0, 1);
  if (progress <= 0.01) return;

  push();

  noFill();
  stroke(red(col), green(col), blue(col), 92 * a);
  strokeWeight(2.5);
  strokeCap(ROUND);

  let start = -HALF_PI;
  let end = start + TWO_PI * progress;

  arc(cx, cy, w * 0.94, h * 0.84, start, end);

  pop();
}

// Note-border progress
// Different modes use different progress forms:
// present mode circles, caught mode traces the border, distance mode checks.
function drawRectProgress(x, y, w, h, p, col, a = 1) {
  let progress = constrain(p, 0, 1);
  if (progress <= 0.01) return;

  push();

  noFill();
  stroke(red(col), green(col), blue(col), 190 * a);
  strokeWeight(2);
  strokeCap(ROUND);
  strokeJoin(ROUND);

  let pad = 5;
  let x1 = x + pad;
  let y1 = y + pad;
  let x2 = x + w - pad;
  let y2 = y + h - pad;

  let total = (x2 - x1) * 2 + (y2 - y1) * 2;
  let remain = total * progress;

  function drawPart(ax, ay, bx, by, len) {
    if (remain <= 0) return;

    let useLen = min(remain, len);
    let t = useLen / len;

    line(ax, ay, lerp(ax, bx, t), lerp(ay, by, t));

    remain -= useLen;
  }

  drawPart(x1, y1, x2, y1, x2 - x1);
  drawPart(x2, y1, x2, y2, y2 - y1);
  drawPart(x2, y2, x1, y2, x2 - x1);
  drawPart(x1, y2, x1, y1, y2 - y1);

  pop();
}

// Check progress
function drawCheck(x, y, s, p, col, a = 1) {
  let progress = constrain(p, 0, 1);

  push();

  noFill();
  stroke(red(col), green(col), blue(col), 120 * a);
  strokeWeight(1.4);
  rect(x, y, s, s, 2);

  if (progress > 0.02) {
    stroke(red(col), green(col), blue(col), 195 * a);
    strokeWeight(2);
    strokeCap(ROUND);

    let p1 = constrain(progress / 0.38, 0, 1);
    let p2 = constrain((progress - 0.38) / 0.42, 0, 1);

    let ax = x + s * 0.24;
    let ay = y + s * 0.56;
    let bx = x + s * 0.43;
    let by = y + s * 0.74;
    let cx = x + s * 0.78;
    let cy = y + s * 0.28;

    line(ax, ay, lerp(ax, bx, p1), lerp(ay, by, p1));

    if (progress > 0.38) {
      line(bx, by, lerp(bx, cx, p2), lerp(by, cy, p2));
    }
  }

  pop();
}

// Draw attention cursor
function drawCursor(x, y, col, a = 1) {
  push();

  translate(x, y);

  let pulse = sin(frameCount * 0.08) * 0.7;
  let r = 10 + pulse;

  noFill();
  stroke(red(col), green(col), blue(col), 185 * a);
  strokeWeight(1.4);
  ellipse(0, 0, r * 2, r * 2);

  stroke(red(col), green(col), blue(col), 120 * a);
  strokeWeight(1);
  line(-r - 4, 0, -r + 2, 0);
  line(r - 2, 0, r + 4, 0);
  line(0, -r - 4, 0, -r + 2);
  line(0, r - 2, 0, r + 4);

  noStroke();
  fill(red(col), green(col), blue(col), 155 * a);
  ellipse(0, 0, 3, 3);

  pop();
}

// Ink colour by current flow
function ink(a = 230) {
  if (flow === "ruminate") return color(88, 34, 31, a);
  if (flow === "pause" || flow === "calm") return color(82, 67, 43, a);
  if (flow === "redistribute") return color(47, 74, 62, a);
  if (flow === "recede" || memClosed) return color(54, 72, 92, a);

  return color(64, 52, 38, a);
}

// Mode colour
// Colours follow mental states:
// paper-like for normal distance, reddish for close distance, cooler green for far distance.
function modeCol(targetMode, a = 220) {
  if (targetMode === "ordinary") return color(166, 128, 76, a);
  if (targetMode === "close") return color(150, 64, 60, a);
  if (targetMode === "far") return color(82, 132, 98, a);

  return color(90, 90, 90, a);
}

// Memory font
function fontMem(size = 13) {
  textFont(memoryFont);
  textStyle(NORMAL);
  textSize(size);
}

function fontMemBold(size = 13) {
  textFont(memoryFont);
  textStyle(NORMAL);
  textSize(size + 0.4);
}

// Trace font
function fontThought(size = 13) {
  textFont(thoughtFont);
  textStyle(NORMAL);
  textSize(size);
}

// Caught-mode font
function fontSys(size = 13) {
  textFont(systemFont);
  textStyle(NORMAL);
  textSize(size);
}

function fontSysBold(size = 13) {
  textFont(systemFont);
  textStyle(NORMAL);
  textSize(size + 0.5);
}

// Distance-mode font
function fontFar(size = 13) {
  textFont(distanceFont);
  textStyle(NORMAL);
  textSize(size);
}

function fontFarBold(size = 13) {
  textFont(distanceFont);
  textStyle(NORMAL);
  textSize(size + 0.4);
}

// Select body font by flow
function bodyFont(size = 13) {
  if (flow === "follow" || flow === "ruminate") {
    fontSys(size);
  } else if (flow === "pause" || flow === "calm" || flow === "redistribute" || flow === "recede") {
    fontFar(size);
  } else {
    fontMem(size);
  }
}

// Select bold font by flow
function bodyBold(size = 13) {
  if (flow === "follow" || flow === "ruminate") {
    fontSysBold(size);
  } else if (flow === "pause" || flow === "calm" || flow === "redistribute" || flow === "recede") {
    fontFarBold(size);
  } else {
    fontMemBold(size);
  }
}

// Draw top-left records
function drawRecords() {
  push();

  drawNote(
    ui.topX,
    ui.topY,
    ui.topW,
    ui.topH,
    color(250, 244, 226, 222),
    color(190, 170, 130, 68),
    radians(-0.35),
    1,
    true,
    true
  );

  noStroke();
  fill(ink(210));
  textAlign(LEFT, TOP);

  fontMemBold(15);
  text("Reality is being generated", ui.topX + 18, ui.topY + 18);

  drawRecordRows();

  pop();
}

// Draw record rows
function drawRecordRows() {
  let rows = buildRecords();
  let startX = ui.topX + 16;
  let startY = ui.topY + 48;
  let rowW = ui.topW - 32;
  let maxLines = 3;

  for (let i = 0; i < min(maxLines, rows.length); i++) {
    let row = rows[rows.length - 1 - i];
    let yy = startY + i * 21;
    let a = map(i, 0, maxLines - 1, 205, 105);

    let paper = color(255, 250, 225, a * 0.72);
    let border = color(190, 160, 110, a * 0.18);
    let txt = ink(a);

    if (row.tone === "loop") {
      paper = color(250, 224, 219, a * 0.78);
      border = color(190, 105, 95, a * 0.24);
      txt = color(95, 38, 36, a);
    } else if (row.tone === "pause") {
      paper = color(232, 240, 234, a * 0.76);
      border = color(100, 145, 125, a * 0.22);
      txt = color(52, 82, 74, a);
    } else if (row.tone === "redistribute") {
      paper = color(224, 242, 226, a * 0.72);
      border = color(120, 165, 130, a * 0.2);
      txt = color(44, 78, 60, a);
    } else if (row.tone === "recede") {
      paper = color(224, 235, 247, a * 0.72);
      border = color(120, 150, 190, a * 0.18);
      txt = color(50, 72, 100, a);
    }

    drawNote(
      startX,
      yy - 2,
      rowW,
      18,
      paper,
      border,
      radians(i === 0 ? -0.2 : i === 1 ? 0.15 : -0.1),
      1,
      false,
      false
    );

    noStroke();
    fill(txt);
    fontMem(11);
    textAlign(LEFT, TOP);
    drawOneLine(row.text, startX + 9, yy + 2, rowW - 18);
  }

  if (rows.length === 0) {
    fill(95, 75, 50, 115);
    fontMem(11);
    textAlign(LEFT, TOP);
    text("No trace has been left yet.", startX + 4, startY + 7);
  }
}

// Draw main page
function drawPage() {
  push();

  let paper = color(250, 244, 226, 245);
  let border = color(190, 170, 130, 90);

  if (flow === "ruminate") {
    paper = color(245, 218, 215, 246);
    border = color(170, 80, 80, 110);
  } else if (flow === "pause") {
    paper = color(250, 240, 216, 244);
    border = color(185, 150, 85, 96);
  } else if (flow === "calm") {
    paper = color(236, 244, 240, 244);
    border = color(112, 150, 136, 90);
  } else if (flow === "redistribute") {
    paper = color(238, 249, 235, 242);
    border = color(120, 165, 130, 96);
  } else if (flow === "recede") {
    paper = color(236, 244, 250, 240);
    border = color(120, 150, 190, 88);
  }

  drawNote(
    ui.mainX,
    ui.mainY,
    ui.mainW,
    ui.mainH,
    paper,
    border,
    radians(0.05),
    1,
    false,
    true
  );

  drawTape(ui.mainX + ui.mainW / 2, ui.mainY + 7, 132, radians(1.2), 0.95);

  noStroke();
  fill(ink(190));
  textAlign(CENTER, TOP);

  fontMemBold(20);
  text("Where attention has stayed", ui.mainX + ui.mainW / 2, ui.mainY + 22);

  pop();
}

// Reserved archive layer
function drawArchive() {
  return;
}

// Draw current flow content
function drawFlow() {
  if (
    flow === "collect" ||
    flow === "expand" ||
    flow === "follow" ||
    flow === "calm" ||
    flow === "redistribute"
  ) {
    drawFrags();

    if (flow === "follow") {
      drawKey();
    }
  }

  if (flow === "ruminate") {
    drawOptions();
  }

  if (flow === "pause") {
    drawPauseCard();
  }

  if (flow === "redistribute" || zoneA > 0.02) {
    drawZones();
  }

  if (calmCardA > 0.02) {
    drawCalmCard();
  }

  if (flow === "recede") {
    drawRecedeCard();
  }
}

// Draw fragment collection
function drawFrags() {
  if (frags.length === 0) {
    push();

    fill(80, 65, 48, 135);
    noStroke();
    textAlign(CENTER, CENTER);
    fontMem(17);

    let msg = archive.length > 0
      ? "The previous memory has receded into the background.\nKeep a normal distance, and new attention can surface on the page."
      : "Keep a normal distance.\nSlowly move your head direction across the page, and fragments will surface where attention passes.";

    if (flow === "calm") {
      fontFar(17);
      msg = "Move farther away and close your eyes.\nEven without specific fragments, the page can enter a brief quiet.";
    }

    if (flow === "redistribute") {
      fontFar(17);
      msg = "Far distance.\nLook toward the pale surrounding areas, and memory will be redistributed.";
    }

    text(
      msg,
      ui.mainX + ui.mainW / 2,
      ui.mainY + ui.mainH / 2
    );

    pop();
    return;
  }

  for (let frag of frags) {
    drawFrag(frag);
  }
}

// Draw one fragment
function drawFrag(frag) {
  let fade = fragAlpha(frag);
  if (fade <= 0.02) return;

  push();

  let age = millis() - frag.born;
  let appear = constrain(age / 600, 0, 1);

  let weight = frag.weight === undefined ? 1 : frag.weight;

  let a = frag.expanded ? 245 : 112 + appear * 75;
  a *= fade;
  a *= weight;

  let w = frag.expanded ? 390 : 164;
  let h = frag.expanded ? 150 : 54;

  let cool = constrain(
    calmVis * 0.75 + (1 - weight) * 0.85,
    0,
    1
  );

  let paper = lerpColor(
    color(255, 248, 214, a),
    color(214, 226, 224, a * 0.72),
    cool
  );

  let border = lerpColor(
    color(180, 150, 90, a * 0.46),
    color(92, 130, 122, a * 0.42),
    cool
  );

  let txt = lerpColor(
    color(60, 48, 35, a),
    color(58, 82, 78, a * 0.8),
    cool
  );

  let rot = frag.expanded
    ? radians(-0.8)
    : radians(sin(frag.born * 0.01) * 1.8);

  drawNote(
    frag.x - w / 2,
    frag.y - h / 2,
    w,
    h,
    paper,
    border,
    rot,
    fade * weight,
    true,
    true
  );

  noStroke();
  fill(txt);

  if (frag.expanded) {
    let padX = 28;
    let padY = 28;

    let eventText = frag.answer || makeEventLine(frag.text);

    fontMem(15);

    drawFitText(
      eventText,
      frag.x - w / 2 + padX,
      frag.y - h / 2 + padY,
      w - padX * 2,
      h - padY * 2,
      {
        maxSize: 15,
        minSize: 11,
        lineGap: 1.26,
        alignX: CENTER,
        alignY: CENTER,
        maxLines: 5,
        ellipsis: true,
        fontKind: "memory"
      }
    );
  } else {
    let padX = 14;
    let padY = 12;

    fontMem(15);

    drawFitText(
      frag.text,
      frag.x - w / 2 + padX,
      frag.y - h / 2 + padY,
      w - padX * 2,
      h - padY * 2,
      {
        maxSize: 15,
        minSize: 11,
        lineGap: 1.18,
        alignX: CENTER,
        alignY: CENTER,
        maxLines: 2,
        ellipsis: true,
        fontKind: "memory"
      }
    );
  }

  if (frag.progress > 0 && !frag.expanded) {
    drawFocusRing(
      frag.x,
      frag.y,
      w,
      h,
      frag.progress,
      color(120, 95, 55),
      fade * weight
    );
  }

  pop();
}

// Draw close-mode keyword
function drawKey() {
  push();

  let following = isFollowingKey();
  let p = constrain(key.followMs / keyNeed, 0, 1);
  let growP = easeOut(p);

  for (let s of splits) {
    let age = millis() - s.born;
    let weight = s.weight === undefined ? 1 : s.weight;
    let a = map(age, 0, 8600, 165, 0, true) * weight;

    let floatX = sin(age * 0.0016 + s.phase) * 9;
    let floatY = cos(age * 0.0014 + s.phase) * 7;

    fill(120, 50, 45, a);
    noStroke();
    textAlign(CENTER, CENTER);
    fontSys(14);

    text(
      s.text,
      key.x + s.ox + floatX,
      key.y + s.oy + floatY
    );
  }

  splits = splits.filter(s => millis() - s.born < 8600);

  let baseW = max(260, textWidth(key.text) + 130);
  let baseH = 104;

  let grow = following ? 1 + growP * 0.42 : 1;

  let noteW = baseW * grow;
  let noteH = baseH * grow;

  let paper = following
    ? color(255, 232, 214, 238)
    : color(255, 241, 219, 220);

  let border = following
    ? color(145, 58, 52, 150)
    : color(145, 78, 66, 88);

  drawNote(
    key.x - noteW / 2,
    key.y - noteH / 2,
    noteW,
    noteH,
    paper,
    border,
    radians(sin(frameCount * 0.018) * 1.2),
    1,
    true,
    true
  );

  fill(130, 52, 48, 235);
  noStroke();
  textAlign(CENTER, CENTER);
  fontSysBold(keySize);

  drawFitText(
    key.text,
    key.x - noteW / 2 + 24,
    key.y - noteH / 2 + 22,
    noteW - 48,
    noteH - 44,
    {
      maxSize: keySize,
      minSize: 13,
      lineGap: 1.16,
      alignX: CENTER,
      alignY: CENTER,
      maxLines: 3,
      ellipsis: true,
      fontKind: "system"
    }
  );

  if (following) {
    drawRectProgress(
      key.x - noteW / 2,
      key.y - noteH / 2,
      noteW,
      noteH,
      p,
      color(130, 52, 48),
      0.95
    );
  }

  pop();
}

// Ease-out animation
function easeOut(t) {
  t = constrain(t, 0, 1);
  return 1 - pow(1 - t, 3);
}

// Draw rumination options
function drawOptions() {
  let cards = optionCards();

  for (let card of cards) {
    drawOption(card);
  }

  drawLoopHint();
}

// Draw loop hint
function drawLoopHint() {
  if (loopHintA <= 0.02) return;

  push();

  let cx = ui.mainX + ui.mainW / 2;
  let cy = ui.mainY + ui.mainH * 0.34;

  textAlign(CENTER, CENTER);
  fontSys(22);

  noStroke();
  fill(95, 42, 38, 118 * loopHintA);
  text("The echo has not loosened yet.", cx, cy);

  pop();
}

// Draw one rumination option
function drawOption(card) {
  push();

  let active = activeOpt === card.id;
  let p = active ? constrain((millis() - optStartMs) / optNeed, 0, 1) : 0;

  let paper = active
    ? color(255, 232, 215, 248)
    : color(250, 220, 210, 224);

  let border = active
    ? color(150, 65, 60, 200)
    : color(160, 90, 80, 96);

  let rot = card.id === "again"
    ? radians(-1.4)
    : card.id === "angle"
      ? radians(0.7)
      : radians(1.3);

  drawNote(
    card.x,
    card.y,
    card.w,
    card.h,
    paper,
    border,
    rot,
    1,
    true,
    true
  );

  fill(80, 34, 32, 235);
  noStroke();
  textAlign(CENTER, CENTER);

  fontSysBold(23);

  drawFitText(
    card.label,
    card.x + 18,
    card.y + 22,
    card.w - 36,
    card.h - 44,
    {
      maxSize: 23,
      minSize: 14,
      lineGap: 1.12,
      alignX: CENTER,
      alignY: CENTER,
      maxLines: 3,
      ellipsis: false,
      fontKind: "system"
    }
  );

  if (active) {
    drawRectProgress(
      card.x,
      card.y,
      card.w,
      card.h,
      p,
      color(120, 45, 42),
      1
    );
  }

  pop();
}

// Rumination option layout
function optionCards() {
  let b = gazeBox();

  let gap = 24;
  let cardW = min(300, (b.w - gap * 2) / 3);
  let cardH = 154;
  let totalW = cardW * 3 + gap * 2;
  let x0 = b.x + b.w / 2 - totalW / 2;
  let y = b.y + b.h * 0.39;

  return [
    {
      id: "again",
      label: "Look again",
      x: x0,
      y: y,
      w: cardW,
      h: cardH
    },
    {
      id: "angle",
      label: "Think from another angle",
      x: x0 + cardW + gap,
      y: y,
      w: cardW,
      h: cardH
    },
    {
      id: "stop",
      label: "Let it stop here",
      x: x0 + (cardW + gap) * 2,
      y: y,
      w: cardW,
      h: cardH
    }
  ];
}

// Draw eye-closed pause card
function drawPauseCard() {
  push();

  let p = constrain(pauseMs / pauseNeed, 0, 1);
  let visibleP = constrain(p * zoneSpeed, 0, 1);

  let cx = ui.mainX + ui.mainW / 2;
  let cy = ui.mainY + ui.mainH / 2;

  let w = 450;
  let h = 202;

  drawNote(
    cx - w / 2,
    cy - h / 2,
    w,
    h,
    color(250, 240, 210, 230),
    color(170, 130, 75, 110),
    radians(-0.7),
    1,
    true,
    true
  );

  noStroke();
  fill(82, 65, 42, 220);
  textAlign(CENTER, CENTER);

  fontFarBold(24);
  text("Close your eyes. Let the loop pause.", cx, cy - 44);

  fontFar(15);
  fill(82, 65, 42, 170);

  if (cam.eyesClosed) {
    text("Overweighted judgement is losing weight.", cx, cy + 5);
  } else if (cam.eyeBlocked) {
    text("The head angle is large. Return slightly to a natural angle.", cx, cy + 5);
  } else {
    text("Excessive cause-seeking is being slowed down.", cx, cy + 5);
  }

  drawCheck(
    cx - 13,
    cy + h / 2 - 42,
    26,
    visibleP,
    color(130, 105, 65),
    1
  );

  pop();
}

// Draw far-distance eye-closed card
function drawCalmCard() {
  let a = constrain(calmCardA, 0, 1);
  if (a <= 0.02) return;

  push();

  let p = constrain(calmMs / calmNeed, 0, 1);
  let visibleP = constrain(p * zoneSpeed, 0, 1);
  let t = millis() * 0.00038;

  let driftX =
    sin(t + calmPhase) * calmDriftX +
    sin(t * 0.53 + calmPhase * 1.7) * calmDriftX * 0.45;

  let driftY =
    cos(t * 0.8 + calmPhase) * calmDriftY +
    sin(t * 0.41 + calmPhase * 1.3) * calmDriftY * 0.5;

  let cx = ui.mainX + ui.mainW / 2 + driftX;
  let cy = ui.mainY + ui.mainH / 2 + driftY;

  let w = 438;
  let h = 174;

  drawNote(
    cx - w / 2,
    cy - h / 2,
    w,
    h,
    color(226, 236, 232, (128 + 82 * calmVis) * a),
    color(95, 130, 120, (78 + 72 * calmVis) * a),
    radians(sin(t * 2.0 + calmPhase) * 1.6),
    a,
    true,
    true
  );

  noStroke();
  fill(48, 74, 68, 210 * a);
  textAlign(CENTER, CENTER);

  fontFarBold(23);

  if (cam.eyesClosed) {
    text("Let judgement pause.", cx, cy - 39);
  } else if (cam.eyeBlocked) {
    text("Return slightly to a natural angle", cx, cy - 39);
  } else {
    text("Close your eyes. Let judgement pause.", cx, cy - 39);
  }

  fontFar(14);
  fill(48, 74, 68, 150 * a);

  if (cam.eyesClosed) {
    text("Old thoughts are losing weight.", cx, cy);
  } else if (cam.eyeBlocked) {
    text("When the head angle is large, eye-closed sensitivity is reduced.", cx, cy);
  } else {
    text("Stay at a far distance. Closing your eyes will create a pause.", cx, cy);
  }

  drawCheck(
    cx - 12,
    cy + h / 2 - 42,
    24,
    visibleP,
    color(70, 120, 105),
    a
  );

  pop();
}

// Draw distance zones
function drawZones() {
  let cards = zoneCards();

  for (let i = 0; i < zones.length; i++) {
    drawZone(zones[i], cards[i]);
  }
}

// Draw one distance zone
function drawZone(z, c) {
  let layerA = constrain(zoneA, 0, 1);
  if (layerA <= 0.02) return;

  push();

  let baseA = z.done ? 245 : 96 + z.progress * 128;
  let a = baseA * layerA;

  let rot = radians(sin(z.phase + frameCount * 0.006) * 1.9);

  drawNote(
    c.x,
    c.y,
    c.w,
    c.h,
    color(228, 244, 226, a),
    color(105, 150, 105, a * 0.55),
    rot,
    layerA,
    true,
    true
  );

  noStroke();
  fill(42, 78, 58, a);
  textAlign(CENTER, TOP);

  fontFarBold(18);

  let checkSize = 18;
  let labelY = c.y + 25;
  let labelW = textWidth(z.label);
  let checkX = c.x + c.w / 2 - labelW / 2 - checkSize - 9;
  let checkY = labelY - 1;

  let visibleP = z.done ? 1 : constrain(z.progress * zoneSpeed, 0, 1);

  drawCheck(
    checkX,
    checkY,
    checkSize,
    visibleP,
    color(42, 78, 58),
    layerA
  );

  drawFitText(
    z.label,
    c.x + 26,
    labelY - 2,
    c.w - 52,
    34,
    {
      maxSize: 18,
      minSize: 11,
      lineGap: 1.08,
      alignX: CENTER,
      alignY: TOP,
      maxLines: 2,
      ellipsis: true,
      fontKind: "distance"
    }
  );

  fontFar(13);
  fill(42, 78, 58, a * 0.84);

  if (z.done) {
    drawFitText(
      z.answer,
      c.x + 22,
      c.y + 62,
      c.w - 44,
      c.h - 74,
      {
        maxSize: 13,
        minSize: 10,
        lineGap: 1.22,
        alignX: CENTER,
        alignY: TOP,
        maxLines: 5,
        ellipsis: true,
        fontKind: "distance"
      }
    );
  }

  pop();
}

// Distance-zone positions
// The four areas avoid the centre and drift slowly,
// showing a wider field of attention after moving farther away.
function zoneCards() {
  let b = gazeBox();

  let cardW = min(300, b.w * 0.25);
  let cardH = min(150, b.h * 0.22);

  let cards = [];

  for (let i = 0; i < zones.length; i++) {
    let z = zones[i];

    if (z.nx === undefined) z.nx = 0.25 + i * 0.15;
    if (z.ny === undefined) z.ny = 0.35 + i * 0.08;
    if (z.phase === undefined) z.phase = random(TWO_PI);
    if (z.drift === undefined) z.drift = 34;

    let t = millis() * 0.00042;

    let driftX = z.drift;
    let driftY = z.drift * 0.72;

    let x =
      b.x +
      b.w * z.nx -
      cardW / 2 +
      sin(t + z.phase) * driftX +
      sin(t * 0.47 + z.phase * 1.7) * driftX * 0.42;

    let y =
      b.y +
      b.h * z.ny -
      cardH / 2 +
      cos(t * 0.82 + z.phase) * driftY +
      sin(t * 0.36 + z.phase * 2.1) * driftY * 0.36;

    x = constrain(x, b.x + 18, b.x + b.w - cardW - 18);
    y = constrain(y, b.y + 86, b.y + b.h - cardH - 90);

    cards.push({
      x: x,
      y: y,
      w: cardW,
      h: cardH
    });
  }

  return cards;
}

// Draw memory receding prompt
function drawRecedeCard() {
  push();

  let cx = ui.mainX + ui.mainW / 2;
  let cy = ui.mainY + ui.mainH / 2;

  for (let i = 0; i < 5; i++) {
    let s = i / 4;
    let w = lerp(260, 94, s);
    let h = lerp(150, 54, s);
    let yy = cy + lerp(32, -84, s);
    let a = lerp(46, 18, s);

    drawNote(
      cx - w / 2 + sin(i * 1.7) * 14,
      yy - h / 2,
      w,
      h,
      color(230, 240, 250, a),
      color(120, 150, 190, a * 0.8),
      radians(lerp(-3, 3, s)),
      0.75,
      i < 2,
      true
    );
  }

  drawNote(
    cx - 190,
    cy - 78,
    380,
    150,
    color(236, 244, 250, 225),
    color(120, 150, 190, 95),
    radians(-0.6),
    1,
    true,
    true
  );

  fill(54, 72, 92, 210);
  noStroke();
  textAlign(CENTER, CENTER);

  fontFarBold(25);
  text("Memory recedes", cx, cy - 18);

  fontFar(14);
  fill(54, 72, 92, 145);
  text("It still exists, but it has become lighter experience material.", cx, cy + 32);

  pop();
}

// Reserved echo layer
function drawEchoLayer() {
  return;
}

// Draw text-based gaze trace
// The trace is composed of words, turning where one has looked into visible thought marks.
function drawTrace() {
  if (!traces || traces.length < 2) return;

  push();

  noStroke();
  textAlign(CENTER, CENTER);

  let drawnD = 0;
  let lastX = traces[0].x;
  let lastY = traces[0].y;

  for (let i = 1; i < traces.length; i++) {
    let prev = traces[i - 1];
    let curr = traces[i];

    let dx = curr.x - prev.x;
    let dy = curr.y - prev.y;
    let segD = sqrt(dx * dx + dy * dy);

    if (segD < 2) continue;

    drawnD += dist(curr.x, curr.y, lastX, lastY);

    if (drawnD < traceGap) continue;

    drawnD = 0;
    lastX = curr.x;
    lastY = curr.y;

    let age = millis() - curr.born;
    let ageA = map(age, 0, 14500, 1, 0, true);
    let indexA = map(i, 0, traces.length - 1, 0.18, 1);
    let a = 92 * ageA * indexA;

    if (a < 3) continue;

    let traceMode = curr.mode;
    let col;

    if (traceMode === "close") {
      col = color(145, 55, 52, a);
    } else if (traceMode === "far") {
      col = color(70, 120, 90, a);
    } else {
      col = color(80, 75, 58, a);
    }

    fill(col);

    let angle = atan2(dy, dx) + (curr.rotOffset || 0);

    let sideX = cos(angle + HALF_PI) * (curr.sideOffset || 0);
    let sideY = sin(angle + HALF_PI) * (curr.sideOffset || 0);

    push();
    translate(curr.x + sideX, curr.y + sideY);
    rotate(angle);

    fontThought(curr.wordSize || 8.5);
    text(curr.word || "trace", 0, 0);

    pop();
  }

  pop();
}

// Generate trace word by current mode
function makeTraceWord(traceMode, traceFlow) {
  if (traceFlow === "ruminate") {
    let pool = [
      "why",
      "best",
      "again",
      "compare",
      "judge",
      "proof",
      "enough",
      "version",
      "cause",
      "myself"
    ];

    return pool[floor(random(pool.length))];
  }

  if (traceFlow === "follow") {
    let source = sourceWord(key.text || core);

    let pool = [
      source,
      "almost",
      "better",
      "reason",
      "compare",
      "heavier",
      "why",
      "detail",
      "doubt",
      "return"
    ];

    return pool[floor(random(pool.length))];
  }

  if (traceMode === "ordinary") {
    let pool = [
      "event",
      "detail",
      "draft",
      "note",
      "part",
      "matter",
      "adjust",
      "trace",
      "glance",
      "piece",
      "keep",
      "possible",
      "process",
      "material"
    ];

    return pool[floor(random(pool.length))];
  }

  if (traceMode === "close") {
    let source = sourceWord(key.text || core);

    let pool = [
      source,
      "why",
      "better",
      "proof",
      "judge",
      "narrow",
      "again",
      "heavier",
      "maximum",
      "self"
    ];

    return pool[floor(random(pool.length))];
  }

  if (traceMode === "far") {
    let pool = [
      "mechanism",
      "lighter",
      "pause",
      "background",
      "fact",
      "next",
      "uncertain",
      "release",
      "distance",
      "experience"
    ];

    return pool[floor(random(pool.length))];
  }

  return "trace";
}

// Convert fragment text into a short trace word
function sourceWord(value) {
  let t = cleanText(value || "")
    .replace(/[()，。！？、]/g, "")
    .trim()
    .toLowerCase();

  if (t.length === 0) return "detail";

  if (t.includes("work")) return "work";
  if (t.includes("note")) return "note";
  if (t.includes("sketch")) return "sketch";
  if (t.includes("draft")) return "draft";
  if (t.includes("version")) return "version";
  if (t.includes("revision") || t.includes("revise")) return "revise";
  if (t.includes("paragraph")) return "paragraph";
  if (t.includes("sentence")) return "sentence";
  if (t.includes("title")) return "title";
  if (t.includes("statement")) return "text";
  if (t.includes("folder") || t.includes("file")) return "file";
  if (t.includes("blank")) return "blank";
  if (t.includes("flaw") || t.includes("mistake")) return "flaw";
  if (t.includes("detail")) return "detail";
  if (t.includes("structure")) return "structure";
  if (t.includes("concept")) return "concept";
  if (t.includes("question")) return "question";
  if (t.includes("judgement") || t.includes("judgment")) return "judge";
  if (t.includes("compare")) return "compare";
  if (t.includes("trace")) return "trace";
  if (t.includes("edge") || t.includes("margin")) return "margin";
  if (t.includes("image")) return "image";
  if (t.includes("light") || t.includes("glow")) return "light";
  if (t.includes("rhythm")) return "rhythm";
  if (t.includes("choice")) return "choice";
  if (t.includes("potential")) return "potential";
  if (t.includes("intuition")) return "intuition";

  let words = t.split(/\s+/).filter(Boolean);

  for (let word of words) {
    let cleaned = word.replace(/[^a-z]/g, "");

    if (cleaned.length >= 4) {
      return cleaned.slice(0, 12);
    }
  }

  let fallback = [
    "draft",
    "note",
    "work",
    "version",
    "trace"
  ];

  return fallback[floor(random(fallback.length))];
}

// Draw cursor
function drawGazeDot() {
  if (!isFinite(gaze.x) || !isFinite(gaze.y)) {
    let b = gazeBox();

    gaze.x = b.x + b.w / 2;
    gaze.y = b.y + b.h / 2;
  }

  push();

  let a = cam.hasFace ? 1 : 0.42;

  drawCursor(gaze.x, gaze.y, modeCol(mode, 230), a);

  if (head0.calibrating) {
    fill(80, 65, 45, 135);
    textAlign(CENTER, TOP);
    fontMem(12);
    text("Calibrating", gaze.x, gaze.y + 28);
  }

  if (!cam.hasFace) {
    fill(80, 65, 45, 105);
    textAlign(CENTER, TOP);
    fontMem(11);
    text("Waiting for detection", gaze.x, gaze.y + 18);
  }

  pop();
}

// Bottom mode bar
function drawModeBar() {
  let x = ui.modeX;
  let y = ui.modeY;
  let w = ui.modeW;
  let h = ui.modeH;

  push();

  drawNote(
    x,
    y,
    w,
    h,
    color(255, 248, 226, 146),
    color(170, 145, 105, 48),
    radians(0.08),
    1,
    false,
    false
  );

  let gap = 12;
  let leftW = 205;
  let cardW = (w - leftW - gap * 3 - 18) / 3;
  let cardH = 28;
  let x0 = x + leftW + gap;
  let cy = y + h / 2;

  fill(ink(135));
  noStroke();
  textAlign(LEFT, CENTER);
  fontMem(11);

  let eyeStatus = "Press C to reset the current front-facing position";

  if (head0.calibrating) {
    eyeStatus = "Calibrating";
  } else if (cam.eyeBlocked && mode === "far") {
    eyeStatus = "Head angle too large";
  }

  drawFitText(
    eyeStatus,
    x + 14,
    y + 7,
    leftW - 20,
    h - 14,
    {
      maxSize: 11,
      minSize: 9,
      lineGap: 1.05,
      alignX: LEFT,
      alignY: CENTER,
      maxLines: 2,
      ellipsis: true,
      fontKind: "memory"
    }
  );

  drawModeTag(
    "ordinary",
    "Present",
    "fragments settle into order",
    x0,
    cy - cardH / 2,
    cardW,
    cardH
  );

  drawModeTag(
    "close",
    "Entangled",
    "echoes begin to split",
    x0 + cardW + gap,
    cy - cardH / 2,
    cardW,
    cardH
  );

  drawModeTag(
    "far",
    "Withdrawn",
    "noise is gently released",
    x0 + (cardW + gap) * 2,
    cy - cardH / 2,
    cardW,
    cardH
  );

  pop();
}

// Single mode tag
function drawModeTag(cardMode, label, sub, x, y, w, h) {
  let active = mode === cardMode;

  push();

  let base = modeCol(cardMode, 210);

  let paper = active
    ? color(red(base), green(base), blue(base), 210)
    : color(255, 250, 235, 122);

  let border = active
    ? modeCol(cardMode, 220)
    : color(165, 140, 105, 58);

  let rot = cardMode === "ordinary"
    ? radians(-0.45)
    : cardMode === "close"
      ? radians(0.55)
      : radians(-0.2);

  drawNote(
    x,
    y,
    w,
    h,
    paper,
    border,
    rot,
    1,
    false,
    true
  );

  noStroke();
  fill(active ? color(255, 250, 236, 245) : color(75, 60, 44, 138));
  textAlign(CENTER, CENTER);

  if (cardMode === "close") {
    fontSysBold(11);
  } else if (cardMode === "far") {
    fontFarBold(11);
  } else {
    fontMemBold(11);
  }

  drawFitText(
    label + ": " + sub,
    x + 8,
    y + 4,
    w - 16,
    h - 8,
    {
      maxSize: 11,
      minSize: 8,
      lineGap: 1.04,
      alignX: CENTER,
      alignY: CENTER,
      maxLines: 2,
      ellipsis: true,
      fontKind: cardMode === "close" ? "system" : cardMode === "far" ? "distance" : "memory"
    }
  );

  pop();
}

// Start receding animation
function startRecedeAnim() {
  if (receding) return;

  receding = true;
  memClosed = false;
  recedeP = 0;
  recedeStart = frameCount;

  echoText = "";
  noteText = "This memory is receding into the background.";

  addRecord("Memory begins to recede into the background.");
}

// Update receding animation
function updateRecedeAnim() {
  let elapsed = frameCount - recedeStart;
  recedeP = constrain(elapsed / 620, 0, 1);

  if (recedeP >= 1) {
    finishRecede();
  }
}

// Finish receding and archive
function finishRecede() {
  receding = false;
  memClosed = false;
  recedeP = 0;

  let oldMem = core || key.text || "a memory that has become lighter";

  archive.push({
    text: oldMem,
    cycle: cycle,
    born: millis()
  });

  if (archive.length > 5) {
    archive.shift();
  }

  records.push({
    flow: "recede",
    text: "The previous old note becomes background experience. A new round of attention begins.",
    tone: "recede",
    born: millis()
  });

  if (records.length > 64) {
    records.shift();
  }

  cycle++;

  resetCycle();
}

// Reset into a new cycle
function resetCycle() {
  flow = "collect";

  echoText = "";
  noteText = "The previous memory has receded into the background. Keep a normal distance, and new attention will continue.";

  frags = [];
  focusFrag = null;
  core = "";

  key = {
    text: "",
    x: 0,
    y: 0,
    vx: 0.72,
    vy: 0.48,
    followMs: 0,
    lastSplitMs: 0
  };

  splits = [];
  vers = [];

  optCounts = {
    again: 0,
    angle: 0,
    stop: 0
  };

  activeOpt = "";
  lastOpt = "";
  optStartMs = 0;
  loopStartMs = 0;
  loopReady = false;
  loopHintA = 0;

  pauseMs = 0;
  pauseDone = false;

  calmMs = 0;
  calmVis = 0;
  calmDone = false;
  calmEndMs = 0;
  calmCardA = 0;

  zoneA = 0;
  calmPhase = random(TWO_PI);

  resetZones();
  zonesDoneAt = 0;

  ghosts = [];
  traces = [];

  loopHeat = 0;
  lastFragMs = millis();
}

// Draw receding animation scene
function drawRecedeScene() {
  let p = easeInOut(recedeP);

  background(lerp(229, 218, p), lerp(235, 228, p), lerp(241, 235, p));
  drawGrain();

  push();

  let cx = width / 2;
  let cy = lerp(height * 0.50, height * 0.35, p);

  for (let i = 0; i < 6; i++) {
    let s = i / 5;
    let w = lerp(width * 0.46, 34, p) * lerp(1, 0.42, s);
    let h = lerp(height * 0.25, 24, p) * lerp(1, 0.44, s);
    let ox = sin(i * 1.6 + p * 4) * lerp(18, 4, p);
    let oy = lerp(i * 12, -i * 4, p);
    let a = lerp(128, 18, p) * lerp(1, 0.35, s);

    drawNote(
      cx - w / 2 + ox,
      cy - h / 2 + oy,
      w,
      h,
      color(245, 240, 225, a),
      color(120, 150, 190, a * 0.7),
      radians(lerp(-3, 3, s) + sin(p * 3 + i) * 0.8),
      0.9,
      i < 2,
      true
    );
  }

  let mainW = lerp(width * 0.56, 28, p);
  let mainH = lerp(height * 0.26, 24, p);

  drawNote(
    cx - mainW / 2,
    cy - mainH / 2,
    mainW,
    mainH,
    color(245, 240, 225, lerp(205, 36, p)),
    color(120, 150, 190, lerp(96, 24, p)),
    radians(lerp(-0.8, 2.2, p)),
    1,
    p < 0.82,
    true
  );

  fill(54, 72, 92, lerp(235, 80, p));
  textAlign(CENTER, CENTER);
  fontFarBold(24);
  text("Memory is receding into the background", cx, cy - lerp(38, 8, p));

  fill(70, 86, 105, lerp(130, 40, p));
  fontFar(13);
  text("It does not disappear; it changes from judgement into experience.", cx, cy + lerp(34, 8, p));

  if (p > 0.48) {
    let dotP = map(p, 0.48, 1, 0, 1);

    drawNote(
      cx - lerp(18, 7, dotP) / 2,
      height * 0.34 - lerp(18, 7, dotP) / 2,
      lerp(18, 7, dotP),
      lerp(18, 7, dotP),
      color(210, 225, 240, 120 * dotP),
      color(120, 155, 190, 90 * dotP),
      radians(12),
      dotP,
      false,
      true
    );
  }

  pop();
}

// Ease-in-out animation
function easeInOut(t) {
  if (t < 0.5) return 4 * t * t * t;
  return 1 - pow(-2 * t + 2, 3) / 2;
}

// Add record
function addRecord(textValue) {
  let clean = cleanText(textValue);
  let line = makeRecord(clean, flow);

  records.push({
    flow: flow,
    text: line,
    tone: recordTone(flow),
    born: millis()
  });

  if (records.length > 64) {
    records.shift();
  }
}

// Generate record text by flow
// This function was modified with the assistance of ChatGPT 
function makeRecord(value, flowName) {
  let source = String(value || "").trim();

  source = source
    .replace(/^Attention leaves a fragment:\s*/, "")
    .replace(/^The fragment is arranged into an event description:\s*/, "")
    .replace(/^A keyword is pushed to the foreground:\s*/, "")
    .replace(/^The rumination loop begins\./, "")
    .replace(/^After moving farther away, the loop slows down\./, "")
    .replace(/^Moved farther away with eyes closed\. Old fragments begin to fade\./, "")
    .replace(/^In far mode, the eye-closed pause prompt appears again\./, "")
    .replace(/^The weight of old fragments is reduced, and blank space returns to the page\./, "")
    .replace(/^After moving farther away, the memory is redistributed\./, "")
    .replace(/^All four areas are complete\. Memory begins to find an exit\./, "")
    .replace(/^Memory recedes into the background\./, "")
    .replace(/^Memory begins to recede into the background\./, "")
    .trim();

  let d = core || key.text || source || "a detail in an old work";

  if (flowName === "collect") {
    let pool = [
      "A piece of old material surfaces, not yet becoming an explanation.",
      "The old work shows a small edge.",
      source + " is seen, but it does not ask for a conclusion yet.",
      "A sentence from the note returns to the page.",
      "An old version leaves a trace.",
      "Attention passes across the page, leaving only a part that can be observed.",
      "The old note opens slightly.",
      source + " feels like material, still light for now.",
      "An effective attempt appears from an old version.",
      "A part of the old work can still be understood further.",
      "A past choice becomes visible again.",
      "A small clue appears on the page.",
      "An old sketch rises, not yet classified.",
      "A detail stays at the edge and does not need an explanation yet.",
      "The page keeps a slight trace, as if it has just been touched.",
      "An old judgement loosens slightly.",
      "Past material reveals its outline before being pressed into conclusion.",
      "An unfinished part is seen again.",
      "The old note does not answer. It only opens a narrow gap.",
      "A small problem appears, but it is still light.",
      "The gaze passes over old material and leaves a temporary coordinate.",
      "The old work shows a little breath again.",
      "A neglected part slowly surfaces.",
      "The material stays first, and meaning is not fixed yet."
    ];

    return pickRecord(pool);
  }

  if (flowName === "expand") {
    let pool = [
      "A fragment is placed back into the whole, and the old work gently takes shape.",
      "One piece of old material connects with another.",
      d + " is no longer isolated. It returns inside the work.",
      "The old note is gently assembled, leaving an entrance.",
      "This part does not become evaluation; it becomes a line of evidence.",
      "The work shows layers again, not only one problem.",
      "The fragment steps back slightly, and the process becomes visible.",
      d + " is placed again, and the old work becomes lighter because of it.",
      "The event is not fully explained. It only shows an outline again.",
      "Old material moves closer together, like a slow act of arranging.",
      "A local part connects back to the whole, and judgement does not expand for now.",
      "Past choices are placed back into the process of that time.",
      "The old work no longer leaves only problems; it also shows earlier attempts.",
      "A fragment becomes an event line rather than a conclusion about the self.",
      "Materials on the page begin to lean toward each other.",
      "The seen part is not enlarged. It is only gently arranged.",
      "Scattered clues in the old note move close again.",
      "A local problem returns inside the work.",
      "An event outline appears, but it still keeps blank space.",
      "This act of looking back arranges facts first, without rushing toward causes.",
      "Relations appear between materials, and weight does not keep increasing.",
      "The old work feels unfolded again, and layers slowly appear."
    ];

    return pickRecord(pool);
  }

  if (flowName === "follow") {
    let pool = [
      d + " is pushed to the foreground, and reasonable reflection begins to become heavy.",
      "A specific part starts to look like core evidence for the whole work.",
      "Attention still looks as if it is trying to understand, but it has begun to ask why.",
      d + " catches old versions, and comparison slowly multiplies.",
      "A local problem brightens, while other materials move to the edge.",
      "A revisable detail begins to approach self-evaluation.",
      "The problem in the old note keeps growing, as if searching for the only correct version.",
      "Reflection has not broken, but it is no longer light.",
      d + " changes from material into a standard, asking for a better self.",
      "It could once be adjusted, but now it seems to prove what was not enough.",
      "A maximised version approaches this detail, making other possibilities dimmer.",
      "Attention begins to believe: if this part is not good enough, the whole thing is not good enough.",
      "One local part is lifted forward, and the rest of the work temporarily loses its voice.",
      "The thought of reasonable revision remains, but it begins to hurry.",
      "The detail has not disappeared, yet it begins to occupy too much space.",
      "A workable problem slowly becomes a cause that must be fully explained.",
      "After comparison increases, even the effective parts become uncertain.",
      "The old version opens again, as if looking for a missed best answer.",
      "The closer attention moves, the less it feels like a problem, and the more it feels like evidence.",
      "One detail begins to pull at the value of the whole work.",
      "Reflection still has a shape, but its direction bends toward self-judgement.",
      "This material becomes heavy, as if it must speak for the whole work."
    ];

    return pickRecord(pool);
  }

  if (flowName === "ruminate") {
    let pool = [
      "The same detail changes wording, but does not leave the centre.",
      "A new version is added, and the maximised standard is added with it.",
      d + " is lit again, as if it still needs to prove what was not enough.",
      "Even stopping revision is written as a new self-evaluation.",
      "Reflection does not move forward. It stays in the same place, asking for causes.",
      "The work is compressed into a local part, and the local part is misread as the self.",
      "The old note begins to ask why, instead of what can be done next.",
      "Version comparison keeps increasing, but it does not make the problem more concrete.",
      "Each new angle produces a standard that is harder to reach.",
      d + " is no longer only a work problem. It starts to become an explanation of me.",
      "Reasonable reflection keeps its outer shape, but inside it becomes repeated judgement.",
      "Attention keeps returning to the same place, as if the only answer is hidden there.",
      "The more it searches for a cause, the more it seems to prove that I was not enough then.",
      "Old versions are arranged as evidence, rather than being seen as process.",
      "The same question becomes louder, while other materials are pushed away.",
      "Versions continue to generate, but the exit does not come closer.",
      "Each look again presses the local part back into the centre.",
      "The thought of stopping is also taken back by the loop.",
      "The finer the cause-seeking becomes, the blurrier the event itself becomes.",
      "Comparison does not bring clarity. It only brings a higher standard.",
      "The old work is forced to answer an oversized question.",
      "The detail keeps multiplying, as if searching for material for self-evaluation.",
      "A small problem is turned over again and again, until it seems like the conclusion of the whole thing.",
      "Attention does not leave. It only writes another sentence around the same place."
    ];

    return pickRecord(pool);
  }

  if (flowName === "pause" || flowName === "calm") {
    let pool = [
      "The loop slows down, and the voice of cause-seeking lowers.",
      "The page becomes quiet for a moment.",
      "The enlarged detail begins to lose weight.",
      "The old work has not disappeared. It simply stops being judged further.",
      "Some comparisons step back, and blank space returns.",
      "The old note fades, as if placed on a farther paper layer.",
      "Attention steps back, and the work regains its edge.",
      "The place looked at for too long no longer asks for an answer immediately.",
      "Self-evaluation pauses, and facts and feelings separate again.",
      "Excessive cause-seeking becomes lighter, and the event itself slowly appears.",
      "Attention no longer keeps enlarging the local part.",
      "After judgement slows down, the work becomes material that can be looked at again.",
      "The voices of old versions lower, and the page gains a little blank space.",
      "Comparison pauses, and materials recover their distance.",
      "The part pressed too heavily begins to loosen.",
      "After the eyes close, the problem stops generating new versions.",
      "Old thoughts step back one layer, and breath returns to the page.",
      "The detail remains, but it no longer demands explanation immediately.",
      "A tense judgement is temporarily set aside.",
      "Attention steps out of proving and returns first to quiet.",
      "Old material begins to lose noise, leaving a lighter outline.",
      "The loop is not erased. It is only slowed down."
    ];

    return pickRecord(pool);
  }

  if (flowName === "redistribute") {
    let pool = [
      "Attention turns toward the mechanism behind it.",
      d + " returns to being part of a creative process.",
      "Self-evaluation is made less certain, leaving only an observable thought.",
      "Fact, feeling, and next step are separated.",
      "The page places the overweighted detail back to the side.",
      "The old note no longer only asks for causes. It also leaves a next step.",
      "The work becomes multiple parts again.",
      d + " still exists, but it no longer explains everything.",
      "What was enlarged was not the fact itself, but the way it was processed.",
      "A self-judgement is taken apart.",
      "Reflection becomes a concrete action again, rather than endless comparison.",
      "Old material is redistributed in weight, and the good parts become visible again.",
      "The problem returns inside the work.",
      "Fact returns to fact, and feeling returns to feeling.",
      "Old versions no longer compete with each other. They remain as process.",
      "An overweighted judgement is broken into several smaller problems.",
      "The next step becomes concrete again.",
      "The work is no longer represented by one single detail.",
      "The weight inside memory is placed again.",
      "The revisable part remains, and the uncertain part is moved farther away for now.",
      "The old note is rearranged into material that can be worked with again.",
      "Attention turns from self-explanation toward the mechanism of making.",
      "The problem is not deleted. It returns to a more suitable position.",
      "Event, emotion, and judgement begin to separate."
    ];

    return pickRecord(pool);
  }

  if (flowName === "recede" || flowName === "closed") {
    let pool = [
      "The old work remains, but it has receded into the background.",
      "It leaves a trace, no longer occupying the current gaze.",
      "The page keeps its shadow, and also keeps a little distance.",
      "This creative memory becomes lighter, as if placed farther away.",
      "It is not erased. It simply stops glowing.",
      "The previous old note becomes background experience. A new round of attention begins.",
      "Looking back ends for now, and the work can stay as experience.",
      "It becomes an experience, not a conclusion that still needs proving.",
      "After memory recedes, new material can still appear.",
      "The old version remains far away, no longer asking to be solved immediately.",
      "This act of looking back is saved as experience, and attention keeps moving forward.",
      "It no longer presses on the page, leaving only a light background layer.",
      "Old material is set down, but not denied.",
      "One experience stays behind, and a new gaze begins again.",
      "The work still exists, but it no longer reaches a conclusion about the self.",
      "Old memory enters a deeper paper layer, and the page widens again.",
      "This looking back ends in a lighter place.",
      "It becomes experience that can be carried, not proof that must be solved.",
      "The old note closes slightly, and new blank space appears.",
      "Memory is saved as background, no longer occupying the centre.",
      "The previous round of attention steps back, and the next round begins to move.",
      "It is still far away, but it no longer pulls at the present."
    ];

    return pickRecord(pool);
  }

  return source || "The page keeps a small trace.";
}

// Get recent records
function buildRecords() {
  return records.slice(-8).map(item => {
    return {
      text: item.text,
      tone: item.tone
    };
  });
}

// Classify record tone
function recordTone(flowName) {
  if (flowName === "collect" || flowName === "expand") return "organise";
  if (flowName === "follow" || flowName === "ruminate") return "loop";
  if (flowName === "pause" || flowName === "calm") return "pause";
  if (flowName === "redistribute") return "redistribute";
  if (flowName === "recede" || flowName === "closed") return "recede";

  return "neutral";
}

// Check whether keyword is being followed
function isFollowingKey() {
  if (flow !== "follow") return false;
  if (mode !== "close") return false;
  if (!key || !key.text) return false;

  let d = dist(gaze.x, gaze.y, key.x, key.y);
  return d < keyRad;
}

// Clean text spacing
function cleanText(value) {
  if (!value) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

// Draw one truncated line
function drawOneLine(content, x, y, w) {
  if (!content) return;

  let original = String(content).replace(/\n/g, " ");
  let t = original;

  while (textWidth(t) > w && t.length > 1) {
    t = t.slice(0, -1);
  }

  if (t !== original && t.length > 3) {
    t = t.slice(0, -3) + "...";
  }

  text(t, x, y);
}

// Adaptive text box
function drawFitText(content, x, y, w, h, opt = {}) {
  if (!content) return;

  let maxSize = opt.maxSize || 13;
  let minSize = opt.minSize || 10;
  let lineGap = opt.lineGap || 1.22;
  let alignX = opt.alignX === undefined ? LEFT : opt.alignX;
  let alignY = opt.alignY === undefined ? TOP : opt.alignY;
  let maxLinesLimit = opt.maxLines || 8;
  let useEllipsis = opt.ellipsis === undefined ? true : opt.ellipsis;
  let fontKind = opt.fontKind || "auto";

  let finalSize = minSize;
  let finalLines = [];

  for (let s = maxSize; s >= minSize; s -= 0.4) {
    setBoxFont(fontKind, s);

    let lineH = s * lineGap;
    let maxLinesByHeight = max(1, floor(h / lineH));
    let maxLines = min(maxLinesLimit, maxLinesByHeight);
    let lines = wrapText(content, w, maxLines, useEllipsis);

    if (lines.length * lineH <= h + 0.5) {
      finalSize = s;
      finalLines = lines;
      break;
    }
  }

  setBoxFont(fontKind, finalSize);

  let finalLineH = finalSize * lineGap;
  let maxLinesByHeight = max(1, floor(h / finalLineH));
  let maxLines = min(maxLinesLimit, maxLinesByHeight);

  if (finalLines.length === 0) {
    finalLines = wrapText(content, w, maxLines, useEllipsis);
  }

  let totalH = finalLines.length * finalLineH;
  let startY = y;

  if (alignY === CENTER) {
    startY = y + h / 2 - totalH / 2 + finalLineH * 0.08;
  } else if (alignY === BOTTOM) {
    startY = y + h - totalH;
  }

  textAlign(alignX, TOP);

  for (let i = 0; i < finalLines.length; i++) {
    let tx = x;

    if (alignX === CENTER) {
      tx = x + w / 2;
    } else if (alignX === RIGHT) {
      tx = x + w;
    }

    text(finalLines[i], tx, startY + i * finalLineH);
  }
}

// Set text-box font
function setBoxFont(kind, size) {
  if (kind === "system") {
    fontSys(size);
  } else if (kind === "distance") {
    fontFar(size);
  } else if (kind === "thought") {
    fontThought(size);
  } else if (kind === "memory") {
    fontMem(size);
  } else {
    bodyFont(size);
  }
}

// English word wrapping
// This function was modified with the assistance of ChatGPT 
function wrapText(content, maxW, maxLines, useEllipsis) {
  let source = String(content)
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

  let rawLines = source.split("\n");
  let lines = [];

  for (let r = 0; r < rawLines.length; r++) {
    let textValue = rawLines[r].trim();

    if (textValue.length === 0) continue;

    let words = textValue.split(/\s+/);
    let current = "";

    for (let i = 0; i < words.length; i++) {
      let word = words[i];
      let test = current.length === 0 ? word : current + " " + word;

      if (textWidth(test) <= maxW || current.length === 0) {
        if (textWidth(test) <= maxW) {
          current = test;
        } else {
          let pieces = breakLongWord(word, maxW);

          for (let j = 0; j < pieces.length; j++) {
            if (current.length > 0) {
              lines.push(current);
              current = "";
            }

            if (j < pieces.length - 1) {
              lines.push(pieces[j]);
            } else {
              current = pieces[j];
            }

            if (lines.length >= maxLines) break;
          }
        }
      } else {
        lines.push(current);
        current = word;
      }

      if (lines.length >= maxLines) break;
    }

    if (lines.length >= maxLines) break;

    if (current.length > 0) {
      lines.push(current);
    }

    if (lines.length >= maxLines) break;
  }

  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
  }

  if (useEllipsis) {
    let flatLines = lines.join(" ").replace(/\s+/g, " ").trim();
    let flatSource = source.replace(/\s+/g, " ").trim();

    if (flatLines.length < flatSource.length && lines.length > 0) {
      lines[lines.length - 1] = trimTextLine(lines[lines.length - 1], maxW);
    }
  }

  return lines;
}

// Break overlong words
function breakLongWord(word, maxW) {
  let pieces = [];
  let current = "";

  for (let i = 0; i < word.length; i++) {
    let ch = word[i];
    let test = current + ch;

    if (textWidth(test) <= maxW || current.length === 0) {
      current = test;
    } else {
      pieces.push(current);
      current = ch;
    }
  }

  if (current.length > 0) {
    pieces.push(current);
  }

  return pieces;
}

// Add ellipsis to final line
function trimTextLine(line, maxW) {
  let t = String(line || "");

  while (textWidth(t + "...") > maxW && t.length > 0) {
    t = t.slice(0, -1);
  }

  return t + "...";
}

// Support different FaceMesh data structures
function getKps(face) {
  if (face.keypoints) return face.keypoints;

  if (face.scaledMesh) {
    return face.scaledMesh.map(p => {
      return {
        x: p[0],
        y: p[1],
        z: p[2] || 0
      };
    });
  }

  if (face.landmarks) return face.landmarks;

  return [];
}

// Calculate face bounding box
function getFaceBox(kps) {
  let minX = 99999;
  let minY = 99999;
  let maxX = -99999;
  let maxY = -99999;

  for (let p of kps) {
    minX = min(minX, p.x);
    minY = min(minY, p.y);
    maxX = max(maxX, p.x);
    maxY = max(maxY, p.y);
  }

  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY
  };
}

// Calculate centre of multiple points
function avgPts(kps, ids) {
  let x = 0;
  let y = 0;
  let count = 0;

  for (let id of ids) {
    if (!kps[id]) continue;

    x += kps[id].x;
    y += kps[id].y;
    count++;
  }

  if (count === 0) {
    return {
      x: camW / 2,
      y: camH / 2
    };
  }

  return {
    x: x / count,
    y: y / count
  };
}

// Read iris correction
function getIris(kps, leftEyeMid, rightEyeMid) {
  if (!kps[468] || !kps[473]) {
    return {
      x: 0,
      y: 0
    };
  }

  let leftIris = avgPts(kps, [468, 469, 470, 471, 472]);
  let rightIris = avgPts(kps, [473, 474, 475, 476, 477]);

  let leftEyeW = ptDist(kps[33], kps[133]);
  let rightEyeW = ptDist(kps[362], kps[263]);

  let leftEyeH = max(1, leftEyeW * 0.45);
  let rightEyeH = max(1, rightEyeW * 0.45);

  let lx = (leftIris.x - leftEyeMid.x) / max(1, leftEyeW);
  let ly = (leftIris.y - leftEyeMid.y) / leftEyeH;

  let rx = (rightIris.x - rightEyeMid.x) / max(1, rightEyeW);
  let ry = (rightIris.y - rightEyeMid.y) / rightEyeH;

  return {
    x: constrain((lx + rx) / 2, -0.5, 0.5),
    y: constrain((ly + ry) / 2, -0.5, 0.5)
  };
}

// Calculate eye openness ratio
function eyeOpen(kps, ids) {
  let p1 = kps[ids[0]];
  let p2 = kps[ids[1]];
  let p3 = kps[ids[2]];
  let p4 = kps[ids[3]];
  let p5 = kps[ids[4]];
  let p6 = kps[ids[5]];

  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) {
    return 1;
  }

  let v1 = ptDist(p2, p6);
  let v2 = ptDist(p3, p5);
  let h = ptDist(p1, p4);

  if (h === 0) return 1;

  return (v1 + v2) / (2 * h);
}

// Distance between two points
function ptDist(a, b) {
  if (!a || !b) return 0;
  return dist(a.x, a.y, b.x, b.y);
}

// Rectangle hit test
function inRect(px, py, x, y, w, h) {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}