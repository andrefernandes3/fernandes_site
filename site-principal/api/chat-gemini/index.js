const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inicializa o SDK com a sua chave (configurada no Azure)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = async function (context, req) {
    context.log('🚀 Processando chat com Gemini');

    try {
        const { message } = req.body || {};
        
        if (!message) {
            context.res = { status: 400, body: { error: "Mensagem vazia" } };
            return;
        }

        // Configura o modelo (Gemini 1.5 Flash é rápido e económico)
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            systemInstruction: "Tu és o assistente da Fernandes Technology. Seja profissional, prestativo e responda em português. André Fernandes é o fundador."
        });

        // Gera a resposta
        const result = await model.generateContent(message);
        const response = await result.response;
        const text = response.text();

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                reply: text,
                timestamp: new Date().toISOString()
            }
        };

    } catch (error) {
        context.log.error('💥 Erro no Gemini:', error);
        context.res = {
            status: 500,
            body: { error: "Erro ao processar IA", detail: error.message }
        };
    }
};