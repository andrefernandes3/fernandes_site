// chat.js - Gerenciamento do chat com integração de IA gratuita via Groq

document.addEventListener('DOMContentLoaded', function() {
    const chatContainer = document.getElementById('chatContainer');
    const closeChatBtn = document.getElementById('closeChatBtn');
    const chatToggleBtn = document.getElementById('chatToggleBtn');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatMessages = document.getElementById('chatMessages');

    // Sua chave da API do Groq (cole aqui a sua real - obtenha em groq.com)
    const GROQ_API_KEY = 'gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // Substitua pela sua API Key!

    // Função para abrir/fechar o chat (mantendo o existente)
    chatToggleBtn.addEventListener('click', function() {
        chatContainer.style.display = 'block';
        if (chatMessages.children.length === 0) {
            addMessage('Olá! Sou o Fernandes AI. Como posso ajudar hoje?', false); // Mensagem inicial da IA
        }
    });

    closeChatBtn.addEventListener('click', function() {
        chatContainer.style.display = 'none';
    });

    // Função para adicionar mensagens (mantendo estilos existentes)
    function addMessage(text, isUser) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', isUser ? 'user-message' : 'ai-message');
        msgDiv.textContent = text;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Evento de envio (integra a IA)
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });

    async function sendMessage() {
        const userMessage = chatInput.value.trim();
        if (!userMessage) return;

        addMessage(userMessage, true); // Adiciona mensagem do usuário
        chatInput.value = ''; // Limpa input

        // Adiciona indicador de "digitando" enquanto espera
        const typingDiv = document.createElement('div');
        typingDiv.classList.add('message', 'ai-message');
        typingDiv.textContent = 'Digitando...';
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'mixtral-8x7b-32768', // Modelo gratuito e rápido (pode trocar por 'llama2-70b-4096')
                    messages: [
                        { role: 'system', content: 'Você é o Fernandes AI, um assistente útil para dúvidas sobre tecnologia, Node.js, React, AWS, Azure e serviços da Fernandes Technology. Responda de forma amigável e profissional em português.' }, // Prompt personalizado para se adequar ao site
                        { role: 'user', content: userMessage }
                    ],
                    max_tokens: 200, // Limite para respostas concisas
                    temperature: 0.7 // Para respostas criativas mas precisas
                })
            });

            if (!response.ok) throw new Error('Erro na API: ' + response.statusText);

            const data = await response.json();
            const aiResponse = data.choices[0].message.content.trim();

            // Remove o "digitando" e adiciona a resposta real
            chatMessages.removeChild(typingDiv);
            addMessage(aiResponse, false);
        } catch (error) {
            chatMessages.removeChild(typingDiv);
            addMessage('Desculpe, ocorreu um erro ao conectar com a IA. Tente novamente ou verifique sua conexão.', false);
            console.error(error);
        }
    }
});