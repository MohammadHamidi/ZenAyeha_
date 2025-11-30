const DIFY_CONFIG = {
    token: 'YkVaZls25USX0XUG',
    baseUrl: 'https://demo.pish.run',
    apiKey: 'app-dWuhVbCf00LYXKOZqZklYdSd',
    apiBaseUrl: 'https://api.morshed.pish.run/v1'
};

const wizardState = {
    currentQuestion: 1,
    answers: { q1: null, q2: null, q3: null }
};

function decidePersona(q1, q2, q3) {
    const scores = { "معلم": 0, "والدین": 0, "فعال_مسجد": 0, "مبلغ": 0, "نوجوان": 0 };
    const q1Map = { students: "معلم", families: "والدین", mosque_people: "فعال_مسجد", religious_audience: "مبلغ", peers: "نوجوان" };
    const q2Map = { education: "معلم", parenting: "والدین", mosque_activities: "فعال_مسجد", tabligh: "مبلغ", teen_issues: "نوجوان" };
    const q3Map = { teacher_self_role: "معلم", parent_self_role: "والدین", mosque_activist_self_role: "فعال_مسجد", preacher_self_role: "مبلغ", teen_self_role: "نوجوان" };

    if (q1Map[q1]) scores[q1Map[q1]]++;
    if (q2Map[q2]) scores[q2Map[q2]]++;
    if (q3Map[q3]) scores[q3Map[q3]] += 2;

    const priority = ["نوجوان", "والدین", "معلم", "فعال_مسجد", "مبلغ"];
    let best = priority[0], max = scores[best];
    priority.forEach(p => { if (scores[p] > max) { max = scores[p]; best = p; } });
    return best;
}

function buildWizardPayload() {
    const persona = decidePersona(wizardState.answers.q1, wizardState.answers.q2, wizardState.answers.q3);
    const payload = {
        version: 'v1',
        persona: persona,
        answers: { ...wizardState.answers },
        decided_by: 'rule_based_v1',
        decided_at: new Date().toISOString()
    };
    localStorage.setItem('persona_wizard_v1', JSON.stringify(payload));
    return payload;
}

function getOrCreateUserId() {
    let id = localStorage.getItem('dify_user_id');
    if (!id) {
        id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('dify_user_id', id);
    }
    return id;
}

function updateProgress() {
    document.getElementById('progress-fill').style.width = (wizardState.currentQuestion / 3 * 100) + '%';
    document.getElementById('progress-text').textContent = `سوال ${wizardState.currentQuestion} از 3`;
}

function showQuestion(num) {
    document.querySelectorAll('.question-slide').forEach(s => s.classList.remove('active'));
    document.getElementById(`question-${num}`).classList.add('active');

    document.getElementById('back-btn').style.display = num > 1 ? 'block' : 'none';
    document.getElementById('next-btn').style.display = wizardState.answers[`q${num}`] ? 'block' : 'none';
    document.getElementById('next-btn').textContent = num === 3 ? 'شروع گفتگو' : 'بعدی';
    updateProgress();
}

async function initializeDifyChatViaAPI() {
    const payload = buildWizardPayload();
    const userId = getOrCreateUserId();

    document.getElementById('wizard-container').style.display = 'none';
    document.getElementById('chat-container').style.display = 'block';

    document.getElementById('chat-wrapper').innerHTML = `
        <div id="custom-chat">
            <div id="chat-header">
                <img src="Icon.png" alt="آیکون">
                <div><h2>زندگی با آیه‌ها</h2><p>${payload.persona}</p></div>
            </div>
            <div id="messages"></div>
            <div id="input-area">
                <input type="text" id="user-input" placeholder="پیام خود را بنویسید...">
                <button id="send-btn">ارسال</button>
            </div>
        </div>
    `;

    let conversationId = null;

    function parseMarkdown(content) {
        if (typeof marked === 'undefined') return content;
        try {
            return typeof marked.parse === 'function' ? marked.parse(content) : marked(content);
        } catch (e) {
            return content;
        }
    }

    function addMessage(content, isUser = false) {
        const msgs = document.getElementById('messages');
        const div = document.createElement('div');
        div.className = `message ${isUser ? 'user-message' : 'system-message'}`;

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';

        const inner = document.createElement('div');
        inner.className = 'message-content';

        if (isUser) {
            inner.textContent = content;
        } else {
            const html = parseMarkdown(content);
            inner.innerHTML = html !== content ? html : content;
        }

        bubble.appendChild(inner);
        div.appendChild(bubble);
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
        return div;
    }

    async function sendMessage(msg) {
        addMessage(msg, true);
        const loading = addMessage('در حال پردازش...', false);

        try {
            const body = {
                query: msg,
                inputs: { wizard_payload: JSON.stringify(payload), persona: payload.persona },
                user: userId,
                response_mode: 'blocking'
            };
            if (conversationId) body.conversation_id = conversationId;

            const res = await fetch(`${DIFY_CONFIG.apiBaseUrl}/chat-messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DIFY_CONFIG.apiKey}` },
                body: JSON.stringify(body)
            });

            if (!res.ok) throw new Error(`API Error: ${res.status}`);

            const data = await res.json();
            if (data.conversation_id) conversationId = data.conversation_id;

            loading.remove();
            addMessage(data.answer || 'خطا در دریافت پاسخ', false);
        } catch (err) {
            loading.remove();
            addMessage(`خطا: ${err.message}`, false);
        }
    }

    const input = document.getElementById('user-input');
    const btn = document.getElementById('send-btn');

    btn.onclick = () => {
        const msg = input.value.trim();
        if (msg) { sendMessage(msg); input.value = ''; }
    };

    input.onkeypress = (e) => {
        if (e.key === 'Enter') {
            const msg = e.target.value.trim();
            if (msg) { sendMessage(msg); e.target.value = ''; }
        }
    };

    input.focus();
    addMessage('سلام! خوش آمدید به زندگی با آیه‌ها. چطور می‌تونم کمکتون کنم؟', false);
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const q = this.dataset.question;
            const v = this.dataset.value;
            this.parentElement.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            wizardState.answers[q] = v;
            document.getElementById('next-btn').style.display = 'block';
        });
    });

    document.getElementById('back-btn').onclick = () => {
        if (wizardState.currentQuestion > 1) {
            wizardState.currentQuestion--;
            showQuestion(wizardState.currentQuestion);
        }
    };

    document.getElementById('next-btn').onclick = () => {
        if (wizardState.currentQuestion < 3) {
            wizardState.currentQuestion++;
            showQuestion(wizardState.currentQuestion);
        } else {
            initializeDifyChatViaAPI();
        }
    };

    showQuestion(1);
});