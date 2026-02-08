document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('chatToggleBtn');
    const chatContainer = document.getElementById('chatContainer');
    const closeBtn = document.getElementById('closeChatBtn');
    const sendBtn = document.getElementById('chatSendBtn');
    const input = document.getElementById('chatInput');
    const messagesBody = document.getElementById('chatMessages');

    // Estado do Chat
    let isOpen = false;

    // Abrir/Fechar
    function toggleChat() {
        isOpen = !isOpen;
        if (isOpen) {
            chatContainer.classList.add('active');
            toggleBtn.style.display = 'none'; // Esconde o botão flutuante
            input.focus();
        } else {
            chatContainer.classList.remove('active');
            toggleBtn.style.display = 'flex';
        }
    }

    toggleBtn.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', toggleChat);

    // Enviar Mensagem (ATUALIZADO PARA API REAL)
    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        // 1. Mostra msg do usuário
        addMessage(text, 'user');
        input.value = '';
        input.focus();

        // 2. Mostra "Digitando..."
        const typingId = showTyping();

        try {
            // 3. Chama a API Serverless (Backend)
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            const data = await response.json();
            
            // 4. Remove "Digitando" e mostra resposta real
            removeTyping(typingId);
            
            if (response.ok) {
                addMessage(data.reply, 'bot');
            } else {
                addMessage("Ops, tive um erro de conexão. Tente novamente.", 'bot');
            }

        } catch (error) {
            removeTyping(typingId);
            addMessage("Erro de rede. Verifique sua conexão.", 'bot');
            console.error(error);
        }
    }

    // Adiciona bolha no chat
    function addMessage(text, sender) {
        const div = document.createElement('div');
        div.classList.add('message', sender);
        div.innerText = text;
        messagesBody.appendChild(div);
        messagesBody.scrollTop = messagesBody.scrollHeight; // Auto scroll
    }

    // Indicador de digitação
    function showTyping() {
        const id = 'typing-' + Date.now();
        const div = document.createElement('div');
        div.classList.add('message', 'bot');
        div.id = id;
        div.innerHTML = '<i class="fas fa-ellipsis-h fa-fade"></i>'; // FontAwesome animado
        messagesBody.appendChild(div);
        messagesBody.scrollTop = messagesBody.scrollHeight;
        return id;
    }

    function removeTyping(id) {
        const el = document.getElementById(id);
        if(el) el.remove();
    }  

    // Eventos de Envio
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
});