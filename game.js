// A simple 5x5 'H' puzzle
// 1 = filled, 0 = empty
const puzzleData = [
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1]
];

const canvas = document.getElementById('nonogram-canvas');
const game = new Nonogram(puzzleData, canvas);