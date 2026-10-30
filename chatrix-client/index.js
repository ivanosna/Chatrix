
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

socket.on("disconnect", () => {
  hideMatchSearch();
});

// ELEMENTE
const roomStatus = document.getElementById("roomStatus");
const roomPartner = document.getElementById("roomPartner");
const likeBtn = document.getElementById("likeBtn");
const nextBtn = document.getElementById("nextBtn");
const leaveBtn = document.getElementById("leaveBtn");
const backToMainBtn = document.getElementById("backToMainBtn");

let currentRoomId = null;
let preferredGender = null;
let savedMatchChat = false;
let pendingMatchKey = null;

const matchSearch = document.getElementById("matchSearch");
const input = document.getElementById("inputEl");
const send = document.getElementById("buttonEl");
const ulList = document.getElementById("ulEl");
const plusBtn = document.getElementById("plusBtn");
const fileInput = document.getElementById("fileInput");
const logoutBtn = document.getElementById("logoutBtn");
const roomsBtn = document.getElementById("roomsBtn");
const cancelSearchBtn = document.getElementById("cancelSearchBtn");

const usernameInput = document.getElementById("usernameEl");
const passwordInput = document.getElementById("passwordEl");
const loginBtn = document.getElementById("loginBtn");

const regGender = document.getElementById("regGenderEl");
const regUsername = document.getElementById("regUsernameEl");
const regPassword = document.getElementById("regPasswordEl");
const registerBtn = document.getElementById("registerBtn");

const errorText = document.getElementById("errorText");

const roomsPopup = document.getElementById("roomsPopup");
const closeRoomsBtn = document.getElementById("closeRoomsBtn");

// MATCHES ELEMENTE
const chatView = document.getElementById("chatView");
const matchesBtn = document.getElementById("matchesBtn");
const matchesContainer = document.getElementById("matchesContainer");
const matchesList = document.getElementById("matchesList");
const backToChatBtn = document.getElementById("backToChatBtn");

// MATCH-SUCHE ANZEIGEN / AUSBLENDEN
function showMatchSearch() {
  if (matchSearch) matchSearch.hidden = false;
}

function hideMatchSearch() {
  if (matchSearch) matchSearch.hidden = true;
}

// NACHRICHT ANZEIGEN
function addMessage(text, isMine) {
  if (!ulList) return;

  const li = document.createElement("li");

  li.textContent = text;
  li.classList.add("bubble");
  li.classList.add(isMine ? "me" : "other");

  ulList.appendChild(li);
  ulList.scrollTop = ulList.scrollHeight;
}

// ROOMS POPUP
if (roomsBtn && roomsPopup) {
  roomsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    roomsPopup.hidden = false;
  });
}

if (closeRoomsBtn && roomsPopup) {
  closeRoomsBtn.addEventListener("click", () => {
    roomsPopup.hidden = true;
  });
}

// MATCH GEFUNDEN
socket.on("matchFound", (data) => {
  hideMatchSearch();

  savedMatchChat = false;
  currentRoomId = data.roomId;

  if (likeBtn) {
    likeBtn.disabled = false;
    likeBtn.hidden = false;
    likeBtn.textContent = "❤️ Like";
  }

  if (nextBtn) nextBtn.disabled = false;
  if (leaveBtn) leaveBtn.disabled = false;
  if (roomStatus) roomStatus.hidden = false;

  if (roomPartner) {
    roomPartner.textContent = `Private chat with ${data.username}`;
  }

  if (ulList) ulList.replaceChildren();

  showChat();
});

// ROOM BEENDET
socket.on("roomEnded", (data) => {
  savedMatchChat = false;
  currentRoomId = null;
  pendingMatchKey = null;

  // Der Nutzer, der Next gedrückt hat, sucht weiter.
  // Beim anderen Nutzer wird die Animation ausgeblendet.
  if (data.reason === "next" && data.by === socket.id) {
    showMatchSearch();
  } else {
    hideMatchSearch();
  }

  if (likeBtn) {
    likeBtn.disabled = false;
    likeBtn.hidden = false;
    likeBtn.textContent = "❤️ Like";
  }

  if (nextBtn) nextBtn.disabled = false;
  if (leaveBtn) leaveBtn.disabled = false;
  if (roomStatus) roomStatus.hidden = true;

  if (roomsPopup) roomsPopup.hidden = true;

  if (ulList) {
    ulList.replaceChildren();

    const li = document.createElement("li");

    li.textContent = data.reason === "next"
      ? "The chat has ended."
      : "The private chat has ended.";

    ulList.appendChild(li);
  }

  showChat();
});

// MUTUAL LIKE
socket.on("mutualLike", () => {
  addMessage("It's a Match! ❤️", true);
});

