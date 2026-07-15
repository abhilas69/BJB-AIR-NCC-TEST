const navAdd = document.getElementById('navAdd');
const navView = document.getElementById('navView');
const addSection = document.getElementById('addQuestionSection');
const viewSection = document.getElementById('viewResultsSection');

let allResults = [];
let activeDetailsCard = null;

// --- AUTHENTICATION INTERCEPTOR ---
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;

    const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (res.ok && data.success) {
        sessionStorage.setItem('isAdminAuthenticated', 'true');
        unlockDashboard();
    } else {
        alert('Invalid Username or Password');
    }
});

function unlockDashboard() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('adminPanelContainer').style.display = 'block';
    fetchResults();
}

if (sessionStorage.getItem('isAdminAuthenticated') === 'true') {
    unlockDashboard();
}

// --- NAVIGATION CONTROLS ---
navAdd.addEventListener('click', () => {
    navAdd.classList.add('active');
    navView.classList.remove('active');
    addSection.style.display = 'block';
    viewSection.style.display = 'none';
});

navView.addEventListener('click', () => {
    navView.classList.add('active');
    navAdd.classList.remove('active');
    addSection.style.display = 'none';
    viewSection.style.display = 'block';
    fetchResults();
});

// --- SUBMIT NEW QUESTION ---
document.getElementById('questionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const questionText = document.getElementById('questionForm').querySelector('input[type="text"]').value;
    const optionElements = document.querySelectorAll('.opt');
    const options = Array.from(optionElements).map(el => el.value);
    const correctAnswer = parseInt(document.getElementById('correctIndex').value, 10);

    const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionText, options, correctAnswer })
    });

    if (res.ok) {
        alert('Question added successfully!');
        document.getElementById('questionForm').reset();
    } else {
        alert('Failed to add question.');
    }
});

// --- FETCH RESULTS ---
async function fetchResults() {
    try {
        const res = await fetch('/api/results');
        allResults = await res.json();
        renderUserList();
    } catch (err) {
        console.error(err);
    }
}

function renderUserList() {
    const list = document.getElementById('userList');
    list.innerHTML = '';

    if (allResults.length === 0) {
        list.innerHTML = '<p>No test attempts recorded yet.</p>';
        return;
    }

    allResults.forEach((res, idx) => {
        const row = document.createElement('div');
        row.className = 'user-row';
        row.innerHTML = `
            <div class="user-info">
                <strong>${res.studentName}</strong> - Score: ${res.score}
            </div>
            <div class="details-card" id="details-${idx}" style="display:none; background:#f8fafc; padding:15px; border-radius:6px; margin-top:10px; border:1px solid #e2e8f0;"></div>
        `;

        row.addEventListener('click', (e) => {
            if (e.target.classList.contains('download-pdf-btn')) return;
            const card = document.getElementById(`details-${idx}`);
            showDetails(idx, card);
        });

        list.appendChild(row);
    });
}

function showDetails(idx, detailsCard) {
    const data = allResults[idx];

    if (activeDetailsCard && activeDetailsCard !== detailsCard) {
        activeDetailsCard.style.display = 'none';
    }

    if (detailsCard.style.display === 'block') {
        detailsCard.style.display = 'none';
        activeDetailsCard = null;
        return;
    }

    detailsCard.innerHTML = `
        <h3>Student Metrics: ${data.studentName}</h3>
        <p style="margin-top: 10px;"><strong>Time Taken:</strong> ${data.timeTaken} mins</p>
        <p style="color: #22c55e;"><strong>Correct Metrics:</strong> ${data.score} Items</p>
        <p style="color: #ef4444;"><strong>Wrong Layouts:</strong> ${data.wrongAnswers} Items</p>
        <button class="download-pdf-btn" data-id="${data._id}" style="display: inline-block; margin-top: 10px; padding: 8px 12px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer;">Download PDF</button>
    `;
    detailsCard.style.display = 'block';
    activeDetailsCard = detailsCard;

    detailsCard.querySelector('.download-pdf-btn').addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        window.location.href = `/api/results/${id}/pdf`;
    });
}