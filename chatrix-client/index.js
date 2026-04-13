const input = document.getElementById("inputEl");
const send = document.getElementById("buttonEl");
const ulList = document.getElementById("ulEl");
const plusBtn = document.getElementById("plusBtn");
const fileInput = document.getElementById("fileInput");

const socket = io();

// TEXT EMPFANGEN
socket.on("message", (data) => {
  let li = document.createElement("li");
  li.textContent = data.text;
  li.classList.add("bubble");

  if (data.id === socket.id) {
    li.classList.add("me");
  } else {
    li.classList.add("other");
  }

  ulList.appendChild(li);
});

// IMAGE EMPFANGEN
socket.on("image", (data) => {
  let li = document.createElement("li");
  li.classList.add("bubble");

  let img = document.createElement("img");
  img.src = data.img;

  img.style.border = "3px solid red";

  li.appendChild(img);

  if (data.id === socket.id) {
    li.classList.add("me");
  } else {
    li.classList.add("other");
  }

  ulList.appendChild(li);
});

// BUTTON → FILE OPEN
plusBtn.addEventListener("click", () => {
  fileInput.click();
});

// FILE AUSWÄHLEN → SENDEN
fileInput.addEventListener("change", function () {
  console.log("1. Datei ausgewählt");

  let file = fileInput.files[0];
  if (!file) return;

  let reader = new FileReader();

  reader.onload = function (e) {
    console.log("2. FileReader fertig");

    const base64Image = e.target.result;
    console.log("3. Sende Bild an Server");

    socket.emit("image", base64Image);
  };

  reader.readAsDataURL(file);
});

// ENTER KEY
input.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    sendMessage();
  }
});

// BUTTON CLICK
send.addEventListener("click", sendMessage);

// TEXT SENDEN
function sendMessage() {
  let eingabe = input.value;

  if (eingabe.trim() === "") return;

  socket.emit("message", eingabe);

  input.value = "";
  input.focus();
}