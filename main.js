import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";

const coinsEl = document.querySelector("#coins");
const dayEl = document.querySelector("#day");
const weatherEl = document.querySelector("#weather");
const overlay = document.querySelector("#overlay");
const desktopButton = document.querySelector("#playDesktop");
const vrButton = document.querySelector("#enterVr");
const xrMessage = document.querySelector("#xrMessage");
const toolbar = document.querySelector("#toolbar");
const seedSelect = document.querySelector("#seedSelect");
const shopPanel = document.querySelector("#shopPanel");
const shopItemsEl = document.querySelector("#shopItems");
const closeShop = document.querySelector("#closeShop");
const toastEl = document.querySelector("#toast");

const crops = {
  carrot: { label: "Carrot", buy: 3, sell: 8, grow: 28, color: 0xf36f2d, leaf: 0x4f9c45 },
  wheat: { label: "Wheat", buy: 2, sell: 6, grow: 22, color: 0xe8c24e, leaf: 0xc6a83a },
  tomato: { label: "Tomato", buy: 5, sell: 13, grow: 36, color: 0xd83535, leaf: 0x3b8d42 },
  potato: { label: "Potato", buy: 4, sell: 10, grow: 32, color: 0xb98952, leaf: 0x5d9448 },
  pumpkin: { label: "Pumpkin", buy: 8, sell: 22, grow: 48, color: 0xf08a24, leaf: 0x477f34 }
};

const state = {
  coins: 32,
  day: 1,
  weather: "Clear",
  tool: "hoe",
  selectedSeed: "carrot",
  running: false,
  moveSpeed: 1.7,
  growthBoost: 1,
  seedBonus: 0,
  nextWeatherAt: 35,
  weatherUntil: 0,
  lastDayTick: 0,
  activeSlot: 0,
  aButtonWasDown: false,
  inventory: {
    carrot: 4,
    wheat: 0,
    tomato: 0,
    potato: 0,
    pumpkin: 0
  },
  upgrades: {
    boots: 0,
    compost: 0,
    basket: 0
  }
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87bfe8);
scene.fog = new THREE.FogExp2(0x9fd0ec, 0.018);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 180);
const rig = new THREE.Group();
rig.position.set(0, 0, 7);
camera.position.set(0, 1.62, 0);
rig.add(camera);
scene.add(rig);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const keys = new Set();
const interactables = [];
const plotMeshes = [];
const plots = [];
const rainDrops = [];
const tempObjects = [];
const inventorySlots = [
  { type: "tool", key: "hoe", label: "Hoe" },
  { type: "tool", key: "harvest", label: "Harvest" },
  { type: "seed", key: "carrot", label: "Carrot" },
  { type: "seed", key: "wheat", label: "Wheat" },
  { type: "seed", key: "tomato", label: "Tomato" },
  { type: "seed", key: "potato", label: "Potato" },
  { type: "seed", key: "pumpkin", label: "Pumpkin" },
  { type: "shop", key: "shop", label: "Shop" },
  { type: "empty", key: "empty1", label: "Empty" },
  { type: "empty", key: "empty2", label: "Empty" }
];
const wristSlotViews = [];
let controller;
let controllerGrip;
let wristInventory;
let audioStarted = false;
let audioContext;
let toastTimer = 0;

const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x74a957, roughness: 0.9 });
const untilledMaterial = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.92 });
const tilledMaterial = new THREE.MeshStandardMaterial({ color: 0x5f3922, roughness: 0.96 });
const readyMaterial = new THREE.MeshStandardMaterial({ color: 0xffef9e, roughness: 0.65, emissive: 0x332700, emissiveIntensity: 0.18 });
const hoverMaterial = new THREE.MeshStandardMaterial({ color: 0xe8d08a, roughness: 0.72 });

setupLights();
createWorld();
createFarmPlots();
createShopStand();
createRain();
createReticle();
buildShop();
updateHud();

