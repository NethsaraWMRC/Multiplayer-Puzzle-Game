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
const GOAL_POSITION = { row: 11, col: 30 };

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

    // Use the 'players' object for tracking count within the room
    const currentPlayersInRoom = players[roomId]
      ? Object.keys(players[roomId]).length
      : 0;
    if (currentPlayersInRoom >= 2) {
      socket.emit("room-joined", { error: "Room is full" });
      return;
    }

    socket.join(roomId);

    // Ensure room structures exist
    if (!rooms[roomId]) rooms[roomId] = []; // Should ideally exist from create-room
    if (!players[roomId]) players[roomId] = {};

    // Add player to room tracking (if not already there somehow)
    if (!rooms[roomId].includes(socket.id)) {
      rooms[roomId].push(socket.id);
    }

    // Assign position based on who is already there
    // NOTE: Ensure these coords [3,1] and [17,1] are valid path cells '1' in your maze array!
    const playerPosition =
      currentPlayersInRoom === 0 ? { row: 3, col: 1 } : { row: 17, col: 1 };
    players[roomId][socket.id] = playerPosition;

    console.log(
      `Player ${socket.id} assigned position in room ${roomId}:`,
      playerPosition
    );
    console.log(`Current players in room ${roomId}:`, players[roomId]);

    // 1. Send 'room-joined' confirmation ONLY to the joining player
    socket.emit("room-joined", { roomId });

    // 2. Send 'init' event ONLY to the joining player (socket)
    //    This tells them their ID and the current state of all players in the room.
    socket.emit("init", { id: socket.id, players: players[roomId] });
    console.log(`Sent 'init' to joining player ${socket.id}`);

    // 3. Notify *OTHER* players in the room about the new player
    //    Use 'player-joined' event which the client already handles.
    socket.broadcast.to(roomId).emit("player-joined", {
      id: socket.id,
      position: playerPosition,
    });
    console.log(`Broadcast 'player-joined' for ${socket.id} to room ${roomId}`);

    // --- This broadcast 'init' was the problem, REMOVE it ---
    // io.to(roomId).emit("init", { id: socket.id, players: players[roomId] });

    // --- Start countdown if room is now full ---
    // Use Object.keys on the definitive player state for the room
    if (Object.keys(players[roomId]).length === 2) {
      console.log(`Room ${roomId} is full. Starting countdown.`);
      let countdown = 3;
      const interval = setInterval(() => {
        io.to(roomId).emit("countdown", countdown);
        if (countdown === 0) {
          io.to(roomId).emit("game-start");
          clearInterval(interval);
          console.log(`Game started in room ${roomId}`);
        }
        countdown--;
      }, 1000);
    } else {
      console.log(
        `Room ${roomId} has ${
          Object.keys(players[roomId]).length
        } player(s). Waiting for more.`
      );
    }
  });

  // --- Handle player movement ---
  // --- Handle player movement ---
  socket.on("move", (newPosition) => {
    const roomId = findPlayerRoom(socket.id);
    if (!roomId || !players[roomId][socket.id]) return;

    players[roomId][socket.id] = newPosition;

    io.to(roomId).emit("player-moved", {
      id: socket.id,
      position: newPosition,
    });

    // Check if player reached goal
    if (
      newPosition.row === GOAL_POSITION.row &&
      newPosition.col === GOAL_POSITION.col
    ) {
      // Send game-over to both players
      const playerIds = Object.keys(players[roomId]);

      playerIds.forEach((id) => {
        io.to(id).emit("game-over", {
          winner: socket.id,
          youWon: id === socket.id,
        });
      });

      console.log(`Game over! Winner: ${socket.id} in room ${roomId}`);

      // Optionally reset room state
      delete rooms[roomId];
      delete players[roomId];
    }
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
