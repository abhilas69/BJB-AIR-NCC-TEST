const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    questionText: { 
        type: String,
        required: true,
        },
    options: [{
        type: String,
        required: true,
        }],
    correctAnswer: {
        type: Number,
        required: true,
        },
    createdAt:{
        type:Date,
        default: Date.now,
        expires:86400
    }
});

module.exports = mongoose.model('Question', questionSchema);