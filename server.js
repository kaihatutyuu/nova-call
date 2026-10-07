const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();

function generatePassword() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

io.on("connection", (socket) => {
  console.log("接続:", socket.id);

  socket.on("create-room", (roomId) => {
    if (!roomId) return;

    const password = generatePassword();

    rooms.set(roomId, {
      password,
      members: new Set()
    });

    socket.emit("room-created", {
      roomId,
      password
    });
  });

  socket.on("join-room", ({ roomId, password }) => {
    const roomData = rooms.get(roomId);

    if (!roomData) {
      socket.emit("room-not-found");
      return;
    }

    if (roomData.password !== String(password)) {
      socket.emit("wrong-password");
      return;
    }

    if (roomData.members.size >= 2) {
      socket.emit("room-full");
      return;
    }

    socket.join(roomId);
    roomData.members.add(socket.id);

    socket.data.roomId = roomId;

    const numberOfUsers = roomData.members.size;

    if (numberOfUsers === 1) {
      socket.emit("waiting");
    } else if (numberOfUsers === 2) {
      socket.to(roomId).emit("user-joined");
      socket.emit("ready");
    }
  });

  socket.on("offer", ({ roomId, offer }) => {
    socket.to(roomId).emit("offer", offer);
  });

  socket.on("answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("answer", answer);
  });

  socket.on("ice-candidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("ice-candidate", candidate);
  });

  socket.on("leave-room", () => {
    const roomId = socket.data.roomId;

    if (!roomId) return;

    const roomData = rooms.get(roomId);

    if (roomData) {
      roomData.members.delete(socket.id);

      socket.to(roomId).emit("user-left");

      if (roomData.members.size === 0) {
        rooms.delete(roomId);
      }
    }

    socket.leave(roomId);
    socket.data.roomId = null;
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;

    if (roomId) {
      const roomData = rooms.get(roomId);

      if (roomData) {
        roomData.members.delete(socket.id);

        socket.to(roomId).emit("user-left");

        if (roomData.members.size === 0) {
          rooms.delete(roomId);
        }
      }
    }

    console.log("切断:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});