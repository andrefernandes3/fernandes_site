const fetch = require('node-fetch');

module.exports = async function (context, req) {
    try {
        if (req.method === 'GET') {
            context.res = { status: 200, body: { status: 'online' } };
            return;
        }

        const { message } = req.body || {};
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        if (!GEMINI_API_KEY || !message) {
            context.res = { status: 400, body: { error: 'Dados insuficientes' } };
            return;
        }

        // URL Estável v1 e Modelo 1.5-Flash (Real)
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: "Você é o assistente da Fernandes Technology. André Fernandes é o fundador. Seja profissional e responda em português." }]
                },
                contents: [{
                    role: "user",
                    parts: [{ text: message }]
                }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            context.log.error('Erro Google:', data);
            // Se a IA falhar, não mandamos 500, mandamos uma resposta amigável para o chat não travar
            context.res = { 
                status: 200, 
                body: { reply: "Tive um soluço técnico aqui. Pode repetir a pergunta, por favor?" } 
            };
            return;
        }

        // Pega a resposta real da IA
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Não entendi muito bem. Pode explicar melhor?";

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: { reply }
        };

    } catch (error) {
        context.log.error('Erro Fatal:', error);
        context.res = { status: 200, body: { reply: "Estou a processar muitas coisas. Tente novamente em breve!" } };
    }
};