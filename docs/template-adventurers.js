const ACTION = {
    WAIT: 0,
    FORWARD: 1,
    TURN_RIGHT: 2,
    TURN_AROUND: 3,
    TURN_LEFT: 4,
}

return {
    startRound: n => undefined,
    takeTurn: vision => [
        Math.floor(random() * 5),
        Math.floor(random() * 5),
    ]
}
