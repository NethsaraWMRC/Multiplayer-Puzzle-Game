const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

let rooms = {}; // roomId -> array of socketIds
let players = {}; // roomId -> { socketId: { row, col } }

io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // --- Handle room creation ---
  socket.on("create-room", () => {
    const roomId = generateRoomCode();
    socket.join(roomId);

    rooms[roomId] = [socket.id];
    players[roomId] = {
      [socket.id]: { row: 3, col: 1 }, // Host default position
    };

    console.log(`Room created: ${roomId} by ${socket.id}`);

    socket.emit("room-created", { roomId });
    socket.emit("init", { id: socket.id, players: players[roomId] });
  });

  // --- Handle joining a room ---
  socket.on("join-room", (roomId) => {
    const room = io.sockets.adapter.rooms.get(roomId);

    if (!room) {
      socket.emit("room-joined", { error: "Room does not exist" });
      return;
    }

    if (room.size >= 2) {
      socket.emit("room-joined", { error: "Room is full" });
      return;
    }

    socket.join(roomId);
    rooms[roomId].push(socket.id);
    socket.emit("room-joined", { roomId });
    console.log(`Player ${socket.id} joined room: ${roomId}`);

    // Start countdown when both players are in
    if (rooms[roomId].length === 2) {
      let countdown = 3;
      const interval = setInterval(() => {
        io.to(roomId).emit("countdown", countdown);
        if (countdown === 0) {
          io.to(roomId).emit("game-start");
          clearInterval(interval);
        }
        countdown--;
      }, 1000);
    }
  });

  // --- Handle player movement ---
  socket.on("move", (newPosition) => {
    const roomId = findPlayerRoom(socket.id);
    if (!roomId || !players[roomId][socket.id]) return;

    // Only allow move if both players are present
    if (Object.keys(players[roomId]).length < 2) return;

    players[roomId][socket.id] = newPosition;

    io.to(roomId).emit("player-moved", {
      id: socket.id,
      position: newPosition,
    });
  });

  // --- Handle disconnect ---
  socket.on("disconnect", (reason) => {
    console.log(`Player disconnected: ${socket.id}. Reason: ${reason}`);

    const roomId = findPlayerRoom(socket.id);
    if (!roomId) return;

    delete players[roomId][socket.id];

    // Remove from room tracking
    rooms[roomId] = rooms[roomId].filter((id) => id !== socket.id);

    // Cleanup if room is empty
    if (rooms[roomId].length === 0) {
      delete rooms[roomId];
      delete players[roomId];
      console.log(`Room ${roomId} deleted (empty).`);
    }

    io.to(roomId).emit("player-left", socket.id);
  });
});

// --- Helper to find which room a socket belongs to ---
function findPlayerRoom(socketId) {
  for (const [roomId, playerList] of Object.entries(players)) {
    if (playerList[socketId]) return roomId;
  }
  return null;
}

// --- Room code generator ---
function generateRoomCode(length = 5) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// --- Start server ---
server.listen(3001, () =>
  console.log("Server running on http://localhost:3001")
);
