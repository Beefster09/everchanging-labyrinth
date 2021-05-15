
class Maze {
    constructor(size) {
        this.maze = []
    }
}

function initGame() {
    let canvas = document.getElementById('viewport');
    let {width, height} = canvas;
    let ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ccc';
    ctx.fillRect(0, 0, width, height);
}
