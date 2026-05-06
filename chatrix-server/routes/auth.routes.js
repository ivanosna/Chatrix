const express = require("express");
const router = express.Router();
const fs = require("fs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

require("dotenv").config();


// =====================
// SAFE DB LOAD FUNCTION
// =====================
function loadUsers() {
  try {
    if (!fs.existsSync("datenbank.json")) {
      fs.writeFileSync("datenbank.json", "[]");
    }

    const daten = fs.readFileSync("datenbank.json", "utf-8");

    if (!daten) return [];

    return JSON.parse(daten);
  } catch (err) {
    return [];
  }
}


// =====================
// REGISTER
// =====================
router.post("/register", async (req, res) => {
  try {
    const username = req.body.username;
    const password = req.body.password;

    if (!username) {
      return res.status(400).json({ error: "username is missing" });
    }

    if (!password) {
      return res.status(400).json({ error: "password is missing" });
    }

    const users = loadUsers();

    const userExists = users.find(u => u.user === username);

    if (userExists) {
      return res.status(400).json({ error: "user already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    users.push({
      user: username,
      password: hashedPassword
    });

    fs.writeFileSync("datenbank.json", JSON.stringify(users, null, 2));

    res.json({
      message: "user created",
      user: username
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "server error register" });
  }
});


// =====================
// LOGIN
// =====================
router.post("/login", async (req, res) => {
  try {
    const username = req.body.username;
    const password = req.body.password;

    if (!username) {
      return res.status(400).json({ error: "username is missing" });
    }

    if (!password) {
      return res.status(400).json({ error: "password is missing" });
    }

    const users = loadUsers();

    const existingUser = users.find(u => u.user === username);

    if (!existingUser) {
      return res.status(400).json({ error: "user does not exist, please register" });
    }

    const checkPassword = await bcrypt.compare(password, existingUser.password);

    if (!checkPassword) {
      return res.status(400).json({ error: "wrong password" });
    }

    const token = jwt.sign(
      { username: existingUser.user },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      message: `Welcome back ${username}`,
      token
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "server error login" });
  }
});


// =====================
// MIDDLEWARE
// =====================
function middleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "no token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "invalid token" });
  }
}


// =====================
// PROFILE
// =====================
router.get("/profile", middleware, (req, res) => {
  res.json({
    user: req.user
  });
});

module.exports = router;