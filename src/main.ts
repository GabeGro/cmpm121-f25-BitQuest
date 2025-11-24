import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";
import "./style.css";

// --- Configuration ---
const TILE_DEGREES = 1e-4; // Size of a grid cell
const NEIGHBORHOOD_SIZE = 8; // How many cells away we can see
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
const playerGridPos = latLngToCell(START_LOC.lat, START_LOC.lng);

const playerMarker = leaflet.marker(START_LOC);
playerMarker.addTo(map);
playerMarker.bindTooltip("That's you!");

const gridLayer = leaflet.layerGroup().addTo(map);

// Tracks what is currently visible on the map
const activeCells = new Map<string, leaflet.Layer>();

// Tracks cells we have modified
const savedCells = new Map<string, number>();

// --- Game Logic ---

function spawnCell(cell: Cell) {
  const bounds = cellToBounds(cell);
  const key = `${cell.i},${cell.j}`;

  let cellValue: number = 0;
  let shouldSpawn = false;

  // If we have visited this cell before, restore its state
  if (savedCells.has(key)) {
    cellValue = savedCells.get(key)!;
    shouldSpawn = true;
  } // Otherwise, use the Flyweight pattern (procedural generation)
  else if (luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
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

    // Add visual representation
    rect.addTo(gridLayer);
    activeCells.set(key, rect);

    // Permanent Tooltip
    rect.bindTooltip(`${cellValue}`, {
      permanent: true,
      direction: "center",
      className: "cell-label",
    });

    // Styling for empty cells (if restoring a 0)
    if (cellValue === 0) {
      rect.setStyle({ color: "gray", fillOpacity: 0.1 });
    }

    // Interaction Logic
    rect.on("click", () => {
      const distI = Math.abs(playerGridPos.i - cell.i);
      const distJ = Math.abs(playerGridPos.j - cell.j);

      if (distI === 0 && distJ === 0) {
        if (playerInventory === 0) {
          // Collect
          playerInventory += cellValue;
          cellValue = 0;

          // --- SAVE STATE ---
          savedCells.set(key, cellValue);

          inventoryDiv.innerText = `Inventory: ${playerInventory}`;
          rect.setStyle({ color: "gray", fillOpacity: 0.1 });
          rect.setTooltipContent(`${cellValue}`);
        } else if (playerInventory === cellValue) {
          // Deposit/Merge
          cellValue += playerInventory;
          playerInventory = 0;

          // --- SAVE STATE ---
          savedCells.set(key, cellValue);

          inventoryDiv.innerText = `Inventory: ${playerInventory}`;
          rect.setTooltipContent(`${cellValue}`);
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

  // Remove cells that have gone out of range
  for (const [key, layer] of activeCells) {
    const [i, j] = key.split(",").map(Number);
    if (i < startI || i > endI || j < startJ || j > endJ) {
      layer.remove();
      activeCells.delete(key);
    }
  }

  // Spawn new cells
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

// Initial Draw
updateGrid();
