"use strict";

// Special thanks to https://github.com/bryc/code/blob/master/jshash/PRNGs.md
// for various CC-0 javascript implementations various rng algorithms

function sfc32(a, b, c, d) {
    return function() {
      a |= 0; b |= 0; c |= 0; d |= 0;
      var t = (a + b | 0) + d | 0;
      d = d + 1 | 0;
      a = b ^ b >>> 9;
      b = c + (c << 3) | 0;
      c = c << 21 | c >>> 11;
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    }
}

function xmur3a(str) {
    for(var k, i = 0, h = 2166136261 >>> 0; i < str.length; i++) {
        k = Math.imul(str.charCodeAt(i), 3432918353); k = k << 15 | k >>> 17;
        h ^= Math.imul(k, 461845907); h = h << 13 | h >>> 19;
        h = Math.imul(h, 5) + 3864292196 | 0;
    }
    h ^= str.length;
    return function() {
        h ^= h >>> 16; h = Math.imul(h, 2246822507);
        h ^= h >>> 13; h = Math.imul(h, 3266489909);
        h ^= h >>> 16;
        return h >>> 0;
    }
}

function seededRandom(seedString) {
    let seed = xmur3a(seedString);
    let rand = sfc32(seed(), seed(), seed(), 1);
    for (let i = 0; i < 15; i++) { rand(); }
    return rand;
}

const SEED_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function genRandomSeed() {  // this does not need to be reproducible, so Math.random() is fine
    let seedString = '';
    for (let i = 0; i < 8; i++) {
        seedString += SEED_CHARS[Math.floor(Math.random() * SEED_CHARS.length)];
    }
    return seedString;
}


// lazy cached fibonacci
const fib = function () {
    var cache = [1, 1];

    return function fib(n) {
        while (n >= cache.length) {
            cache.push(cache[cache.length - 1] + cache[cache.length - 2]);
        }
        return cache[n];
    }
}();

// And onto game-specific classes and such

class Strike extends Error {
    constructor(message, who) {
        super(message);
        this.who = who;
        this.name = this.constructor.name;
    }
}

class Maze {
    constructor(size) {
        this.maze = []
    }
}

const GEN_COMPUTE_FACTOR = 1; // ms of compute time allotted per cell to generate a maze
const ADV_START_ROUND_COMPUTE = 10; // ms of compute time allotted to adventurers for startRound
const TURN_COMPUTE  = 1; // ms of compute time allotted per turn
const ROUND_COMPUTE = 50;  // ms of compute time allotted at the beginning of each round

const ADV_ACTIONS = {
    WAIT: 0,
    FORWARD: 1,
    TURN_RIGHT: 2,
    TURN_AROUND: 3,
    TURN_LEFT: 4,
}

const TURNS_PER_ROUND = 1000;
const SCORE_PER_COMPLETED_MAZE = 1000;

const REL_WALLS = {
    north: [-1, 0, 'south'],
    south: [0, 0, 'south'],
    east:  [0, 0, 'east'],
    west:  [0, -1, 'east'],
};

const OFFSET_BY_DIR = {
    north: [-1, 0],
    south: [+1, 0],
    east:  [0, +1],
    west:  [0, -1],
}

const DIRS_CIRCLE = [
    'north',
    'east',
    'south',
    'west',
]
function rotate(dir, turns) {
    return DIRS_CIRCLE[
        (DIRS_CIRCLE.indexOf(dir) + turns) % DIRS_CIRCLE.length
    ];
}

const WALLS_BY_DIR = {
    north: {
        ahead: REL_WALLS.north,
        left: REL_WALLS.west,
        right: REL_WALLS.east,
    },
    south: {
        ahead: REL_WALLS.south,
        left: REL_WALLS.east,
        right: REL_WALLS.west,
    },
    east: {
        ahead: REL_WALLS.east,
        left: REL_WALLS.north,
        right: REL_WALLS.south,
    },
    west: {
        ahead: REL_WALLS.west,
        left: REL_WALLS.south,
        right: REL_WALLS.north,
    },
};