// LIKE ERROR
socket.on("likeError", (data) => {
  addMessage(data.message, true);
});

// PRIVATE TEXT
socket.on("roomMessage", (data) => {
  addMessage(data.text, data.id === socket.id);
});

// PRIVATE BILDER
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

// MATCH-CHAT ERFOLGREICH GEÖFFNET
socket.on("matchRoomJoined", async (data) => {
  if (data.matchKey !== pendingMatchKey) return;

  currentRoomId = data.roomId;
  savedMatchChat = true;

  if (roomStatus) roomStatus.hidden = false;

  if (roomPartner) {
    roomPartner.textContent = `Chat with ${data.username}`;
  }

  if (likeBtn) likeBtn.hidden = true;
  if (nextBtn) nextBtn.disabled = true;
  if (leaveBtn) leaveBtn.disabled = false;

  if (ulList) ulList.replaceChildren();

  try {
    const token = localStorage.getItem("token");

    const response = await fetch(
      `/auth/matches/${encodeURIComponent(data.matchKey)}/messages`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error("Nachrichten konnten nicht geladen werden.");
    }

    const result = await response.json();

    if (!result.messages.length) {
      addMessage("No messages yet.", false);
    } else {
      result.messages.forEach((message) => {
        addMessage(message.text, message.isMine);
      });
    }

    pendingMatchKey = null;

  } catch (err) {
    console.error("Fehler beim Laden der Nachrichten:", err);
    addMessage("Messages could not be loaded.", false);
  }
});

// MATCH-CHAT FEHLER
socket.on("matchRoomError", (data) => {
  pendingMatchKey = null;
  alert(data.message);
});

// MATCH-CHAT VERLASSEN
socket.on("matchRoomLeft", () => {
  currentRoomId = null;
  savedMatchChat = false;
  pendingMatchKey = null;

  if (roomStatus) roomStatus.hidden = true;

  if (likeBtn) {
    likeBtn.hidden = false;
    likeBtn.disabled = false;
    likeBtn.textContent = "❤️ Like";
  }

  if (nextBtn) nextBtn.disabled = false;
  if (leaveBtn) leaveBtn.disabled = false;
});

// NEXT BUTTON
if (nextBtn) {
  nextBtn.addEventListener("click", () => {
    if (!preferredGender || savedMatchChat) return;

    showMatchSearch();
    socket.emit("nextPartner", preferredGender);
  });
}

// LEAVE BUTTON
if (leaveBtn) {
  leaveBtn.addEventListener("click", () => {
    if (savedMatchChat) {
      socket.emit("leaveMatchRoom");
      return;
    }

    socket.emit("leaveRoom");
  });
}

// LIKE BUTTON
if (likeBtn) {
  likeBtn.addEventListener("click", () => {
    if (savedMatchChat) return;

    socket.emit("like");

    likeBtn.textContent = "❤️ Liked";
    likeBtn.disabled = true;
  });
}

// GENDER BUTTONS
const menBtn = document.getElementById("menBtn");
const womenBtn = document.getElementById("womenBtn");

if (menBtn) {
  menBtn.addEventListener("click", () => {
    if (savedMatchChat) return;

    preferredGender = "men";

    if (roomsPopup) roomsPopup.hidden = true;

    showMatchSearch();
    socket.emit("findPartner", preferredGender);
  });
}

if (womenBtn) {
  womenBtn.addEventListener("click", () => {
    if (savedMatchChat) return;

    preferredGender = "women";

    if (roomsPopup) roomsPopup.hidden = true;

    showMatchSearch();
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
  } else if (errorText) {
    errorText.style.color = "red";
    errorText.textContent = data.error;
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
  } else if (errorText) {
    errorText.style.color = "red";
    errorText.textContent = data.error;
  }
}

if (registerBtn) {
  registerBtn.addEventListener("click", register);
}

// ÖFFENTLICHE NACHRICHTEN
socket.on("message", (data) => {
  if (!ulList || currentRoomId) return;

  addMessage(data.text, data.id === socket.id);
});

// ÖFFENTLICHE BILDER
socket.on("image", (data) => {
  if (!ulList || currentRoomId) return;

  const li = document.createElement("li");
  li.classList.add("bubble");

  const img = document.createElement("img");
  img.src = data.img;

  li.appendChild(img);
  li.classList.add(data.id === socket.id ? "me" : "other");

  ulList.appendChild(li);
});

// NACHRICHT SENDEN
function sendMessage() {
  if (!input || !input.value.trim()) return;

  if (currentRoomId) {
    socket.emit("roomMessage", input.value.trim());
  } else {
    socket.emit("message", input.value.trim());
  }

  input.value = "";
}

if (send) {
  send.addEventListener("click", sendMessage);
}

if (input) {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });
}

