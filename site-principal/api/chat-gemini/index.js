const fetch = require('node-fetch');

module.exports = async function (context, req) {
    context.log('🚀 Função executada. Method:', req.method);
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (req.method === 'GET') {
        context.res = { status: 200, body: { status: "API OK", keyPresent: !!GEMINI_API_KEY } };
        return;
    }

    try {
        const { message } = req.body;
        if (!message) {
            context.res = { status: 400, body: { error: "Mensagem não fornecida" } };
            return;
        }

        if (!GEMINI_API_KEY) {
            context.res = { status: 500, body: { error: "API Key não configurada no Azure" } };
            return;
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: message }] }] })
            }
        );

        const data = await response.json();
        context.res = {
            status: 200,
            body: { reply: data.candidates[0].content.parts[0].text }
        };
    } catch (error) {
        context.log.error('Erro:', error);
        context.res = { status: 500, body: { error: error.message } };
    }
};