function wrapBot(factory, randomFunc, methods) {
    const name = factory.botName;
    let localLogs = [];
    let localMath = Object.create(Math);
    localMath.random = randomFunc;
    function wrapMethod(boundMethod) {
        return (...args) => {
            const before = performance.now();
            let elapsed = Infinity;
            try {
                var ret = boundMethod(...args);
            }
            catch (err) {
                console.error(err);
                throw new Strike(`${err.name} in ${name}: ${err.message}`, name);
            }
            finally {
                elapsed = performance.now() - before;
                for (let args of localLogs.splice(0)) {
                    console.log(...args);
                }
            }
            return [ret, elapsed];
        };
    }
    let botObj = factory(randomFunc, localMath, localLogs);
    let wrapper = {
        name: factory.botName
    }
    for (let method of methods) {
        wrapper[method] = wrapMethod(botObj[method].bind(botObj));
    }
    return wrapper;
}

class Game {
    constructor(mmFactory, advFactory, randomSeed) {
        if (!randomSeed) {
            randomSeed = genRandomSeed();
            console.log("No random seed was given! Using " + randomSeed);
        }

        this.logs = [];

        this.mmBot = wrapBot(
            mmFactory,
            seededRandom(randomSeed + ':M'),
            ['generateMaze', 'takeTurn']
        );
        this.mmCompute = 0;
        this.mmMana = 0;

        this.advBot = wrapBot(
            advFactory,
            seededRandom(randomSeed + ':A'),
            ['startRound', 'takeTurn']
        );
        this.advCompute = 0;
        this.adv = undefined;

        this.mazeSize = 2; // will be set to 3 on first newRound() call
        this.maze = undefined;
        this.turnNumber = undefined;

        this.score = 0;
        this.dirty = true;

        this.lastActions = undefined;
    }

    // startRound and doTurn return the next function to call to advance the game by one step... for now

    startRound() {
        this.dirty = true;
        this.mazeSize++;
        const mmTimeLimit = this.mazeSize * this.mazeSize * GEN_COMPUTE_FACTOR;
        const [returnedBoard, genDuration] = this.mmBot.generateMaze(this.mazeSize);
        if (genDuration > mmTimeLimit) {
            throw new Strike(
                `${this.mmBot.name}.generateMaze() took too long to execute (time limit is ${mmTimeLimit}ms)`
            )
        }

        if (returnedBoard.length != this.mazeSize) {
            throw new Strike(
                `Maze returned by ${this.mmBot.name}.generateMaze() has an incorrect number of rows.`
                + ` (Expected ${this.mazeSize} rows, got ${returnedBoard.length} rows)\n`
                + JSON.stringify(returnedBoard, null, '\t'),
                this.mmBot.name
            )
        }

        this.maze = returnedBoard.map((row, rowIndex) => {
            if (row.length != this.mazeSize) {
                throw new Strike(
                    `Row ${rowIndex} of maze returned by ${this.mmBot.name}.generateMaze() has an incorrect number of cells.`
                    + ` (Expected ${this.mazeSize} cells, got ${row.length} cells)\n`
                    + JSON.stringify(returnedBoard, null, '\t'),
                    this.mmBot.name
                )
            }
            return row.map((cell, cellIndex) => {
                if (cellIndex + 1 < this.mazeSize && !cell.hasOwnProperty('east')) {
                    throw new Strike("bleh", this.mmBot.name);
                }
                if (rowIndex + 1 < this.mazeSize && !cell.hasOwnProperty('south')) {
                    throw new Strike("bleh", this.mmBot.name);
                }
                return {
                    east: (cellIndex + 1 < this.mazeSize)? !!cell.east : null,
                    eastChangeCount: 0,
                    south: (rowIndex + 1 < this.mazeSize)? !!cell.south : null,
                    southChangeCount: 0,
                }
            })
        });

        if (!this.mazeIsFullyConnected()) {
            throw new Strike(
                `Maze returned by ${this.mmBot.name}.generateMaze() is not fully-connected\n`
                + JSON.stringify(returnedBoard, null, '\t'),
                this.mmBot.name
            );
        }

        const advDuration = this.advBot.startRound(this.mazeSize)[1];
        if (advDuration > ADV_START_ROUND_COMPUTE) {
            throw new Strike(
                `${this.advBot.name}.startRound() took too long to execute (time limit is ${ADV_START_ROUND_COMPUTE}ms, but it took ${advDuration}ms)`,
                this.advBot.name
            );
        }

        this.mmMana = 0;

        this.mmCompute = ROUND_COMPUTE;
        this.advCompute = ROUND_COMPUTE;

        this.turnNumber = 0;  // will be incremented in doTurn
        this.adv = [
            {
                row: 0,
                col: 0,
                dir: 'east',
            },
            {
                row: 0,
                col: 0,
                dir: 'south',
            },
        ];

        return this.doTurn.bind(this)
    }

