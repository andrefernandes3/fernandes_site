const fetch = require('node-fetch');

module.exports = async function (context, req) {
    try {
        if (req.method === 'GET') {
            context.res = { status: 200, body: { status: 'online' } };
            return;
        }

        if (req.method === 'POST') {
            const { message } = req.body || {};
            const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
            
            if (!GEMINI_API_KEY) {
                context.res = { status: 500, body: { error: 'API Key não configurada' } };
                return;
            }

            // CORREÇÃO: Usando a versão estável (v1) e o modelo correto (1.5-flash)
            const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            // Mantendo o seu treino do index.old.js
                            text: `Você é o assistente virtual oficial da Fernandes Technology, especializada em software e infraestrutura cloud. 
                            Fundada por André Fernandes. Responda de forma profissional e concisa.
                            
                            CONTEXTO: ${message}`
                        }]
                    }]
                })
            });

            const data = await response.json();

            if (!response.ok) {
                context.log.error('Erro Gemini:', data);
                context.res = {
                    status: 500,
                    body: { error: 'Erro na API do Gemini', details: data.error?.message }
                };
                return;
            }

            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Desculpe, não consegui processar.';
            
            context.res = { status: 200, body: { reply } };
            return;
        }
    } catch (error) {
        context.log.error('Erro:', error);
        context.res = { status: 500, body: { error: error.message } };
    }
};