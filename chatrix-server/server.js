
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const Match = require("./models/Match.js");
const mongoose = require("mongoose");
const User = require("./models/User.js");
const Message = require("./models/Message.js");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const userRoutes = require("./routes/auth.routes");
const path = require("path");

const app = express();

app.use(helmet({
  contentSecurityPolicy: false
}));

const allowedOrigins = [
  "http://localhost:2000"
];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST"],
  credentials: true
}));

const http = require("http").createServer(app);

const io = require("socket.io")(http, {
  maxHttpBufferSize: 5e6,
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = 2000;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_IMAGE_LENGTH = 4 * 1024 * 1024;

const waitingUsers = [];
const roomParticipants = new Map();
const roomLikes = new Map();

app.use(express.json());
app.use("/auth", userRoutes);
app.use(express.static(path.join(__dirname, "../chatrix-client")));


// SOCKET EVENT RATE LIMITING

function allowSocketEvent(socket, eventName, limit, windowMs) {
  const now = Date.now();

  if (!socket.eventLimits) {
    socket.eventLimits = new Map();
  }

  const current = socket.eventLimits.get(eventName);

  if (!current || now - current.start >= windowMs) {
    socket.eventLimits.set(eventName, {
      start: now,
      count: 1
    });

    return true;
  }

  if (current.count >= limit) {
    socket.emit("rateLimitExceeded", {
      message: "Du sendest zu viele Anfragen. Bitte warte kurz."
    });

    return false;
  }

  current.count++;
  return true;
}


// BILD-VALIDIERUNG

function isValidImage(data) {
  if (
    typeof data !== "string" ||
    data.length > MAX_IMAGE_LENGTH
  ) {
    return false;
  }

  const match = data.match(
    /^data:image\/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/
  );

  if (!match) return false;

  const mimeType = match[1].toLowerCase();
  const base64 = match[2];

  const buffer = Buffer.from(base64, "base64");

  // Prüfen, ob die Base64-Daten korrekt sind
  if (
    buffer.toString("base64").replace(/=+$/, "") !==
    base64.replace(/=+$/, "")
  ) {
    return false;
  }

  // JPEG-Signatur prüfen
  const isJPEG =
    buffer[0] === 0xFF &&
    buffer[1] === 0xD8 &&
    buffer[2] === 0xFF;

  // PNG-Signatur prüfen
  const isPNG =
    buffer.subarray(0, 8).equals(
      Buffer.from([
        0x89, 0x50, 0x4E, 0x47,
        0x0D, 0x0A, 0x1A, 0x0A
      ])
    );

  // GIF-Signatur prüfen
  const isGIF =
    buffer.toString("ascii", 0, 6) === "GIF87a" ||
    buffer.toString("ascii", 0, 6) === "GIF89a";

  // WebP-Signatur prüfen
  const isWEBP =
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";

  if (mimeType === "jpeg" || mimeType === "jpg") {
    return isJPEG;
  }

  if (mimeType === "png") {
    return isPNG;
  }

  if (mimeType === "gif") {
    return isGIF;
  }

  if (mimeType === "webp") {
    return isWEBP;
  }

  return false;
}


// RAUM-BERECHTIGUNG

function hasRoomAccess(socket) {
  const roomId = socket.activeRoomId;

  if (!roomId || !socket.activeMatchKey) {
    return false;
  }

  const participants = roomParticipants.get(roomId);

  return (
    socket.rooms.has(roomId) &&
    participants &&
    participants.includes(socket.id)
  );
}


// GESPEICHERTEN CHAT VERLASSEN

function leaveSavedMatchRoom(socket) {
  const roomId = socket.activeRoomId;

  if (!roomId) return;

  const participants = roomParticipants.get(roomId) || [];

  const updatedParticipants = participants.filter(
    (socketId) => socketId !== socket.id
  );

  if (updatedParticipants.length === 0) {
    roomParticipants.delete(roomId);
  } else {
    roomParticipants.set(roomId, updatedParticipants);
  }

  socket.leave(roomId);

  socket.activeRoomId = null;
  socket.activeMatchKey = null;
  socket.isSavedMatchRoom = false;

  socket.emit("matchRoomLeft");
}


// SOCKET.IO AUTHENTIFIZIERUNG

io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Kein Login-Token vorhanden"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.userId) {
      return next(new Error("Ungültiger Token"));
    }

    socket.userId = decoded.userId;

    next();

  } catch (err) {
    next(new Error("Ungültiger oder abgelaufener Token"));
  }
});


// PRIVATEN CHAT BEENDEN

