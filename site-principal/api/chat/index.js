module.exports = async function (context, req) {
    // Cabeçalho padrão para garantir que o frontend receba JSON
    const headers = { "Content-Type": "application/json" };

    try {
        const apiKey = process.env.GROQ_API_KEY; 
        if (!apiKey) throw new Error("API Key (GROQ_API_KEY) não configurada.");

        // Contexto da Fernandes Technology
        const systemPrompt = `
        VOCÊ É: O assistente virtual da Fernandes Technology.
        
        SOBRE A EMPRESA:
        - Nome: Fernandes Technology (Fundador: André Fernandes).
        - Local: Brasil (Osasco) e EUA (New Jersey).
        - Foco: Consultoria TI Enterprise, Node.js, Azure, MongoDB.
        
        REGRAS:
        - Respostas curtas (máx 3 frases).
        - Profissional e direto.
        - Se perguntarem preço: "Depende do escopo. Vamos agendar uma reunião?"
        - Se perguntarem contato: "Pelo formulário ou WhatsApp no site."
        - Responda no idioma da pergunta.
        `;

        const userMessage = req.body.message || "Olá";

        // CHAMADA DIRETA (Sem biblioteca)
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                model: "llama3-8b-8192", // Modelo Rápido e Grátis
                temperature: 0.5,
                max_tokens: 200
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro na API Groq: ${errorText}`);
        }

        const data = await response.json();
        const replyText = data.choices[0]?.message?.content || "Sem resposta.";

        context.res = {
            status: 200,
            headers: headers,
            body: { reply: replyText }
        };

    } catch (error) {
        context.log.error("Erro Chat:", error);
        
        // Retorna JSON mesmo no erro para não quebrar o frontend
        context.res = { 
            status: 500, 
            headers: headers,
            body: { reply: "Desculpe, estou em manutenção. Tente novamente." } 
        };
    }
};