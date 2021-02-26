function GameManager(size, InputManager, Actuator, StorageManager) {
  this.size           = size; // Size of the grid
  this.inputManager   = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator       = new Actuator;

  this.startTiles     = 2;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));
  this.inputManager.on("autoplay", this.autoplay.bind(this));
  this.inputManager.on("step", this.step.bind(this));
  this.inputManager.on("config", this.config.bind(this));

  this.setup();
}

// Restart the game
GameManager.prototype.restart = function () {
  this.storageManager.clearGameState();
  this.actuator.continueGame(); // Clear the game won/lost message
  this.setup();
};

// Keep playing after winning (allows going over 2048)
GameManager.prototype.keepPlaying = function () {
  this.keepPlaying = true;
  this.actuator.continueGame(); // Clear the game won/lost message
};

// Return true if the game is lost, or has won and the user hasn't kept playing
GameManager.prototype.isGameTerminated = function () {
  return this.over || (this.won && !this.keepPlaying);
};

// Set up the game
GameManager.prototype.setup = function () {
  var previousState = this.storageManager.getGameState();

  // Reload the game from a previous game if present
  if (previousState) {
    this.grid        = new Grid(previousState.grid.size,
                                previousState.grid.cells); // Reload grid
    this.score       = previousState.score;
    this.over        = previousState.over;
    this.won         = previousState.won;
    this.keepPlaying = previousState.keepPlaying;
  } else {
    this.grid        = new Grid(this.size);
    this.score       = 0;
    this.over        = false;
    this.won         = false;
    this.keepPlaying = false;

    if (this.initialTiles != null && this.initialTiles.length > 0) {
      var index = 0;
      var numTiles = 0;
      for (var row = 0; row < this.size; row++) {
        for (var col = 0; col < this.size; col++) {
          var value = 0;
          if (index < this.initialTiles.length) {
            value = this.initialTiles[index];
            index++;
          }
          if (value > 0) {
            this.grid.insertTile(new Tile({x: col, y: row}, value));
            ++numTiles;
          }
        }
      }
      if (numTiles == 0) {
        this.addStartTiles();
      }
    } else {
      // Add the initial tiles
      this.addStartTiles();
    }
  }

  // Update the actuator
  this.actuate();

  this.auto = false;
  this.playing = false;
};

var globalGameManager = null;

var defaultServerAddress = "https://2048-ai-4.cubeythecube.repl.co";

var valueToRank = {
  0: '0', 2: '1', 4: '2', 8: '3', 16: '4', 32: '5', 64: '6', 128: '7', 256: '8',
  512: '9', 1024: 'A', 2048: 'B', 4096: 'C', 8192: 'D', 16384: 'E', 32768: 'F',
  65536: 'G',
};

GameManager.prototype.autoplay = function () {
  if (!this.auto && !this.playing) {
    this.auto = true;
    this.playing = true;
    this.play();
  }
};

GameManager.prototype.step = function () {
  this.auto = false;
  if (!this.playing) {
    this.playing = true;
    this.play();
  }
};

// Play the game after getting suggested move from 2048-AI
GameManager.prototype.play = function () {
  var board = '';
  for (var y = 0; y < this.grid.size; y++) {
    for (var x = 0; x < this.grid.size; x++) {
      if (this.grid.cells[x][y]) {
        board += valueToRank[this.grid.cells[x][y].value];
      } else {
        board += '0';
      }
    }
  }

  if (this.serverAddress == null) {
    this.serverAddress = defaultServerAddress;
  }
  var self = this;
  var request = new XMLHttpRequest();
  var url = this.serverAddress + "/move?board=" + board;
  request.open("GET", url);
  request.onload = function() {
    if (request.readyState === 4) {
      if (request.status === 200) {
        self.hideError();
        var dead = false;
        switch (request.responseText) {
          case 'u': self.move(0); break;
          case 'r': self.move(1); break;
          case 'd': self.move(2); break;
          case 'l': self.move(3); break;
          default: dead = true; break;
        }
        if (!dead) {
          self.actuate();
          if (self.auto) {
            self.play();
          }
        } else {
          self.auto = false;
        }
        self.playing = false;
      } else {
        console.error(request.statusText);
      }
    }
  };
  request.onerror = function (e) {
    self.auto = false;
    self.playing = false;
    self.showError("Unable to contact AI at <strong>" + self.serverAddress + "</strong>");
  };
  request.send(null);
};

GameManager.prototype.showError = function (message) {
  document.getElementById("game-intro").style.display = "none";
  document.getElementById("error-message").innerHTML = message;
  document.getElementById("error-message").style.display = "block";
}

GameManager.prototype.hideError = function () {
  document.getElementById("game-intro").style.display = "block";
  document.getElementById("error-message").style.display = "none";
}

GameManager.prototype.acceptConfig = function () {
  var self = globalGameManager;
  self.configTiles();
  self.configServer();
  self.closeConfig();
};