desktopButton.addEventListener("click", () => startGame("Desktop"));
vrButton.addEventListener("click", enterVr);
renderer.domElement.addEventListener("pointermove", setPointer);
renderer.domElement.addEventListener("pointerdown", () => {
  startGame("Desktop");
  raycaster.setFromCamera(pointer, camera);
  interactWithRay();
});
toolbar.addEventListener("click", chooseTool);
seedSelect.addEventListener("change", () => {
  state.selectedSeed = seedSelect.value;
  showToast(`${crops[state.selectedSeed].label} seeds selected`);
});
closeShop.addEventListener("click", () => shopPanel.classList.remove("is-open"));
window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "Digit1") setTool("hoe");
  if (event.code === "Digit2") setTool("seed");
  if (event.code === "Digit3") setTool("harvest");
  if (event.code === "Digit4") toggleShop();
});
window.addEventListener("keyup", (event) => keys.delete(event.code));

if ("xr" in navigator) {
  navigator.xr.isSessionSupported("immersive-vr").then((supported) => {
    vrButton.disabled = !supported;
    xrMessage.textContent = supported
      ? "VR is ready. Trigger interacts; thumbstick moves smoothly."
      : "This browser or device does not report immersive VR support.";
  });
} else {
  vrButton.disabled = true;
  xrMessage.textContent = "WebXR is not available in this browser.";
}

renderer.setAnimationLoop(render);

function setupLights() {
  scene.add(new THREE.HemisphereLight(0xdff4ff, 0x57753d, 2.4));

  const sun = new THREE.DirectionalLight(0xfff3c2, 3.1);
  sun.position.set(-6, 10, 4);
  scene.add(sun);

  const soft = new THREE.PointLight(0xfff4ad, 20, 22);
  soft.position.set(2, 3, 2);
  scene.add(soft);
}

function createWorld() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 28),
    new THREE.MeshStandardMaterial({ color: 0xc5a276, roughness: 0.95 })
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(5.6, 0.006, 0);
  scene.add(path);

  createFence();
  createTrees();
  createBarn();
  createToolModel();
}

function createFence() {
  const postMaterial = new THREE.MeshStandardMaterial({ color: 0xd7b173, roughness: 0.8 });
  const railMaterial = new THREE.MeshStandardMaterial({ color: 0xc99a5e, roughness: 0.82 });
  const postGeometry = new THREE.BoxGeometry(0.18, 0.75, 0.18);
  const railGeometry = new THREE.BoxGeometry(2.1, 0.12, 0.12);

  for (let side = -1; side <= 1; side += 2) {
    for (let i = -8; i <= 8; i += 1) {
      const post = new THREE.Mesh(postGeometry, postMaterial);
      post.position.set(i * 1.8, 0.38, side * 12);
      scene.add(post);
      if (i < 8) {
        const rail = new THREE.Mesh(railGeometry, railMaterial);
        rail.position.set(i * 1.8 + 0.9, 0.55, side * 12);
        scene.add(rail);
      }
    }
  }
}

function createTrees() {
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x7a5131, roughness: 0.9 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x3d8b45, roughness: 0.78 });
  const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.22, 1.45, 10);
  const leafGeometry = new THREE.ConeGeometry(0.92, 1.8, 9);

  const positions = [
    [-11, -8],
    [-13, 5],
    [11, -7],
    [13, 7],
    [-6, 12],
    [10, 11]
  ];

  positions.forEach(([x, z], index) => {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 0.72;
    const leaves = new THREE.Mesh(leafGeometry, leafMaterial);
    leaves.position.y = 2.1;
    leaves.rotation.y = index * 0.4;
    tree.add(trunk, leaves);
    tree.position.set(x, 0, z);
    scene.add(tree);
  });
}

