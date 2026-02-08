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

    // Enviar Mensagem
    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        // 1. Adiciona msg do usuário
        addMessage(text, 'user');
        input.value = '';

        // 2. Simula "Digitando..."
        const typingId = showTyping();
        
        // 3. Simula resposta (Aqui entrará sua API depois)
        setTimeout(() => {
            removeTyping(typingId);
            // Resposta fake inteligente
            const reply = getDemoResponse(text); 
            addMessage(reply, 'bot');
        }, 1500);
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

    // Respostas de Demonstração (Enquanto não tem IA)
    function getDemoResponse(input) {
        const lower = input.toLowerCase();
        const isEn = localStorage.getItem('selectedLanguage') === 'en';

        if (lower.includes('olá') || lower.includes('hi') || lower.includes('hello')) {
            return isEn ? "Hello! How can I help with your tech project today?" : "Olá! Como posso ajudar com seu projeto de tecnologia hoje?";
        }
        if (lower.includes('preço') || lower.includes('price') || lower.includes('custo')) {
            return isEn ? "We offer custom quotes. Would you like to schedule a call?" : "Trabalhamos com orçamentos personalizados. Gostaria de agendar uma conversa?";
        }
        return isEn ? "I'm a demo of the future Fernandes AI. I'm learning fast!" : "Sou uma demonstração da futura Fernandes AI. Estou aprendendo rápido!";
    }

    // Eventos de Envio
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
});