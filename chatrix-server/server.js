const express = require("express");
const userRoutes = require("./routes/userRoutes");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  maxHttpBufferSize: 1e8 // 100 MB
});

app.use(express.json());
app.use(userRoutes);

const path = require("path");
app.use(express.static(path.join(__dirname, "../chatrix-client")));

let port = 2000;


io.on("connection", (socket) => {
  console.log("Ein User ist verbunden");

  // TEXT MESSAGE
  socket.on("message", (data) => {
    io.emit("message", {
      text: data,
      id: socket.id
    });
  });

  // IMAGE MESSAGE
socket.on("image", (data) => {
  console.log("Bild empfangen"); 

  io.emit("image", {
    img: data,
    id: socket.id
  });
});

});

http.listen(port, () => {
  console.log("Server läuft auf Port: 2000");
});