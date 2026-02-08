const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async function (context, req) {
    try {
        const apiKey = process.env.GEMINI_API_KEY; 
        if (!apiKey) throw new Error("API Key não configurada.");

        const genAI = new GoogleGenerativeAI(apiKey);
        
        // AGORA VAI FUNCIONAR: Com a biblioteca atualizada, ele reconhece o modelo Flash
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const companyContext = `
        VOCÊ É: O assistente virtual oficial da Fernandes Technology.
        SUA PERSONA: Profissional, especialista em TI, direto e prestativo.
        
        SOBRE A EMPRESA:
        - Nome: Fernandes Technology.
        - Fundador: André Fernandes.
        - Localização: Brasil (Osasco/SP) e EUA (New Jersey).
        - Foco: Consultoria de TI Enterprise para empresas que buscam agilidade.
        
        SERVIÇOS:
        - Desenvolvimento Web (Node.js, React).
        - Cloud (Azure, AWS).
        - Banco de Dados (MongoDB, SQL).
        - DevOps (Docker, CI/CD).
        
        REGRAS:
        - Preço: "Depende do escopo. Vamos agendar uma conversa?"
        - Contato: "Use o formulário ou envie e-mail para contato@fernandestechnology.tech"
        - Idioma: Responda no idioma do cliente.
        `;

        const userMessage = req.body.message || "";
        const prompt = `${companyContext}\n\nPERGUNTA: "${userMessage}"\nRESPOSTA:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        context.res = {
            status: 200,
            body: { reply: text }
        };

    } catch (error) {
        context.log.error("Erro Chat:", error);
        context.res = { 
            status: 500, 
            body: { reply: "Desculpe, estou atualizando meu sistema. Tente já já." } 
        };
    }
};