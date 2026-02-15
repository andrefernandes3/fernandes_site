// Aguardar o DOM carregar
document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando chat...');
    initChat();
});

function initChat() {
    // Criar estrutura do chat
    const chatHTML = `
        <div id="chat-container">
            <!-- Botão flutuante -->
            <button id="chat-toggle" class="chat-toggle" style="position: fixed; bottom: 20px; right: 20px; z-index: 9999; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 50%; width: 60px; height: 60px; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center;">
                <i class="bi bi-chat-dots-fill" style="font-size: 24px;"></i>
            </button>

            <!-- Janela do chat -->
            <div id="chat-window" style="display: none; position: fixed; bottom: 90px; right: 20px; width: 350px; height: 500px; background: white; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); z-index: 9999; overflow: hidden; border: 1px solid #e0e0e0;">
                
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h5 style="margin: 0;">Assistente IA</h5>
                            <small>Fernandes Technology</small>
                        </div>
                        <button id="chat-close" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer;">×</button>
                    </div>
                </div>

                <!-- Mensagens -->
                <div id="chat-messages" style="height: 360px; overflow-y: auto; padding: 15px; background: #f5f5f5;">
                    <div style="margin-bottom: 10px; text-align: left;">
                        <div style="background: white; padding: 10px 15px; border-radius: 15px 15px 15px 0; display: inline-block; max-width: 80%;">
                            👋 Olá! Sou o assistente da Fernandes Technology. Como posso ajudar?
                        </div>
                    </div>
                </div>

                <!-- Input -->
                <div style="padding: 15px; background: white; border-top: 1px solid #e0e0e0;">
                    <div style="display: flex; gap: 10px;">
                        <input type="text" id="chat-input" placeholder="Digite sua mensagem..." style="flex: 1; padding: 10px; border: 1px solid #e0e0e0; border-radius: 20px; outline: none;">
                        <button id="chat-send" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 20px; padding: 10px 20px; cursor: pointer;">
                            <i class="bi bi-send"></i> Enviar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Adicionar ao final do body
    document.body.insertAdjacentHTML('beforeend', chatHTML);

    // Elementos
    const toggle = document.getElementById('chat-toggle');
    const window = document.getElementById('chat-window');
    const close = document.getElementById('chat-close');
    const send = document.getElementById('chat-send');
    const input = document.getElementById('chat-input');
    const messages = document.getElementById('chat-messages');

    // Mostrar/esconder
    toggle.addEventListener('click', () => {
        window.style.display = 'block';
        toggle.style.display = 'none';
        input.focus();
    });

    close.addEventListener('click', () => {
        window.style.display = 'none';
        toggle.style.display = 'flex';
    });

    // Enviar mensagem
    send.addEventListener('click', () => sendMessage());
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    async function sendMessage() {
        const message = input.value.trim();
        if (!message) return;

        // Adicionar mensagem do usuário
        addMessage(message, true);
        input.value = '';

        // Mostrar indicador de digitação
        showTyping();

        try {
            // Chamar API
            const response = await fetch('/api/chat-gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            hideTyping();

            const data = await response.json();

            if (response.ok) {
                addMessage(data.reply, false);
            } else {
                addMessage('Desculpe, erro: ' + (data.error || 'Tente novamente.'), false);
            }
        } catch (error) {
            hideTyping();
            addMessage('Erro de conexão. Verifique sua internet.', false);
            console.error('Erro:', error);
        }
    }

    function addMessage(text, isUser) {
        const div = document.createElement('div');
        div.style.marginBottom = '10px';
        div.style.textAlign = isUser ? 'right' : 'left';
        
        div.innerHTML = `
            <div style="background: ${isUser ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white'}; 
                        color: ${isUser ? 'white' : '#333'}; 
                        padding: 10px 15px; 
                        border-radius: ${isUser ? '15px 15px 0 15px' : '15px 15px 15px 0'}; 
                        display: inline-block; 
                        max-width: 80%;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                ${text}
            </div>
        `;
        
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
    }

    function showTyping() {
        const div = document.createElement('div');
        div.id = 'typing-indicator';
        div.style.marginBottom = '10px';
        div.style.textAlign = 'left';
        div.innerHTML = `
            <div style="background: white; padding: 10px 15px; border-radius: 15px 15px 15px 0; display: inline-block;">
                <span style="display: inline-block; width: 8px; height: 8px; background: #667eea; border-radius: 50%; margin-right: 3px; animation: bounce 1s infinite;"></span>
                <span style="display: inline-block; width: 8px; height: 8px; background: #667eea; border-radius: 50%; margin-right: 3px; animation: bounce 1s infinite 0.2s;"></span>
                <span style="display: inline-block; width: 8px; height: 8px; background: #667eea; border-radius: 50%; animation: bounce 1s infinite 0.4s;"></span>
            </div>
        `;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
    }

    function hideTyping() {
        const typing = document.getElementById('typing-indicator');
        if (typing) typing.remove();
    }
}