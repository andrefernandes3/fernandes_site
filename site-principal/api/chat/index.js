const https = require('https');

module.exports = async function (context, req) {
    const headers = { "Content-Type": "application/json" };
    
    try {
        // --- CORREÇÃO DE SEGURANÇA AQUI ---
        // Verifica se req.body existe antes de tentar ler
        let userMessage = "Olá"; // Valor padrão

        if (req.body && req.body.message) {
            userMessage = req.body.message;
        } else if (typeof req.body === "string") {
            // Às vezes o Azure envia o body como texto puro
            try {
                const parsed = JSON.parse(req.body);
                userMessage = parsed.message || "Olá";
            } catch (e) {
                userMessage = req.body;
            }
        }
        
        context.log("Mensagem processada:", userMessage);

        // Validação da Chave
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error("Chave GROQ_API_KEY não configurada no Azure.");
        }

        // Configura a requisição para a Groq
        const data = JSON.stringify({
            messages: [
                {
                    role: "system",
                    content: "Você é a IA da Fernandes Technology (Consultoria TI, Azure, Node.js). Responda de forma curta, técnica e em português."
                },
                { role: "user", content: userMessage }
            ],
            model: "llama3-8b-8192",
            temperature: 0.5
        });

        const options = {
            hostname: 'api.groq.com',
            path: '/openai/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(data)
            }
        };

        // Chamada nativa
        const groqResponse = await new Promise((resolve, reject) => {
            const reqApi = https.request(options, (resApi) => {
                let body = '';
                resApi.on('data', (chunk) => body += chunk);
                resApi.on('end', () => {
                    if (resApi.statusCode >= 200 && resApi.statusCode < 300) {
                        try {
                            resolve(JSON.parse(body));
                        } catch (e) {
                            reject(new Error("Resposta da Groq não é um JSON válido."));
                        }
                    } else {
                        reject(new Error(`Erro API Groq (${resApi.statusCode}): ${body}`));
                    }
                });
            });
            reqApi.on('error', (e) => reject(e));
            reqApi.write(data);
            reqApi.end();
        });

        const replyText = groqResponse.choices?.[0]?.message?.content || "Sem resposta da IA.";

        context.res = {
            status: 200,
            headers: headers,
            body: { reply: replyText }
        };

    } catch (error) {
        context.log.error("ERRO NO CHAT:", error.message);
        
        context.res = {
            status: 500,
            headers: headers,
            body: { reply: `Erro no servidor: ${error.message}` } 
        };
    }
};