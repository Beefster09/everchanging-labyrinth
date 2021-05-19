"use strict";

// Rendering code

const MAZE_STYLE = {
    // colors
    colors: {
        background: '#F5F5F5',
        border: '#212121',
        walls: '#424242',
        grid: '#BDBDBD',

        adv1: '#f44336',
        adv1Stroke: '#b71c1c',
        adv2VisibleCell: '#ffcdd2',
        adv2VisibleWall: '#c62828',

        adv2: '#2196F3',
        adv2Stroke: '#0D47A1',
        adv2VisibleCell: '#BBDEFB',
        adv2VisibleWall: '#1565C0',

        advBothVisibleCell: '#E1BEE7',
        advBothVisibleWall: '#6A1B9A',

        addedWall: '#2E7D32',
        removedWall: '#FFCA28',
    },
    lines: {
        border: 4,
        walls: 3,
        grid: 1,
        adv: 2,
    },
    padding: 20
};

const ADVENTURER_SHAPE = {
    north: [
        [0.2, 0.8],
        [0.5, 0.2],
        [0.8, 0.8]
    ],
    south: [
        [0.2, 0.2],
        [0.5, 0.8],
        [0.8, 0.2]
    ],
    east: [
        [0.2, 0.2],
        [0.8, 0.5],
        [0.2, 0.8]
    ],
    west: [
        [0.8, 0.2],
        [0.2, 0.5],
        [0.8, 0.8]
    ],
};

function renderGame(game, canvasDims, drawCtx, turnCounter, scoreTracker, force) {
    if (!game.dirty && !force) return;
    game.dirty = false;

    if (turnCounter) {
        turnCounter.innerHTML = game.turnNumber;
    }
    if (scoreTracker) {
        scoreTracker.innerHTML = game.score;
    }

    const [fullWidth, fullHeight] = canvasDims;

    const outerSize = Math.min(fullHeight, fullWidth);
    const innerSize = outerSize - 2 * MAZE_STYLE.padding;
    const cellSize = innerSize / game.mazeSize;
    const left = fullWidth / 2 - outerSize / 2 + MAZE_STYLE.padding;
    const top = fullHeight / 2 - outerSize / 2 + MAZE_STYLE.padding;
    const right = left + innerSize;
    const bottom = top + innerSize;

    // Fill in the background
    drawCtx.fillStyle = MAZE_STYLE.colors.background;
    drawCtx.fillRect(0, 0, fullWidth, fullHeight);

    // Draw the grid lines
    drawCtx.strokeStyle = MAZE_STYLE.colors.grid;
    drawCtx.lineWidth = MAZE_STYLE.lines.grid;

    drawCtx.beginPath();
    for (let i = 1; i < game.mazeSize; i++) {
        drawCtx.moveTo(left + i * cellSize, top);
        drawCtx.lineTo(left + i * cellSize, bottom);
        drawCtx.moveTo(left, top + i * cellSize);
        drawCtx.lineTo(right, top + i * cellSize);
    }
    drawCtx.stroke();

    // Draw the walls
    drawCtx.strokeStyle = MAZE_STYLE.colors.walls;
    drawCtx.lineWidth = MAZE_STYLE.lines.walls;
    drawCtx.beginPath();
    game.maze.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (cell.east) {
                drawCtx.moveTo(left + (colIndex + 1) * cellSize, top + rowIndex * cellSize);
                drawCtx.lineTo(left + (colIndex + 1) * cellSize, top + (rowIndex + 1) * cellSize);
            }
            if (cell.south) {
                drawCtx.moveTo(left + colIndex * cellSize, top + (rowIndex + 1) * cellSize)
                drawCtx.lineTo(left + (colIndex + 1) * cellSize, top + (rowIndex + 1) * cellSize);
            }
        })
    })
    drawCtx.stroke();

    // Draw the adventurers
    const [advA, advB] = game.adv;

    function drawAdv(adv, points, drawProps) {
        Object.assign(drawCtx, drawProps ?? {});
        drawCtx.beginPath();
        let first = true;
        points.forEach(([x, y]) => {
            drawCtx[(first? 'moveTo' : 'lineTo')](left + (adv.col + x) * cellSize, top + (adv.row + y) * cellSize);
            first = false;
        });
        drawCtx.closePath();
        drawCtx.fill();
        drawCtx.stroke();
    }

    drawAdv(
        game.adv[0],
        ADVENTURER_SHAPE[game.adv[0].dir],
        {
            fillStyle: MAZE_STYLE.colors.adv1,
            strokeStyle: MAZE_STYLE.colors.adv1Stroke,
            lineWidth: MAZE_STYLE.lines.adv
        }
    );
    drawAdv(
        game.adv[1],
        ADVENTURER_SHAPE[game.adv[1].dir],
        {
            fillStyle: MAZE_STYLE.colors.adv2,
            strokeStyle: MAZE_STYLE.colors.adv2Stroke,
            lineWidth: MAZE_STYLE.lines.adv
        }
    );

    // Finally, draw the border
    drawCtx.strokeStyle = MAZE_STYLE.colors.border;
    drawCtx.lineWidth = MAZE_STYLE.lines.border;
    drawCtx.strokeRect(left, top, innerSize, innerSize);
}

