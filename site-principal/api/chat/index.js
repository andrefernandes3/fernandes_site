const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async function (context, req) {
    // 1. Configuração (Pegue a chave das Variáveis de Ambiente do Azure ou coloque aqui para teste RÁPIDO)
    const apiKey = process.env.GEMINI_API_KEY; 
    
    if (!apiKey) {
        context.res = { status: 500, body: "Erro de Configuração: API Key não encontrada." };
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 2. O Contexto (O Cérebro da IA)
    // Aqui resumimos o que está no seu site para a IA saber quem ela é.
    const websiteContext = `
    Você é o assistente virtual da Fernandes Technology (ou Fernandes Tech).
    Sua persona: Profissional, técnico, direto, mas amigável.
    
    SOBRE A EMPRESA:
    - Fundador: André Fernandes.
    - Localização: Osasco, SP (Brasil) e New Jersey (EUA).
    - Tipo: Consultoria de TI Enterprise focada em agilidade (ME).
    - Missão: Simplificar a tecnologia e conectar BR/USA.
    
    SERVIÇOS OFERECIDOS (Tech Stack):
    - Desenvolvimento Web: Node.js, Sites responsivos, SEO.
    - Cloud: Especialistas em Microsoft Azure e AWS (Arquitetura escalável).
    - Banco de Dados: MongoDB e SQL.
    - DevOps: Docker, CI/CD.
    
    CONTATO:
    - O cliente pode entrar em contato pelo formulário no site ou WhatsApp.
    - Respondemos em até 24h úteis.
    
    REGRAS:
    - Se perguntarem preço: Diga que depende do escopo e sugira agendar uma conversa.
    - Se perguntarem algo fora de TI: Diga educadamente que só pode ajudar com serviços da Fernandes Tech.
    - Responda de forma curta e objetiva (máximo 3 frases se possível).
    - Idioma: Responda no idioma que o usuário perguntar (Português ou Inglês).
    `;

    try {
        const userMessage = req.body.message || "";

        // 3. Monta o Prompt
        const prompt = `${websiteContext}\n\nCLIENTE: ${userMessage}\nFERNANDES AI:`;

        // 4. Gera a resposta
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        context.res = {
            status: 200,
            body: { reply: text }
        };

    } catch (error) {
        context.log.error("Erro no Gemini:", error);
        context.res = { status: 500, body: "Desculpe, meu cérebro está offline momentaneamente." };
    }
};