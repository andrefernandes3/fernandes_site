const fetch = require('node-fetch');

module.exports = async function (context, req) {
    context.log('🚀 Processando requisição no chat-gemini');
    
    // 1. Responder ao GET (Teste de Status)
    if (req.method === 'GET') {
        context.res = {
            status: 200,
            body: { status: 'online', message: 'API do chat com Gemini está pronta!' }
        };
        return;
    }

    // 2. Processar o POST (Chat Real)
    try {
        const { message } = req.body || {};
        
        if (!message) {
            context.res = { status: 400, body: { error: 'Mensagem vazia' } };
            return;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            context.log.error('❌ ERRO: GEMINI_API_KEY não configurada no Azure');
            context.res = { status: 500, body: { error: 'Chave de API não configurada no servidor' } };
            return;
        }

        // Usando o modelo 1.5-flash (mais rápido e estável)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Tu és o assistente da Fernandes Technology. Seja direto e profissional. André Fernandes é o fundador. Responda em português: ${message}`
                    }]
                }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            context.log.error('❌ Erro da Google:', data);
            throw new Error(data.error?.message || 'Erro na comunicação com a IA');
        }

        const reply = data.candidates[0]?.content?.parts[0]?.text || 'Não consegui processar a resposta.';

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: { reply }
        };

    } catch (error) {
        context.log.error('💥 Erro Crítico:', error.message);
        context.res = {
            status: 500,
            body: { error: 'Erro interno no servidor', details: error.message }
        };
    }
};