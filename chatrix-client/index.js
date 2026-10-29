console.log("JS LOADED");


const socket = io({
  auth: {
    token: localStorage.getItem("token")
  },
  transports: ["polling"]
});

socket.on("connect", () => {
  console.log("Socket verbunden:", socket.id);
});

socket.on("connect_error", (err) => {
  console.log("Socket-Verbindungsfehler:", err.message);
});



const roomStatus = document.getElementById("roomStatus");
const roomPartner = document.getElementById("roomPartner");
const likeBtn = document.getElementById("likeBtn");
const nextBtn = document.getElementById("nextBtn");
const leaveBtn = document.getElementById("leaveBtn");

let currentRoomId = null;

const input = document.getElementById("inputEl");
const send = document.getElementById("buttonEl");
const ulList = document.getElementById("ulEl");
const plusBtn = document.getElementById("plusBtn");
const fileInput = document.getElementById("fileInput");
const logoutBtn = document.getElementById("logoutBtn");
const roomsBtn = document.getElementById("roomsBtn");
  const regGender = document.getElementById("regGenderEl");

const usernameInput = document.getElementById("usernameEl");
const passwordInput = document.getElementById("passwordEl");
const loginBtn = document.getElementById("loginBtn");

const regUsername = document.getElementById("regUsernameEl");
const regPassword = document.getElementById("regPasswordEl");
const registerBtn = document.getElementById("registerBtn");

const errorText = document.getElementById("errorText");


const roomsPopup = document.getElementById("roomsPopup");
const closeRoomsBtn = document.getElementById("closeRoomsBtn");

// Popup öffnen
if (roomsBtn) {
  roomsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    roomsPopup.hidden = false;
  });
}

// Popup schließen
if (closeRoomsBtn) {
  closeRoomsBtn.addEventListener("click", () => {
    roomsPopup.hidden = true;
  });
}



socket.on("matchFound", (data) => {
  currentRoomId = data.roomId;

  if (roomStatus) roomStatus.hidden = false;
  if (roomPartner) {
    roomPartner.textContent = `Private chat with ${data.username}`;
  }

  if (ulList) ulList.replaceChildren();
  console.log("Privater Chat gestartet:", data.roomId);
});

socket.on("roomEnded", (data) => {
  currentRoomId = null;

  if (roomStatus) roomStatus.hidden = true;

  if (ulList) {
    const li = document.createElement("li");
    li.textContent = data.reason === "next"
  ? "The chat has ended."
  : "The private chat has ended.";
    ulList.appendChild(li);
  }
});

socket.on("roomMessage", (data) => {
  if (!ulList) return;

  const li = document.createElement("li");
  li.textContent = data.text;
  li.classList.add("bubble");
  li.classList.add(data.id === socket.id ? "me" : "other");
  ulList.appendChild(li);
});

socket.on("roomImage", (data) => {
  if (!ulList) return;

  const li = document.createElement("li");
  li.classList.add("bubble");

  const img = document.createElement("img");
  img.src = data.img;
  li.appendChild(img);

  li.classList.add(data.id === socket.id ? "me" : "other");
  ulList.appendChild(li);
});

if (nextBtn) {
  nextBtn.addEventListener("click", () => {
    if (!preferredGender) return;
    socket.emit("nextPartner", preferredGender);
  });
}

if (leaveBtn) {
  leaveBtn.addEventListener("click", () => {
    socket.emit("leaveRoom");
  });
}

if (likeBtn) {
  likeBtn.addEventListener("click", () => {
    likeBtn.textContent = "❤️ Liked";
    likeBtn.disabled = true;
  });
}



const menBtn = document.getElementById("menBtn");
const womenBtn = document.getElementById("womenBtn");


let preferredGender = null;


if (menBtn) {
  menBtn.addEventListener("click", () => {
    preferredGender = "men";
    roomsPopup.hidden = true;

    socket.emit("findPartner", preferredGender);
  });
}



if (womenBtn) {
  womenBtn.addEventListener("click", () => {
    preferredGender = "women";
    roomsPopup.hidden = true;

    socket.emit("findPartner", preferredGender);
  });
}





// LOGIN CHECK

if (!window.location.pathname.includes("login")) {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "login.html";
  }
}


// LOGIN

async function login() {
  const res = await fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: usernameInput?.value,
      password: passwordInput?.value
    })
  });

  const data = await res.json();

  if (data.token) {
    localStorage.setItem("token", data.token);
    window.location.href = "index.html";
  } else {
    if (errorText) {
      errorText.style.color = "red";
      errorText.textContent = data.error;
    }
  }
}

if (loginBtn) {
  loginBtn.addEventListener("click", login);
}


// REGISTER

async function register() {
  const res = await fetch("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: regUsername?.value,
      password: regPassword?.value,
      gender: regGender?.value
    })
  });

  const data = await res.json();

  if (data.message) {
    if (errorText) {
      errorText.style.color = "lightgreen";
      errorText.textContent = "Account created! Now login.";
    }
  } else {
    if (errorText) {
      errorText.style.color = "red";
      errorText.textContent = data.error;
    }
  }
}

if (registerBtn) {
  registerBtn.addEventListener("click", register);
}


// TEXT EMPFANGEN

socket.on("message", (data) => {
  const li = document.createElement("li");
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
  const li = document.createElement("li");
  li.classList.add("bubble");

  const img = document.createElement("img");
  img.src = data.img;

  li.appendChild(img);

  if (data.id === socket.id) {
    li.classList.add("me");
  } else {
    li.classList.add("other");
  }

  ulList.appendChild(li);
});


// SEND MESSAGE


function sendMessage() {
  if (!input) return;
  if (input.value.trim() === "") return;

  if (currentRoomId) {
    socket.emit("roomMessage", input.value.trim());
  } else {
    socket.emit("message", input.value.trim());
  }

  input.value = "";
}

if (send) send.addEventListener("click", sendMessage);

if (input) {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });
}



// IMAGE SEND

if (plusBtn && fileInput) {
  plusBtn.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", function () {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {
      if (currentRoomId) {
        socket.emit("roomImage", e.target.result);
      } else {
        socket.emit("image", e.target.result);
      }
    };

    reader.readAsDataURL(file);
  });
}


// LOGOUT

if (logoutBtn) {
  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();

    localStorage.removeItem("token");
    window.location.href = "login.html";
  });
}