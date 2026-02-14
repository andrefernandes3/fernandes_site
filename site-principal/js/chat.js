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
            // CORREÇÃO: Use caminho relativo para funcionar em local, dev e prod
            const AZURE_FUNCTION_URL = "/api/chat"; // Ajuste conforme necessário para o caminho correto da função

            const response = await fetch(AZURE_FUNCTION_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text })
            });

            let data;
            const contentType = response.headers.get("content-type");

            // Verifica se a resposta é JSON antes de tentar ler
            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else {
                const textError = await response.text();
                throw new Error(`Erro no servidor: ${textError}`);
            }

            if (!response.ok) {
                const errorText = await response.text(); // Lê como texto se não for 200 OK
                throw new Error(`Erro ${response.status}: ${errorText}`);
            }

            document.getElementById(typingId).innerText = data.reply;

        } catch (error) {
            console.error("Erro no Chat:", error);
            // Mensagem amigável para o usuário
            document.getElementById(typingId).innerText = "Desculpe, tive um problema técnico. Tente novamente mais tarde.";
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