    doTurn() {
        this.dirty = true;
        this.turnNumber++;

        const vision = [
            this.calculateVision(this.adv[0], this.adv[1]),
            this.calculateVision(this.adv[1], this.adv[0]),
        ];
        const [moves, advTime] = this.advBot.takeTurn(vision);
        this.advCompute += TURN_COMPUTE - advTime;
        if (this.advCompute < 0) {
            throw new Strike(
                `${this.advBot.name} exceeded its compute quota`,
                this.advBot.name
            );
        }

        moves.forEach((move, i) => {
            switch (move) {
                case ADV_ACTIONS.FORWARD: {
                    const {row, col, dir} = this.adv[i]
                    const [dr, dc, dw] = REL_WALLS[dir];
                    const [or, oc] = OFFSET_BY_DIR[dir];

                    if (this.checkWall(row + dr, col + dc, dw)) {
                        return
                    }

                    this.adv[i].row += or;
                    this.adv[i].col += oc;
                } break;
                case ADV_ACTIONS.TURN_RIGHT:
                case ADV_ACTIONS.TURN_AROUND:
                case ADV_ACTIONS.TURN_LEFT: {
                    this.adv[i].dir = rotate(this.adv[i].dir, 1 + move - ADV_ACTIONS.TURN_RIGHT);
                } break;
                case ADV_ACTIONS.WAIT:
                default:
                    break;
            }
        })

        this.score--;

        if (this.adv.some(({row, col}) => row >= this.mazeSize - 1 && col >= this.mazeSize - 1)) {
            // Adventurers win! Onto the next maze!
            this.score += SCORE_PER_COMPLETED_MAZE;
            this.lastActions = [...moves, null, null];
            return this.startRound.bind(this)
        }
        else if (this.turnNumber >= TURNS_PER_ROUND) {
            // GAME OVER
            this.lastActions = [...moves, null, null];
            return null
        }
        else {
            // There are still more turns that can be taken this round, so the maze master gets to do something now
            this.mmMana += Math.floor(1 + Math.log(this.turnNumber) / Math.log(this.mazeSize));
            const [mmActions, mmTime] = this.mmBot.takeTurn(this.mmMana, this.maze.map(
                row => row.map(
                    cell => ({
                        east: cell.east,
                        eastCost: fib(cell.eastChangeCount),
                        south: cell.south,
                        southCost: fib(cell.southChangeCount),
                    })
                )
            ));

            this.mmCompute += TURN_COMPUTE - mmTime;
            if (this.mmCompute < 0) {
                throw new Strike(
                    `${this.mmBot.name} exceeded its compute quota`,
                    this.mmBot.name
                );
            }

            if (mmActions == null) { // nothing to do
                this.lastActions = [...moves, null, null];
                return this.doTurn.bind(this);
            }

            let assert = pred => {
                if (!pred) throw new Strike(
                    `${this.mmBot.name}.takeTurn() returned an incompatible object.`
                    + " (it must be nullish or an array of length 2 with wall coordinates or nulls)"
                )
            }
            // Verify schema of return value
            assert(Array.isArray(mmActions) && mmActions.length == 2);
            for (let item of mmActions) {
                if (item != null) assert(
                    Array.isArray(item)
                    && item.length == 3
                    && typeof(item[0]) == 'number'
                    && typeof(item[1]) == 'number'
                    && ['south', 'east'].includes(item[2])
                )
            }

            const [removeWall, addWall] = mmActions;

            // Do nothing if both coordinates are the same
            if (
                removeWall != null
                && addWall != null
                && removeWall.every((item, i) => item === addWall[i])
            ) {
                this.lastActions = [...moves, null, null];
                return this.doTurn.bind(this);
            }

            let totalCost = 0;
            if (removeWall && this.checkWall(...removeWall)) {
                totalCost += this.costToChange(...removeWall);
            }
            if (addWall && !this.checkWall(...addWall)) {
                totalCost += this.costToChange(...addWall);
            }

            if (totalCost <= this.mmMana) {
                this.mmMana -= totalCost;

                let removePossible = removeWall? !this.adv.some(adv => this.isWallVisible(adv, ...removeWall)) : false;
                let addPossible    = addWall?    !this.adv.some(adv => this.isWallVisible(adv, ...addWall))    : false;

                if (removePossible) this.changeWall(...removeWall, false);
                if (addPossible)    this.changeWall(...addWall,    true);

                if (!this.mazeIsFullyConnected()) {
                    throw new Strike(
                        `Maze modified by ${this.mmBot.name}.takeTurn() is not fully-connected\n`
                        + JSON.stringify(this.maze, null, '\t'),
                        this.mmBot.name
                    );
                }
            }

            this.lastActions = [...moves, removeWall, addWall];
            return this.doTurn.bind(this);
        }
    }

