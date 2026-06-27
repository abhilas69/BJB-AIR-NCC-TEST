let totalSeconds = 50 * 60; // 50 Minutes
let timerInterval;
const studentName = sessionStorage.getItem('studentName');

if (!studentName) {
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    initQuiz();
    document.getElementById('quizForm').addEventListener('submit', submitExam);
});

// Initialise Examination Portal
async function initQuiz() {
    try {
        const res = await fetch('/api/questions');
        const questions = await res.json();
        
        const container = document.getElementById('questionsContainer');
        if(questions.length === 0) {
            container.innerHTML = `<p>No questions found in database. Ask admin to add some.</p>`;
            return;
        }

        questions.forEach((q, idx) => {
            const qDiv = document.createElement('div');
            qDiv.className = 'question-block';
            qDiv.innerHTML = `
                <p class=\"question-text\"><strong>Q${idx + 1}.</strong> ${q.questionText}</p>
                <div class=\"options-group\">
                    ${q.options.map((opt, i) => `
                        <label>
                            <input type=\"radio\" name=\"${q._id}\" value=\"${i}\" required>
                            ${opt}
                        </label>
                    `).join('')}
                </div>
            `;
            container.appendChild(qDiv);
        });

        startTimer();
    } catch (err) {
        console.error(err);
    }
}

function startTimer() {
    const timerDisplay = document.getElementById('timer');
    timerInterval = setInterval(() => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        
        timerDisplay.textContent = `Time Remaining: ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        if (totalSeconds <= 0) {
            clearInterval(timerInterval);
            submitExam(); 
        }
        totalSeconds--;
    }, 1000);
}

async function submitExam(e) {
    if(e) e.preventDefault();
    clearInterval(timerInterval);

    const formData = new FormData(document.getElementById('quizForm'));
    const answers = {};
    formData.forEach((value, key) => {
        answers[key] = value;
    });

    const elapsedSeconds = (50 * 60) - totalSeconds;
    const elapsedMins = Math.floor(elapsedSeconds / 60);
    const elapsedSecs = elapsedSeconds % 60;
    const timeTakenStr = `${elapsedMins}:${elapsedSecs.toString().padStart(2, '0')}`;

    try {
        const res = await fetch('/api/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentName,
                timeTaken: timeTakenStr,
                answers
            })
        });

        if (res.ok) {
            sessionStorage.clear();
            window.location.href = 'thankyou.html';
        } else {
            alert('Failed to submit exam. Please try again.');
        }
    } catch (err) {
        console.error(err);
    }
}