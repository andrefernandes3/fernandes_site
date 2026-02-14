// api/chat-ia/index.js (versão Gemini)
module.exports = async function (context, req) {
    try {
        const { message } = req.body;
        
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Contexto: Você é assistente da Fernandes Technology, especialista em Node.js, React, AWS e Azure. Responda: ${message}`
                        }]
                    }]
                })
            }
        );

        const data = await response.json();
        
        context.res = {
            status: 200,
            body: {
                reply: data.candidates[0].content.parts[0].text
            }
        };
    } catch (error) {
        context.res = {
            status: 500,
            body: { error: "Erro ao processar" }
        };
    }
};