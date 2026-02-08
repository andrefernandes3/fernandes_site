const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async function (context, req) {
    try {
        const apiKey = process.env.GEMINI_API_KEY; 
        if (!apiKey) throw new Error("API Key não configurada.");

        const genAI = new GoogleGenerativeAI(apiKey);
        
        // MUDANÇA AQUI: Usando o modelo estável 'gemini-pro'
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const companyContext = `
        VOCÊ É: O assistente virtual oficial da Fernandes Technology.
        SUA PERSONA: Profissional, especialista em TI, direto e prestativo. Use emojis moderados.
        
        SOBRE A EMPRESA:
        - Nome: Fernandes Technology.
        - Fundador: André Fernandes.
        - Localização: Brasil (Osasco/SP) e EUA (New Jersey).
        - Foco: Consultoria de TI Enterprise para empresas que buscam agilidade.
        
        SERVIÇOS (Tech Stack):
        - Desenvolvimento Web: Node.js, React, Sites rápidos e responsivos.
        - Cloud: Especialistas em Azure e AWS (Arquitetura, Migração, Serverless).
        - Banco de Dados: MongoDB (NoSQL) e SQL Server.
        - DevOps: Pipelines CI/CD, Docker, Automação.
        
        REGRAS DE ATENDIMENTO:
        1. Se perguntarem preço: "Depende do escopo do projeto. Posso pedir para o André entrar em contato?"
        2. Se perguntarem contato: Indique o formulário do site ou e-mail contato@fernandestechnology.tech.
        3. Idioma: Responda SEMPRE no idioma que o usuário perguntar (Português ou Inglês).
        4. Tamanho: Respostas curtas e objetivas (máximo 3 parágrafos).
        
        OBJETIVO: Tirar dúvidas técnicas e convencer o cliente a agendar uma reunião.
        `;

        const userMessage = req.body.message || "";
        const prompt = `${companyContext}\n\nPERGUNTA DO CLIENTE: "${userMessage}"\nSUA RESPOSTA:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        context.res = {
            status: 200,
            body: { reply: text }
        };

    } catch (error) {
        context.log.error("Erro no Chat:", error);
        context.res = { 
            status: 500, 
            body: { reply: "Desculpe, estou em manutenção rápida. Tente novamente em 1 minuto." } 
        };
    }
};