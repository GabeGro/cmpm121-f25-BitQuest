# D3: Bit quest

## Gameplay Goal

The gameplay takes place on a map of the campus, with minimalistic cells about the size of a small house projected on top of the map. The cells are all labelled with numbers < 7. The player is able to add one cell to their inventory at a time and combine them with cells of the same value, with the goal of getting as large a cell as possible. The play can move around the map with the arrow keys.

## Technologies

1. TypeScript for most game code, little to no explicit HTML, and all CSS collected in common `style.css` file
2. Deno and Vite for building
3. GitHub Actions + GitHub Pages for deployment automation

## Steps

### D3.a

1. [x] Familiarize with the existing code from the template repo
2. [x] Delete template code
3. [x] Implement basic Leaflet map
4. [x] Add player's location to map
5. [x] Project cells onto map
6. [x] Add numbers to cells
7. [x] Implement ability to stash cells in inventory
8. [x] Implement ability to combine cells of similar value

### D3.b

1. [x] Implement cell-based player movement using WASD keys
2. [ ] Player is only able to interact with nearby cells
3. [ ] Cells are spawned when player moves to unpopulated area
4. [ ] Cell's offscreen are deleted
