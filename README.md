# 💬 Chatrix – Fullstack Real-Time Chat Application

Chatrix is a fullstack real-time chat application built with JavaScript, Node.js, Express, MongoDB and Socket.IO.

The application features user authentication, real-time public messaging, private one-to-one chat rooms, partner matching, image sharing and persistent match and message data.

Chatrix is an ongoing personal project focused on learning and building practical fullstack development skills.

## 🚀 Features

- 🔐 User registration and login
- 🔑 JWT-based authentication
- 🔒 Protected routes and authenticated chat access
- 🔐 Password hashing with bcrypt
- 💬 Real-time public chat using Socket.IO
- 🧑‍🤝‍🧑 Private one-to-one chat rooms
- 🎯 Partner matching based on gender preferences
- ❤️ Mutual likes and match notifications
- 💾 Persistent matches stored in MongoDB
- 📜 Private text message history stored in MongoDB
- 🖼️ Image sharing in public and private chats
- ⏭️ Next and Leave controls for private rooms
- 📡 Animated partner search with cancel functionality
- 🛡️ Rate limiting for important authentication and chat events
- 📱 Responsive user interface
- ⚡ Instant message updates without page refresh

## 🧱 Tech Stack

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript
- Socket.IO Client
- Lucide Icons

### Backend
- Node.js
- Express.js
- Socket.IO
- MongoDB
- Mongoose
- JSON Web Tokens (JWT)
- bcrypt
- Helmet
- dotenv

## 📁 Project Structure

```text
Chatrix/
├── chatrix-client/
│   ├── index.html
│   ├── login.html
│   ├── index.js
│   └── style.css
│
├── chatrix-server/
│   ├── models/
│   │   ├── User.js
│   │   ├── Match.js
│   │   └── Message.js
│   │
│   ├── routes/
│   │   └── auth.routes.js
│   │
│   ├── server.js
│   ├── package.json
│   └── package-lock.json
│
├── .gitignore
└── README.md
```

## ⚙️ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/ivanosna/Chatrix.git
cd Chatrix
```

### 2. Install backend dependencies

```bash
cd chatrix-server
npm install
```

### 3. Configure environment variables

Create a `.env` file inside the `chatrix-server` directory:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```

Replace the example values with your own MongoDB connection string and a secure JWT secret.

### 4. Start the server

```bash
node server.js
```

### 5. Open the application

Navigate to:

```text
http://localhost:2000/login.html
```

## 🔐 Authentication Flow

1. Users can register and log in.
2. User passwords are hashed using bcrypt before being stored.
3. The server generates a JWT after successful login.
4. The token is stored in localStorage on the client.
5. Protected HTTP routes verify the JWT.
6. Socket.IO connections are authenticated using the JWT.
7. Only authenticated users can access chat functionality.

## 💾 Data Persistence

Chatrix uses MongoDB and Mongoose to store user and chat-related data.

- User accounts and password hashes
- Matched users and match information
- Private text messages and message timestamps

Images are shared in real time and are not permanently stored in MongoDB.

## 🛠️ Current Development

Chatrix is actively being developed. Planned improvements include:

- 🧭 Dashboard navigation
- 👤 User profile pages
- ⚙️ User settings and privacy controls
- 📜 Improved match history
- 🔔 Notifications
- 🟢 Online status
- 🎥 Real-time video calls using WebRTC
- ⭐ Premium features and payment integration
- ☁️ Deployment

## 👨‍💻 Author

**Ivan**

Aspiring Fullstack Developer – currently focusing on Backend Development.

## 📌 Project Status

Chatrix is a personal learning project that I continuously improve by implementing new features and working with real backend technologies.

The goal is to build a deeper understanding of backend development, authentication, databases, API design and real-time communication.

The project is still under active development, with new features and improvements planned.