function createBarn() {
  const barn = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 2.4, 3),
    new THREE.MeshStandardMaterial({ color: 0xb64836, roughness: 0.76 })
  );
  body.position.y = 1.2;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(2.9, 1.45, 4),
    new THREE.MeshStandardMaterial({ color: 0x6f4639, roughness: 0.8 })
  );
  roof.position.y = 2.85;
  roof.rotation.y = Math.PI / 4;
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.35, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x593520, roughness: 0.84 })
  );
  door.position.set(0, 0.7, -1.53);
  barn.add(body, roof, door);
  barn.position.set(-6.5, 0, -9);
  scene.add(barn);
}

function createToolModel() {
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, 0.9, 8),
    new THREE.MeshStandardMaterial({ color: 0x7b5636, roughness: 0.7 })
  );
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.08, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xa9b0a2, metalness: 0.2, roughness: 0.4 })
  );
  handle.rotation.z = 0.45;
  blade.position.set(0.2, -0.38, 0);
  handle.add(blade);
  handle.position.set(-0.36, -0.32, -0.72);
  handle.name = "hoeModel";
  camera.add(handle);
}

function createFarmPlots() {
  const plotGeometry = new THREE.BoxGeometry(1.08, 0.08, 1.08);
  let index = 0;
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const mesh = new THREE.Mesh(plotGeometry, untilledMaterial);
      mesh.position.set(col * 1.28 - 3.8, 0.04, row * 1.28 - 2.4);
      mesh.userData.kind = "plot";
      mesh.userData.index = index;
      scene.add(mesh);
      interactables.push(mesh);
      plotMeshes.push(mesh);
      plots.push({
        mesh,
        tilled: false,
        crop: null,
        plantedAt: 0,
        growth: 0,
        plantGroup: null
      });
      index += 1;
    }
  }
}

function createShopStand() {
  const stand = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x9b6b3d, roughness: 0.84 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xf2d46f, roughness: 0.64 });
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.25, 1.05), wood);
  table.position.y = 0.85;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 1.4), roofMat);
  roof.position.y = 1.95;
  const sign = createTextSprite("SHOP", "#2f3b22", "#f8d76b", 220, 92);
  sign.position.set(0, 1.45, -0.58);
  sign.scale.set(1.6, 0.65, 1);
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(2.9, 2.1, 1.6),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
  );
  hit.position.y = 1.05;
  hit.userData.kind = "shop";
  stand.add(table, roof, sign, hit);
  stand.position.set(6.3, 0, -3.3);
  scene.add(stand);
  interactables.push(hit);

  const seedKeys = Object.keys(crops);
  seedKeys.forEach((key, index) => {
    const button = createWorldButton(`${crops[key].label} $${crops[key].buy}`, "seedBuy", key);
    button.position.set(4.85 + (index % 2) * 1.52, 1.25 - Math.floor(index / 2) * 0.38, -4.15);
    scene.add(button);
  });

  [
    ["boots", "Boots", 24],
    ["compost", "Compost", 36],
    ["basket", "Basket", 44]
  ].forEach(([key, label, baseCost], index) => {
    const button = createWorldButton(`${label} $${upgradeCost(key, baseCost)}`, "upgradeBuy", key, baseCost);
    button.position.set(7.9, 1.25 - index * 0.38, -4.15);
    scene.add(button);
  });
}

function createWorldButton(label, kind, key, baseCost = 0) {
  const group = new THREE.Group();
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(1.28, 0.3, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xfff0a6, roughness: 0.6 })
  );
  plate.userData = { kind, key, baseCost };
  const text = createTextSprite(label, "#26351f", "#fff2b8", 300, 90);
  text.position.set(0, 0, -0.055);
  text.scale.set(1.05, 0.32, 1);
  group.add(plate, text);
  group.rotation.y = -0.08;
  interactables.push(plate);
  return group;
}

function createRain() {
  const material = new THREE.MeshBasicMaterial({ color: 0xcbe8ff, transparent: true, opacity: 0.65 });
  const geometry = new THREE.CylinderGeometry(0.008, 0.008, 0.42, 5);
  for (let i = 0; i < 130; i += 1) {
    const drop = new THREE.Mesh(geometry, material);
    resetRaindrop(drop, true);
    drop.visible = false;
    rainDrops.push(drop);
    scene.add(drop);
  }
}

