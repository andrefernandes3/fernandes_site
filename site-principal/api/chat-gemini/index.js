const fetch = require('node-fetch');

module.exports = async function (context, req) {
    try {
        if (req.method === 'GET') {
            context.res = { status: 200, body: { status: 'online' } };
            return;
        }

        const { message } = req.body || {};
        const apiKey = process.env.GEMINI_API_KEY;

        // 1. URL Estável (v1) e Modelo Correto (1.5-flash)
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        // Injetando o conhecimento do seu site diretamente no prompt
                        text: `Tu és o assistente da Fernandes Technology. 
                        André Fernandes é o fundador, especialista em software e infraestrutura.
                        A empresa atua no Brasil e EUA com Cloud (Azure/AWS) e IA.
                        Responda em português de forma profissional: ${message}`
                    }]
                }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            // Se der erro, mostramos o erro real nos logs do Azure para diagnóstico
            context.log.error('Erro detalhado da Google:', JSON.stringify(data));
            context.res = { 
                status: 200, 
                body: { reply: "Não consegui contactar a minha base de dados agora. Pode tentar novamente?" } 
            };
            return;
        }

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Pode repetir a pergunta?";

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: { reply }
        };

    } catch (error) {
        context.log.error('Erro Fatal:', error);
        context.res = { status: 200, body: { reply: "Estou a processar muitas solicitações. Tente de novo!" } };
    }
};