const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  console.log("接続:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);

    const room = io.sockets.adapter.rooms.get(roomId);
    const numberOfUsers = room ? room.size : 0;

    if (numberOfUsers === 1) {
      socket.emit("waiting");
    } else if (numberOfUsers === 2) {
      socket.to(roomId).emit("user-joined");
      socket.emit("ready");
    } else {
      socket.leave(roomId);
      socket.emit("room-full");
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

  socket.on("disconnect", () => {
    console.log("切断:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
