return {
    generateMaze: size => {
        Array(size).map(
            r => Array(size).map(
                c => {east: false, south: false}
            )
        )
    }
    takeTurn: (mana, maze) => [null, null]
}
