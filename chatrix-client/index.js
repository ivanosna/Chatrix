const input = document.getElementById("inputEl");
const send = document.getElementById("buttonEl");
const ulList = document.getElementById("ulEl");
const plusBtn = document.getElementById("plusBtn");
const fileInput = document.getElementById("fileInput");

const socket = io();

// =======================
//  USERS VOM BACKEND HOLEN
// =======================
async function loadUsers() {
  try {
    let res = await fetch("http://localhost:2000/users");
    let data = await res.json();

    console.log("Users vom Server:", data.users);

    // optional: anzeigen im UI
    ulList.innerHTML = "";

    data.users
  .filter(user => user.loggedIn)
  .forEach(user => {
    let li = document.createElement("li");
    li.textContent = `${user.name} (${user.age})`;
    ulList.appendChild(li);
  });

  } catch (err) {
    console.log("Fehler beim Laden der Users:", err);
  }
}

// beim Start laden
loadUsers();


// =======================
// TEXT EMPFANGEN (SOCKET)
// =======================
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


// =======================
// IMAGE EMPFANGEN
// =======================
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


// =======================
// FILE BUTTON
// =======================
plusBtn.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", function () {
  let file = fileInput.files[0];
  if (!file) return;

  let reader = new FileReader();

  reader.onload = function (e) {
    const base64Image = e.target.result;
    socket.emit("image", base64Image);
  };

  reader.readAsDataURL(file);
});


// =======================
// ENTER KEY
// =======================
input.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    sendMessage();
  }
});


// =======================
// BUTTON CLICK
// =======================
send.addEventListener("click", sendMessage);


// =======================
// MESSAGE SENDEN
// =======================
function sendMessage() {
  let eingabe = input.value;

  if (eingabe.trim() === "") return;

  socket.emit("message", eingabe);

  input.value = "";
  input.focus();
}