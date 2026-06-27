const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    studentName: { type: String, required: true },
    timeTaken: { type: String, required: true }, // Formatted string (e.g., "12:35")
    answers: {
        type: Map,
        of: Number,
        required: true
    },
    score: { type: Number, required: true },
    wrongAnswers: { type: Number, required: true },
    submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Result', resultSchema);