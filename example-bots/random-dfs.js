// This maze master generates mazes with a depth-first search
// It never tries to change mazes

const OFFSETS = [
    // row, col, doorRow, doorCol, doorDir
    [ 1,  0,  0,  0, 'south'],
    [-1,  0, -1,  0, 'south'],
    [ 0,  1,  0,  0, 'east'],
    [ 0, -1,  0, -1, 'east'],
]

function shuffled(arr)  {
    let result = [...arr];
    for (let i = 0; i < result.length - 1; i++) {
        let swap = Math.floor(random() * (result.length - i) + i);
        let tmp = result[i];
        result[i] = result[swap];
        result[swap] = tmp;
    }
    return result;
}

let curSize = 0;

return {
    generateMaze: size => {
        curSize = size;

        let maze = [...Array(size)].map(
            r => [...Array(size)].map(
                c => ({
                    east: true,
                    south: true,
                    visited: false
                })
            )
        );

        let isVisited = (row, col) => {
            let result = (() => {
                if (row < 0 || row >= size || col < 0 || col >= size) return true;
                else return maze[row][col].visited;
            })()
            return result;
        };

        let explore = (row, col) => {
            maze[row][col].visited = true;
            let lookOrder = shuffled(OFFSETS);
            for (let [rOffset, cOffset, drOffset, dcOffset, dir] of lookOrder) {
                if (!isVisited(row + rOffset, col + cOffset)) {
                    // erase wall
                    maze[row + drOffset][col + dcOffset][dir] = false;
                    explore(row + rOffset, col + cOffset);
                }
            }
        };
        explore(0, 0);

        return maze;
    },
    takeTurn: (mana, maze) => [
        [random() * curSize | 0, random() * curSize | 0, (random() < 0.5)? 'south' : 'east'],
        (random() < 0.1)? [random() * curSize | 0, random() * curSize | 0, (random() < 0.5)? 'south' : 'east'] : null
    ]
}
