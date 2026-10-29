const express = require("express");
const User = require("../models/User.js")
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

require("dotenv").config();


// REGISTER

router.post("/register", async (req, res) => {
  try {
    const username = req.body.username;
    const password = req.body.password;
    const gender = req.body.gender;

    if (!username) return res.status(400).json({ error: "username is missing" });
    if (!password) return res.status(400).json({ error: "password is missing" });

    if (!["men", "women"].includes(gender)) {
      return res.status(400).json({ error: "gender must be men or women" });
}

    const user = await User.findOne({user: username})

    if (user) {
      return res.status(400).json({ error: "user already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      user: username,
      password: hashedPassword,
      gender: gender
    });


    res.json({
      message: "user created",
      user: username
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "server error register" });
  }
});



// LOGIN

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

    const user = await User.findOne({user: username});

    if (!user) {
      return res.status(400).json({ error: "user does not exist, please register" });
    }

    const checkPassword = await bcrypt.compare(password, user.password);

    if (!checkPassword) {
      return res.status(400).json({ error: "wrong password" });
    }

    const token = jwt.sign(
      { username: user.user },
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



// MIDDLEWARE

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



// PROFILE

router.get("/profile", middleware, (req, res) => {
  res.json({
    user: req.user
  });
});

module.exports = router;