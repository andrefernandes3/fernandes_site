class ChatGemini {
    constructor() {
        this.isOpen = false;
        this.init();
    }

    init() {
        // Criar estrutura do chat
        const chatHTML = `
            <!-- Botão flutuante -->
            <button id="chatToggleBtn" class="chat-toggle-btn" 
                    style="position: fixed; bottom: 20px; right: 20px; z-index: 1000;
                           background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                           color: white; border: none; border-radius: 50%; width: 60px; 
                           height: 60px; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                           display: flex; align-items: center; justify-content: center;
                           transition: transform 0.3s;">
                <i class="bi bi-chat-dots-fill" style="font-size: 24px;"></i>
            </button>

            <!-- Janela do chat -->
            <div id="chatWindow" class="chat-window" 
                 style="display: none; position: fixed; bottom: 90px; right: 20px; width: 350px;
                        height: 500px; background: white; border-radius: 15px; 
                        box-shadow: 0 10px 30px rgba(0,0,0,0.2); z-index: 1000;
                        overflow: hidden; border: 1px solid #e0e0e0;">

                <!-- Header -->
                <div class="chat-header" 
                     style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white; padding: 15px; display: flex; 
                            justify-content: space-between; align-items: center;">
                    <div>
                        <h5 style="margin: 0; font-weight: 600;">Assistente IA</h5>
                        <small style="opacity: 0.9;">Fernandes Technology</small>
                    </div>
                    <button id="closeChatBtn" style="background: none; border: none; 
                             color: white; font-size: 20px; cursor: pointer;">×</button>
                </div>

                <!-- Messages -->
                <div id="chatMessages" class="chat-messages" 
                     style="height: 370px; overflow-y: auto; padding: 15px; 
                            background: #f8f9fa;">
                    <div class="message bot-message" 
                         style="margin-bottom: 10px; text-align: left;">
                        <div style="background: white; padding: 10px 15px; 
                                  border-radius: 15px 15px 15px 0; 
                                  display: inline-block; max-width: 80%;
                                  box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            👋 Olá! Sou o assistente virtual da Fernandes Technology. 
                            Como posso ajudar você hoje com:
                            • Node.js
                            • React
                            • AWS/Azure
                            • DevOps
                            Ou qualquer outra tecnologia?
                        </div>
                    </div>
                </div>

                <!-- Input area -->
                <div class="chat-input-area" 
                     style="padding: 15px; background: white; border-top: 1px solid #e0e0e0;">
                    <div class="input-group">
                        <input type="text" id="messageInput" class="form-control" 
                               placeholder="Digite sua mensagem..."
                               style="border-radius: 20px 0 0 20px; border: 1px solid #e0e0e0;
                                      padding: 10px 15px;">
                        <button id="sendMessageBtn" class="btn btn-primary" type="button"
                                style="border-radius: 0 20px 20px 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                       border: none; padding: 10px 15px;">
                            <i class="bi bi-send"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Adicionar ao body
        const chatContainer = document.createElement('div');
        chatContainer.id = 'chatContainer';
        chatContainer.innerHTML = chatHTML;
        document.body.appendChild(chatContainer);

        this.attachEvents();
    }

    attachEvents() {
        const toggleBtn = document.getElementById('chatToggleBtn');
        const closeBtn = document.getElementById('closeChatBtn');
        const chatWindow = document.getElementById('chatWindow');
        const sendBtn = document.getElementById('sendMessageBtn');
        const messageInput = document.getElementById('messageInput');
        const chatMessages = document.getElementById('chatMessages');

        toggleBtn.addEventListener('click', () => {
            this.isOpen = !this.isOpen;
            chatWindow.style.display = this.isOpen ? 'block' : 'none';
            if (this.isOpen) {
                messageInput.focus();
            }
        });

        closeBtn.addEventListener('click', () => {
            this.isOpen = false;
            chatWindow.style.display = 'none';
        });

        sendBtn.addEventListener('click', () => {
            this.sendMessage(messageInput, chatMessages);
        });

        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage(messageInput, chatMessages);
            }
        });
    }

    addMessage(container, message, isUser = true) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
        messageDiv.style.marginBottom = '15px';
        messageDiv.style.textAlign = isUser ? 'right' : 'left';
        
        messageDiv.innerHTML = `
            <div style="background: ${isUser ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white'}; 
                        color: ${isUser ? 'white' : '#333'}; 
                        padding: 10px 15px; 
                        border-radius: ${isUser ? '15px 15px 0 15px' : '15px 15px 15px 0'}; 
                        display: inline-block; 
                        max-width: 80%;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                        word-wrap: break-word;">
                ${message.replace(/\n/g, '<br>')}
            </div>
        `;
        
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
    }

    showTypingIndicator(container) {
        const indicator = document.createElement('div');
        indicator.id = 'typingIndicator';
        indicator.className = 'typing-indicator';
        indicator.style.marginBottom = '15px';
        indicator.style.textAlign = 'left';
        indicator.innerHTML = `
            <div style="background: white; padding: 10px 15px; 
                      border-radius: 15px 15px 15px 0; 
                      display: inline-block;
                      box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                <span style="display: inline-block; width: 8px; height: 8px; 
                           background: #667eea; border-radius: 50%; 
                           margin-right: 3px; animation: bounce 1s infinite;"></span>
                <span style="display: inline-block; width: 8px; height: 8px; 
                           background: #667eea; border-radius: 50%; 
                           margin-right: 3px; animation: bounce 1s infinite 0.2s;"></span>
                <span style="display: inline-block; width: 8px; height: 8px; 
                           background: #667eea; border-radius: 50%; 
                           animation: bounce 1s infinite 0.4s;"></span>
            </div>
        `;
        container.appendChild(indicator);
        container.scrollTop = container.scrollHeight;
    }

    removeTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) indicator.remove();
    }

    async sendMessage(input, messagesContainer) {
        const message = input.value.trim();
        if (!message) return;

        // Mostrar mensagem do usuário
        this.addMessage(messagesContainer, message, true);
        input.value = '';

        // Mostrar indicador de digitação
        this.showTypingIndicator(messagesContainer);

        try {
            // Chamar a API do Azure Function
            const response = await fetch('/api/chat-gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            this.removeTypingIndicator();

            const data = await response.json();

            if (response.ok) {
                this.addMessage(messagesContainer, data.reply, false);
            } else {
                this.addMessage(messagesContainer, 
                    'Desculpe, tive um problema. Pode tentar novamente?', false);
                console.error('Erro:', data.error);
            }
        } catch (error) {
            this.removeTypingIndicator();
            this.addMessage(messagesContainer, 
                'Erro de conexão. Verifique sua internet.', false);
            console.error('Erro:', error);
        }
    }
}

// Adicionar animação CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes bounce {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-5px); }
    }
    
    .chat-toggle-btn:hover {
        transform: scale(1.1);
    }
    
    .chat-window {
        animation: slideIn 0.3s ease;
    }
    
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    new ChatGemini();
});