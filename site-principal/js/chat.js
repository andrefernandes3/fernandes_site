document.addEventListener('DOMContentLoaded', () => {
    // ────────────────────────────────────────────────
    //   CONFIGURAÇÃO – NUNCA MAIS COLOQUE CHAVE AQUI!
    // ────────────────────────────────────────────────
    const BACKEND_URL = "https://fernandesTech.azurestaticapps.net/api/chat"; // ← AJUSTE AQUI

    const toggleBtn    = document.getElementById('chatToggleBtn');
    const chatContainer = document.getElementById('chatContainer');
    const closeBtn     = document.getElementById('closeChatBtn');
    const sendBtn      = document.getElementById('chatSendBtn');
    const input        = document.getElementById('chatInput');
    const messagesBody = document.getElementById('chatMessages');

    let isOpen = false;

    function toggleChat() {
        isOpen = !isOpen;
        chatContainer.classList.toggle('active', isOpen);
        toggleBtn.style.display = isOpen ? 'none' : 'flex';
        if (isOpen) input.focus();
    }

    toggleBtn.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', toggleChat);

    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        input.value = '';
        input.focus();

        const typingId = showTyping();

        try {
            const response = await fetch(BACKEND_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text })
            });

            const data = await response.json();

            removeTyping(typingId);

            if (response.ok) {
                addMessage(data.reply || "Sem resposta.", 'bot');
            } else {
                addMessage(`Erro ${response.status}: ${data.reply || "Falha na conexão"}`, 'bot');
                console.error(data);
            }

        } catch (err) {
            removeTyping(typingId);
            addMessage("Erro de rede. Verifique sua conexão.", 'bot');
            console.error(err);
        }
    }

    // Funções de UI (mantidas iguais)
    function addMessage(text, sender) {
        const div = document.createElement('div');
        div.classList.add('message', sender);
        div.textContent = text;
        messagesBody.appendChild(div);
        messagesBody.scrollTop = messagesBody.scrollHeight;
    }

    function showTyping() {
        const id = 'typing-' + Date.now();
        const div = document.createElement('div');
        div.classList.add('message', 'bot');
        div.id = id;
        div.innerHTML = '<i class="fas fa-ellipsis-h fa-fade"></i> Digitando...';
        messagesBody.appendChild(div);
        messagesBody.scrollTop = messagesBody.scrollHeight;
        return id;
    }

    function removeTyping(id) {
        document.getElementById(id)?.remove();
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});