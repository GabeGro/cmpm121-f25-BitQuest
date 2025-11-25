import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";
import "./style.css";

// --- Configuration ---
const TILE_DEGREES = 1e-4; // Size of a grid cell
const NEIGHBORHOOD_SIZE = 15; // How many cells away we can see
const CACHE_SPAWN_PROBABILITY = 0.3; // Chance of a cell having a coin

// --- UI Setup ---
const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const inventoryDiv = document.createElement("div");
inventoryDiv.id = "inventory";
document.body.append(inventoryDiv);

const controlsDiv = document.createElement("div");
controlsDiv.id = "controls";
controlsDiv.style.position = "absolute";
controlsDiv.style.bottom = "20px";
controlsDiv.style.left = "20px";
controlsDiv.style.zIndex = "1000";
controlsDiv.style.backgroundColor = "white";
controlsDiv.style.padding = "10px";
controlsDiv.innerHTML = `
  <button id="north">⬆️ North</button>
  <button id="south">⬇️ South</button>
  <button id="west">⬅️ West</button>
  <button id="east">➡️ East</button>
  <button id="reset">🚮 Reset</button>
`;
document.body.append(controlsDiv);

// --- Game State ---
let playerInventory = 0;
inventoryDiv.innerText = `Inventory: ${playerInventory}`;

// Start near the classroom
const START_LOC = leaflet.latLng(36.997936938057016, -122.05703507501151);

const map = leaflet.map(mapDiv, {
  center: START_LOC,
  zoom: 19,
  minZoom: 19,
  maxZoom: 19,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Define a Cell interface for our grid coordinates
interface Cell {
  i: number;
  j: number;
}

// --- Coordinate Conversion Functions ---
function latLngToCell(lat: number, lng: number): Cell {
  return {
    i: Math.floor(lat / TILE_DEGREES),
    j: Math.floor(lng / TILE_DEGREES),
  };
}

function cellToBounds(cell: Cell): leaflet.LatLngBounds {
  const south = cell.i * TILE_DEGREES;
  const west = cell.j * TILE_DEGREES;
  const north = (cell.i + 1) * TILE_DEGREES;
  const east = (cell.j + 1) * TILE_DEGREES;
  return leaflet.latLngBounds([south, west], [north, east]);
}

// Track player location in Grid coordinates
let playerGridPos = latLngToCell(START_LOC.lat, START_LOC.lng);

const playerMarker = leaflet.marker(START_LOC);
playerMarker.addTo(map);
playerMarker.bindTooltip("That's you!");

const gridLayer = leaflet.layerGroup().addTo(map);

// --- State Management ---

const activeCells = new Map<string, leaflet.Layer>();

// Memento: Modified cells. changed to 'let' to allow loading from storage
let savedCells = new Map<string, number>();

// --- Persistence (LocalStorage) ---

function saveGameState() {
  const state = {
    inventory: playerInventory,
    gridPos: playerGridPos,
    // Maps cannot be directly stringified, so we convert to an array of entries
    savedCells: Array.from(savedCells.entries()),
  };
  localStorage.setItem("bitquest_state", JSON.stringify(state));
}

function loadGameState() {
  const stateString = localStorage.getItem("bitquest_state");
  if (stateString) {
    const state = JSON.parse(stateString);
    playerInventory = state.inventory;
    playerGridPos = state.gridPos;
    savedCells = new Map(state.savedCells);

    // Update UI based on loaded state
    inventoryDiv.innerText = `Inventory: ${playerInventory}`;

    // Update Map Position
    const newBounds = cellToBounds(playerGridPos);
    const newCenter = newBounds.getCenter();
    playerMarker.setLatLng(newCenter);
    map.panTo(newCenter);
  }
}

// --- Game Logic ---

function spawnCell(cell: Cell) {
  const bounds = cellToBounds(cell);
  const key = `${cell.i},${cell.j}`;

  let cellValue: number = 0;
  let shouldSpawn = false;

  // Restore from Memento OR generate procedurally
  if (savedCells.has(key)) {
    cellValue = savedCells.get(key)!;
    shouldSpawn = true;
  } else if (luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
    const valHash = luck([cell.i, cell.j, "val"].toString());
    cellValue = Math.floor(valHash * 4) + 1;
    shouldSpawn = true;
  }

  if (shouldSpawn) {
    const rect = leaflet.rectangle(bounds, {
      color: "#ff7800",
      weight: 1,
      fillOpacity: 0.2,
    });

    rect.addTo(gridLayer);
    activeCells.set(key, rect);

    rect.bindTooltip(`${cellValue}`, {
      permanent: true,
      direction: "center",
      className: "cell-label",
    });

    if (cellValue === 0) {
      rect.setStyle({ color: "gray", fillOpacity: 0.1 });
    }

    rect.on("click", () => {
      const distI = Math.abs(playerGridPos.i - cell.i);
      const distJ = Math.abs(playerGridPos.j - cell.j);

      if (distI === 0 && distJ === 0) {
        let changed = false;
        if (playerInventory === 0) {
          playerInventory += cellValue;
          cellValue = 0;
          changed = true;

          savedCells.set(key, cellValue);
          rect.setStyle({ color: "gray", fillOpacity: 0.1 });
          rect.setTooltipContent(`${cellValue}`);
        } else if (playerInventory === cellValue) {
          cellValue += playerInventory;
          playerInventory = 0;
          changed = true;

          savedCells.set(key, cellValue);
          rect.setTooltipContent(`${cellValue}`);
        }

        if (changed) {
          inventoryDiv.innerText = `Inventory: ${playerInventory}`;
          saveGameState(); // Auto-save on interaction
        }
      } else {
        console.log("Too far to interact!");
      }
    });
  }
}

function updateGrid() {
  const startI = playerGridPos.i - NEIGHBORHOOD_SIZE;
  const endI = playerGridPos.i + NEIGHBORHOOD_SIZE;
  const startJ = playerGridPos.j - NEIGHBORHOOD_SIZE;
  const endJ = playerGridPos.j + NEIGHBORHOOD_SIZE;

  for (const [key, layer] of activeCells) {
    const [i, j] = key.split(",").map(Number);
    if (i < startI || i > endI || j < startJ || j > endJ) {
      layer.remove();
      activeCells.delete(key);
    }
  }

  for (let i = startI; i <= endI; i++) {
    for (let j = startJ; j <= endJ; j++) {
      const key = `${i},${j}`;
      if (!activeCells.has(key)) {
        spawnCell({ i, j });
      }
    }
  }
}

// --- Movement System ---

function movePlayer(dLat: number, dLng: number) {
  playerGridPos.i += dLat;
  playerGridPos.j += dLng;

  const newBounds = cellToBounds(playerGridPos);
  const newCenter = newBounds.getCenter();

  playerMarker.setLatLng(newCenter);
  map.panTo(newCenter);

  updateGrid();
  saveGameState(); // Auto-save on movement
}

document.getElementById("north")!.addEventListener(
  "click",
  () => movePlayer(1, 0),
);
document.getElementById("south")!.addEventListener(
  "click",
  () => movePlayer(-1, 0),
);
document.getElementById("west")!.addEventListener(
  "click",
  () => movePlayer(0, -1),
);
document.getElementById("east")!.addEventListener(
  "click",
  () => movePlayer(0, 1),
);

document.getElementById("reset")!.addEventListener("click", () => {
  if (confirm("Are you sure you want to erase your save and restart?")) {
    localStorage.removeItem("bitquest_state");
    location.reload();
  }
});

// --- Startup ---
loadGameState(); // Load save file before starting the game
updateGrid();
