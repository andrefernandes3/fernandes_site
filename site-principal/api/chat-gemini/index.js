const fetch = require('node-fetch');

module.exports = async function (context, req) {
    if (req.method === 'GET') return context.res = { body: { status: 'online' } };

    const { message, history, lang } = req.body || {};
    const apiKey = process.env.GROQ_API_KEY;

    // Converte o histórico para o formato da Groq
    const messages = (history || []).map(m => ({
        role: m.isUser ? "user" : "assistant",
        content: m.text
    }));

    if (messages.length === 0) messages.push({ role: "user", content: message });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: "llama3-8b-8192",
            messages: [
                { role: "system", content: `Assistente da Fernandes Technology. Responda em ${lang === 'en' ? 'Inglês' : 'Português'}.` },
                ...messages
            ]
        })
    });

    const data = await response.json();
    context.res = { body: { reply: data.choices[0].message.content } };
};