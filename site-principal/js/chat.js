document.addEventListener("DOMContentLoaded", function () {
    const chatInput = document.getElementById('chatInput');
    const chatSendBtn = document.getElementById('sendBtn');
    const chatMessages = document.getElementById('chatMessages');
    const chatContainer = document.getElementById('chatContainer');
    const chatToggleBtn = document.getElementById('chatToggleBtn');
    const closeChatBtn = document.getElementById('closeChatBtn');

    // --- ABRIR/FECHAR ---
    chatToggleBtn.addEventListener('click', () => {
        chatContainer.style.display = 'flex';
    });

    closeChatBtn.addEventListener('click', () => {
        chatContainer.style.display = 'none';
    });

    // --- ENVIO PARA PRODUÇÃO ---
    // ... (início do arquivo mantido)

    // --- ENVIO PARA PRODUÇÃO ---
    async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    appendMessage('user', text);
    chatInput.value = '';
    const typingId = appendMessage('bot', '...');

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text })
        });

        const data = await response.json(); // Lê o corpo uma única vez

        if (!response.ok) {
            throw new Error(data.reply || "Erro no servidor");
        }

        document.getElementById(typingId).innerText = data.reply;

    } catch (error) {
        console.error("Erro:", error);
        document.getElementById(typingId).innerText = "Tive um problema. Tente em instantes.";
    }
}

    // ... (restante do arquivo mantido)

    function appendMessage(sender, text) {
        const id = 'msg-' + Math.random().toString(36).substr(2, 9);
        const div = document.createElement('div');
        div.className = `message ${sender}`;
        div.id = id;
        div.innerText = text;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return id;
    }

    chatSendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
});