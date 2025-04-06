// Maze.js
import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./Maze.css";

const socket = io("http://localhost:3001");

const Maze = ({ maze }) => {
  const [playerId, setPlayerId] = useState(null);
  const [players, setPlayers] = useState({});

  const rows = maze.length;
  const cols = maze[0].length;

  useEffect(() => {
    // Define listener functions separately to easily add/remove them
    const handleInit = ({ id, players: initialPlayers }) => {
      console.log("Received 'init':", { id, initialPlayers });
      setPlayerId(id);
      setPlayers(initialPlayers);
    };

    const handlePlayerJoined = ({ id, position }) => {
      console.log("Received 'player-joined':", { id, position });
      setPlayers((prev) => ({ ...prev, [id]: position })); // Simplified update
    };

    const handlePlayerMoved = ({ id, position }) => {
      console.log("Received 'player-moved':", { id, position });
      setPlayers((prev) => ({ ...prev, [id]: position })); // Simplified update
    };

    const handlePlayerLeft = (id) => {
      console.log("Received 'player-left':", id);
      setPlayers((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    };

    const handleConnect = () => {
      console.log("Socket connected!", socket.id);
    };

    const handleDisconnect = (reason) => {
      console.log("Socket disconnected:", reason);
      // Optional: You might want to clear player state or show a message on disconnect
      // setPlayers({});
      // setPlayerId(null);
    };

    const handleConnectError = (err) => {
      console.error("Socket connection error:", err);
    };

    // --- Attach listeners ---
    console.log("Attaching socket listeners...");
    socket.on("connect", handleConnect);
    socket.on("init", handleInit);
    socket.on("player-joined", handlePlayerJoined);
    socket.on("player-moved", handlePlayerMoved);
    socket.on("player-left", handlePlayerLeft);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    // --- Ensure connection if not already connected ---
    // The io() call usually initiates connection, but explicit connect()
    // can be used if manual connection control is needed.
    // Generally, this isn't necessary if socket is defined outside.
    // if (!socket.connected) {
    //   socket.connect();
    // }

    // --- Cleanup function ---
    return () => {
      console.log("Cleaning up socket listeners...");
      // Remove only the listeners added by this specific component instance
      socket.off("connect", handleConnect);
      socket.off("init", handleInit);
      socket.off("player-joined", handlePlayerJoined);
      socket.off("player-moved", handlePlayerMoved);
      socket.off("player-left", handlePlayerLeft);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);

      // **Do NOT disconnect here if the socket instance is shared/module-level**
      // socket.disconnect(); // <--- Remove or comment this out
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const myPos = players[playerId];
      if (!myPos) return;

      let { row, col } = myPos;

      switch (e.key) {
        case "ArrowUp":
          if (row > 0 && maze[row - 1][col] === 1) row--;
          break;
        case "ArrowDown":
          if (row < rows - 1 && maze[row + 1][col] === 1) row++;
          break;
        case "ArrowLeft":
          if (col > 0 && maze[row][col - 1] === 1) col--;
          break;
        case "ArrowRight":
          if (col < cols - 1 && maze[row][col + 1] === 1) col++;
          break;
        default:
          return;
      }

      const newPosition = { row, col };
      socket.emit("move", newPosition);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [players, playerId, maze, rows, cols]);

  return (
    <div
      className="maze"
      style={{
        gridTemplateColumns: `repeat(${cols}, 40px)`,
        gridTemplateRows: `repeat(${rows}, 40px)`,
      }}
    >
      {maze.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const isWall = cell === 0;

          // Check if a player is on this cell
          const playerHere = Object.entries(players).find(
            ([, pos]) => pos.row === rowIndex && pos.col === colIndex
          );

          const isSelf = playerHere && playerHere[0] === playerId;
          const isOther = playerHere && playerHere[0] !== playerId;

          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`cell ${isWall ? "wall" : "path"} ${
                isSelf ? "player" : isOther ? "enemy" : ""
              }`}
            />
          );
        })
      )}
    </div>
  );
};

export default Maze;