// more controllery stuff

function loadSourceInto(sourceURL, destElement) {
    fetch(sourceURL, {}).then(resp => {
        if (resp.ok) resp.text().then(src => {destElement.value = src})
    })
}

function interactiveScheduler(speedControl, pausePlay, step) {
    let paused = false;
    let delay = parseInt(speedControl.value);
    let next = undefined;
    let scheduleHandle = undefined;

    pausePlay.value = 'Pause';

    function schedule(func) {
        if (!func) return;
        if (scheduleHandle) return scheduleHandle;
        next = func;
        if (!paused) {
            scheduleHandle = setTimeout(() => {
                scheduleHandle = undefined;
                func();
            }, delay);
            return scheduleHandle;
        }
    }

    speedControl.addEventListener('input', ev => {delay = parseInt(ev.target.value)});
    pausePlay.addEventListener('click', ev => {
        if (paused) {
            paused = false;
            pausePlay.value = 'Pause';
            scheduleHandle = undefined;
            next();
        }
        else {
            paused = true;
            pausePlay.value = 'Play';
            if (scheduleHandle) {
                clearTimeout(scheduleHandle);
            }
        }
    });
    step.addEventListener('click', ev => {
        if (!paused) {
            paused = true;
            pausePlay.value = 'Play';
            if (scheduleHandle) {
                clearTimeout(scheduleHandle);
            }
        }
        next();
    })

    return schedule;
}

function initPage() {
    let canvas = document.getElementById('viewport');
    let {width, height} = canvas;
    let drawCtx = canvas.getContext('2d');

    let manager = new GameManager();
    // TODO: scrape from challenge page
    let currentGame = undefined;

    let seedInput = document.getElementById('seed-input');
    let startButton = document.getElementById('start-button');
    let advSelect = document.getElementById('adv-selector');
    let mmSelect = document.getElementById('mm-selector');

    let delayControl = document.getElementById('delay-control');
    let pausePlay = document.getElementById('pause-play');
    let stepBtn = document.getElementById('step-btn');

    let scoreTracker = document.getElementById('score-tracker');
    let turnCounter = document.getElementById('turn-counter');

    let advCode = document.getElementById('new-adv-code');
    let mmCode = document.getElementById('new-mm-code');

    let sched = interactiveScheduler(delayControl, pausePlay, stepBtn);

    function renderLoop() {
        if (currentGame) {
            renderGame(currentGame, [width, height], drawCtx, turnCounter, scoreTracker);
            requestAnimationFrame(renderLoop);
        }
    }

    startButton.addEventListener('click', ev => {
        if (currentGame) {
            return;
        }

        let selectedAdv = advSelect.value;
        if (!selectedAdv) {
            selectedAdv = '<New Adventurer>';
            manager.addBot('adventurers', selectedAdv, advCode.value);
        }

        let selectedMM = mmSelect.value;
        if (!selectedMM) {
            selectedMM = '<New Maze Master>';
            manager.addBot('mazemaster', selectedMM, mmCode.value);
        }

        let [createdGame, promise] = manager.startGame(selectedMM, selectedAdv, seedInput.value, sched);
        currentGame = createdGame;
        promise.then(game => {currentGame = undefined})
        promise.catch(game => {currentGame = undefined})

        renderLoop();
    })
}
