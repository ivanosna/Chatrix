
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true,
    unique: true,
    minlength: 3,
    maxlength: 20,
    match: /^[a-zA-Z0-9_-]+$/
  },

  password: {
    type: String,
    required: true
  },

  gender: {
    type: String,
    enum: ["men", "women"],
    required: true
  }
});

const User = mongoose.model("User", userSchema);

module.exports = User;