// BILD SENDEN
if (plusBtn && fileInput) {
  const MAX_FILE_SIZE = 3 * 1024 * 1024 - 1024;

  const allowedImageTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
  ];

  plusBtn.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", function () {
    const file = fileInput.files[0];

    if (!file) return;

    if (!allowedImageTypes.includes(file.type)) {
      alert("Bitte wähle ein gültiges Bild aus.");
      fileInput.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert("Das Bild darf maximal 3 MB groß sein.");
      fileInput.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = function (e) {
      const imageData = e.target.result;

      if (
        typeof imageData !== "string" ||
        imageData.length > 4 * 1024 * 1024
      ) {
        alert("Das Bild ist zu groß oder ungültig.");
        fileInput.value = "";
        return;
      }

      if (currentRoomId) {
        socket.emit("roomImage", imageData);
      } else {
        socket.emit("image", imageData);
      }

      fileInput.value = "";
    };

    reader.onerror = function () {
      alert("Das Bild konnte nicht gelesen werden.");
      fileInput.value = "";
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

// CHAT ANZEIGEN
function showChat() {
  if (chatView) chatView.hidden = false;
  if (matchesContainer) matchesContainer.hidden = true;
}


// PARTNERSUCHE ABBRECHEN

if (cancelSearchBtn) {
  cancelSearchBtn.addEventListener("click", () => {
    cancelSearchBtn.disabled = true;
    cancelSearchBtn.textContent = "Cancelling...";

    socket.emit("cancelSearch");
  });
}

socket.on("searchCancelled", () => {
  hideMatchSearch();

  if (cancelSearchBtn) {
    cancelSearchBtn.disabled = false;
    cancelSearchBtn.textContent = "Cancel Search";
  }

  console.log("Partnersuche wurde abgebrochen.");
});



// MATCH-CHAT ÖFFNEN
function openMatch(match) {
  if (currentRoomId) {
    alert("Please leave your current chat first.");
    return;
  }

  if (!socket.connected) {
    alert("Server connection is not available.");
    return;
  }

  if (!match.matchKey) {
    alert("This match has no valid chat ID.");
    return;
  }

  pendingMatchKey = match.matchKey;

  showChat();

  if (ulList) ulList.replaceChildren();

  if (roomPartner) {
    roomPartner.textContent = `Connecting to ${match.partner.user}...`;
  }

  socket.emit("joinMatchRoom", match.matchKey);
}

// MATCHES ANZEIGEN
async function showMatches() {
  if (!chatView || !matchesContainer || !matchesList) return;

  if (currentRoomId) {
    alert("Please leave your current chat first.");
    return;
  }

  chatView.hidden = true;
  matchesContainer.hidden = false;

  matchesList.replaceChildren();

  const token = localStorage.getItem("token");

  try {
    const response = await fetch("/auth/matches", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("Matches konnten nicht geladen werden.");
    }

    const data = await response.json();

    if (data.matches.length === 0) {
      matchesList.textContent = "You don't have any matches yet.";
      return;
    }

    data.matches.forEach((match) => {
      const li = document.createElement("li");

      li.textContent = `❤️ ${match.partner.user}`;
      li.style.cursor = "pointer";

      li.addEventListener("click", () => {
        openMatch(match);
      });

      matchesList.appendChild(li);
    });

  } catch (err) {
    console.error("Match-Fehler:", err);
    matchesList.textContent = "Matches could not be loaded.";
  }
}

// MATCHES BUTTON
if (matchesBtn) {
  matchesBtn.addEventListener("click", (event) => {
    event.preventDefault();
    showMatches();
  });
}

// BACK TO CHAT BUTTON
if (backToChatBtn) {
  backToChatBtn.addEventListener("click", () => {
    showChat();
  });
}

// BACK TO MAIN PAGE BUTTON
if (backToMainBtn) {
  backToMainBtn.addEventListener("click", () => {
    hideMatchSearch();

    if (savedMatchChat) {
      socket.emit("leaveMatchRoom");
    } else if (currentRoomId) {
      socket.emit("leaveRoom");
    }

    currentRoomId = null;
    savedMatchChat = false;
    pendingMatchKey = null;

    if (roomStatus) roomStatus.hidden = true;

    if (ulList) ulList.replaceChildren();

    if (likeBtn) {
      likeBtn.hidden = false;
      likeBtn.disabled = false;
      likeBtn.textContent = "❤️ Like";
    }

    if (nextBtn) nextBtn.disabled = false;
    if (leaveBtn) leaveBtn.disabled = false;

    if (roomsPopup) roomsPopup.hidden = true;

    showChat();
  });
}
