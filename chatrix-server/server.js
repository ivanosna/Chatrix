
const express = require("express");
const mongoose = require("mongoose");
const User = require("./models/User.js");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const userRoutes = require("./routes/auth.routes");
const path = require("path");

const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  maxHttpBufferSize: 1e8
});

const PORT = 2000;
const waitingUsers = [];
const roomParticipants = new Map();

app.use(express.json());
app.use("/auth", userRoutes);
app.use(express.static(path.join(__dirname, "../chatrix-client")));

// SOCKET.IO AUTHENTIFIZIERUNG
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Kein Login-Token vorhanden"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.username = decoded.username;
    next();
  } catch (err) {
    next(new Error("Ungültiger oder abgelaufener Token"));
  }
});

// PRIVATEN CHAT BEENDEN
function endRoom(socket, reason) {
  const roomId = socket.activeRoomId;

  if (!roomId) return;

  const participants = roomParticipants.get(roomId) || [
    socket.id
  ];

  roomParticipants.delete(roomId);

  for (const socketId of participants) {
    const participant = io.sockets.sockets.get(socketId);

    if (!participant) continue;

    participant.activeRoomId = null;
    participant.leave(roomId);

    participant.emit("roomEnded", {
      reason,
      by: socket.id
    });
  }

  console.log(`Privater Chat beendet: ${roomId}`);
}

// PASSENDEN PARTNER SUCHEN
function findPartner(socket, user, preferredGender) {
  if (preferredGender !== "men" && preferredGender !== "women") {
    return;
  }

  // Nicht suchen, wenn bereits ein privater Chat aktiv ist
  if (socket.activeRoomId) return;

  // Diesen Benutzer aus der Warteliste entfernen,
  // damit er nicht mehrfach eingetragen wird
  const ownWaitingIndex = waitingUsers.findIndex(
    (waitingUser) => waitingUser.socketId === socket.id
  );

  if (ownWaitingIndex !== -1) {
    waitingUsers.splice(ownWaitingIndex, 1);
  }

  // Gegenseitige Geschlechterpräferenzen prüfen
  const partnerIndex = waitingUsers.findIndex((waitingUser) => {
    return (
      waitingUser.gender === preferredGender &&
      waitingUser.preferredGender === user.gender
    );
  });

  if (partnerIndex === -1) {
    waitingUsers.push({
      socketId: socket.id,
      username: user.user,
      gender: user.gender,
      preferredGender
    });

    console.log(`${user.user} wartet auf einen Partner.`);
    return;
  }

  const partner = waitingUsers[partnerIndex];
  const partnerSocket = io.sockets.sockets.get(partner.socketId);

  // Nicht mehr verbundene Partner überspringen
  if (!partnerSocket || partnerSocket.activeRoomId) {
    waitingUsers.splice(partnerIndex, 1);
    return findPartner(socket, user, preferredGender);
  }

  waitingUsers.splice(partnerIndex, 1);

  // Gemeinsamen privaten Raum erstellen
  const roomId = `room-${socket.id}-${partner.socketId}`;

  socket.join(roomId);
  partnerSocket.join(roomId);

  socket.activeRoomId = roomId;
  partnerSocket.activeRoomId = roomId;

  roomParticipants.set(roomId, [
    socket.id,
    partner.socketId
  ]);

  socket.emit("matchFound", {
    username: partner.username,
    roomId
  });

  partnerSocket.emit("matchFound", {
    username: user.user,
    roomId
  });

  console.log(
    `${user.user} und ${partner.username} wurden verbunden.`
  );
}

// SERVER STARTEN
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    http.listen(PORT, () => {
      console.log(`Server läuft auf http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("MongoDB-Verbindung fehlgeschlagen:", err);
  }
}

// SOCKET.IO VERBINDUNG
io.on("connection", async (socket) => {
  console.log("Ein User ist verbunden");

  let user;

  try {
    user = await User.findOne({ user: socket.username });
  } catch (err) {
    console.error("Benutzer konnte nicht geladen werden:", err);
    socket.disconnect(true);
    return;
  }

  if (!user) {
    socket.disconnect(true);
    return;
  }

  console.log("Benutzer:", user.user);
  console.log("Geschlecht:", user.gender);

  // PARTNERSUCHE
  socket.on("findPartner", (preferredGender) => {
    findPartner(socket, user, preferredGender);
  });

  // ÖFFENTLICHE TEXTNACHRICHTEN
  socket.on("message", (data) => {
    io.emit("message", {
      text: data,
      id: socket.id
    });
  });

  // ÖFFENTLICHE BILDER
  socket.on("image", (data) => {
    io.emit("image", {
      img: data,
      id: socket.id
    });
  });

  // PRIVATE TEXTNACHRICHTEN
  socket.on("roomMessage", (text) => {
    const roomId = socket.activeRoomId;

    if (
      typeof text !== "string" ||
      !text.trim() ||
      !roomId ||
      !socket.rooms.has(roomId)
    ) {
      return;
    }

    io.to(roomId).emit("roomMessage", {
      text,
      id: socket.id
    });
  });

  // PRIVATE BILDER
  socket.on("roomImage", (data) => {
    const roomId = socket.activeRoomId;

    if (
      typeof data !== "string" ||
      !roomId ||
      !socket.rooms.has(roomId)
    ) {
      return;
    }

    io.to(roomId).emit("roomImage", {
      img: data,
      id: socket.id
    });
  });

  // CHAT VERLASSEN
  socket.on("leaveRoom", () => {
    endRoom(socket, "left");
  });

  // NÄCHSTEN PARTNER SUCHEN
  socket.on("nextPartner", (preferredGender) => {
    if (socket.activeRoomId) {
      endRoom(socket, "next");
    }

    findPartner(socket, user, preferredGender);
  });

  // BEI TRENNUNG AUFRÄUMEN
  socket.on("disconnect", () => {
    const waitingIndex = waitingUsers.findIndex(
      (waitingUser) => waitingUser.socketId === socket.id
    );

    if (waitingIndex !== -1) {
      waitingUsers.splice(waitingIndex, 1);
    }

    endRoom(socket, "disconnected");

    console.log("Ein User hat die Verbindung getrennt");
  });
});

startServer();
