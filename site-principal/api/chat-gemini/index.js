const fetch = require('node-fetch');

module.exports = async function (context, req) {
    try {
        if (req.method === 'GET') {
            context.res = { status: 200, body: { status: 'online', engine: 'Groq' } };
            return;
        }

        const { message } = req.body || {};
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey || !message) {
            context.res = { status: 400, body: { error: 'Dados insuficientes' } };
            return;
        }

        // Endpoint da Groq (compatível com OpenAI)
        const url = "https://api.groq.com/openai/v1/chat/completions";

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "llama3-8b-8192", // Modelo gratuito e ultra rápido
                messages: [
                    { 
                        role: "system", 
                        content: `Você é o assistente oficial da Fernandes Technology. 
                        Fundador: André Fernandes. 
                        Missão: Conectar empresas do Brasil e EUA ao futuro digital.
                        Especialidades: Node.js, Azure Cloud, MongoDB, DevOps e IA.
                        Responda de forma profissional e direta em português.` 
                    },
                    { role: "user", content: message }
                ],
                temperature: 0.7
            })
        });

        const data = await response.json();

        if (!response.ok) {
            context.log.error('Erro Groq:', data);
            throw new Error(data.error?.message || 'Erro na comunicação com Groq');
        }

        // A Groq retorna a resposta em choices[0].message.content
        const reply = data.choices[0]?.message?.content || "Pode repetir a pergunta?";

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: { reply }
        };

    } catch (error) {
        context.log.error('Erro Fatal:', error.message);
        context.res = { 
            status: 200, 
            body: { reply: "Estou com uma instabilidade técnica momentânea. Tente novamente!" } 
        };
    }
};