    start(scheduler) {
        let game = this;
        scheduler ??= setTimeout;  // full-speed execution by default

        return new Promise((resolve, reject) => {
            function engine(step) {
                return () => {
                    try {
                        const next = step();
                        if (next) {
                            scheduler(engine(next));
                        }
                        else {
                            resolve(game);
                        }
                    }
                    catch (err) {
                        reject(err);
                    }
                };
            }
            engine(this.startRound.bind(this))();
        });
    }

    checkWall(row, col, wall) {
        // check borders
        if (row < 0 || col < 0) return true;
        if (col >= this.mazeSize - (wall == 'east')) return true;
        if (row >= this.mazeSize - (wall == 'south')) return true;
        // ok, it's inside the maze, so look at the walls
        return !! this.maze[row][col][wall];
    }

    costToChange(row, col, wall) {
        if (row < 0 || col < 0) return 0;
        else if (col >= this.mazeSize - (wall == 'east')) return 0;
        else if (row >= this.mazeSize - (wall == 'south')) return 0;

        return fib(this.maze[row][col][wall + 'ChangeCount']);
    }

    changeWall(row, col, wall, value) {
        if (row < 0 || col < 0) return;
        if (col >= this.mazeSize - (wall == 'east')) return;
        if (row >= this.mazeSize - (wall == 'south')) return;
        if (value == !!this.maze[row][col][wall]) return;  // no change
        this.maze[row][col][wall] = value;
        this.maze[row][col][wall + 'ChangeCount']++;
    }

    isWallVisible(adv, row, col, wall) {
        // Fast-fail walls behind the adventurer
        switch (adv.dir) {
            case 'north':
                if (adv.row <= row) return false;
                break;
            case 'south':
                if (adv.row > row) return false;
                break;
            case 'east':
                if (adv.col > col) return false;
                break;
            case 'west':
                if (adv.col <= col) return false;
                break;
        }
        // And then do hard calculations...
        const {left: [lr, lc, lw], right: [rr, rc, rw], ahead: [ar, ac, aw]} = WALLS_BY_DIR[adv.dir];
        const [dr, dc] = OFFSET_BY_DIR[adv.dir];

        const sameCoords = (r, c, w) => row === r && col === c && wall === w;
        const wallCoords = (r, c) => ({
            ahead: [r + ar, c + ac, aw],
            left:  [r + lr, c + lc, lw],
            right: [r + rr, c + rc, rw],
        });
        const cellHasMatch = cell => (
               sameCoords(...cell.ahead)
            || sameCoords(...cell.left)
            || sameCoords(...cell.right)
        );

        let curCell = wallCoords(adv.row, adv.col);
        if (cellHasMatch(curCell)) return true;
        if (!this.checkWall(...curCell.left)  && sameCoords(adv.row - dc + ar, adv.col + dr + ac, aw)) return true;
        if (!this.checkWall(...curCell.right) && sameCoords(adv.row + dc + ar, adv.col - dr + ac, aw)) return true;
        let vRow = adv.row + dr;
        let vCol = adv.col + dc;
        while (!this.checkWall(...curCell.ahead)) {
            curCell = wallCoords(vRow, vCol);
            if (cellHasMatch(curCell)) return true;
            vRow += dr;
            vCol += dc;
        }
        return false;
    }