function createReticle() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.018, 0.03, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72 })
  );
  ring.position.set(0, 0, -1.4);
  camera.add(ring);
}

function createTextSprite(text, color, background, width = 320, height = 120) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = color;
  ctx.font = "800 48px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
  return sprite;
}

function createWristInventory() {
  const group = new THREE.Group();
  group.name = "wristInventory";
  group.position.set(0.18, -0.18, -0.18);
  group.rotation.set(-0.72, 0.18, 0.08);
  group.scale.setScalar(0.72);

  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.075, 0.44, 12),
    new THREE.MeshStandardMaterial({ color: 0x6c8f52, roughness: 0.75 })
  );
  arm.rotation.x = Math.PI / 2;
  arm.position.set(-0.18, -0.015, 0.03);
  group.add(arm);

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.54, 0.035),
    new THREE.MeshStandardMaterial({ color: 0x26351f, roughness: 0.68 })
  );
  group.add(board);

  const title = createTextSprite("PACK", "#26351f", "#f8d76b", 200, 70);
  title.position.set(0, 0.33, 0.035);
  title.scale.set(0.34, 0.12, 1);
  group.add(title);

  inventorySlots.forEach((slot, index) => {
    const col = index % 5;
    const row = Math.floor(index / 5);
    const slotGroup = new THREE.Group();
    slotGroup.position.set(-0.3 + col * 0.15, 0.15 - row * 0.22, 0.04);

    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.125, 0.17, 0.022),
      new THREE.MeshStandardMaterial({ color: 0xfff1b0, roughness: 0.6 })
    );
    const label = createInventoryLabel();
    label.sprite.position.set(0, 0, 0.017);
    label.sprite.scale.set(0.115, 0.15, 1);

    slotGroup.add(plate, label.sprite);
    group.add(slotGroup);
    wristSlotViews.push({ plate, label, slot });
  });

  updateInventoryDisplay();
  return group;
}

function createInventoryLabel() {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 200;
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  const ctx = canvas.getContext("2d");

  return {
    sprite,
    draw(lines, selected) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = selected ? "#fff4bd" : "#f7f0cf";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = selected ? "#2e7d32" : "#9c8750";
      ctx.lineWidth = selected ? 12 : 5;
      ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
      ctx.fillStyle = "#26351f";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "800 34px system-ui, sans-serif";
      ctx.fillText(lines[0], canvas.width / 2, 60);
      ctx.font = "800 28px system-ui, sans-serif";
      ctx.fillText(lines[1] || "", canvas.width / 2, 126);
      texture.needsUpdate = true;
    }
  };
}

function updateInventoryDisplay() {
  wristSlotViews.forEach((view, index) => {
    const selected = index === state.activeSlot;
    const slot = view.slot;
    const color = selected ? 0xf8d76b : 0xfff1b0;
    view.plate.material.color.setHex(color);
    view.label.draw(slotLines(slot), selected);
  });
}

function slotLines(slot) {
  if (slot.type === "tool") return [slot.label, "Tool"];
  if (slot.type === "seed") return [slot.label.slice(0, 5), `x${state.inventory[slot.key]}`];
  if (slot.type === "shop") return ["Shop", "$"];
  return ["-", ""];
}

async function enterVr() {
  if (!navigator.xr) return;
  startGame("VR");
  const session = await navigator.xr.requestSession("immersive-vr", {
    optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"]
  });
  await renderer.xr.setSession(session);

  setupVrHand(0);
  setupVrHand(1);

  session.addEventListener("end", () => {
    overlay.classList.remove("is-hidden");
    showToast("Exited VR");
  });
}

