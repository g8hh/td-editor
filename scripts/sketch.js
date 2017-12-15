var cols;
var rows;
var tileZoom = 2;
var ts = 24;            // tile size

var grid;               // tile type (0 = empty, 1 = wall, 2 = path, 3 = tower)
var paths;              // direction to travel

var exit;
var spawnpoints = [];

var waves;

var selected = 'empty';


// Misc functions

// Draw an arrow
function arrow() {
    stroke(0);
    var length = 0.7 * ts;
    var back = 0.1 * ts;
    var width = 0.5 * ts;
    line(-length / 2, 0, length / 2, 0);
    line(-length / 2, 0, -back, -width / 2);
    line(-length / 2, 0, -back, width / 2);
}

function drawTile(col, row) {
    stroke(0, 63);
    var t = grid[col][row];
    fill([
        [255, 255, 255],
        [108, 122, 137],
        [191, 85, 236],
        [25, 181, 254]
    ][t]);
    rect(col * ts, row * ts, ts, ts);
}

// Return map string
function exportMap() {
    // Convert spawnpoints into a JSON-friendly format
    var spawns = [];
    for (var i = 0; i < spawnpoints.length; i++) {
        var s = spawnpoints[i];
        spawns.push([s.x, s.y]);
    }
    return JSON.stringify({
        // Grids
        grid: grid,
        paths: paths,
        // Important tiles
        exit: [exit.x, exit.y],
        spawnpoints: spawns,
        // Misc
        cols: cols,
        rows: rows,
        waves: waves
    });
}

// Return walkability map
function getWalkMap() {
    var walkMap = [];
    for (var x = 0; x < cols; x++) {
        walkMap[x] = [];
        for (var y = 0; y < rows; y++) {
            walkMap[x][y] = walkable(x, y);
        }
    }
    return walkMap;
}

// Load a map from a map string
function importMap(str) {
    try {
        var m = JSON.parse(str);

        // Grids
        grid = m.grid;
        paths = m.paths;
        // Important tiles
        exit = createVector(m.exit[0], m.exit[1]);
        spawnpoints = [];
        for (var i = 0; i < m.spawnpoints.length; i++) {
            var s = m.spawnpoints[i];
            spawnpoints.push(createVector(s[0], s[1]));
        }
        // Misc
        cols = m.cols;
        rows = m.rows;
        waves = m.waves;

        resizeFit();
    } catch (err) {
        resetMap();
    }
}

// Recalculate pathfinding maps
// Algorithm from https://www.redblobgames.com/pathfinding/tower-defense/
function recalculate() {
    if (!exit) return;
    walkMap = getWalkMap();
    var frontier = [];
    var target = vts(exit);
    frontier.push(target);
    var cameFrom = {};
    cameFrom[target] = null;

    // Fill cameFrom and distance for every tile
    while (frontier.length !== 0) {
        var current = frontier.shift();
        var t = stv(current);
        var adj = neighbors(walkMap, t.x, t.y, true);

        for (var i = 0; i < adj.length; i++) {
            var next = adj[i];
            if (next in cameFrom) continue;
            frontier.push(next);
            cameFrom[next] = current;
        }
    }

    // Generate usable maps
    paths = buildArray(cols, rows, null);
    var keys = Object.keys(cameFrom);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var current = stv(key);

        // Generate path direction for every tile
        var val = cameFrom[key];
        if (val !== null) {
            // Subtract vectors to determine direction
            var next = stv(val);
            var dir = next.sub(current);
            // Fill tile with direction
            if (dir.x < 0) paths[current.x][current.y] = 'left';
            if (dir.y < 0) paths[current.x][current.y] = 'up';
            if (dir.x > 0) paths[current.x][current.y] = 'right';
            if (dir.y > 0) paths[current.x][current.y] = 'down';
        }
    }
}

// Clear grid
function resetMap() {
    grid = buildArray(cols, rows, 0);
    paths = buildArray(cols, rows, null);

    exit = null;
    spawnpoints = [];
}

// Changes tile size to fit everything onscreen
function resizeFit() {
    var div = document.getElementById('sketch-holder');
    var ts1 = floor(div.offsetWidth / cols);
    var ts2 = floor(div.offsetHeight / rows);
    ts = Math.min(ts1, ts2);
    resizeCanvas(cols * ts, rows * ts, true);
}

