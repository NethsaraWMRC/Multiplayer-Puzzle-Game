const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // Consider restricting this in production
});

let players = {}; // Track players by socket ID: { socketId: { row: r, col: c } }

io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  const initialPos = { row: 1, col: 1 };

  players[socket.id] = initialPos;

  socket.emit("init", { id: socket.id, players: players }); // Send the whole players object

  socket.broadcast.emit("player-joined", {
    id: socket.id,
    position: players[socket.id],
  });

  // Movement handler
  socket.on("move", (newPosition) => {
    // **Crucial Server-Side Validation:** Ensure the move is valid!
    const currentPlayerPos = players[socket.id];
    if (!currentPlayerPos) return; // Player might have disconnected

    // More advanced: check if move is adjacent (prevent teleporting)
    const dx = Math.abs(newPosition.col - currentPlayerPos.col);
    const dy = Math.abs(newPosition.row - currentPlayerPos.row);

    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
      players[socket.id] = newPosition; // Update position on the server
      // Broadcast the validated move to ALL connected clients

      io.emit("player-moved", { id: socket.id, position: newPosition });
    }
  });

  // Handle disconnect
  socket.on("disconnect", (reason) => {
    console.log(`Player disconnected: ${socket.id}. Reason: ${reason}`);
    delete players[socket.id]; // Remove player from state
    // Broadcast that the player left
    console.log(`Broadcasting 'player-left': ${socket.id}`);
    io.emit("player-left", socket.id); // Send only the ID
  });
});

server.listen(3001, () =>
  console.log("Server running on http://localhost:3001")
);
