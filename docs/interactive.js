"use strict";

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
    let ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ccc';
    ctx.fillRect(0, 0, width, height);

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

    let advCode = document.getElementById('new-adv-code');
    let mmCode = document.getElementById('new-mm-code');

    let sched = interactiveScheduler(delayControl, pausePlay, stepBtn);

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

        manager.startGame(selectedMM, selectedAdv, seedInput.value, sched)
            .then(game => window.alert("done"))
    })
}
