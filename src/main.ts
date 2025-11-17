import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";
import "./style.css";

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const inventoryDiv = document.createElement("div");
inventoryDiv.id = "inventory";
document.body.append(inventoryDiv);

let playerInventory = 0;
inventoryDiv.innerText = `Inventory: ${playerInventory}`;

const CLASS_LOC = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);
const ZOOM = 19;
const CELL_DEGREES = 1e-4;
const CELL_COUNT = 8;
const CELL_SPAWN_RATE = 0.2;

const map = leaflet.map(mapDiv, {
  center: CLASS_LOC,
  zoom: ZOOM,
  minZoom: ZOOM,
  maxZoom: ZOOM,
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

const playerMarker = leaflet.marker(CLASS_LOC);
playerMarker.addTo(map);

function spawnCell(i: number, j: number) {
  // Convert cell numbers into lat/lng bounds
  const origin = CLASS_LOC;
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * CELL_DEGREES, origin.lng + j * CELL_DEGREES],
    [origin.lat + (i + 1) * CELL_DEGREES, origin.lng + (j + 1) * CELL_DEGREES],
  ]);

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Add a text label with a random number 1-4 at the center of the rectangle
  const center = bounds.getCenter();
  let cellValue = Math.floor(Math.random() * 4) + 1;

  const label = leaflet.marker(center, {
    icon: leaflet.divIcon({
      className: "cell-label",
      html:
        `<div style='font-size: 18px; font-weight: bold; color: black;'>${cellValue}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    }),
  });
  label.addTo(map);
  label.on("click", () => {
    if (playerInventory == 0) {
      label.setIcon(leaflet.divIcon({
        className: "cell-label",
        html:
          `<div style='font-size: 18px; font-weight: bold; color: black;'>0</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }));
      playerInventory += cellValue;
      cellValue = 0;
      inventoryDiv.innerText = `Inventory: ${playerInventory}`;
    } else if (playerInventory == cellValue) {
      label.setIcon(leaflet.divIcon({
        className: "cell-label",
        html: `<div style='font-size: 18px; font-weight: bold; color: black;'>${
          playerInventory + cellValue
        }</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }));
      cellValue += playerInventory;
      playerInventory = 0;
      inventoryDiv.innerText = `Inventory: ${playerInventory}`;
    }
  });
}

// Look around the player's neighborhood for caches to spawn
for (let i = -CELL_COUNT; i < CELL_COUNT; i++) {
  for (let j = -CELL_COUNT; j < CELL_COUNT; j++) {
    // If location i,j is lucky enough, spawn a cache!
    if (luck([i, j].toString()) < CELL_SPAWN_RATE) {
      spawnCell(i, j);
    }
  }
}