GameManager.prototype.closeConfig = function () {
  var self = globalGameManager;
  var config = document.getElementById("config-dialog");
  config.style.display = "none";
  self.inputManager.resumeListen();
  document.removeEventListener("keydown", this.handleKeys);
};

GameManager.prototype.handleKeys = function (event) {
  var self = globalGameManager;

  var modifiers = event.altKey || event.ctrlKey || event.metaKey ||
    event.shiftKey;

  // Esc key closes config dialog
  if (!modifiers && event.which === 27) {
    self.closeConfig();
  }

  // Enter key accepts config changes
  if (!modifiers && event.which === 13) {
    self.acceptConfig();
  }
};

function selectTraining() {
  var training = document.getElementById('training').value;
  var tiles;
  if (training == 'clear') {
    tiles = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  } else if (training == 'snake-32k') {
    tiles = [16384,8192,4096,256,2048,1024,512,128,2,0,0,0,0,0,0,0];
  } else if (training == 'snake-64k') {
    tiles = [32768,16384,8192,512,4096,2048,1024,256,2,0,0,0,0,0,0,0];
  } else if (training == 'pdf-32k') {
    tiles = [16384,8192,4096,2,2048,1024,512,2,256,128,4,2,2,2,2,2];
  } else if (training == 'pdf-64k') {
    tiles = [32768,16384,8192,2,4096,2048,1024,2,512,256,4,2,2,2,2,2];
  } else if (training == 'dpdf-32k') {
    tiles = [16384,8192,4096,4,2048,1024,512,2,2,0,0,0,0,0,0,0];
  } else if (training == 'dpdf-64k') {
    tiles = [32768,16384,8192,4,4096,2048,1024,2,2,0,0,0,0,0,0,0];
  }
  var tileGrid = document.getElementsByClassName("tile-input");
  for (var i = 0; i < 16; i++) {
    tileGrid[i].value = tiles[i];
  }
}

// Config game options
GameManager.prototype.config = function () {
  var tiles = this.initialTiles;
  if (tiles == null) {
    tiles = [16384,8192,4096,256,2048,1024,512,128,2,0,0,0,0,0,0,0];
  }
  var tileGrid = document.getElementsByClassName("tile-input");
  for (var i = 0; i < this.size * this.size; i++) {
    tileGrid[i].value = tiles[i];
  }

  var server = this.serverAddress;
  if (server == null) {
    server = defaultServerAddress;
  }
  document.getElementById("server-address").value = server;

  globalGameManager = this;
  document.addEventListener("keydown", this.handleKeys);
  this.inputManager.stopListen();

  var self = this;
  var config = document.getElementById("config-dialog");
  config.style.display = "block";
  tileGrid[0].focus();

  var ok = document.getElementById("ok-button");
  ok.onclick = this.acceptConfig;

  var close = document.getElementById("close-button");
  close.onclick = this.closeConfig;
};

// Config the initial layout of tiles
GameManager.prototype.configTiles = function () {
  var tileSet = new Set([0,2,4,8,16,32,64,128,256,512,1024,2048,4096,8192,16384,32768,65536]);
  var tileGrid = document.getElementsByClassName("tile-input");
  var tiles = [];
  var valid = true;
  for (var i = 0; i < this.size * this.size; ++i) {
    var tile = Number(tileGrid[i].value);
    if (tileSet.has(tile)) {
      tiles.push(tile);
    } else {
      alert("Invalid tile: " + tileGrid[i].value);
      valid = false;
      break;
    }
  }
  if (valid) {
    this.initialTiles = tiles;
  }
};

// Config the address of AI server
GameManager.prototype.configServer = function () {
  var address = document.getElementById("server-address").value;
  try {
    new URL(address);
    this.serverAddress = address;
  } catch (_) {
    alert("Malformed address: " + address);
  }
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(this.grid.randomAvailableCell(), value);

    this.grid.insertTile(tile);
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  if (this.storageManager.getBestScore() < this.score) {
    this.storageManager.setBestScore(this.score);
  }

  // Clear the state when the game is over (game over only, not win)
  if (this.over) {
    this.storageManager.clearGameState();
  } else {
    this.storageManager.setGameState(this.serialize());
  }

  this.actuator.actuate(this.grid, {
    score:      this.score,
    over:       this.over,
    won:        this.won,
    bestScore:  this.storageManager.getBestScore(),
    terminated: this.isGameTerminated()
  });

};

// Represent the current game as an object
GameManager.prototype.serialize = function () {
  return {
    grid:        this.grid.serialize(),
    score:       this.score,
    over:        this.over,
    won:         this.won,
    keepPlaying: this.keepPlaying
  };
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this;

  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  var cell, tile;

  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next      = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += merged.value;
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
    this.addRandomTile();

    if (!this.movesAvailable()) {
      this.over = true; // Game over!
    }

    this.actuate();
  }
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1 }, // Up
    1: { x: 1,  y: 0 },  // Right
    2: { x: 0,  y: 1 },  // Down
    3: { x: -1, y: 0 }   // Left
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.grid.withinBounds(cell) &&
           this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = self.grid.cellContent(cell);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};
