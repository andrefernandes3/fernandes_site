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
    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        appendMessage('user', text);
        chatInput.value = '';
        const typingId = appendMessage('bot', '...');

        try {
            // AQUI ESTÁ O SEGREDO: Chamamos a sua Azure Function!
            // Substitua pela sua URL final da Azure
            const AZURE_FUNCTION_URL = "https://fernandesit.com/api/chat";

            const response = await fetch(AZURE_FUNCTION_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text }) 
            });

            const data = await response.json();
            
            // A Azure Function retorna { reply: "texto" }
            document.getElementById(typingId).innerText = data.reply || "Desculpe, estou offline no momento.";

        } catch (error) {
            console.error("Erro de produção:", error);
            document.getElementById(typingId).innerText = "Erro ao conectar com o servidor.";
        }
    }

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