function setupVrHand(index) {
  const handController = renderer.xr.getController(index);
  const handGrip = renderer.xr.getControllerGrip(index);
  handController.add(createPointerLine());
  handController.addEventListener("selectstart", () => {
    startGame("VR");
    setControllerRay(handController);
    interactWithRay();
  });
  handController.addEventListener("squeezestart", cycleInventorySlot);
  handController.addEventListener("connected", (event) => {
    const isRight = event.data?.handedness === "right";
    if (isRight || !controller) {
      controller = handController;
      attachWristInventory(handGrip);
    }
  });

  if (!controller) {
    controller = handController;
    attachWristInventory(handGrip);
  }

  scene.add(handController);
  scene.add(handGrip);
}

function attachWristInventory(handGrip) {
  controllerGrip = handGrip;
  if (!wristInventory) {
    wristInventory = createWristInventory();
  }
  if (wristInventory.parent !== controllerGrip) {
    controllerGrip.add(wristInventory);
  }
}

function createPointerLine() {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -5)]),
    new THREE.LineBasicMaterial({ color: 0xf8d76b, transparent: true, opacity: 0.82 })
  );
  line.name = "pointerLine";
  return line;
}

function startGame(mode) {
  if (!state.running) {
    state.running = true;
    state.lastDayTick = clock.getElapsedTime();
    state.nextWeatherAt = clock.getElapsedTime() + 30;
    showToast("Welcome to Meadow Patch");
  }
  overlay.classList.add("is-hidden");
  startAudio();
  updateHud(mode);
}

