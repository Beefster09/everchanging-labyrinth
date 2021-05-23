"use strict";

// Rendering code

const MAZE_STYLE = {
    // colors
    lightColors: {
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
    darkColors: {
        background: '#212121',
        border: '#F5F5F5',
        walls: '#BDBDBD',
        grid: '#424242',

        adv1: '#f44336',
        adv1Stroke: '#ffcdd2',
        adv2VisibleCell: '#b71c1c',
        adv2VisibleWall: '#ef9a9a',

        adv2: '#2196F3',
        adv2Stroke: '#BBDEFB',
        adv2VisibleCell: '#0D47A1',
        adv2VisibleWall: '#90CAF9',

        advBothVisibleCell: '#4A148C',
        advBothVisibleWall: '#CE93D8',

        addedWall: '#A5D6A7',
        removedWall: '#FFB300',
    },
    lines: {
        border: 4,
        walls: 3,
        grid: 1,
        adv: 2,
    },
    padding: 4
};

MAZE_STYLE.colors = MAZE_STYLE.lightColors;

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

function renderGame(game, canvasDims, drawCtx, turnCounter, scoreTracker, manaTracker, force) {
    if (!game.dirty && !force) return;
    game.dirty = false;

    if (turnCounter) {
        turnCounter.innerHTML = game.turnNumber;
    }
    if (scoreTracker) {
        scoreTracker.innerHTML = game.score;
    }
    if (manaTracker) {
        manaTracker.innerHTML = game.mmMana;
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
    game.maze?.forEach((row, rowIndex) => {
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
    const [advA, advB] = game.adv ?? [undefined, undefined];

    function drawAdv(adv, points, drawProps) {
        if (adv == undefined) return;
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
        advA,
        ADVENTURER_SHAPE[advA?.dir],
        {
            fillStyle: MAZE_STYLE.colors.adv1,
            strokeStyle: MAZE_STYLE.colors.adv1Stroke,
            lineWidth: MAZE_STYLE.lines.adv
        }
    );
    drawAdv(
        advB,
        ADVENTURER_SHAPE[advB?.dir],
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

    function schedule(func) {
        next = func;
        if (!func) return;
        if (!paused) {
            scheduleHandle = setTimeout(() => {
                scheduleHandle = undefined;
                func();
            }, delay);
            return scheduleHandle;
        }
    }

    function cancel() {
        next = undefined;
        if (scheduleHandle) {
            clearTimeout(scheduleHandle);
            scheduleHandle = undefined;
        }
    }

    speedControl.addEventListener('input', ev => {delay = parseInt(ev.target.value)});
    pausePlay.addEventListener('click', ev => {
        if (paused) {
            paused = false;
            pausePlay.classList.remove('paused');
            scheduleHandle = undefined;
            next();
        }
        else {
            paused = true;
            pausePlay.classList.add('paused');
            if (scheduleHandle) {
                clearTimeout(scheduleHandle);
            }
        }
    });
    step.addEventListener('click', ev => {
        if (!paused) {
            paused = true;
            pausePlay.classList.add('paused');
            if (scheduleHandle) {
                clearTimeout(scheduleHandle);
            }
        }
        next();
    })

    return [schedule, cancel];
}

function initPage() {
    let canvas = document.getElementById('viewport');
    let {width, height} = canvas;
    let drawCtx = canvas.getContext('2d');

    let manager = new GameManager();
    // TODO: scrape from challenge page
    let currentGame = undefined;

    let seedInput = document.getElementById('seed-input');
    let startButton = document.getElementById('start-single-game');
    let advSelect = document.getElementById('adv-selector');
    let mmSelect = document.getElementById('mm-selector');

    let delayControl = document.getElementById('delay-control');
    let pausePlay = document.getElementById('pause-play');
    let stepBtn = document.getElementById('step-btn');

    let turnCounter = document.getElementById('turn-counter');
    let scoreTracker = document.getElementById('score-tracker');
    let manaTracker = document.getElementById('mana-tracker');

    let advCode = document.getElementById('new-adv-code');
    let mmCode = document.getElementById('new-mm-code');

    let [sched, cancel] = interactiveScheduler(delayControl, pausePlay, stepBtn);

    function renderLoop() {
        if (currentGame) {
            renderGame(currentGame, [width, height], drawCtx, turnCounter, scoreTracker, manaTracker);
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
    });

    for (let acc of document.getElementsByClassName('accordion')) {
        let panel = acc.nextElementSibling;
        if (acc.classList.contains('active')) {
            panel.style.height = panel.scrollHeight + 'px';
        }
        else {
            panel.style.height = '0px';
        }
        acc.addEventListener('click', ev => {
            if (acc.classList.contains('active')) {
                acc.classList.remove('active');
                panel.style.height = '0px';
            }
            else {
                acc.classList.add('active');
                panel.style.height = panel.scrollHeight + 'px';
            }
        });
        for (let textBox of panel.getElementsByTagName('textarea')) {
            textBox.addEventListener('mouseup', ev => {
                if (acc.classList.contains('active')) {
                    panel.style.height = panel.scrollHeight + 'px';
                }
            })
        }
    };

    document.getElementById('abandon-game').addEventListener('click', ev => {
        if (currentGame == undefined) return;
        if (window.confirm("Abandon currently running game?")) {
            cancel();
            currentGame = undefined;
        }
    });

    document.getElementById('column-swapper').addEventListener('click', ev => {
        let body = document.getElementById('everything');
        if (body.classList.contains('flip-columns')) {
            body.classList.remove('flip-columns');
        }
        else {
            body.classList.add('flip-columns');
        }
    });

    document.getElementById('theme-toggle').addEventListener('click', ev => {
        let body = document.getElementById('everything');
        if (body.classList.contains('light-mode')) {
            body.classList.remove('light-mode');
            body.classList.add('dark-mode');
            MAZE_STYLE.colors = MAZE_STYLE.darkColors;
        }
        else {
            body.classList.remove('dark-mode');
            body.classList.add('light-mode');
            MAZE_STYLE.colors = MAZE_STYLE.lightColors;
        }
        if (currentGame) {
            renderLoop(true);
        }
        else {
            drawCtx.clearRect(0, 0, width, height);
        }
    });
}
