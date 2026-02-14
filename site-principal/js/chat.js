document.addEventListener("DOMContentLoaded", () => {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatMessages = document.getElementById('chatMessages');
    const chatContainer = document.getElementById('chatContainer');
    const toggleBtn = document.getElementById('chatToggleBtn');
    const closeBtn = document.getElementById('closeChatBtn');

    // Abrir/Fechar
    toggleBtn.onclick = () => chatContainer.style.display = 'flex';
    closeBtn.onclick = () => chatContainer.style.display = 'none';

    async function handleSend() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Adiciona mensagem do usuário
        appendMsg('user', text);
        chatInput.value = '';

        // Placeholder da IA
        const typingId = appendMsg('bot', '...');

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text })
            });

            const data = await res.json();
            document.getElementById(typingId).innerText = data.reply;
        } catch (e) {
            document.getElementById(typingId).innerText = "Erro ao conectar. Tente mais tarde.";
        }
    }

    function appendMsg(sender, text) {
        const id = 'm-' + Date.now();
        const div = document.createElement('div');
        div.className = `message ${sender}`;
        div.id = id;
        div.innerText = text;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return id;
    }

    sendBtn.onclick = handleSend;
    chatInput.onkeypress = (e) => { if (e.key === 'Enter') handleSend(); };
});