const fetch = require('node-fetch');

module.exports = async function (context, req) {
    context.log('🚀 Iniciando chat-gemini com Gemini');
    
    try {
        // GET - status da API
        if (req.method === 'GET') {
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    status: 'online',
                    message: 'API do chat com Gemini está pronta!',
                    timestamp: new Date().toISOString()
                }
            };
            return;
        }

        // POST - processar mensagem com Gemini
        if (req.method === 'POST') {
            const { message } = req.body || {};
            
            if (!message) {
                context.res = {
                    status: 400,
                    body: { error: 'Mensagem não fornecida' }
                };
                return;
            }

            context.log('Mensagem recebida:', message);

            // Pegar a API Key do ambiente (configurada no Azure)
            const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
            
            if (!GEMINI_API_KEY) {
                context.log.error('API Key não configurada');
                context.res = {
                    status: 500,
                    body: { error: 'API Key não configurada no servidor' }
                };
                return;
            }

            // Chamar API do Gemini
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: `Você é assistente da Fernandes Technology. Responda em português: ${message}`
                            }]
                        }]
                    })
                }
            );

            const data = await response.json();
            
            if (!response.ok) {
                context.log.error('Erro Gemini:', data);
                context.res = {
                    status: 500,
                    body: { error: 'Erro na API do Gemini', details: data }
                };
                return;
            }

            const reply = data.candidates[0]?.content?.parts[0]?.text || 
                         'Desculpe, não consegui processar.';

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: { reply }
            };
            return;
        }

        // Método não permitido
        context.res = {
            status: 405,
            body: { error: 'Método não permitido' }
        };

    } catch (error) {
        context.log.error('Erro:', error);
        context.res = {
            status: 500,
            body: { error: error.message }
        };
    }
};