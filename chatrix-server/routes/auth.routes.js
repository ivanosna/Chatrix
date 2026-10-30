
const express = require("express");
const User = require("../models/User.js");
const Match = require("../models/Match.js");
const Message = require("../models/Message.js");
const router = express.Router();

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { rateLimit } = require("express-rate-limit");

require("dotenv").config();


// SICHERHEITSCHECK

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET fehlt in der .env-Datei!");
}


// RATE LIMITING

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many login attempts. Please try again later."
  }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many registration attempts. Please try again later."
  }
});


// EINGABEN VALIDIEREN

function isValidUsername(username) {
  return (
    typeof username === "string" &&
    /^[a-zA-Z0-9_-]{3,20}$/.test(username)
  );
}

function isValidPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    Buffer.byteLength(password, "utf8") <= 72
  );
}


// REGISTER

router.post("/register", registerLimiter, async (req, res) => {
  try {
    const username =
      typeof req.body?.username === "string"
        ? req.body.username.trim()
        : "";

    const password = req.body?.password;
    const gender = req.body?.gender;

    if (!isValidUsername(username)) {
      return res.status(400).json({
        error: "Username must contain 3-20 letters, numbers, _ or -."
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        error: "Password must contain at least 8 characters and may not exceed 72 UTF-8 bytes."
      });
    }

    if (!["men", "women"].includes(gender)) {
      return res.status(400).json({
        error: "Gender must be men or women."
      });
    }

    const existingUser = await User.findOne({
      user: username
    });

    if (existingUser) {
      return res.status(409).json({
        error: "Username is already taken."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await User.create({
      user: username,
      password: hashedPassword,
      gender
    });

    return res.status(201).json({
      message: "Account successfully created."
    });

  } catch (err) {
    // Eindeutiger Datenbankindex: doppelte Registrierung abfangen
    if (err.code === 11000) {
      return res.status(409).json({
        error: "Username is already taken."
      });
    }

    console.error("Registration error:", err);

    return res.status(500).json({
      error: "Server error during registration."
    });
  }
});


// LOGIN

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const username =
      typeof req.body?.username === "string"
        ? req.body.username.trim()
        : "";

    const password = req.body?.password;

    if (!username || typeof password !== "string") {
      return res.status(400).json({
        error: "Username and password are required."
      });
    }

    if (
      username.length > 20 ||
      password.length === 0 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(401).json({
        error: "Invalid username or password."
      });
    }

    const user = await User.findOne({
      user: username
    });

    if (!user) {
      return res.status(401).json({
        error: "Invalid username or password."
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Invalid username or password."
      });
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        username: user.user
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h"
      }
    );

    return res.json({
      message: "Login successful.",
      token
    });

  } catch (err) {
    console.error("Login error:", err);

    return res.status(500).json({
      error: "Server error during login."
    });
  }
});


// AUTHENTIFIZIERUNGS-MIDDLEWARE

function middleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (
    typeof authHeader !== "string" ||
    !authHeader.startsWith("Bearer ")
  ) {
    return res.status(401).json({
      error: "Authentication required."
    });
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      error: "Authentication required."
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (!decoded.userId || !decoded.username) {
      return res.status(403).json({
        error: "Invalid token."
      });
    }

    req.user = decoded;
    next();

  } catch (err) {
    return res.status(403).json({
      error: "Invalid or expired token."
    });
  }
}


// PROFIL

router.get("/profile", middleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select("_id user gender")
      .lean();

    if (!user) {
      return res.status(404).json({
        error: "User not found."
      });
    }

    return res.json({
      user
    });

  } catch (err) {
    console.error("Profile error:", err);

    return res.status(500).json({
      error: "Server error loading profile."
    });
  }
});


// MATCHES

router.get("/matches", middleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select("_id")
      .lean();

    if (!user) {
      return res.status(404).json({
        error: "User not found."
      });
    }

    const matches = await Match.find({
      users: user._id
    })
      .populate("users", "user gender")
      .sort({ createdAt: -1 })
      .lean();

    const result = matches.map((match) => {
      const partner = match.users.find(
        (matchUser) =>
          matchUser._id.toString() !== user._id.toString()
      );

      if (!partner) return null;

      return {
        matchId: match._id,
        matchKey: match.matchKey,
        partner: {
          user: partner.user,
          gender: partner.gender
        },
        createdAt: match.createdAt
      };
    }).filter(Boolean);

    return res.json({
      matches: result
    });

  } catch (err) {
    console.error("Matches error:", err);

    return res.status(500).json({
      error: "Server error loading matches."
    });
  }
});


// PRIVATE CHAT NACHRICHTEN LADEN

router.get(
  "/matches/:matchKey/messages",
  middleware,
  async (req, res) => {
    try {
      const matchKey = req.params.matchKey;

      if (
        typeof matchKey !== "string" ||
        matchKey.length > 100
      ) {
        return res.status(400).json({
          error: "Invalid match ID."
        });
      }

      const user = await User.findById(req.user.userId)
        .select("_id")
        .lean();

      if (!user) {
        return res.status(404).json({
          error: "User not found."
        });
      }

      const match = await Match.findOne({
        matchKey,
        users: user._id
      }).lean();

      if (!match) {
        return res.status(403).json({
          error: "You are not allowed to access this chat."
        });
      }

      // Maximal 100 Nachrichten laden
      const messages = await Message.find({
        matchKey: match.matchKey
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate("sender", "user")
        .lean();

      const result = messages.reverse().map((message) => ({
        text: message.text,
        sender: message.sender?.user || "Unknown",
        isMine:
          message.sender?._id?.toString() === user._id.toString(),
        createdAt: message.createdAt
      }));

      return res.json({
        messages: result
      });

    } catch (err) {
      console.error("Messages error:", err);

      return res.status(500).json({
        error: "Server error loading messages."
      });
    }
  }
);


module.exports = router;