// Resizes cols, rows, and canvas based on tile size
function resizeMax() {
    var div = document.getElementById('sketch-holder');
    cols = floor(div.offsetWidth / ts);
    rows = floor(div.offsetHeight / ts);
    resizeCanvas(cols * ts, rows * ts, true);
}

// User drawing on map
function userDraw() {
    if (!mouseInMap()) return;
    var p = gridPos(mouseX, mouseY);
    var g = grid[p.x][p.y];
    switch (selected) {
        case 'down':
            if (g === 0 || g === 2) paths[p.x][p.y] = 'down';
            break;
        case 'empty':
            grid[p.x][p.y] = 0;
            break;
        case 'exit':
            exit = createVector(p.x, p.y);
            break;
        case 'left':
            if (g === 0 || g === 2) paths[p.x][p.y] = 'left';
            break;
        case 'none':
            paths[p.x][p.y] = null;
            break;
        case 'path':
            grid[p.x][p.y] = 2;
            break;
        case 'right':
            if (g === 0 || g === 2) paths[p.x][p.y] = 'right';
            break;
        case 'spawn':
            var s = createVector(p.x, p.y);
            for (var i = 0; i < spawnpoints.length; i++) {
                if (s.equals(spawnpoints[i])) return;
            }
            spawnpoints.push(s);
            break;
        case 'tower':
            grid[p.x][p.y] = 3;
            paths[p.x][p.y] = null;
            break;
        case 'up':
            if (g === 0 || g === 2) paths[p.x][p.y] = 'up';
            break;
        case 'wall':
            grid[p.x][p.y] = 1;
            paths[p.x][p.y] = null;
            break;
    }
}

// Return whether tile is walkable
function walkable(col, row) {
    // Check if empty or path tile
    return grid[col][row] === 0 || grid[col][row] === 2;
}


// Main p5 functions

function setup() {
    var div = document.getElementById('sketch-holder');
    var canvas = createCanvas(div.offsetWidth, div.offsetHeight);
    canvas.parent('sketch-holder');
    resizeMax();
    resetMap();
}

function draw() {
    // Draw basic tiles
    for (var x = 0; x < cols; x++) {
        for (var y = 0; y < rows; y++) {
            drawTile(x, y);
        }
    }

    // Draw spawnpoints
    for (var i = 0; i < spawnpoints.length; i++) {
        stroke(0);
        fill(0, 230, 64);
        var s = spawnpoints[i];
        rect(s.x * ts, s.y * ts, ts, ts);
    }

    // Draw exit
    if (exit) {
        stroke(0);
        fill(207, 0, 15);
        rect(exit.x * ts, exit.y * ts, ts, ts);
    }

    // Draw paths
    for (var x = 0; x < cols; x++) {
        for (var y = 0; y < rows; y++) {
            var d = paths[x][y];
            if (d) {
                push();
                var c = center(x, y);
                translate(c.x, c.y);
                rotate({
                    down: PI * 3 / 2,
                    left: 0,
                    right: PI,
                    up: PI / 2
                }[d]);
                arrow();
                pop();
            }
        }
    }
}


// User input

function keyPressed() {
    switch (keyCode) {
        case 37:
            // Left arrow
            selected = 'left';
            break;
        case 38:
            // Up arrow
            selected = 'up';
            break;
        case 39:
            // Right arrow
            selected = 'right';
            break;
        case 40:
            // Down arrow
            selected = 'down';
            break;
        case 48:
            // 0
            selected = 'none';
            break;
        case 49:
            // 1
            selected = 'empty';
            break;
        case 50:
            // 2
            selected = 'wall';
            break;
        case 51:
            // 3
            selected = 'path';
            break;
        case 52:
            // 4
            selected = 'tower';
            break;
        case 53:
            // 5
            selected = 'spawn';
            break;
        case 54:
            // 6
            selected = 'exit';
            break;
        case 77:
            // M
            importMap(prompt('Input map string:'));
            break;
        case 80:
            // P
            recalculate();
            break;
        case 82:
            // R
            resetMap();
            break;
        case 83:
            // S
            spawnpoints = [];
            break;
        case 88:
            // X
            copyToClipboard(exportMap());
            break;
        case 219:
            // Left bracket
            if (ts > 16) {
                ts -= tileZoom;
                resizeMax();
                resetMap();
            }
            break;
        case 221:
            // Right bracket
            if (ts < 40) {
                ts += tileZoom;
                resizeMax();
                resetMap();
            }
            break;
    }
}

function mouseDragged() {
    userDraw();
}

function mousePressed() {
    userDraw();
}
