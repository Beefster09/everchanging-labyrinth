return {
    generateMaze: size => {
        return [...Array(size)].map(
            r => [...Array(size)].map(
                c => {
                    return {
                        east: random() < 0.2,
                        south: random() < 0.3
                    };
                }
            )
        )
    },
    takeTurn: (mana, maze) => [null, null]
}
