const https = require('https');

module.exports = async function (context, req) {
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // Aberto para facilitar testes iniciais
        "Access-Control-Allow-Methods": "POST, OPTIONS"
    };

    if (req.method === "OPTIONS") {
        context.res = { status: 204, headers };
        return;
    }

    try {
        const userMessage = req.body?.message || "Olá";
        const apiKey = process.env.HF_API_KEY;

        if (!apiKey) {
            context.res = { status: 500, headers, body: { reply: "Erro: HF_API_KEY não configurada no Azure." } };
            return;
        }

        const payload = JSON.stringify({
            inputs: `Contexto: Você é o assistente técnico da Fernandes Technology. Responda de forma curta em português.\nPergunta: ${userMessage}\nResposta:`,
            parameters: { max_new_tokens: 250, temperature: 0.7 }
        });

        const options = {
            hostname: 'api-inference.huggingface.co',
            path: '/models/facebook/blenderbot-400M-distill', // Modelo gratuito e leve (rápido)
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const result = await new Promise((resolve, reject) => {
            const apiReq = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve({ status: res.statusCode, body: data }));
            });
            apiReq.on('error', reject);
            apiReq.write(payload);
            apiReq.end();
        });

        const parsed = JSON.parse(result.body);
        // O Blenderbot retorna um objeto diferente do Llama
        const reply = parsed.generated_text || parsed[0]?.generated_text || "Estou processando sua dúvida...";

        context.res = { status: 200, headers, body: { reply } };

    } catch (err) {
        context.log.error("Erro interno:", err);
        context.res = { status: 500, headers, body: { reply: "Erro ao conectar com a IA." } };
    }
};