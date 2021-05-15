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

class DisqualifyError extends Error {
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
const ADV_START_ROUND_COMPUTE = 1; // ms of compute time allotted to adventurers for startRound
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

class Game {
    constructor(mmFactory, advFactory, randomSeed) {
        if (!randomSeed) {
            randomSeed = genRandomSeed();
            console.log("No random seed was given! Using " + randomSeed);
        }

        this.mmBot = mmFactory(seededRandom(randomSeed + ':M'));
        this.mmBotName = mmFactory.botName;
        this.mmCompute = 0;
        this.mmMana = 0;

        this.advBot = advFactory(seededRandom(randomSeed + ':A'));
        this.advBotName = advFactory.botName;
        this.advCompute = 0;
        this.adv = undefined;

        this.mazeSize = 2; // will be set to 3 on first newRound() call
        this.maze = undefined;
        this.turnNumber = undefined;

        this.score = 0;
        this.next = this.startRound;
    }

    // startRound and doTurn return the next function to call to advance the game by one step... for now

    startRound() {
        this.mazeSize++;
        const beforeGen = Performance.now();
        const returnedBoard = this.mmBot.generateMaze(this.mazeSize);
        const genDuration = Performance.now() - beforeGen;
        const mmTimeLimit = this.mazeSize * this.mazeSize * GEN_COMPUTE_FACTOR;
        if (genDuration > mmTimeLimit) {
            throw new DisqualifyError(
                `${this.mmBotName}.generateMaze() took too long to execute (time limit is ${mmTimeLimit}ms)`
            )
        }

        if (returnedBoard.length != this.mazeSize) {
            throw new DisqualifyError(
                `Maze returned by ${this.mmBotName}.generateMaze() has an incorrect number of rows.`
                + ` (Expected ${this.mazeSize} rows, got ${returnedBoard.length} rows)\n`
                + JSON.stringify(returnedBoard, null, '\t'),
                this.mmBotName
            )
        }

        this.maze = returnedBoard.map((row, rowIndex) => {
            if (row.length != this.mazeSize) {
                throw new DisqualifyError(
                    `Row ${rowIndex} of maze returned by ${this.mmBotName}.generateMaze() has an incorrect number of cells.`
                    + ` (Expected ${this.mazeSize} cells, got ${row.length} cells)\n`
                    + JSON.stringify(returnedBoard, null, '\t'),
                    this.mmBotName
                )
            }
            return row.map((cell, cellIndex) => {
                // if ( !(cell.east === true || cell.east === false || cellIndex + 1 == this.mazeSize && cell.east == null) ) {
                //     throw new DisqualifyError(
                //         `Cell at row ${rowIndex}, column ${colIndex}`
                //         + ` of maze returned by ${this.mmBotName}.generateMaze()`
                //         + ` does not define a valid east wall (got ${cell.east})\n`
                //         + JSON.stringify(returnedBoard, null, '\t'),
                //         this.mmBotName
                //     );
                // }
                // if ( !(cell.south === true || cell.south === false || rowIndex + 1 == this.mazeSize && cell.south == null) ) {
                //     throw new DisqualifyError(
                //         `Cell at row ${rowIndex}, column ${colIndex}`
                //         + ` of maze returned by ${this.mmBotName}.generateMaze()`
                //         + ` does not define a valid south wall (got ${cell.south})\n`
                //         + JSON.stringify(returnedBoard, null, '\t'),
                //         this.mmBotName
                //     );
                // }
                return {
                    east: (cellIndex + 1 == this.mazeSize)? !!cell.east : null,
                    eastChangeCount: 0,
                    south: (rowIndex + 1 == this.mazeSize)? !!cell.south : null,
                    southChangeCount: 0,
                }
            })
        });


        let beforeAdv = Performance.now();
        this.advBot.startRound(this.mazeSize);
        let advDuration = Performance.now() - beforeAdv;
        if (advDuration > ADV_START_ROUND_COMPUTE) {
            throw new DisqualifyError(
                `${this.advBotName}.startRound() took too long to execute (time limit is ${ADV_START_ROUND_COMPUTE}ms)`,
                this.advBotName
            );
        }

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

        return this.doTurn
    }

    doTurn() {
        this.turnNumber++;

        const vision = this.adv.map(this.calculateVision);
        const beforeMove = Performance.now();
        const moves = this.advBot.takeTurn(vision);
        this.advCompute += TURN_COMPUTE - (Performance.now() - beforeMove);
        if (this.advCompute < 0) {
            throw new DisqualifyError(
                `${this.advBotName} exceeded its compute quota`,
                this.advBotName
            );
        }

        // TODO: process move

        this.score--;

        if (this.adv.some(({row, col}) => row + 1 == this.boardSize && col + 1 == this.boardSize)) {
            // Adventurers win! Onto the next maze!
            return this.startRound
        }
        else if (this.turnNumber >= TURNS_PER_ROUND) {
            // GAME OVER
            return null
        }
        else {
            // There are still more turns that can be taken this round, so the maze master gets to do something now
            this.mmMana += 1 + Math.log(this.turnNumber) / Math.log(this.boardSize);
            const mazeWithCost = this.maze.map(
                row => row.map(
                    cell => ({
                        east: cell.east,
                        eastCost: fib(cell.eastChangeCount),
                        south: cell.south,
                        southCost: fib(cell.southChangeCount),
                    })
                )
            );
            const beforeChange = Performance.now();
            const [removeWall, addWall] = this.mmBot.takeTurn(this.mmMana, mazeWithCost);
            this.mmCompute += TURN_COMPUTE - (Performance.now() - beforeChange);
            if (this.mmCompute < 0) {
                throw new DisqualifyError(
                    `${this.mmBotName} exceeded its compute quota`,
                    this.mmBotName
                );
            }
            return this.doTurn
        }
    }

    run() {
        //
    }

    calculateVision(location) {
        let vision = {
            forward: [],
            left: null,
            right: null,
        }

    }
}

const BOT_HEADER = // Code header to make most obvious rulebreaking less convenient
`"use strict";
let self = undefined;
const window = undefined;
const globalThis = undefined;
const document = undefined;
const Math = Object.create(Math);
Math.random = random;
`;
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
        let factory = new Function('random', BOT_HEADER + sourceCode);
        factory.botName = name;
        switch(type.replace(/[ _-]/, '').toLowerCase()) {
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

    runGame(mmName, advName, seed) {
        let game = new Game(this.bots[MAZE_MASTER][mmName], this.bots[ADVENTURERS][advName], seed)
    }
}

function initGame() {
    let canvas = document.getElementById('viewport');
    let {width, height} = canvas;
    let ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ccc';
    ctx.fillRect(0, 0, width, height);

    let manager = new GameManager();
    let seedInput = document.getElementById('seed-input');
    let startButton = document.getElementById('start-button');
}


function loadSourceInto(sourceURL, destElement) {
    fetch(sourceURL, {}).then(resp => {
        if (resp.ok) resp.text().then(src => {destElement.value = src})
    })
}
