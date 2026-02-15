const fetch = require('node-fetch');

module.exports = async function (context, req) {
    if (req.method === 'GET') {
        context.res = { status: 200, body: { status: 'online' } };
        return;
    }

    try {
        const { message } = req.body || {};
        const GEMINI_API_KEnv.GEMINI_API_KEY;

        if (!GEMINI_API_KEY) {
            context.res = { status: 500, body: { error: 'API Key não configurada' } };
            return;
        }

        // URL estável v1 com o modelo 1.5-flash
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        // "Treino" via System Instruction
        const systemPrompt = `Você é o assistente virtual oficial da Fernandes Technology.
        Contexto da Empresa:
        - Fundada por André Fernandes.
        - Missão: Simplificar a tecnologia para empresas no Brasil e EUA.
        - Serviços: Desenvolvimento Web (Node.js), Cloud (Azure/AWS), Dados (MongoDB/SQL), e IA.
        - Diferenciais: Agilidade, presença global e experiência enterprise.
        Regras de Resposta:
        - Sê profissional, direto e prestativo.
        - Responde sempre no idioma em que o utilizador falar (Português ou Inglês).
        - Se perguntarem sobre serviços, usa os detalhes do site (SaaS, CI/CD, LLMs).
        - Se não souberes algo, sugere contactar o André pelo formulário do site.`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [{ text: `Instrução de Sistema: ${systemPrompt}\n\nPergunta do Utilizador: ${message}` }]
                    }
                ]
            })
        });

        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error?.message || 'Erro na IA');

        const reply = data.candidates[0]?.content?.parts[0]?.text || 'Desculpe, tente novamente.';

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: { reply }
        };

    } catch (error) {
        context.log.error('Erro:', error.message);
        context.res = { status: 500, body: { error: 'Erro interno' } };
    }
};