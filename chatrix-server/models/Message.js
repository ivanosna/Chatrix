const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    matchKey: {
        type: String,
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    }
}, {
    timestamps: true
});

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;