function setPointer(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function setControllerRay(source = controller) {
  if (!source) return;
  const matrix = new THREE.Matrix4();
  matrix.identity().extractRotation(source.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(source.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(matrix);
}

function interactWithRay() {
  const hits = raycaster.intersectObjects(interactables, true);
  if (!hits.length) return;
  const hit = hits[0].object;
  const data = hit.userData;

  if (data.kind === "plot") {
    usePlot(plots[data.index]);
  }

  if (data.kind === "shop") {
    toggleShop(true);
  }

  if (data.kind === "seedBuy") {
    buySeed(data.key);
  }

  if (data.kind === "upgradeBuy") {
    buyUpgrade(data.key, data.baseCost);
  }
}

function usePlot(plot) {
  if (state.tool === "hoe") {
    if (plot.tilled) {
      showToast("That soil is already ready");
      return;
    }
    plot.tilled = true;
    plot.mesh.material = tilledMaterial;
    pulse(plot.mesh.position, 0xd49a5a);
    showToast("Soil tilled");
    return;
  }

  if (state.tool === "seed") {
    if (!plot.tilled) {
      showToast("Use the hoe first");
      return;
    }
    if (plot.crop) {
      showToast("Something is already growing here");
      return;
    }
    const crop = state.selectedSeed;
    if (!crops[crop]) {
      showToast("Pick a valid seed first");
      return;
    }
    if (!hasSeed(crop)) {
      showToast(`No ${crops[crop].label.toLowerCase()} seeds left`);
      return;
    }
    state.inventory[crop] -= 1;
    plantCrop(plot, crop);
    updateHud();
    updateInventoryDisplay();
    return;
  }

  if (state.tool === "harvest") {
    if (!plot.crop) {
      showToast("Nothing to harvest yet");
      return;
    }
    if (plot.growth < 1) {
      showToast("Still growing");
      return;
    }
    const crop = crops[plot.crop];
    const bonus = state.upgrades.basket * 2;
    const earned = crop.sell + bonus;
    state.coins += earned;
    clearPlot(plot);
    pulse(plot.mesh.position, crop.color);
    showToast(`Sold ${crop.label} for $${earned}`);
    updateHud();
    buildShop();
  }
}

function plantCrop(plot, cropKey) {
  const crop = crops[cropKey];
  plot.crop = cropKey;
  plot.plantedAt = clock.getElapsedTime();
  plot.growth = 0;
  plot.plantGroup = new THREE.Group();
  plot.plantGroup.position.copy(plot.mesh.position);
  plot.plantGroup.position.y = 0.12;

  const sprout = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.34, 8),
    new THREE.MeshStandardMaterial({ color: crop.leaf, roughness: 0.72 })
  );
  sprout.position.y = 0.15;
  plot.plantGroup.add(sprout);
  scene.add(plot.plantGroup);
  showToast(`${crop.label} planted`);
}

function clearPlot(plot) {
  if (plot.plantGroup) {
    scene.remove(plot.plantGroup);
    plot.plantGroup.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
  plot.crop = null;
  plot.growth = 0;
  plot.plantedAt = 0;
  plot.plantGroup = null;
  plot.mesh.material = tilledMaterial;
}

function updateCrops(elapsed, delta) {
  const rainBoost = state.weather === "Rain" ? 1.85 : 1;
  const boost = rainBoost * (1 + state.upgrades.compost * 0.25);
  plots.forEach((plot) => {
    if (!plot.crop) return;
    const crop = crops[plot.crop];
    plot.growth = Math.min(1, plot.growth + (delta / crop.grow) * boost);
    plot.mesh.material = plot.growth >= 1 ? readyMaterial : tilledMaterial;
    updatePlantModel(plot, crop, elapsed);
  });
}

function updatePlantModel(plot, crop, elapsed) {
  if (!plot.plantGroup) return;
  const scale = 0.35 + plot.growth * 1.25;
  plot.plantGroup.scale.setScalar(scale);
  plot.plantGroup.rotation.y = Math.sin(elapsed + plot.mesh.position.x) * 0.12;

  if (plot.growth > 0.62 && plot.plantGroup.children.length < 2) {
    const fruit = new THREE.Mesh(
      new THREE.SphereGeometry(plot.crop === "pumpkin" ? 0.24 : 0.15, 12, 10),
      new THREE.MeshStandardMaterial({ color: crop.color, roughness: 0.62 })
    );
    fruit.position.set(0, 0.33, 0);
    plot.plantGroup.add(fruit);
  }
}

function buildShop() {
  shopItemsEl.innerHTML = "";
  Object.entries(crops).forEach(([key, crop]) => {
    const row = document.createElement("div");
    row.className = "shop-item";
    row.innerHTML = `<span><strong>${crop.label} seeds</strong><small>$${crop.buy} each - sell crop for $${crop.sell}</small></span>`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Buy";
    button.disabled = !canAfford(crop.buy);
    button.addEventListener("click", () => buySeed(key));
    row.append(button);
    shopItemsEl.append(row);
  });

  [
    ["boots", "Walking boots", "Move faster", 24],
    ["compost", "Compost bin", "Crops grow faster", 36],
    ["basket", "Market basket", "Harvests sell for more", 44]
  ].forEach(([key, label, description, baseCost]) => {
    const row = document.createElement("div");
    row.className = "shop-item";
    const cost = upgradeCost(key, baseCost);
    row.innerHTML = `<span><strong>${label}</strong><small>${description} - level ${state.upgrades[key]} - $${cost}</small></span>`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Upgrade";
    button.disabled = !canAfford(cost);
    button.addEventListener("click", () => buyUpgrade(key, baseCost));
    row.append(button);
    shopItemsEl.append(row);
  });
}

function buySeed(key) {
  if (!crops[key]) {
    showToast("That seed is not available");
    return;
  }
  const price = crops[key].buy;
  if (!spendCoins(price)) {
    showToast("Not enough coins");
    buildShop();
    return;
  }
  state.inventory[key] += 1 + state.seedBonus;
  state.selectedSeed = key;
  seedSelect.value = key;
  showToast(`Bought ${crops[key].label} seed`);
  updateHud();
  updateInventoryDisplay();
  buildShop();
}

function buyUpgrade(key, baseCost) {
  const cost = upgradeCost(key, baseCost);
  if (!spendCoins(cost)) {
    showToast("Not enough coins");
    buildShop();
    return;
  }
  state.upgrades[key] += 1;
  state.moveSpeed = 1.7 + state.upgrades.boots * 0.28;
  showToast("Upgrade bought");
  buildShop();
  updateHud();
}

function canAfford(amount) {
  return Number.isFinite(amount) && state.coins >= amount;
}

function spendCoins(amount) {
  if (!canAfford(amount)) return false;
  state.coins = Math.max(0, state.coins - amount);
  return true;
}

function hasSeed(key) {
  return Number.isFinite(state.inventory[key]) && state.inventory[key] > 0;
}

function upgradeCost(key, baseCost) {
  return baseCost + state.upgrades[key] * 18;
}

function chooseTool(event) {
  const button = event.target.closest("[data-tool]");
  if (!button) return;
  if (button.dataset.tool === "shop") {
    toggleShop();
    return;
  }
  setTool(button.dataset.tool);
}

function setTool(tool) {
  state.tool = tool;
  document.querySelectorAll(".tool").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tool === tool);
  });
  showToast(`${tool[0].toUpperCase()}${tool.slice(1)} selected`);
  updateInventoryDisplay();
}

