// ============================================
// Configuration
// ============================================
const DIFY_CONFIG = {
    token: 'YkVaZls25USX0XUG',
    baseUrl: 'https://demo.pish.run',
    apiKey: 'app-dWuhVbCf00LYXKOZqZklYdSd',
    apiBaseUrl: 'https://api.morshed.pish.run/v1'
};

// ============================================
// State Management
// ============================================
const wizardState = {
    currentQuestion: 1,
    answers: {
        q1: null,
        q2: null,
        q3: null
    }
};

// ============================================
// Persona Decision Logic
// ============================================
function decidePersona(q1, q2, q3) {
    const scores = {
        "معلم": 0,
        "والدین": 0,
        "فعال_مسجد": 0,
        "مبلغ": 0,
        "نوجوان": 0
    };

    // Question 1 scoring
    const q1Map = {
        students: "معلم",
        families: "والدین",
        mosque_people: "فعال_مسجد",
        religious_audience: "مبلغ",
        peers: "نوجوان"
    };
    if (q1Map[q1]) scores[q1Map[q1]]++;

    // Question 2 scoring
    const q2Map = {
        education: "معلم",
        parenting: "والدین",
        mosque_activities: "فعال_مسجد",
        tabligh: "مبلغ",
        teen_issues: "نوجوان"
    };
    if (q2Map[q2]) scores[q2Map[q2]]++;

    // Question 3 scoring (weighted more heavily)
    const q3Map = {
        teacher_self_role: "معلم",
        parent_self_role: "والدین",
        mosque_activist_self_role: "فعال_مسجد",
        preacher_self_role: "مبلغ",
        teen_self_role: "نوجوان"
    };
    if (q3Map[q3]) scores[q3Map[q3]] += 2;

    // Find max score with priority tiebreaker
    const priority = ["نوجوان", "والدین", "معلم", "فعال_مسجد", "مبلغ"];
    let bestPersona = priority[0];
    let maxScore = scores[bestPersona];

    for (const persona of priority) {
        if (scores[persona] > maxScore) {
            maxScore = scores[persona];
            bestPersona = persona;
        }
    }

    return bestPersona;
}

// ============================================
// Wizard Payload Builder
// ============================================
function buildWizardPayload() {
    const persona = decidePersona(
        wizardState.answers.q1,
        wizardState.answers.q2,
        wizardState.answers.q3
    );

    const payload = {
        version: 'v1',
        persona: persona,
        answers: { ...wizardState.answers },
        decided_by: 'rule_based_v1',
        decided_at: new Date().toISOString()
    };

    // Save to localStorage for future sessions
    localStorage.setItem('persona_wizard_v1', JSON.stringify(payload));

    return payload;
}

// ============================================
// User ID Management
// ============================================
function getOrCreateUserId() {
    let userId = localStorage.getItem('dify_user_id');
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('dify_user_id', userId);
    }
    return userId;
}

// ============================================
// UI Updates
// ============================================
function updateProgress() {
    const progress = (wizardState.currentQuestion / 3) * 100;
    document.getElementById('progress-fill').style.width = progress + '%';
    document.getElementById('progress-text').textContent = `سوال ${wizardState.currentQuestion} از 3`;
}

function showQuestion(questionNumber) {
    // Hide all questions
    document.querySelectorAll('.question-slide').forEach(slide => {
        slide.classList.remove('active');
    });

    // Show current question
    document.getElementById(`question-${questionNumber}`).classList.add('active');

    // Update navigation buttons
    const backBtn = document.getElementById('back-btn');
    const nextBtn = document.getElementById('next-btn');

    backBtn.style.display = questionNumber > 1 ? 'block' : 'none';

    const currentAnswer = wizardState.answers[`q${questionNumber}`];
    nextBtn.style.display = currentAnswer ? 'block' : 'none';
    nextBtn.textContent = questionNumber === 3 ? 'شروع گفتگو' : 'بعدی';

    updateProgress();
}

