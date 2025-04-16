const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

// Function to generate initial position for a player
function getInitialPosition() {
  return { row: 1, col: 1 }; // You can modify this based on your maze structure
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create-room', () => {
    const roomId = generateRoomId();
    console.log('Creating room:', roomId);
    
    rooms.set(roomId, {
      players: [socket.id],
      maze: generateMaze() // You'll need to implement this function
    });
    
    socket.join(roomId);
    socket.emit('room-created', { 
      roomId,
      position: getInitialPosition()
    });
  });

  socket.on('join-room', (roomId) => {
    console.log('Joining room:', roomId);
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('room-joined', { error: 'Room not found' });
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('room-joined', { error: 'Room is full' });
      return;
    }
    
    room.players.push(socket.id);
    socket.join(roomId);
    socket.emit('room-joined', { 
      roomId,
      position: getInitialPosition()
    });
    
    io.to(roomId).emit('player-joined', {
      id: socket.id,
      position: getInitialPosition()
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Clean up rooms when players disconnect
    for (const [roomId, room] of rooms.entries()) {
      if (room.players.includes(socket.id)) {
        room.players = room.players.filter(id => id !== socket.id);
        if (room.players.length === 0) {
          rooms.delete(roomId);
        }
        io.to(roomId).emit('player-left', socket.id);
      }
    }
  });
});

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Start the server
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});