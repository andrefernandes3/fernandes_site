const https = require('https');

module.exports = async function (context, req) {
    // Cabeçalhos básicos + CORS
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "https://fernandesit.com",           // ← ajuste para seu domínio em produção (ex: https://seusite.com)
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    // Trata requisição OPTIONS (pré-flight CORS)
    if (req.method === "OPTIONS") {
        context.res = { status: 204, headers };
        return;
    }

    try {
        // --- Leitura segura do body ---
        let userMessage = "Olá";
        if (req.body) {
            if (typeof req.body === 'object' && req.body.message) {
                userMessage = req.body.message;
            } else if (typeof req.body === 'string') {
                try {
                    const parsed = JSON.parse(req.body);
                    userMessage = parsed.message || req.body.trim() || "Olá";
                } catch {
                    userMessage = req.body.trim() || "Olá";
                }
            }
        }

        context.log.info(`Mensagem recebida: "${userMessage}"`);

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error("Variável de ambiente GROQ_API_KEY não configurada no Azure.");
        }

        const payload = {
            messages: [
                {
                    role: "system",
                    content: "Você é a IA da Fernandes Technology (Consultoria TI, Azure, Node.js). Responda de forma curta, técnica e em português."
                },
                { role: "user", content: userMessage }
            ],
            model: "llama3-8b-8192",
            temperature: 0.5,
            max_tokens: 512
        };

        const data = JSON.stringify(payload);

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

        const groqResponse = await new Promise((resolve, reject) => {
            const apiReq = https.request(options, (apiRes) => {
                let body = '';
                apiRes.on('data', chunk => body += chunk);
                apiRes.on('end', () => {
                    if (apiRes.statusCode >= 200 && apiRes.statusCode < 300) {
                        try {
                            resolve(JSON.parse(body));
                        } catch (e) {
                            reject(new Error(`Resposta Groq inválida (não-JSON): ${body.substring(0, 200)}`));
                        }
                    } else {
                        reject(new Error(`Groq erro ${apiRes.statusCode}: ${body.substring(0, 300)}`));
                    }
                });
            });

            apiReq.on('error', reject);
            apiReq.write(data);
            apiReq.end();
        });

        const reply = groqResponse.choices?.[0]?.message?.content?.trim() 
            || "Sem resposta válida da IA.";

        context.res = {
            status: 200,
            headers,
            body: { reply }
        };

    } catch (err) {
        context.log.error("ERRO NO CHAT:", err);

        let errorMsg = "Erro interno no servidor.";
        let status = 500;

        if (err.message.includes("GROQ_API_KEY")) {
            errorMsg = "Configuração incompleta no servidor (chave da API ausente).";
            status = 503; // Service Unavailable
        } else if (err.message.includes("Groq erro")) {
            errorMsg = "Erro na comunicação com a IA. Tente novamente mais tarde.";
        }

        context.res = {
            status,
            headers,
            body: { reply: errorMsg, details: err.message }
        };
    }
};