function cycleTool() {
  const tools = ["hoe", "seed", "harvest"];
  const next = tools[(tools.indexOf(state.tool) + 1) % tools.length];
  setTool(next);
}

function cycleInventorySlot() {
  state.activeSlot = (state.activeSlot + 1) % inventorySlots.length;
  applyInventorySlot(inventorySlots[state.activeSlot]);
  updateInventoryDisplay();
}

function applyInventorySlot(slot) {
  if (slot.type === "tool") {
    setTool(slot.key);
    return;
  }

  if (slot.type === "seed") {
    if (!hasSeed(slot.key)) {
      showToast(`No ${crops[slot.key].label.toLowerCase()} seeds owned`);
      return;
    }
    state.selectedSeed = slot.key;
    seedSelect.value = slot.key;
    setTool("seed");
    showToast(`${crops[slot.key].label} slot selected`);
    return;
  }

  if (slot.type === "shop") {
    toggleShop(true);
    showToast("Shop slot selected");
    return;
  }

  showToast("Empty slot");
}

function toggleShop(forceOpen = null) {
  const open = forceOpen ?? !shopPanel.classList.contains("is-open");
  shopPanel.classList.toggle("is-open", open);
  buildShop();
}

function updateHud(mode) {
  coinsEl.textContent = `$${state.coins}`;
  dayEl.textContent = `Day ${state.day}`;
  weatherEl.textContent = state.weather;
  if (mode) {
    weatherEl.textContent = `${state.weather} - ${mode}`;
  }
}

function updateDayAndWeather(elapsed) {
  if (!state.running) return;
  if (elapsed - state.lastDayTick > 90) {
    state.day += 1;
    state.lastDayTick = elapsed;
    showToast(`Day ${state.day}`);
    updateHud();
  }

  if (state.weather === "Clear" && elapsed > state.nextWeatherAt) {
    state.weather = Math.random() > 0.45 ? "Rain" : "Breezy";
    state.weatherUntil = elapsed + (state.weather === "Rain" ? 26 : 18);
    showToast(state.weather === "Rain" ? "Rain is helping crops grow" : "A calm breeze rolls in");
    updateHud();
  }

  if (state.weather !== "Clear" && elapsed > state.weatherUntil) {
    state.weather = "Clear";
    state.nextWeatherAt = elapsed + 35 + Math.random() * 25;
    showToast("The sky clears");
    updateHud();
  }
}

function updateRain(delta) {
  const raining = state.weather === "Rain";
  rainDrops.forEach((drop) => {
    drop.visible = raining;
    if (!raining) return;
    drop.position.y -= delta * 9;
    drop.position.x -= delta * 1.4;
    if (drop.position.y < 0.15) resetRaindrop(drop);
  });
}

function resetRaindrop(drop, first = false) {
  drop.position.set(
    rig.position.x + (Math.random() - 0.5) * 22,
    first ? 2 + Math.random() * 9 : 8 + Math.random() * 4,
    rig.position.z + (Math.random() - 0.5) * 22
  );
  drop.rotation.z = -0.28;
}