// ============================================
// Method 1: Simple Iframe Embed (RECOMMENDED)
// ============================================
function initializeDifyChat() {
    const wizardPayload = buildWizardPayload();

    console.log('🎯 Wizard Payload:', wizardPayload);
    console.log('👤 User ID:', getOrCreateUserId());

    // Enable error suppression for expected iframe errors
    enableErrorSuppression();

    // Hide wizard, show chat
    document.getElementById('wizard-container').style.display = 'none';
    document.getElementById('chat-container').style.display = 'block';

    const chatWrapper = document.getElementById('chat-wrapper');

    // Show loading state
    chatWrapper.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: white; padding: 40px;">
            <div style="text-align: center;">
                <div style="width: 50px; height: 50px; border: 4px solid #e0e0e0; border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                <p style="color: #666; font-size: 16px; margin: 0;">در حال بارگذاری گفتگو...</p>
            </div>
        </div>
        <style>
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        </style>
    `;

    // Build iframe URL with query parameters
    const params = new URLSearchParams({
        user_id: getOrCreateUserId(),
        persona: wizardPayload.persona,
        wizard_data: JSON.stringify(wizardPayload)
    });

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.src = `${DIFY_CONFIG.baseUrl}/chatbot/${DIFY_CONFIG.token}?${params.toString()}`;
    iframe.style.cssText = 'width: 100%; height: 100%; min-height: 700px; border: none; opacity: 0; transition: opacity 0.3s ease;';
    iframe.allow = 'microphone';
    iframe.frameBorder = '0';
    iframe.allowFullscreen = true;

    let iframeLoaded = false;

    // Timeout fallback - if iframe doesn't load within 10 seconds
    const loadTimeout = setTimeout(() => {
        if (!iframeLoaded) {
            console.warn('⚠️ Iframe loading timeout, showing fallback');
            showErrorFallback(chatWrapper, wizardPayload);
        }
    }, 10000);

    // Handle iframe load success
    iframe.onload = function () {
        clearTimeout(loadTimeout);
        iframeLoaded = true;
        console.log('✅ Iframe loaded successfully');
        console.log('ℹ️ Note: Some API errors from inside the iframe may appear in console, but the chat should still work.');
        // Fade in the iframe after a short delay
        setTimeout(() => {
            iframe.style.opacity = '1';
            // Remove loading state
            const loadingDiv = chatWrapper.querySelector('div');
            if (loadingDiv && loadingDiv.id !== 'custom-chat') loadingDiv.remove();
            // Add fallback button
            addFallbackButton(chatWrapper, wizardPayload);
        }, 500);
    };

    // Handle iframe load error (note: this only works for same-origin iframes)
    iframe.onerror = function () {
        clearTimeout(loadTimeout);
        console.error('❌ Failed to load iframe');
        if (!iframeLoaded) {
            showErrorFallback(chatWrapper, wizardPayload);
        }
    };

    chatWrapper.appendChild(iframe);
    console.log('✅ Iframe loading with URL:', iframe.src);
}

// Error fallback - show custom chat UI if iframe fails
function showErrorFallback(chatWrapper, wizardPayload) {
    console.log('🔄 Falling back to custom chat UI');
    // Clear everything
    chatWrapper.innerHTML = '';
    // Use the API-based custom chat UI
    initializeDifyChatViaAPI();
}

// Add manual fallback button to iframe (shown after load)
function addFallbackButton(chatWrapper, wizardPayload) {
    const fallbackBtn = document.createElement('button');
    fallbackBtn.textContent = 'استفاده از رابط سفارشی';
    fallbackBtn.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 1000; padding: 10px 20px; background: rgba(102, 126, 234, 0.9); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); transition: all 0.3s ease; font-family: inherit;';

    fallbackBtn.addEventListener('mouseenter', () => {
        fallbackBtn.style.background = 'rgba(118, 75, 162, 0.9)';
        fallbackBtn.style.transform = 'translateY(-2px)';
    });

    fallbackBtn.addEventListener('mouseleave', () => {
        fallbackBtn.style.background = 'rgba(102, 126, 234, 0.9)';
        fallbackBtn.style.transform = 'translateY(0)';
    });

    fallbackBtn.addEventListener('click', () => {
        if (confirm('آیا می‌خواهید به رابط سفارشی گفتگو تغییر دهید؟')) {
            fallbackBtn.remove();
            showErrorFallback(chatWrapper, wizardPayload);
        }
    });

    document.body.appendChild(fallbackBtn);

    // Auto-remove after 30 seconds
    setTimeout(() => {
        if (fallbackBtn.parentNode) {
            fallbackBtn.style.opacity = '0';
            fallbackBtn.style.transition = 'opacity 0.3s ease';
            setTimeout(() => fallbackBtn.remove(), 300);
        }
    }, 30000);
}

// ============================================
// Method 2: Custom Chat UI with API
// ============================================
async function initializeDifyChatViaAPI() {
    const wizardPayload = buildWizardPayload();
    const userId = getOrCreateUserId();

    console.log('🎯 Initializing API Chat');
    console.log('Wizard Payload:', wizardPayload);
    console.log('User ID:', userId);

    // Hide wizard, show custom chat UI
    document.getElementById('wizard-container').style.display = 'none';
    document.getElementById('chat-container').style.display = 'block';

    // Create custom chat UI
    const chatWrapper = document.getElementById('chat-wrapper');
    chatWrapper.innerHTML = `
        <div id="custom-chat" style="display: flex; flex-direction: column; height: 100vh; background: #f8fafc;">
            <div id="chat-header" style="padding: 20px 24px; background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 14px;">
                <img src="Icon.png" alt="زندگی با آیه‌ها" style="width: 48px; height: 48px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">
                <div style="flex: 1;">
                    <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">زندگی با آیه‌ها</h2>
                    <p style="margin: 3px 0 0 0; font-size: 13px; color: rgba(255,255,255,0.85);">${wizardPayload.persona}</p>
                </div>
            </div>
            <div id="messages" style="flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 16px; background: #f8fafc;"></div>
            <div id="input-area" style="padding: 18px 24px; border-top: 1px solid #e2e8f0; background: white; display: flex; gap: 12px;">
                <input type="text" id="user-input" placeholder="پیام خود را بنویسید..." style="flex: 1; padding: 14px 18px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 15px; font-family: inherit; background: #f8fafc; transition: border-color 0.2s;" />
                <button id="send-btn" style="padding: 14px 28px; background: linear-gradient(135deg, #22c55e 0%, #4ade80 100%); color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 15px; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);">ارسال</button>
            </div>
        </div>
    `;

    let conversationId = null;

    // Function to parse markdown safely
    function parseMarkdown(content) {
        if (typeof marked === 'undefined') {
            // Fallback if markdown library isn't loaded
            return content;
        }

        try {
            // Support both marked.parse() (v4+) and marked() (v3)
            if (typeof marked.parse === 'function') {
                return marked.parse(content);
            } else if (typeof marked === 'function') {
                return marked(content);
            }
        } catch (error) {
            console.warn('Markdown parsing error:', error);
        }

        return content;
    }

    // Function to add message to UI
    function addMessage(content, isUser = false) {
        const messagesDiv = document.getElementById('messages');
        const msgDiv = document.createElement('div');
        const msgContent = document.createElement('div');
        msgContent.className = 'message-content';

        if (isUser) {
            msgDiv.style.cssText = 'align-self: flex-end; background: linear-gradient(135deg, #22c55e 0%, #4ade80 100%); color: white; padding: 12px 16px; border-radius: 18px 18px 4px 18px; max-width: 70%; word-wrap: break-word; box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);';
            // User messages remain as plain text
            msgContent.textContent = content;
        } else {
            msgDiv.style.cssText = 'align-self: flex-start; background: white; color: #1a1a1a; padding: 12px 16px; border-radius: 18px 18px 18px 4px; max-width: 70%; word-wrap: break-word; box-shadow: 0 2px 4px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;';
            // AI messages: parse markdown
            const htmlContent = parseMarkdown(content);
            if (htmlContent !== content) {
                // Markdown was parsed successfully
                msgContent.innerHTML = htmlContent;
            } else {
                // No markdown library or parsing failed, use plain text
                msgContent.textContent = content;
            }
        }

        msgDiv.appendChild(msgContent);
        messagesDiv.appendChild(msgDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        return msgDiv;
    }

    // Function to send message via API
    async function sendMessage(message) {
        // Add user message
        addMessage(message, true);

        // Add loading indicator
        const loadingDiv = addMessage('در حال پردازش...', false);
        loadingDiv.id = 'loading';

        try {
            console.log('📤 Sending message:', message);
            console.log('🔗 API URL:', `${DIFY_CONFIG.apiBaseUrl}/chat-messages`);

            const requestBody = {
                query: message,
                inputs: {
                    wizard_payload: JSON.stringify(wizardPayload),
                    persona: wizardPayload.persona
                },
                user: userId,
                response_mode: 'blocking'
            };

            // Add conversation_id if exists
            if (conversationId) {
                requestBody.conversation_id = conversationId;
            }

            console.log('📦 Request body:', requestBody);

            const response = await fetch(`${DIFY_CONFIG.apiBaseUrl}/chat-messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${DIFY_CONFIG.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            console.log('📥 Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ API Error:', errorText);
                throw new Error(`API Error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('✅ Response data:', data);

            // Save conversation ID
            if (data.conversation_id) {
                conversationId = data.conversation_id;
                console.log('💾 Conversation ID saved:', conversationId);
            }

            // Remove loading
            loadingDiv.remove();

            // Add AI response
            addMessage(data.answer || 'خطا در دریافت پاسخ', false);

        } catch (error) {
            console.error('❌ Error sending message:', error);
            loadingDiv.remove();

            addMessage(`خطا: ${error.message}`, false);
        }
    }

    // Event listeners
    const sendBtn = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');

    // Add interactive styles
    userInput.addEventListener('focus', function () {
        this.style.borderColor = '#22c55e';
        this.style.background = 'white';
    });

    userInput.addEventListener('blur', function () {
        this.style.borderColor = '#e2e8f0';
        this.style.background = '#f8fafc';
    });

    sendBtn.addEventListener('mouseenter', function () {
        this.style.transform = 'translateY(-2px)';
        this.style.boxShadow = '0 6px 16px rgba(34, 197, 94, 0.4)';
    });

    sendBtn.addEventListener('mouseleave', function () {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
    });

    sendBtn.addEventListener('click', () => {
        const message = userInput.value.trim();
        if (message) {
            sendMessage(message);
            userInput.value = '';
        }
    });

    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const message = e.target.value.trim();
            if (message) {
                sendMessage(message);
                e.target.value = '';
            }
        }
    });

    // Focus input
    userInput.focus();

    // Send initial greeting
    addMessage('سلام! خوش آمدید به زندگی با آیه‌ها. چطور می‌تونم کمکتون کنم؟', false);
}

// ============================================
// Event Listeners
// ============================================
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 App initialized');

    // Option button clicks
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const question = this.dataset.question;
            const value = this.dataset.value;

            console.log(`Question ${question} answered:`, value);

            // Remove previous selection
            this.parentElement.querySelectorAll('.option-btn').forEach(b => {
                b.classList.remove('selected');
            });

            // Mark as selected
            this.classList.add('selected');

            // Save answer
            wizardState.answers[question] = value;

            // Show next button
            document.getElementById('next-btn').style.display = 'block';
        });
    });

    // Back button
    document.getElementById('back-btn').addEventListener('click', function () {
        if (wizardState.currentQuestion > 1) {
            wizardState.currentQuestion--;
            showQuestion(wizardState.currentQuestion);
        }
    });

    // Next button
    document.getElementById('next-btn').addEventListener('click', function () {
        if (wizardState.currentQuestion < 3) {
            wizardState.currentQuestion++;
            showQuestion(wizardState.currentQuestion);
        } else {
            console.log('✅ Wizard completed');
            console.log('Final answers:', wizardState.answers);

            // Using API-based custom chat UI
            initializeDifyChatViaAPI();

            // Alternative: Iframe method (currently disabled)
            // initializeDifyChat();
        }
    });

    // Initialize first question
    showQuestion(1);
});

// ============================================
// Optional: Returning User Support
// ============================================
window.addEventListener('load', function () {
    const savedPayload = localStorage.getItem('persona_wizard_v1');

    if (savedPayload) {
        try {
            const payload = JSON.parse(savedPayload);
            console.log('💾 Found saved persona:', payload.persona);

            // Create banner
            const banner = document.createElement('div');
            banner.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: white; padding: 15px 25px; border-radius: 10px; box-shadow: 0 5px 20px rgba(0,0,0,0.2); z-index: 1000; display: flex; gap: 15px; align-items: center; font-family: inherit;';
            banner.innerHTML = `
                <span style="font-size: 14px;">ادامه با نقش: <strong style="color: #667eea;">${payload.persona}</strong></span>
                <button id="continue-btn" style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">ادامه</button>
                <button id="restart-btn" style="padding: 8px 16px; background: #f0f0f0; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">شروع دوباره</button>
            `;
            document.body.appendChild(banner);

            document.getElementById('continue-btn').addEventListener('click', () => {
                console.log('▶️ Continuing with saved persona');
                banner.remove();
                // Restore wizard state
                wizardState.answers = payload.answers;
                initializeDifyChatViaAPI();
            });

            document.getElementById('restart-btn').addEventListener('click', () => {
                console.log('🔄 Restarting wizard');
                banner.remove();
                localStorage.removeItem('persona_wizard_v1');
            });
        } catch (e) {
            console.error('Error loading saved persona:', e);
        }
    }
});

// ============================================
// Debug Helpers
// ============================================
window.debugWizard = function () {
    console.log('=== WIZARD DEBUG INFO ===');
    console.log('Current State:', wizardState);
    console.log('Saved Payload:', localStorage.getItem('persona_wizard_v1'));
    console.log('User ID:', getOrCreateUserId());
    console.log('Config:', DIFY_CONFIG);
};

// ============================================
// Global Error Handling
// ============================================
// Suppress expected iframe errors in console (these are from inside the iframe and don't affect functionality)
const originalConsoleError = console.error;
let errorSuppressionActive = false;

// Optional: Suppress common iframe API errors (comment out if you want to see all errors)
window.addEventListener('error', function (event) {
    if (errorSuppressionActive && event.message &&
        (event.message.includes('api.morshed.pish.run') ||
            event.message.includes('404') ||
            event.message.includes('401'))) {
        // These are expected errors from inside the iframe
        return;
    }
});

window.addEventListener('unhandledrejection', function (event) {
    if (errorSuppressionActive && event.reason &&
        typeof event.reason === 'string' &&
        (event.reason.includes('api.morshed.pish.run') ||
            event.reason.includes('404') ||
            event.reason.includes('401'))) {
        // These are expected errors from inside the iframe
        event.preventDefault();
        return;
    }
});

// Enable error suppression when iframe is loading
function enableErrorSuppression() {
    errorSuppressionActive = true;
    console.log('ℹ️ Error suppression enabled - iframe API errors are expected and won\'t affect chat functionality.');
}

// Log on load
console.log('📱 Wizard loaded. Type debugWizard() in console for debug info.');
console.log('ℹ️ Note: Some API errors from inside the chat iframe may appear in console but are usually harmless.');