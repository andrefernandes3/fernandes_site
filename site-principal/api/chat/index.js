const https = require('https');

module.exports = async function (context, req) {
    const headers = { "Content-Type": "application/json" };
    
    try {
        // --- 1. SEGURANÇA NA LEITURA DA MENSAGEM ---
        let userMessage = "Olá"; // Valor padrão para não quebrar

        // Tenta ler do body (POST)
        if (req.body && req.body.message) {
            userMessage = req.body.message;
        } 
        // Tenta ler da query (GET - útil para testes no navegador)
        else if (req.query && req.query.message) {
            userMessage = req.query.message;
        }
        
        context.log("Mensagem recebida:", userMessage);

        // --- 2. VALIDAÇÃO DA CHAVE ---
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) throw new Error("Chave GROQ_API_KEY não configurada no servidor.");

        // --- 3. REQUISIÇÃO PARA GROQ (Nativa) ---
        const requestData = JSON.stringify({
            messages: [
                { 
                    role: "system", 
                    content: "Você é a IA da Fernandes Technology (Consultoria TI, Azure, Node.js). Responda de forma curta, técnica e em português do Brasil." 
                },
                { role: "user", content: userMessage }
            ],
            model: "llama3-8b-8192", // Modelo rápido e estável
            temperature: 0.5,
            max_tokens: 300
        });

        const options = {
            hostname: 'api.groq.com',
            path: '/openai/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(requestData)
            }
        };

        const apiResponse = await new Promise((resolve, reject) => {
            const request = https.request(options, (response) => {
                let body = '';
                response.on('data', chunk => body += chunk);
                response.on('end', () => {
                    try {
                        const jsonResponse = JSON.parse(body || '{}');
                        resolve({ status: response.statusCode, data: jsonResponse });
                    } catch (e) {
                        reject(new Error("Erro ao processar resposta da Groq."));
                    }
                });
            });
            request.on('error', (e) => reject(e));
            request.write(requestData);
            request.end();
        });

        // --- 4. TRATAMENTO DA RESPOSTA ---
        if (apiResponse.status !== 200) {
            const errorMsg = apiResponse.data.error?.message || "Erro desconhecido na IA";
            throw new Error(`Groq API Error: ${errorMsg}`);
        }

        const replyText = apiResponse.data.choices?.[0]?.message?.content || "Desculpe, não consegui formular uma resposta.";

        context.res = {
            status: 200,
            headers: headers,
            body: { reply: replyText }
        };

    } catch (error) {
        context.log.error("ERRO CRÍTICO NO CHAT:", error.message);
        
        context.res = {
            status: 500,
            headers: headers,
            body: { reply: `Erro no servidor: ${error.message}` } 
        };
    }
};