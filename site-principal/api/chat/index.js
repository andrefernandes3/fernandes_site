const https = require('https');

module.exports = async function (context, req) {
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
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
            context.res = { status: 500, headers, body: { reply: "Erro: Chave API não configurada no Azure." } };
            return;
        }

        // Usando o modelo da Microsoft (DialoGPT) - Excelente para chats rápidos e gratuitos
        const model = "microsoft/DialoGPT-medium";
        
        const payload = JSON.stringify({
            inputs: userMessage,
            parameters: { max_new_tokens: 100, temperature: 0.7 }
        });

        const result = await new Promise((resolve, reject) => {
            const apiReq = https.request({
                hostname: 'api-inference.huggingface.co',
                path: `/models/${model}`,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve({ status: res.statusCode, body: data }));
            });
            apiReq.on('error', reject);
            apiReq.write(payload);
            apiReq.end();
        });

        const parsed = JSON.parse(result.body);
        context.log("Resposta da IA:", parsed); // Isso ajuda a ver o erro no Log do Azure

        // Lógica "Caça-Resposta": Tenta encontrar o texto em diferentes formatos comuns
        let reply = "Desculpe, não consegui processar. Tente novamente.";
        
        if (parsed.error) {
            // Se o modelo estiver carregando, avisa o usuário
            reply = parsed.estimated_time ? "A IA está acordando... tente enviar de novo em 20 segundos." : parsed.error;
        } else if (Array.isArray(parsed) && parsed[0]?.generated_text) {
            reply = parsed[0].generated_text;
        } else if (parsed.generated_text) {
            reply = parsed.generated_text;
        }

        context.res = { status: 200, headers, body: { reply } };

    } catch (err) {
        context.res = { status: 500, headers, body: { reply: "Erro na comunicação com o servidor." } };
    }
};