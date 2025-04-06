import "./App.css";
import Maze from "./maze/Maze";

function App() {
  const maze = [
    [0, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 1, 0, 1, 0],
    [0, 1, 0, 1, 0, 1, 0],
    [0, 1, 0, 1, 1, 1, 1],
    [0, 1, 1, 1, 0, 1, 0],
    [0, 0, 0, 0, 0, 0, 0],
  ];
  return (
    <div>
      <Maze maze={maze} />
    </div>
  );
}

export default App;
