// This implements a left-hand / right-hand rule pair

const ACTION = {
    WAIT: 0,
    FORWARD: 1,
    TURN_RIGHT: 2,
    TURN_AROUND: 3,
    TURN_LEFT: 4,
}

let botMemory = undefined;

let hugWall = (vis, mem, wall, innerTurn, outerTurn) => {
    if (mem.justTurned) {
        mem.justTurned = false;
        mem.sideBehind = true;
        return ACTION.FORWARD;
    }
    let ahead = vis.ahead[0].ahead;
    let side = vis.ahead[0][wall];
    let sideBehind = mem.sideBehind;
    mem.sideBehind = side;
    console.log(ahead, side, mem);
    if (side) {
        if (ahead) return outerTurn;
        else return ACTION.FORWARD;
    }
    else {
        if (sideBehind) {
            mem.justTurned = true;
            return innerTurn;
        }
        else if (ahead) {
            return (random() < 0.5)? ACTION.TURN_LEFT : ACTION.TURN_RIGHT;
        }
        else return ACTION.FORWARD;
    }
}

return {
    startRound: () => {
        botMemory = [
            {
                sideBehind: false,
                justTurned: false
            },
            {
                sideBehind: false,
                justTurned: false
            }
        ];
    },
    takeTurn: ([visA, visB]) => [
        hugWall(visA, botMemory[0], 'left', ACTION.TURN_LEFT, ACTION.TURN_RIGHT),
        hugWall(visB, botMemory[1], 'right', ACTION.TURN_RIGHT, ACTION.TURN_LEFT)
    ]
}
