const fetch = require('node-fetch');

module.exports = async function (context, req) {
    try {
        const { message } = req.body;
        
        if (!message) {
            context.res = {
                status: 400,
                body: { error: "Mensagem não fornecida" }
            };
            return;
        }

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        
        if (!GEMINI_API_KEY) {
            context.res = {
                status: 500,
                body: { error: "API Key não configurada" }
            };
            return;
        }

        // Prompt personalizado para a Fernandes Technology
        const prompt = `
        Você é um assistente virtual da empresa Fernandes Technology, especializada em:
        - Desenvolvimento Node.js
        - React
        - Infraestrutura Cloud (AWS e Azure)
        - MongoDB
        - DevOps com Docker
        
        Responda de forma profissional, amigável e em português do Brasil.
        Se não souber algo, seja honesto e ofereça ajudar com o que está ao seu alcance.
        
        Pergunta do cliente: ${message}
        
        Responda como assistente da Fernandes Technology:
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
            context.res = {
                status: response.status,
                body: { error: "Erro na API do Gemini" }
            };
            return;
        }

        const reply = data.candidates[0]?.content?.parts[0]?.text || 
                     "Desculpe, não consegui processar sua resposta.";

        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: { reply }
        };

    } catch (error) {
        context.log.error('Erro no chat:', error);
        context.res = {
            status: 500,
            body: { error: "Erro interno no servidor" }
        };
    }
};