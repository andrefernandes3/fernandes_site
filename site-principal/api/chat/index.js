const https = require('https');

module.exports = async function (context, req) {
    const headers = { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" // Permite testes em qualquer domínio
    };

    try {
        const apiKey = process.env.HF_API_KEY;
        const userMsg = req.body?.message;

        if (!apiKey || !userMsg) {
            context.res = { status: 400, headers, body: { reply: "Erro: Chave ou mensagem ausente." } };
            return;
        }

        const payload = JSON.stringify({ inputs: userMsg });

        const response = await new Promise((resolve, reject) => {
            const apiReq = https.request({
                hostname: 'api-inference.huggingface.co',
                path: '/models/microsoft/DialoGPT-medium',
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
            }, res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
            });
            apiReq.on('error', reject);
            apiReq.write(payload);
            apiReq.end();
        });

        // TRATAMENTO DE RESPOSTA ROBUSTO
        let botReply = "";
        if (response.status === 503) {
            botReply = "Estou ligando meus motores... envie a mensagem novamente em 20 segundos!";
        } else if (response.body.error) {
            botReply = "Tive um soluço técnico. Pode repetir?";
        } else {
            // O DialoGPT pode retornar string ou array
            botReply = response.body.generated_text || response.body[0]?.generated_text || "Não entendi, pode falar de outro jeito?";
        }

        context.res = { status: 200, headers, body: { reply: botReply } };

    } catch (err) {
        context.res = { status: 500, headers, body: { reply: "Erro crítico no servidor." } };
    }
};