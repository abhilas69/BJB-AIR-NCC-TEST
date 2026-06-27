const express = require('express');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
require('dotenv').config();

const Question = require('./models/Question');
const Result = require('./models/Result');

const app = express();

// 1. GLOBAL MIDDLEWARE
app.use(express.json());
app.use(express.static('public'));

// 2. HARDCODED ADMIN CREDENTIALS
const ADMIN_CREDENTIALS = {
    "abhilas": "2006",
    "soumya": "2006"
};

// 3. DATABASE CONNECTION
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB Atlas successfully.'))
    .catch(err => console.error('Database connection error:', err));


// --- 5. API ROUTES ---

// Admin Login Authentication Endpoint
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    if (ADMIN_CREDENTIALS[username] && ADMIN_CREDENTIALS[username] === password) {
        res.status(200).json({ success: true, message: "Login successful" });
    } else {
        res.status(401).json({ success: false, message: "Invalid Username or Password" });
    }
});

// Get all questions (For the student's test page - conceals the correct answer index)
app.get('/api/questions', async (req, res) => {
    try {
        const questions = await Question.find({}, { correctAnswer: 0 });
        res.json(questions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check if a student already submitted before allowing quiz access
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

app.post('/api/check-student', async (req, res) => {
    try {
        const { studentName } = req.body;
        if (!studentName || !studentName.trim()) {
            return res.status(400).json({ exists: false, message: 'Name is required' });
        }

        const normalized = studentName.trim();
        const exists = await Result.exists({
            studentName: { $regex: `^${escapeRegExp(normalized)}$`, $options: 'i' }
        });

        res.json({ exists: !!exists });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Endpoint: Save a newly created question to MongoDB
app.post('/api/questions', async (req, res) => {
    try {
        const { questionText, options, correctAnswer } = req.body;
        const newQuestion = new Question({ questionText, options, correctAnswer });
        await newQuestion.save();
        res.status(201).json({ message: 'Question added successfully' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Admin Endpoint: Fetch all student testing history profiles
app.get('/api/results', async (req, res) => {
    try {
        const results = await Result.find().sort({ submittedAt: -1 });
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Endpoint: Generate and download highlighted student report PDF
app.get('/api/results/:id/pdf', async (req, res) => {
    try {
        const result = await Result.findById(req.params.id);
        if (!result) {
            return res.status(404).json({ error: 'Result not found' });
        }

        // Safely extract answers into a plain JavaScript Object
        let rawAnswers = {};
        if (result.answers instanceof Map) {
            rawAnswers = Object.fromEntries(result.answers);
        } else if (result.answers && typeof result.answers === 'object') {
            rawAnswers = JSON.parse(JSON.stringify(result.answers));
        }

        const answerKeys = Object.keys(rawAnswers);
        
        // Cast string IDs into Mongoose ObjectIds so MongoDB matches records properly
        const objectIds = answerKeys.map(key => {
            try {
                return new mongoose.Types.ObjectId(key);
            } catch (e) {
                return null;
            }
        }).filter(id => id !== null);

        // Fetch all relevant questions from the database using ObjectIds
        const questions = await Question.find({ _id: { $in: objectIds } });
        const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

        // Initialize PDF Document
        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${result.studentName}-report.pdf"`);
        doc.pipe(res);

        // Document Header
        doc.fontSize(22).fillColor('#1e3a8a').text(`Student Performance Report`, { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#334155');
        doc.text(`Name: ${result.studentName}`);
        doc.text(`Time Taken: ${result.timeTaken} mins`);
        doc.text(`Score: ${result.score} / ${questions.length}`);
        doc.text(`Wrong Answers: ${result.wrongAnswers}`);
        doc.moveDown(1.5);

        // Iterate through each question
        answerKeys.forEach((questionId, idx) => {
            const question = questionMap.get(questionId);
            if (!question) return; // Skip if question no longer exists in DB

            const selectedIndex = rawAnswers[questionId] !== null ? Number(rawAnswers[questionId]) : null;
            const isCorrect = selectedIndex !== null && selectedIndex === question.correctAnswer;

            // Question Text Label
            doc.fontSize(12).fillColor('#0f172a').text(`${idx + 1}. ${question.questionText}`);
            doc.moveDown(0.2);

            // Render Options
            question.options.forEach((optionText, optionIndex) => {
                const isSelected = selectedIndex === optionIndex;
                const isCorrectOption = optionIndex === question.correctAnswer;
                
                let color = '#475569'; // Default gray for unselected options
                let prefix = '    [ ] ';

                if (isSelected) {
                    prefix = '    [X] '; // Bulletproof safe marker instead of problematic Unicode icons
                    color = isCorrect ? '#16a34a' : '#dc2626'; // Green if chosen correct, Red if chosen wrong
                } else if (!isCorrect && isCorrectOption) {
                    color = '#16a34a'; // Reveal the correct option in Green if student answered incorrectly
                }

                doc.fontSize(11).fillColor(color).text(`${prefix}${String.fromCharCode(65 + optionIndex)}. ${optionText}`);
            });

            // Summary Verdict Line for the Question
            doc.moveDown(0.2);
            if (isCorrect) {
                doc.fontSize(10).fillColor('#16a34a').text(`Verdict: Correct`, { italic: true });
            } else {
                doc.fontSize(10).fillColor('#dc2626').text(`Verdict: Incorrect (Correct Answer: ${String.fromCharCode(65 + question.correctAnswer)})`, { italic: true });
            }

            doc.moveDown(1);
        });

        doc.end();
    } catch (err) {
        console.error('PDF Generation Error:', err);
        res.status(500).json({ error: 'Failed to generate PDF report.' });
    }
});

// Student Submission Endpoint
app.post('/api/submit', async (req, res) => {
    try {
        const { studentName, timeTaken, answers } = req.body; 

        const questions = await Question.find({});
        let score = 0;
        let wrongAnswers = 0;
        const normalizedAnswers = {};

        Object.entries(answers || {}).forEach(([questionId, answerValue]) => {
            const parsed = parseInt(answerValue, 10);
            normalizedAnswers[questionId] = Number.isNaN(parsed) ? null : parsed;
        });

        questions.forEach(q => {
            const studentAnswer = normalizedAnswers[q._id.toString()];
            if (studentAnswer !== undefined && studentAnswer !== null) {
                if (studentAnswer === q.correctAnswer) {
                    score++;
                } else {
                    wrongAnswers++;
                }
            } else {
                wrongAnswers++; 
            }
        });

        const newResult = new Result({
            studentName,
            timeTaken,
            answers: normalizedAnswers,
            score,
            wrongAnswers
        });
        await newResult.save();

        res.status(200).json({ message: 'Submission completed and data processed.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));