// site-principal/js/chat.js
document.addEventListener('DOMContentLoaded', function () {
    console.log('🎯 Inicializando chat Fernandes Technology...');

    // Verifica se é um reload para gerenciar o histórico
    const isReload = performance.navigation.type === 1;
    if (isReload) {
        localStorage.removeItem('fernandes_chat_history');
        historicoConversa = [];
    } else {
        carregarHistorico();
    }

    iniciarChat();
});

let historicoConversa = [];

function carregarHistorico() {
    const saved = localStorage.getItem('fernandes_chat_history');
    if (saved) {
        historicoConversa = JSON.parse(saved);
        historicoConversa.forEach(msg => adicionarMensagem(msg.text, msg.isUser, false));
    }
}

function salvarHistorico() {
    const historicoSalvar = historicoConversa.slice(-20);
    localStorage.setItem('fernandes_chat_history', JSON.stringify(historicoSalvar));
}

function iniciarChat() {
    const messages = document.getElementById('chatMessages');
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSendBtn');

    async function sendMessage() {
        const texto = input.value.trim();
        if (!texto) return;

        adicionarMensagem(texto, true);
        input.value = '';
        exibirDigitando();

        try {
            const response = await fetch('/api/chat-gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: texto, 
                    history: historicoConversa, 
                    lang: localStorage.getItem('selectedLanguage') || 'pt',
                    pagina: window.location.pathname // Envia a página atual
                })
            });

            const data = await response.json();
            removerDigitacao();
            
            if (data.reply) {
                adicionarMensagem(data.reply, false);
            } else {
                adicionarMensagem("Desculpe, tive um problema técnico.", false);
            }
        } catch (error) {
            removerDigitacao();
            adicionarMensagem("Erro de conexão. Tente novamente.", false);
        }
    }

    sendBtn.onclick = sendMessage;
    input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
}

function adicionarMensagem(texto, isUser, salvar = true) {
    const messages = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.marginBottom = '10px';
    div.style.justifyContent = isUser ? 'flex-end' : 'flex-start';
    
    const bgColor = isUser ? '#2563eb' : 'white';
    const textColor = isUser ? 'white' : '#1f2937';
    const borderRadius = isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px';
    
    // Processa Markdown apenas para o Bot
    const conteudoProcessado = (!isUser && typeof marked !== 'undefined') ? marked.parse(texto) : texto;

    div.innerHTML = `
        <div style="background: ${bgColor}; color: ${textColor}; 
                    padding: 10px 14px; border-radius: ${borderRadius}; 
                    max-width: 80%; box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                    word-wrap: break-word;">
            ${conteudoProcessado}
        </div>
    `;
    
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;

    if (salvar) {
        historicoConversa.push({ text: texto, isUser });
        salvarHistorico();
    }
}

function exibirDigitando() {
    const div = document.createElement('div');
    div.id = 'digitando';
    div.style.display = 'flex';
    div.style.marginBottom = '10px';
    div.innerHTML = `<div style="background:white; padding:10px; border-radius:15px;">...</div>`;
    document.getElementById('chatMessages').appendChild(div);
}

function removerDigitacao() {
    const el = document.getElementById('digitando');
    if (el) el.remove();
}