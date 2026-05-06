console.log("JS LOADED");

const socket = io();

// =====================
// ELEMENTS
// =====================
const input = document.getElementById("inputEl");
const send = document.getElementById("buttonEl");
const ulList = document.getElementById("ulEl");
const plusBtn = document.getElementById("plusBtn");
const fileInput = document.getElementById("fileInput");
const logoutBtn = document.getElementById("logoutBtn");

const usernameInput = document.getElementById("usernameEl");
const passwordInput = document.getElementById("passwordEl");
const loginBtn = document.getElementById("loginBtn");

const regUsername = document.getElementById("regUsernameEl");
const regPassword = document.getElementById("regPasswordEl");
const registerBtn = document.getElementById("registerBtn");

const errorText = document.getElementById("errorText");

// =====================
// LOGIN CHECK
// =====================
if (!window.location.pathname.includes("login")) {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "login.html";
  }
}

// =====================
// LOGIN
// =====================
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

// =====================
// REGISTER
// =====================
async function register() {
  const res = await fetch("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: regUsername?.value,
      password: regPassword?.value
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

// =====================
// TEXT EMPFANGEN
// =====================
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

// =====================
// IMAGE EMPFANGEN
// =====================
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

// =====================
// SEND MESSAGE
// =====================
function sendMessage() {
  if (!input) return;

  if (input.value.trim() === "") return;

  socket.emit("message", input.value);

  input.value = "";
}

if (send) send.addEventListener("click", sendMessage);

if (input) {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });
}

// =====================
// IMAGE SEND
// =====================
if (plusBtn && fileInput) {
  plusBtn.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", function () {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {
      socket.emit("image", e.target.result);
    };

    reader.readAsDataURL(file);
  });
}

// =====================
// LOGOUT
// =====================
if (logoutBtn) {
  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();

    localStorage.removeItem("token");
    window.location.href = "login.html";
  });
}