function endRoom(socket, reason) {
  const roomId = socket.activeRoomId;

  if (!roomId || socket.isSavedMatchRoom) return;

  const participants = roomParticipants.get(roomId) || [
    socket.id
  ];

  roomParticipants.delete(roomId);
  roomLikes.delete(roomId);

  for (const socketId of participants) {
    const participant = io.sockets.sockets.get(socketId);

    if (!participant) continue;

    participant.activeRoomId = null;
    participant.activeMatchKey = null;
    participant.isSavedMatchRoom = false;

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

  if (socket.activeRoomId) return;

  const ownWaitingIndex = waitingUsers.findIndex(
    (waitingUser) => waitingUser.socketId === socket.id
  );

  if (ownWaitingIndex !== -1) {
    waitingUsers.splice(ownWaitingIndex, 1);
  }

  const partnerIndex = waitingUsers.findIndex((waitingUser) => {
    return (
      waitingUser.gender === preferredGender &&
      waitingUser.preferredGender === user.gender
    );
  });

  if (partnerIndex === -1) {
    waitingUsers.push({
      socketId: socket.id,
      userId: socket.userId,
      username: user.user,
      gender: user.gender,
      preferredGender
    });

    console.log(`${user.user} wartet auf einen Partner.`);
    return;
  }

  const partner = waitingUsers[partnerIndex];
  const partnerSocket = io.sockets.sockets.get(partner.socketId);

  if (!partnerSocket || partnerSocket.activeRoomId) {
    waitingUsers.splice(partnerIndex, 1);
    return findPartner(socket, user, preferredGender);
  }

  waitingUsers.splice(partnerIndex, 1);

  const roomId = `room-${socket.id}-${partner.socketId}`;

  socket.join(roomId);
  partnerSocket.join(roomId);

  socket.activeRoomId = roomId;
  partnerSocket.activeRoomId = roomId;

  socket.isSavedMatchRoom = false;
  partnerSocket.isSavedMatchRoom = false;

  const userIds = [
    socket.userId,
    partner.userId
  ].sort();

  const matchKey = userIds.join("_");

  socket.activeMatchKey = matchKey;
  partnerSocket.activeMatchKey = matchKey;

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
    user = await User.findById(socket.userId);
  } catch (err) {
    console.error("Benutzer konnte nicht geladen werden:", err);
    socket.disconnect(true);
    return;
  }

  if (!user) {
    socket.disconnect(true);
    return;
  }

  socket.userId = user._id.toString();
  socket.isSavedMatchRoom = false;

  console.log("Benutzer:", user.user);
  console.log("Geschlecht:", user.gender);


  // PARTNERSUCHE

  socket.on("findPartner", (preferredGender) => {
    if (!allowSocketEvent(socket, "findPartner", 5, 60000)) {
      return;
    }

    findPartner(socket, user, preferredGender);
  });


  // PARTNERSUCHE ABBRECHEN

  socket.on("cancelSearch", () => {
    // Falls bereits ein Chat zustande gekommen ist,
    // wird dieser nicht versehentlich beendet.
    if (socket.activeRoomId) {
      socket.emit("searchCancelled");
      return;
    }

    const waitingIndex = waitingUsers.findIndex(
      (waitingUser) => waitingUser.socketId === socket.id
    );

    if (waitingIndex !== -1) {
      waitingUsers.splice(waitingIndex, 1);
    }

    socket.emit("searchCancelled");

    console.log(`${user.user} hat die Partnersuche abgebrochen.`);
  });


  // BESTEHENDEM MATCH-CHAT BEITRETEN

  socket.on("joinMatchRoom", async (matchKey) => {
    if (!allowSocketEvent(socket, "joinMatchRoom", 5, 10000)) {
      return;
    }

    if (
      typeof matchKey !== "string" ||
      !matchKey ||
      matchKey.length > 100 ||
      socket.activeRoomId
    ) {
      return socket.emit("matchRoomError", {
        message: "Chat kann momentan nicht geöffnet werden."
      });
    }

    try {
      const match = await Match.findOne({
        matchKey,
        users: socket.userId
      }).populate("users", "user");

      if (!match) {
        return socket.emit("matchRoomError", {
          message: "Du hast keinen Zugriff auf diesen Chat."
        });
      }

      const partner = match.users.find(
        (matchUser) =>
          matchUser._id.toString() !== socket.userId
      );

      if (!partner) {
        return socket.emit("matchRoomError", {
          message: "Chat-Partner konnte nicht gefunden werden."
        });
      }

      const roomId = `match-${match.matchKey}`;

      socket.join(roomId);

      socket.activeRoomId = roomId;
      socket.activeMatchKey = match.matchKey;
      socket.isSavedMatchRoom = true;

      const participants = roomParticipants.get(roomId) || [];

      if (!participants.includes(socket.id)) {
        participants.push(socket.id);
      }

      roomParticipants.set(roomId, participants);

      socket.emit("matchRoomJoined", {
        username: partner.user,
        roomId,
        matchKey: match.matchKey
      });

      console.log(
        `${user.user} ist dem bestehenden Chat mit ${partner.user} beigetreten.`
      );

    } catch (err) {
      console.error("Match-Chat konnte nicht geöffnet werden:", err);

      socket.emit("matchRoomError", {
        message: "Fehler beim Öffnen des Chats."
      });
    }
  });


  // ÖFFENTLICHE TEXTNACHRICHTEN

  socket.on("message", (data) => {
    if (!allowSocketEvent(socket, "message", 8, 5000)) {
      return;
    }

    if (
      typeof data !== "string" ||
      !data.trim() ||
      data.trim().length > MAX_MESSAGE_LENGTH
    ) {
      return;
    }

    io.emit("message", {
      text: data.trim(),
      id: socket.id
    });
  });


  // ÖFFENTLICHE BILDER

  socket.on("image", (data) => {
    if (!allowSocketEvent(socket, "image", 2, 10000)) {
      return;
    }

    if (!isValidImage(data)) {
      return;
    }

    io.emit("image", {
      img: data,
      id: socket.id
    });
  });


  // PRIVATE TEXTNACHRICHTEN

  socket.on("roomMessage", async (text) => {
    if (!allowSocketEvent(socket, "roomMessage", 5, 5000)) {
      return;
    }

    if (
      typeof text !== "string" ||
      !text.trim() ||
      text.trim().length > MAX_MESSAGE_LENGTH ||
      !hasRoomAccess(socket)
    ) {
      return;
    }

    try {
      const message = await Message.create({
        matchKey: socket.activeMatchKey,
        sender: socket.userId,
        text: text.trim()
      });

      io.to(socket.activeRoomId).emit("roomMessage", {
        text: message.text,
        id: socket.id,
        createdAt: message.createdAt
      });

    } catch (err) {
      console.error("Fehler beim Speichern der Nachricht:", err);
    }
  });


  // PRIVATE BILDER

  socket.on("roomImage", (data) => {
    if (!allowSocketEvent(socket, "roomImage", 2, 10000)) {
      return;
    }

    if (
      !isValidImage(data) ||
      !hasRoomAccess(socket)
    ) {
      return;
    }

    io.to(socket.activeRoomId).emit("roomImage", {
      img: data,
      id: socket.id
    });
  });


  // GESPEICHERTEN CHAT VERLASSEN

  socket.on("leaveMatchRoom", () => {
    if (!socket.isSavedMatchRoom) return;

    leaveSavedMatchRoom(socket);
  });


  // ZUFÄLLIGEN CHAT VERLASSEN

  socket.on("leaveRoom", () => {
    if (socket.isSavedMatchRoom) return;

    endRoom(socket, "left");
  });


  // NÄCHSTEN PARTNER SUCHEN

  socket.on("nextPartner", (preferredGender) => {
    if (!allowSocketEvent(socket, "nextPartner", 5, 30000)) {
      return;
    }

    if (socket.isSavedMatchRoom) return;

    if (socket.activeRoomId) {
      endRoom(socket, "next");
    }

    findPartner(socket, user, preferredGender);
  });


  // LIKE SYSTEM

  socket.on("like", async () => {
    if (!allowSocketEvent(socket, "like", 5, 10000)) {
      return;
    }

    if (socket.isSavedMatchRoom) return;

    const roomId = socket.activeRoomId;

    if (!roomId || !hasRoomAccess(socket)) return;

    const participants = roomParticipants.get(roomId);

    if (!participants || participants.length !== 2) return;

    let likes = roomLikes.get(roomId);

    if (!likes) {
      likes = new Set();
      roomLikes.set(roomId, likes);
    }

    likes.add(socket.userId);

    const bothLiked = participants.every((socketId) => {
      const participant = io.sockets.sockets.get(socketId);

      return participant && likes.has(participant.userId);
    });

    if (bothLiked) {
      const userIds = participants.map((socketId) => {
        const participant = io.sockets.sockets.get(socketId);
        return participant.userId;
      });

      userIds.sort();

      const matchKey = userIds.join("_");

      try {
        await Match.findOneAndUpdate(
          { matchKey },
          {
            $setOnInsert: {
              users: userIds,
              matchKey
            }
          },
          {
            upsert: true,
            returnDocument: "after"
          }
        );

        io.to(roomId).emit("mutualLike");
        roomLikes.delete(roomId);

      } catch (err) {
        console.error("Match konnte nicht gespeichert werden:", err);

        io.to(roomId).emit("likeError", {
          message: "Das Match konnte momentan nicht gespeichert werden."
        });
      }
    }
  });


  // BEI TRENNUNG AUFRÄUMEN

  socket.on("disconnect", () => {
    const waitingIndex = waitingUsers.findIndex(
      (waitingUser) => waitingUser.socketId === socket.id
    );

    if (waitingIndex !== -1) {
      waitingUsers.splice(waitingIndex, 1);
    }

    if (socket.isSavedMatchRoom) {
      leaveSavedMatchRoom(socket);
    } else {
      endRoom(socket, "disconnected");
    }

    console.log("Ein User hat die Verbindung getrennt");
  });
});


startServer();