    calculateVision({row, col, dir}, {row: otherRow, col: otherCol}) {
        const {left: [lr, lc, lw], right: [rr, rc, rw], ahead: [ar, ac, aw]} = WALLS_BY_DIR[dir];
        const [dr, dc] = OFFSET_BY_DIR[dir];

        const cellVision = (r, c) => ({
            ahead: this.checkWall(r + ar, c + ac, aw),
            left:  this.checkWall(r + lr, c + lc, lw),
            right: this.checkWall(r + rr, c + rc, rw),
        });

        let vision = {
            ahead: [cellVision(row, col)],
            leftAhead: null,
            rightAhead: null,
            friend: (row == otherRow && col == otherCol)? [0, 0] : null,
        }

        while (!vision.ahead[vision.ahead.length - 1].ahead) {
            let len = vision.ahead.length;
            if (len > this.mazeSize) {
                throw Error("Something is going horribly wrong. ABORT!");
            }
            vision.ahead.push(cellVision(row + len * dr, col + len * dc));
            if (otherRow == row + len * dr && otherCol == col + len * dc) {
                vision.friend = [len, 0];
            }
        }
        if (!vision.ahead[0].left) {
            vision.leftAhead = this.checkWall(row - dc + ar, col + dr + ac, aw);
            if (otherRow == row - dc && otherCol == col + dr) {
                vision.friend = [0, -1];
            }
        }
        if (!vision.ahead[0].right) {
            vision.rightAhead = this.checkWall(row + dc + ar, col - dr + ac, aw);
            if (otherRow == row + dc && otherCol == col - dr) {
                vision.friend = [0, 1];
            }
        }

        return vision;
    }

    mazeIsFullyConnected() {
        try {
            const size = this.mazeSize;
            const maze = this.maze;
            let visited = [...Array(size)].map(r => [...Array(size)]);
            let markCount = 0;
            function checkCell(row, col) {
                if (visited[row][col]) return;
                visited[row][col] = true;
                markCount++;
                if (row < size - 1 && !maze[row][col].south)     checkCell(row + 1, col);
                if (row > 0        && !maze[row - 1][col].south) checkCell(row - 1, col);
                if (col < size - 1 && !maze[row][col].east)      checkCell(row, col + 1);
                if (col > 0        && !maze[row][col - 1].east)  checkCell(row, col - 1);
            }
            checkCell(0, 0);
            return markCount == this.mazeSize * this.mazeSize;
        }
        catch (err) {
            console.error(err);
            return false;
        }
    }
}

const BOT_HEADER = ( // Code header to make most obvious rulebreaking less convenient
      '"use strict";'
    + 'const self = undefined;'
    + 'const window = undefined;'
    + 'const globalThis = undefined;'
    + 'const document = undefined;'
    + 'const setTimeout = () => undefined;'
    + 'const console = {'
        + 'log: (...args) => _logs_.push(args)'
    + '};'
)
const MAZE_MASTER = 0;
const ADVENTURERS = 1;


class GameManager {
    constructor() {
        this.bots = [{}, {}];
        this.resetScores();
    }

    resetScores() {
        this.scoreHistory = {}
    }

    addBot(type, name, sourceCode) {
        const concatenated = BOT_HEADER + sourceCode;
        let factory = undefined;
        try {
            factory = new Function('random', 'Math', '_logs_', concatenated);
        }
        catch (err) {
            console.log(concatenated);
            throw err;
        }
        factory.botName = name;
        switch(type.trim().replace(/[ _-]/, '').toLowerCase()) {
            case 'adventurer':
            case 'adventurers':
                this.bots[ADVENTURERS][name] = factory;
                break;
            case 'mazemaster':
                this.bots[MAZE_MASTER][name] = factory;
                break;
            default:
                throw Error("Invalid bot type: " + type);
        }
    }

    startGame(mmName, advName, seed, scheduler) {
        let game = new Game(this.bots[MAZE_MASTER][mmName], this.bots[ADVENTURERS][advName], seed);
        let promise = game.start(scheduler)
        return [game, promise];
    }
}
