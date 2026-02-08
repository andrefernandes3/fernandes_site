const https = require('https');

module.exports = async function (context, req) {
    // 1. Prepara a resposta padrão (JSON)
    const headers = { "Content-Type": "application/json" };
    
    try {
        // 2. Valida a Chave
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error("Chave GROQ_API_KEY não configurada no servidor.");
        }

        const userMessage = req.body.message || "Olá";

        // 3. Configura a requisição para a Groq
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
                'Content-Length': data.length
            }
        };

        // 4. Executa a chamada (Sem usar fetch/axios)
        const groqResponse = await new Promise((resolve, reject) => {
            const reqApi = https.request(options, (resApi) => {
                let body = '';
                resApi.on('data', (chunk) => body += chunk);
                resApi.on('end', () => {
                    if (resApi.statusCode >= 200 && resApi.statusCode < 300) {
                        resolve(JSON.parse(body));
                    } else {
                        reject(new Error(`Erro API Groq (${resApi.statusCode}): ${body}`));
                    }
                });
            });
            reqApi.on('error', (e) => reject(e));
            reqApi.write(data);
            reqApi.end();
        });

        const replyText = groqResponse.choices[0]?.message?.content || "Sem resposta.";

        // 5. Sucesso!
        context.res = {
            status: 200,
            headers: headers,
            body: { reply: replyText }
        };

    } catch (error) {
        context.log.error("Erro Chat:", error.message);
        
        // Retorna ERRO EM JSON para o frontend não quebrar
        context.res = {
            status: 500,
            headers: headers,
            body: { reply: `Erro no servidor: ${error.message}` } 
        };
    }
};