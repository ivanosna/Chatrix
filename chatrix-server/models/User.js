const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  user: String,
  password: String,
  gender: {
    type: String,
    enum: ["men", "women"],
    required: true
  }
});

const User = mongoose.model("User", userSchema);
module.exports = User;