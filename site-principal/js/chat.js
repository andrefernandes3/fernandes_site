document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 Inicializando chat com histórico...');
    
    // Carrega o histórico salvo ao iniciar
    carregarHistorico();
    
    // Inicia o chat
    iniciarChat();
});

// Variável global para armazenar o histórico
let historicoConversa = [];

// Carrega histórico do localStorage
function carregarHistorico() {
    const saved = localStorage.getItem('fernandes_chat_history');
    if (saved) {
        historicoConversa = JSON.parse(saved);
        console.log('📚 Histórico carregado:', historicoConversa.length, 'mensagens');
    }
}

// Salva histórico no localStorage
function salvarHistorico() {
    // Mantém apenas as últimas 20 mensagens para não sobrecarregar
    const historicoSalvar = historicoConversa.slice(-20);
    localStorage.setItem('fernandes_chat_history', JSON.stringify(historicoSalvar));
}

function iniciarChat() {
    // Verifica se o chat já existe
    if (document.getElementById('chatContainer')) {
        return;
    }

    const lang = localStorage.getItem('selectedLanguage') || 'pt';
    
    const textos = {
        pt: {
            welcome: "Olá! Sou assistente da Fernandes Technology. Como posso ajudar?",
            placeholder: "Digite sua mensagem...",
            send: "Enviar",
            online: "Online"
        },
        en: {
            welcome: "Hello! I'm Fernandes Technology assistant. How can I help?",
            placeholder: "Type your message...",
            send: "Send",
            online: "Online"
        }
    };

    const t = lang === 'en' ? textos.en : textos.pt;

    // HTML do chat
    const chatHTML = `
        <div id="chatContainer" class="chat-widget-container" 
             style="position: fixed; bottom: 90px; right: 20px; width: 350px; 
                    height: 500px; background: white; border-radius: 12px; 
                    box-shadow: 0 5px 20px rgba(0,0,0,0.2); z-index: 9999; 
                    display: none; flex-direction: column; overflow: hidden;">
            
            <div class="chat-header" 
                 style="background: #2563eb; color: white; padding: 15px; 
                        display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h5 style="margin: 0;">Fernandes AI</h5>
                    <small>${t.online}</small>
                </div>
                <button id="closeChatBtn" 
                        style="background: none; border: none; color: white; 
                               font-size: 24px; cursor: pointer;">×</button>
            </div>
            
            <div id="chatMessages" 
                 style="flex: 1; overflow-y: auto; padding: 15px; 
                        background: #f9fafb; display: flex; flex-direction: column; gap: 10px;">
                <!-- Mensagens serão inseridas aqui -->
            </div>
            
            <div class="chat-input-area" 
                 style="padding: 15px; background: white; border-top: 1px solid #e5e7eb;">
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="chatInput" 
                           placeholder="${t.placeholder}" 
                           style="flex: 1; padding: 10px 12px; border: 1px solid #d1d5db; 
                                  border-radius: 20px; outline: none; font-size: 14px;">
                    <button id="chatSendBtn" 
                            style="background: #2563eb; color: white; border: none; 
                                   border-radius: 20px; padding: 0 16px; cursor: pointer;
                                   font-size: 14px; font-weight: bold;">${t.send}</button>
                </div>
            </div>
        </div>
        
        <button id="chatToggleBtn" 
                style="position: fixed; bottom: 20px; right: 20px; z-index: 9999;
                       background: #2563eb; color: white; border: none; border-radius: 50%;
                       width: 60px; height: 60px; cursor: pointer; 
                       box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                       display: flex; align-items: center; justify-content: center;
                       font-size: 24px; transition: all 0.3s;">💬</button>
    `;

    document.body.insertAdjacentHTML('beforeend', chatHTML);

    // Elementos
    const toggle = document.getElementById('chatToggleBtn');
    const container = document.getElementById('chatContainer');
    const close = document.getElementById('closeChatBtn');
    const send = document.getElementById('chatSendBtn');
    const input = document.getElementById('chatInput');
    const messages = document.getElementById('chatMessages');

    // MOSTRA O HISTÓRICO SALVO ao abrir o chat
    if (historicoConversa.length > 0) {
        messages.innerHTML = ''; // Limpa a mensagem de boas-vindas padrão
        historicoConversa.forEach(msg => {
            adicionarMensagem(msg.text, msg.isUser, false); // false = não salvar novamente
        });
    } else {
        // Se não tem histórico, mostra mensagem de boas-vindas
        adicionarMensagem(t.welcome, false, false);
    }

    // Eventos
    toggle.onclick = function() {
        container.style.display = 'flex';
        toggle.style.display = 'none';
        input.focus();
    };

    close.onclick = function() {
        container.style.display = 'none';
        toggle.style.display = 'flex';
    };

    send.onclick = enviarMensagem;
    input.onkeypress = function(e) {
        if (e.key === 'Enter') enviarMensagem();
    };

    async function enviarMensagem() {
        const texto = input.value.trim();
        if (!texto) return;

        // Mostra mensagem do usuário e SALVA
        adicionarMensagem(texto, true, true);
        input.value = '';

        // Mostra indicador de digitação
        mostrarDigitacao();

        try {
            // Envia TODO o histórico para a API (últimas 10 mensagens)
            const historicoParaAPI = historicoConversa.slice(-10);
            
            const res = await fetch('/api/chat-gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: texto,
                    history: historicoParaAPI,  // 👈 Envia o histórico!
                    lang: localStorage.getItem('selectedLanguage') || 'pt'
                })
            });

            const data = await res.json();
            
            // Remove indicador de digitação
            removerDigitacao();
            
            // Mostra resposta e SALVA
            adicionarMensagem(data.reply, false, true);

        } catch (error) {
            console.error('Erro:', error);
            removerDigitacao();
            adicionarMensagem('Erro de conexão. Tente novamente.', false, true);
        }
    }

    function adicionarMensagem(texto, isUser, salvar = true) {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.marginBottom = '10px';
        div.style.justifyContent = isUser ? 'flex-end' : 'flex-start';
        
        const bgColor = isUser ? '#2563eb' : 'white';
        const textColor = isUser ? 'white' : '#1f2937';
        const borderRadius = isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px';
        
        div.innerHTML = `
            <div style="background: ${bgColor}; color: ${textColor}; 
                        padding: 10px 14px; border-radius: ${borderRadius}; 
                        max-width: 80%; box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                        word-wrap: break-word;">
                ${texto}
            </div>
        `;
        
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;

        // Salva no histórico se necessário
        if (salvar) {
            historicoConversa.push({ text: texto, isUser });
            salvarHistorico();
        }
    }

    function mostrarDigitacao() {
        const div = document.createElement('div');
        div.id = 'digitando';
        div.style.display = 'flex';
        div.style.marginBottom = '10px';
        div.style.justifyContent = 'flex-start';
        
        div.innerHTML = `
            <div style="background: white; padding: 12px 16px; 
                        border-radius: 18px 18px 18px 4px; 
                        box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                <div style="display: flex; gap: 4px;">
                    <span style="width: 8px; height: 8px; background: #9ca3af; 
                               border-radius: 50%; animation: pulse 1s infinite;"></span>
                    <span style="width: 8px; height: 8px; background: #9ca3af; 
                               border-radius: 50%; animation: pulse 1s infinite 0.2s;"></span>
                    <span style="width: 8px; height: 8px; background: #9ca3af; 
                               border-radius: 50%; animation: pulse 1s infinite 0.4s;"></span>
                </div>
            </div>
        `;
        
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
    }

    function removerDigitacao() {
        const digitando = document.getElementById('digitando');
        if (digitando) digitando.remove();
    }

    // Animação CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-4px); }
        }
        #chatToggleBtn:hover {
            transform: scale(1.1);
            background: #1d4ed8 !important;
        }
    `;
    document.head.appendChild(style);
}