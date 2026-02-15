document.addEventListener('DOMContentLoaded', () => {
    // Injeta o HTML e CSS necessário se não existir
    if (!document.getElementById('chatContainer')) {
        injectChatStructure();
    }
    loadHistory();
    setupEventListeners();
});

function injectChatStructure() {
    const lang = localStorage.getItem('selectedLanguage') || 'pt';
    const ui = {
        welcome: lang === 'en' ? "Hello! How can I help you today?" : "Olá! Como posso ajudar hoje?",
        placeholder: lang === 'en' ? "Type here..." : "Digite aqui...",
        send: lang === 'en' ? "Send" : "Enviar"
    };

    const chatHTML = `
        <div id="chatContainer" class="chat-widget-container" style="display:none;">
            <div class="chat-header">
                <div><h5>Fernandes AI</h5><small>Online</small></div>
                <button id="closeChatBtn" style="background:none; border:none; color:white; font-size:20px;">×</button>
            </div>
            <div id="chatMessages" class="chat-messages" style="height:300px; overflow-y:auto; padding:10px; background:#f9f9f9;">
                <div class="message bot" style="margin-bottom:10px; padding:8px; background:white; border-radius:10px;">${ui.welcome}</div>
            </div>
            <div class="chat-input-area" style="padding:10px; display:flex; gap:5px;">
                <input type="text" id="chatInput" placeholder="${ui.placeholder}" style="flex:1; border-radius:5px; border:1px solid #ccc;">
                <button id="chatSendBtn" class="btn btn-primary btn-sm">${ui.send}</button>
            </div>
        </div>
        <button id="chatToggleBtn" class="chat-toggle-btn" style="position:fixed; bottom:20px; right:20px; border-radius:50%; width:50px; height:50px; z-index:9999;">💬</button>
    `;
    document.body.insertAdjacentHTML('beforeend', chatHTML);
}

function setupEventListeners() {
    const toggle = document.getElementById('chatToggleBtn');
    const container = document.getElementById('chatContainer');
    const close = document.getElementById('closeChatBtn');
    const send = document.getElementById('chatSendBtn');
    const input = document.getElementById('chatInput');

    toggle.onclick = () => container.style.display = 'block';
    close.onclick = () => container.style.display = 'none';
    send.onclick = sendMessage;
    input.onkeypress = (e) => { if(e.key === 'Enter') sendMessage(); };
}

function loadHistory() {
    const history = JSON.parse(localStorage.getItem('chat_history') || '[]');
    const box = document.getElementById('chatMessages');
    if(history.length > 0) {
        box.innerHTML = '';
        history.forEach(m => addMessageToUI(m.text, m.isUser));
    }
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if(!text) return;

    addMessageToUI(text, true);
    saveToLocal(text, true);
    input.value = '';

    const history = JSON.parse(localStorage.getItem('chat_history') || '[]');
    const lang = localStorage.getItem('selectedLanguage') || 'pt';

    try {
        const res = await fetch('/api/chat-gemini', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ message: text, history, lang })
        });
        const data = await res.json();
        addMessageToUI(data.reply, false);
        saveToLocal(data.reply, false);
    } catch (e) {
        addMessageToUI("Erro de conexão.", false);
    }
}

function addMessageToUI(text, isUser) {
    const box = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.style.margin = "5px 0";
    div.style.textAlign = isUser ? "right" : "left";
    div.innerHTML = `<span style="display:inline-block; padding:8px; border-radius:10px; background:${isUser ? '#0d6efd' : '#eee'}; color:${isUser ? 'white' : 'black'}">${text}</span>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function saveToLocal(text, isUser) {
    const history = JSON.parse(localStorage.getItem('chat_history') || '[]');
    history.push({ text, isUser });
    localStorage.setItem('chat_history', JSON.stringify(history.slice(-10))); // Guarda as últimas 10
}