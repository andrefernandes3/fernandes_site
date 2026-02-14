const fetch = require('node-fetch');

module.exports = async function (context, req) {
    context.log('========== INÍCIO ==========');
    
    try {
        if (req.method === 'GET') {
            context.res = {
                status: 200,
                body: { status: 'online' }
            };
            return;
        }

        if (req.method === 'POST') {
            const { message } = req.body || {};
            context.log('Mensagem:', message);

            const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
            
            if (!GEMINI_API_KEY) {
                context.res = {
                    status: 500,
                    body: { error: 'API Key não configurada' }
                };
                return;
            }

            // ✅ CORREÇÃO: usar gemini-pro em vez de gemini-1.5-flash
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Você é o assistente da Fernandes Technology, especialista em Node.js, React, AWS, Azure e DevOps. Responda em português de forma profissional e amigável.

Pergunta: ${message}`
                        }]
                    }]
                })
            });

            const data = await response.json();

            if (!response.ok) {
                context.log.error('Erro Gemini:', data);
                context.res = {
                    status: 500,
                    body: { 
                        error: 'Erro na API do Gemini',
                        details: data.error?.message 
                    }
                };
                return;
            }

            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                         'Desculpe, não consegui processar.';
            
            context.res = {
                status: 200,
                body: { reply }
            };
            return;
        }

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