function updateMovement(delta) {
  const speed = state.moveSpeed * delta;
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const move = new THREE.Vector3();

  if (keys.has("KeyW") || keys.has("ArrowUp")) move.add(forward);
  if (keys.has("KeyS") || keys.has("ArrowDown")) move.sub(forward);
  if (keys.has("KeyA") || keys.has("ArrowLeft")) move.sub(right);
  if (keys.has("KeyD") || keys.has("ArrowRight")) move.add(right);

  const session = renderer.xr.getSession();
  if (session && controller?.inputSource?.gamepad?.axes) {
    const axes = controller.inputSource.gamepad.axes;
    const x = axes[2] || axes[0] || 0;
    const y = axes[3] || axes[1] || 0;
    if (Math.abs(x) > 0.18) move.addScaledVector(right, x);
    if (Math.abs(y) > 0.18) move.addScaledVector(forward, -y);
  }

  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(speed);
    rig.position.add(move);
    rig.position.x = THREE.MathUtils.clamp(rig.position.x, -12, 12);
    rig.position.z = THREE.MathUtils.clamp(rig.position.z, -11, 11);
  }
}

function updateVrButtons() {
  const buttons = controller?.inputSource?.gamepad?.buttons;
  if (!buttons) return;

  const aButton = buttons[4];
  const aPressed = Boolean(aButton?.pressed);
  if (aPressed && !state.aButtonWasDown) {
    cycleInventorySlot();
  }
  state.aButtonWasDown = aPressed;
}

function pulse(position, color) {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.18, 32), material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(position);
  ring.position.y = 0.12;
  ring.userData.life = 1;
  tempObjects.push(ring);
  scene.add(ring);
}

function updateTempObjects(delta) {
  for (let i = tempObjects.length - 1; i >= 0; i -= 1) {
    const object = tempObjects[i];
    object.userData.life -= delta * 1.8;
    object.scale.addScalar(delta * 2.8);
    object.material.opacity = Math.max(0, object.userData.life);
    if (object.userData.life <= 0) {
      scene.remove(object);
      object.geometry.dispose();
      object.material.dispose();
      tempObjects.splice(i, 1);
    }
  }
}

function updateHover() {
  plotMeshes.forEach((mesh, index) => {
    const plot = plots[index];
    if (!plot.crop) {
      mesh.material = plot.tilled ? tilledMaterial : untilledMaterial;
    } else if (plot.growth >= 1) {
      mesh.material = readyMaterial;
    }
  });

  if (renderer.xr.isPresenting && controller) {
    setControllerRay();
  } else {
    raycaster.setFromCamera(pointer, camera);
  }

  const hits = raycaster.intersectObjects(plotMeshes, false);
  if (hits.length) {
    hits[0].object.material = hoverMaterial;
  }
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 1800);
}

function startAudio() {
  if (audioStarted) return;
  audioStarted = true;
  audioContext = new AudioContext();
  const master = audioContext.createGain();
  master.gain.value = 0.055;
  master.connect(audioContext.destination);

  const notes = [261.63, 329.63, 392, 523.25];
  notes.forEach((frequency, index) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = index % 2 ? "triangle" : "sine";
    osc.frequency.value = frequency / (index === 3 ? 2 : 1);
    gain.gain.value = index === 0 ? 0.35 : 0.18;
    osc.connect(gain);
    gain.connect(master);
    osc.start();
  });

  const lfo = audioContext.createOscillator();
  const lfoGain = audioContext.createGain();
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 0.02;
  lfo.connect(lfoGain);
  lfoGain.connect(master.gain);
  lfo.start();
}

function render() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.getElapsedTime();
  updateMovement(delta);
  updateVrButtons();
  updateCrops(elapsed, delta);
  updateDayAndWeather(elapsed);
  updateRain(delta);
  updateTempObjects(delta);
  updateHover();
  renderer.render(scene, camera);
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
