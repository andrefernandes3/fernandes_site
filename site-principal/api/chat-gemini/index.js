const fetch = require('node-fetch');

module.exports = async function (context, req) {
    try {
        if (req.method === 'GET') {
            context.res = { status: 200, body: { status: 'online' } };
            return;
        }

        const { message, history, lang } = req.body || {};
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey) {
            context.log.error('❌ Chave GROQ_API_KEY não encontrada');
            context.res = { status: 500, body: { error: 'Erro de configuração no servidor' } };
            return;
        }

        // Formata o histórico para a Groq
        const messages = (history || []).map(m => ({
            role: m.isUser ? "user" : "assistant",
            content: m.text
        }));
        
        // Adiciona a instrução de sistema e a mensagem atual
        const systemMsg = { 
            role: "system", 
            content: `Tu és o assistente da Fernandes Technology (André Fernandes). Responde em ${lang === 'en' ? 'Inglês' : 'Português'}.` 
        };
        const userMsg = { role: "user", content: message };

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: [systemMsg, ...messages.slice(-6), userMsg],
                temperature: 0.7
            })
        });

        const data = await response.json();

        // VALIDAÇÃO CRÍTICA: Evita erro 500 ao ler data.choices
        if (!response.ok || !data.choices || data.choices.length === 0) {
            context.log.error('Erro Groq:', data);
            context.res = { status: 200, body: { reply: "Estou a processar muitas perguntas. Pode repetir?" } };
            return;
        }

        const reply = data.choices[0].message.content;
        context.res = { status: 200, body: { reply } };

    } catch (error) {
        context.log.error('💥 Erro Fatal:', error.message);
        context.res = { status: 200, body: { reply: "Tive um problema de conexão. Tente novamente!" } };
    }
};