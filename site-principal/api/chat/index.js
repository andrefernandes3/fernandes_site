module.exports = async function (context, req) {
    context.log(">>> Iniciando função de Chat...");

    try {
        // 1. Teste da Chave
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("A variável GEMINI_API_KEY não foi encontrada nas configurações.");
        }

        // 2. Teste da Biblioteca
        let GoogleGenerativeAI;
        try {
            const module = require("@google/generative-ai");
            GoogleGenerativeAI = module.GoogleGenerativeAI;
        } catch (e) {
            throw new Error("A biblioteca '@google/generative-ai' não está instalada. Rode 'npm install' na pasta api.");
        }

        // 3. Execução da IA
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const companyContext = `
        Você é a IA da Fernandes Technology.
        Responda de forma curta e prestativa.
        `;

        const userMessage = req.body.message || "Olá";
        const prompt = `${companyContext}\n\nUser: ${userMessage}\nIA:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        context.res = {
            status: 200,
            body: { reply: text }
        };

    } catch (error) {
        context.log.error("ERRO GRAVE:", error);
        
        // Aqui devolvemos o erro REAL para o frontend para você ler
        context.res = {
            status: 200, // Retornamos 200 para o chat mostrar a mensagem de erro
            body: { 
                reply: `🚨 ERRO DE DIAGNÓSTICO: ${error.message}` 
            }
        };
    }
};