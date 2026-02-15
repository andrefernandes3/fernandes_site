// Aguarda o DOM carregar completamente
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 Inicializando chat...');
    iniciarChat();
});

// Função principal que cria e gerencia o chat
function iniciarChat() {
    // ==========================================
    // 1. CRIAR A ESTRUTURA DO CHAT
    // ==========================================
    
    // Botão flutuante do chat
    const botaoHTML = `
        <button id="chatBotao" class="chat-botao" 
                style="position: fixed; bottom: 20px; right: 20px; z-index: 9999;
                       background: #2563eb; color: white; border: none; border-radius: 50%;
                       width: 60px; height: 60px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                       display: flex; align-items: center; justify-content: center;
                       font-size: 24px; transition: all 0.3s;">
            💬
        </button>
    `;

    // Janela do chat
    const janelaHTML = `
        <div id="chatJanela" class="chat-janela" 
             style="display: none; position: fixed; bottom: 90px; right: 20px; width: 350px;
                    height: 500px; background: white; border-radius: 12px; 
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2); z-index: 9999;
                    overflow: hidden; border: 1px solid #e5e7eb; font-family: Arial, sans-serif;">
            
            <!-- CABEÇALHO -->
            <div style="background: #2563eb; color: white; padding: 15px; 
                        display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="font-size: 16px;">🤖 Assistente IA</strong>
                    <div style="font-size: 12px; opacity: 0.9;">Fernandes Technology</div>
                </div>
                <button id="chatFechar" style="background: none; border: none; color: white; 
                         font-size: 20px; cursor: pointer;">×</button>
            </div>
            
            <!-- ÁREA DE MENSAGENS -->
            <div id="chatMensagens" style="height: 360px; overflow-y: auto; padding: 15px; 
                        background: #f9fafb; display: flex; flex-direction: column; gap: 10px;">
                <!-- Mensagem inicial -->
                <div style="display: flex; margin-bottom: 5px;">
                    <div style="background: white; color: #1f2937; padding: 10px 14px; 
                                border-radius: 18px 18px 18px 4px; max-width: 80%;
                                box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                        👋 Olá! Sou o assistente da Fernandes Technology. Como posso ajudar?
                    </div>
                </div>
            </div>
            
            <!-- ÁREA DE INPUT -->
            <div style="padding: 15px; background: white; border-top: 1px solid #e5e7eb;">
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="chatInput" 
                           placeholder="Digite sua mensagem..." 
                           style="flex: 1; padding: 10px 12px; border: 1px solid #d1d5db; 
                                  border-radius: 20px; outline: none; font-size: 14px;">
                    <button id="chatEnviar" 
                            style="background: #2563eb; color: white; border: none; 
                                   border-radius: 20px; padding: 0 16px; cursor: pointer;
                                   font-size: 14px; font-weight: bold;">
                        Enviar
                    </button>
                </div>
            </div>
        </div>
    `;

    // Adiciona os elementos ao corpo da página
    document.body.insertAdjacentHTML('beforeend', botaoHTML);
    document.body.insertAdjacentHTML('beforeend', janelaHTML);

    // ==========================================
    // 2. PEGAR REFERÊNCIAS DOS ELEMENTOS
    // ==========================================
    
    const botao = document.getElementById('chatBotao');
    const janela = document.getElementById('chatJanela');
    const fechar = document.getElementById('chatFechar');
    const enviar = document.getElementById('chatEnviar');
    const input = document.getElementById('chatInput');
    const mensagens = document.getElementById('chatMensagens');

    // ==========================================
    // 3. CONFIGURAR EVENTOS
    // ==========================================
    
    // Abrir chat
    botao.addEventListener('click', function() {
        janela.style.display = 'block';
        botao.style.display = 'none';
        input.focus(); // Foca no input automaticamente
    });

    // Fechar chat
    fechar.addEventListener('click', function() {
        janela.style.display = 'none';
        botao.style.display = 'flex';
    });

    // Enviar mensagem com botão
    enviar.addEventListener('click', function() {
        enviarMensagem();
    });

    // Enviar mensagem com Enter
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            enviarMensagem();
        }
    });

    // ==========================================
    // 4. FUNÇÃO PARA ENVIAR MENSAGEM
    // ==========================================
    
    async function enviarMensagem() {
        const texto = input.value.trim();
        
        // Não enviar mensagem vazia
        if (texto === '') return;

        // Limpar input
        input.value = '';

        // MOSTRAR MENSAGEM DO USUÁRIO
        mostrarMensagem(texto, 'usuario');

        // MOSTRAR INDICADOR DE DIGITAÇÃO
        mostrarDigitacao();

        try {
            console.log('📤 Enviando mensagem para API:', texto);

            // Chamar a API
            const resposta = await fetch('/api/chat-gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: texto })
            });

            // Tentar ler a resposta como JSON
            let dados;
            try {
                dados = await resposta.json();
                console.log('📥 Resposta da API:', dados);
            } catch (erroJson) {
                console.error('❌ Erro ao ler JSON:', erroJson);
                dados = { reply: 'Desculpe, tive um problema técnico. Tente novamente.' };
            }

            // Remover indicador de digitação
            removerDigitacao();

            // Verificar se é uma resposta de fallback (erro controlado)
            if (dados.fallback) {
                mostrarMensagem(dados.reply, 'bot');
            } 
            // Resposta normal
            else if (dados.reply) {
                mostrarMensagem(dados.reply, 'bot');
            } 
            // Erro desconhecido
            else {
                mostrarMensagem('Desculpe, não entendi. Pode reformular?', 'bot');
            }

        } catch (erro) {
            console.error('❌ Erro na requisição:', erro);
            removerDigitacao();
            mostrarMensagem('Erro de conexão. Verifique sua internet.', 'bot');
        }
    }

    // ==========================================
    // 5. FUNÇÃO PARA MOSTRAR MENSAGEM
    // ==========================================
    
    function mostrarMensagem(texto, tipo) {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.marginBottom = '10px';
        div.style.justifyContent = tipo === 'usuario' ? 'flex-end' : 'flex-start';
        
        // Cores diferentes para usuário e bot
        const bgColor = tipo === 'usuario' ? '#2563eb' : 'white';
        const textColor = tipo === 'usuario' ? 'white' : '#1f2937';
        const borderRadius = tipo === 'usuario' ? '18px 18px 4px 18px' : '18px 18px 18px 4px';
        
        div.innerHTML = `
            <div style="background: ${bgColor}; color: ${textColor}; 
                        padding: 10px 14px; border-radius: ${borderRadius}; 
                        max-width: 80%; box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                        word-wrap: break-word; font-size: 14px;">
                ${texto}
            </div>
        `;
        
        mensagens.appendChild(div);
        
        // Rolar para a última mensagem
        mensagens.scrollTop = mensagens.scrollHeight;
    }

    // ==========================================
    // 6. FUNÇÃO PARA MOSTRAR INDICADOR DE DIGITAÇÃO
    // ==========================================
    
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
        
        mensagens.appendChild(div);
        mensagens.scrollTop = mensagens.scrollHeight;
    }

    // ==========================================
    // 7. FUNÇÃO PARA REMOVER INDICADOR DE DIGITAÇÃO
    // ==========================================
    
    function removerDigitacao() {
        const digitando = document.getElementById('digitando');
        if (digitando) {
            digitando.remove();
        }
    }

    // ==========================================
    // 8. ADICIONAR ANIMAÇÃO CSS
    // ==========================================
    
    const estilo = document.createElement('style');
    estilo.textContent = `
        @keyframes pulse {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-4px); }
        }
        
        .chat-botao:hover {
            transform: scale(1.1);
            background: #1d4ed8 !important;
        }
    `;
    document.head.appendChild(estilo);
}