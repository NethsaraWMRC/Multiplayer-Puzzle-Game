// Maze.js
import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./Maze.css";

const socket = io("http://localhost:3001");

const Maze = ({ maze }) => {
  const [playerId, setPlayerId] = useState(null);
  const [players, setPlayers] = useState({});
  const [roomId, setRoomId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [roomCode, setRoomCode] = useState(""); // Add this line
  const [countdown, setCountdown] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(null); // { youWon: true/false }
  const [gameFinished, setGameFinished] = useState(false);

  const rows = maze.length;
  const cols = maze[0].length;

  // Add this after the state declarations
  const createRoom = () => {
    socket.emit("create-room");
  };

  const joinRoom = (roomCode) => {
    socket.emit("join-room", roomCode);
  };

  useEffect(() => {
    socket.on("countdown", (count) => {
      setCountdown(count);
    });

    socket.on("game-start", () => {
      setGameStarted(true);
      setCountdown(null); // clear the counter
    });

    // Define all handler functions first
    const handleConnect = () => {
      console.log("Socket connected!", socket.id);
    };

    const handleDisconnect = (reason) => {
      console.log("Socket disconnected:", reason);
    };

    const handleConnectError = (err) => {
      console.error("Socket connection error:", err);
    };

    const handleInit = ({ id, players: initialPlayers }) => {
      console.log("Received 'init':", { id, initialPlayers });
      setPlayerId(id);
      setPlayers(initialPlayers);
    };

    const handleRoomCreated = ({ roomId }) => {
      console.log("Room created:", roomId);
      setRoomId(roomId);
      setIsHost(true);
    };

    const handleRoomJoined = ({ roomId, error }) => {
      if (error) {
        console.error("Error joining room:", error);
        return;
      }
      console.log("Joined room:", roomId);
      setRoomId(roomId);
    };

    const handlePlayerJoined = ({ id, position }) => {
      console.log("Received 'player-joined':", { id, position });
      setPlayers((prev) => ({ ...prev, [id]: position }));
    };

    const handlePlayerMoved = ({ id, position }) => {
      console.log("Received 'player-moved':", { id, position });
      setPlayers((prev) => ({ ...prev, [id]: position }));
    };

    const handlePlayerLeft = (id) => {
      console.log("Received 'player-left':", id);
      setPlayers((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    };

    const handleGameOver = ({ winner, youWon }) => {
      console.log(`Game Over! Winner: ${winner}, You won: ${youWon}`);
      setGameStarted(false);
      setGameOver({ youWon });
      setGameFinished(true);
    };

    // Then attach all listeners
    console.log("Attaching socket listeners...");

    socket.on("game-over", handleGameOver);
    socket.on("connect", handleConnect);
    socket.on("init", handleInit);
    socket.on("room-created", handleRoomCreated);
    socket.on("room-joined", handleRoomJoined);
    socket.on("player-joined", handlePlayerJoined);
    socket.on("player-moved", handlePlayerMoved);
    socket.on("player-left", handlePlayerLeft);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

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
      socket.off("game-over", handleGameOver);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!gameStarted) return;

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
  }, [players, playerId, maze, rows, cols, gameStarted]);

  return (
    <div className="container">
      {countdown !== null && (
        <div className="countdown-overlay">
          <h1>Game starts in: {countdown}</h1>
        </div>
      )}
      {gameOver && (
        <div className="game-over-overlay">
          <h1>{gameOver.youWon ? "You Win!" : "You Lose"}</h1>
        </div>
      )}

      {!roomId && (
        <div className="room-controls">
          <button onClick={createRoom}>Create New Room</button>
          <div>
            <input
              type="text"
              placeholder="Enter Room Code"
              onChange={(e) => setRoomCode(e.target.value)}
            />
            <button onClick={() => joinRoom(roomCode)}>Join Room</button>
          </div>
        </div>
      )}
      {roomId && (
        <div className="room-info">
          <p>Room Code: {roomId}</p>
          <p>Players: {Object.keys(players).length}/2</p>
        </div>
      )}
      <div
        className="maze"
        style={{
          gridTemplateColumns: `repeat(${cols}, 20px)`,
          gridTemplateRows: `repeat(${rows}, 20px)`,
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
    </div>
  );
};

export default Maze;
