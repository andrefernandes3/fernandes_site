const https = require('https');

module.exports = async function (context, req) {
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "https://fernandesit.com", 
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    if (req.method === "OPTIONS") {
        context.res = { status: 204, headers };
        return;
    }

    try {
        let userMessage = "Olá";
        if (req.body && req.body.message) {
            userMessage = req.body.message;
        }

        context.log.info(`Mensagem recebida: "${userMessage}"`);

        const apiKey = process.env.HF_API_KEY; // Crie essa variável no Azure
        if (!apiKey) {
            throw new Error("Variável de ambiente HF_API_KEY não configurada.");
        }

        // Prompt formatado para Llama 3 (System + User)
        const prompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>

Você é a IA da Fernandes Technology. Responda de forma curta, técnica e em português.<|eot_id|><|start_header_id|>user<|end_header_id|>

${userMessage}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`;

        const payload = JSON.stringify({
            inputs: prompt,
            parameters: {
                max_new_tokens: 512,
                temperature: 0.5,
                return_full_text: false
            }
        });

        const options = {
            hostname: 'api-inference.huggingface.co',
            path: '/models/meta-llama/Meta-Llama-3-8B-Instruct',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const hfResponse = await new Promise((resolve, reject) => {
            const apiReq = https.request(options, (apiRes) => {
                let body = '';
                apiRes.on('data', chunk => body += chunk);
                apiRes.on('end', () => {
                    if (apiRes.statusCode >= 200 && apiRes.statusCode < 300) {
                        try {
                            resolve(JSON.parse(body));
                        } catch (e) {
                            reject(new Error(`Resposta inválida: ${body}`));
                        }
                    } else {
                        // Se o modelo estiver carregando (erro 503), avisa
                        if (apiRes.statusCode === 503) {
                            reject(new Error("O modelo está carregando (cold start). Tente novamente em 30 segundos."));
                        } else {
                            reject(new Error(`Erro HF ${apiRes.statusCode}: ${body}`));
                        }
                    }
                });
            });
            apiReq.on('error', reject);
            apiReq.write(payload);
            apiReq.end();
        });

        // A resposta da HF vem como array: [{ generated_text: "..." }]
        const reply = hfResponse[0]?.generated_text?.trim() || "Sem resposta da IA.";

        context.res = {
            status: 200,
            headers,
            body: { reply }
        };

    } catch (err) {
        context.log.error("ERRO NO CHAT:", err);
        context.res = {
            status: 500,
            headers,
            body: { 
                reply: "Erro ao processar sua mensagem.", 
                details: err.message 
            }
        };
    }
};