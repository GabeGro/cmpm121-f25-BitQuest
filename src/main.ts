import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";
import "./style.css";

// --- Configuration ---
const TILE_DEGREES = 1e-4; // Size of a grid cell
const NEIGHBORHOOD_SIZE = 20; // How many cells away we can see
const CACHE_SPAWN_PROBABILITY = 0.1; // Chance of a cell having a coin

// --- UI Setup ---
const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const inventoryDiv = document.createElement("div");
inventoryDiv.id = "inventory";
document.body.append(inventoryDiv);

const controlsDiv = document.createElement("div");
controlsDiv.id = "controls";
// Basic styling to keep buttons visible
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
  zoom: 200,
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
// Converts a Lat/Lng to a globally consistent Grid Cell (i, j)
function latLngToCell(lat: number, lng: number): Cell {
  return {
    i: Math.floor(lat / TILE_DEGREES),
    j: Math.floor(lng / TILE_DEGREES),
  };
}

// Converts a Grid Cell (i, j) back to a LatLngBounds (for drawing)
function cellToBounds(cell: Cell): leaflet.LatLngBounds {
  const south = cell.i * TILE_DEGREES;
  const west = cell.j * TILE_DEGREES;
  const north = (cell.i + 1) * TILE_DEGREES;
  const east = (cell.j + 1) * TILE_DEGREES;
  return leaflet.latLngBounds([south, west], [north, east]);
}

// Track player location in Grid coordinates
const playerGridPos = latLngToCell(START_LOC.lat, START_LOC.lng);

// Create a marker to represent the player
const playerMarker = leaflet.marker(START_LOC);
playerMarker.addTo(map);
playerMarker.bindTooltip("That's you!");

// Layer group to manage grid cells (allows easy clearing)
const gridLayer = leaflet.layerGroup().addTo(map);

// --- State Management ---
// We use a Map to track which cells are currently visible/active.
// Key: "i,j" string, Value: The Leaflet Rectangle layer
const activeCells = new Map<string, leaflet.Layer>();

// --- Game Logic ---

function spawnCell(cell: Cell) {
  const bounds = cellToBounds(cell);
  const key = `${cell.i},${cell.j}`;

  // Determine if a coin exists here using the luck library
  if (luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
    const rect = leaflet.rectangle(bounds, {
      color: "#ff7800",
      weight: 1,
      fillOpacity: 0.2,
    });

    // Calculate value
    const valHash = luck([cell.i, cell.j, "val"].toString());
    let cellValue = Math.floor(valHash * 4) + 1;

    // Add visual representation
    rect.addTo(gridLayer);

    // Store in our active cache so we don't regenerate it while it's visible
    activeCells.set(key, rect);

    // Permanent Tooltip to show value
    rect.bindTooltip(`${cellValue}`, {
      permanent: true,
      direction: "center",
      className: "cell-label",
    });

    // Interaction Logic
    rect.on("click", () => {
      // Check distance using Grid Coordinates
      const distI = Math.abs(playerGridPos.i - cell.i);
      const distJ = Math.abs(playerGridPos.j - cell.j);

      // Player must be ON the cell to interact
      if (distI === 0 && distJ === 0) {
        if (playerInventory === 0) {
          // Collect
          playerInventory += cellValue;
          cellValue = 0; // "Empty" the cell locally
          inventoryDiv.innerText = `Inventory: ${playerInventory}`;

          // Visual updates
          rect.setStyle({ color: "gray", fillOpacity: 0.1 });
          rect.setTooltipContent(`${cellValue}`); // Display "0"
        } else if (playerInventory === cellValue) {
          // Deposit/Merge
          cellValue += playerInventory;
          playerInventory = 0;
          inventoryDiv.innerText = `Inventory: ${playerInventory}`;

          // Visual updates
          rect.setTooltipContent(`${cellValue}`); // Update number
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

  // 1. Remove cells that have gone out of range
  for (const [key, layer] of activeCells) {
    const [i, j] = key.split(",").map(Number);
    if (i < startI || i > endI || j < startJ || j > endJ) {
      layer.remove(); // Remove from Leaflet map
      activeCells.delete(key); // Remove from our tracking
    }
  }

  // 2. Spawn new cells only if they don't already exist
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
  // Update Player Grid Position
  playerGridPos.i += dLat;
  playerGridPos.j += dLng;

  // Calculate new Lat/Lng for the marker and map center
  const newBounds = cellToBounds(playerGridPos);
  const newCenter = newBounds.getCenter();

  // Update Visuals
  playerMarker.setLatLng(newCenter);
  map.panTo(newCenter); // Move the map to follow the player

  // Update the grid (optimized)
  updateGrid();
}

// Bind buttons to movement logic
document
  .getElementById("north")!
  .addEventListener("click", () => movePlayer(1, 0));
document
  .getElementById("south")!
  .addEventListener("click", () => movePlayer(-1, 0));
document
  .getElementById("west")!
  .addEventListener("click", () => movePlayer(0, -1));
document
  .getElementById("east")!
  .addEventListener("click", () => movePlayer(0, 1));

// Initial Draw
updateGrid();
