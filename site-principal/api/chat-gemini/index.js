const fetch = require('node-fetch');

module.exports = async function (context, req) {
    context.log('Função chat-gemini foi executada');

    try {
        // Permitir GET para teste
        if (req.method === 'GET') {
            context.res = {
                status: 200,
                body: { message: "API do Chat Gemini está funcionando! Use POST para enviar mensagens." }
            };
            return;
        }

        const { message } = req.body;
        
        if (!message) {
            context.res = {
                status: 400,
                body: { error: "Por favor, forneça uma mensagem." }
            };
            return;
        }

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        
        if (!GEMINI_API_KEY) {
            context.log.error('GEMINI_API_KEY não configurada');
            context.res = {
                status: 500,
                body: { error: "API Key não configurada no servidor." }
            };
            return;
        }

        const prompt = `
        Você é um assistente virtual da empresa Fernandes Technology, especializada em:
        - Desenvolvimento Node.js
        - React
        - Infraestrutura Cloud (AWS e Azure)
        - MongoDB
        - DevOps com Docker
        
        Responda de forma profissional, amigável e em português do Brasil.
        
        Pergunta: ${message}
        `;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 500,
                    }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            context.log.error('Erro Gemini:', data);
            context.res = {
                status: response.status,
                body: { error: "Erro na API do Gemini: " + (data.error?.message || 'Erro desconhecido') }
            };
            return;
        }

        const reply = data.candidates[0]?.content?.parts[0]?.text || 
                     "Desculpe, não consegui processar sua resposta.";

        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: { reply }
        };

    } catch (error) {
        context.log.error('Erro na função:', error);
        context.res = {
            status: 500,
            body: { error: "Erro interno no servidor: " + error.message }
        };
    }
};