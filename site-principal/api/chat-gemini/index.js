const fetch = require('node-fetch');

module.exports = async function (context, req) {
    const requestId = Math.random().toString(36).substring(7);
    context.log(`🚀 [${requestId}] Iniciando`);
    
    try {
        // GET - health check
        if (req.method === 'GET') {
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: { 
                    status: 'online',
                    version: '2.0',
                    requestId
                }
            };
            return;
        }

        // POST - processar mensagem
        if (req.method === 'POST') {
            const { message } = req.body || {};
            context.log(`📝 [${requestId}] Mensagem: "${message}"`);

            if (!message) {
                context.res = {
                    status: 400,
                    body: { error: 'Mensagem não fornecida' }
                };
                return;
            }

            const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
            
            if (!GEMINI_API_KEY) {
                context.log.error(`❌ [${requestId}] API Key não configurada`);
                context.res = {
                    status: 500,
                    body: { error: 'Erro de configuração do servidor' }
                };
                return;
            }

            // MODELO CORRETO da sua lista
            const MODELOS = [
                'gemini-2.5-flash',  // ✅ Este está na sua lista
                'gemini-2.0-flash',   // Fallback
                'gemini-pro-latest'    // Último fallback
            ];
            
            let lastError = null;
            let reply = null;

            // Tenta cada modelo até um funcionar
            for (const modelo of MODELOS) {
                try {
                    context.log(`🔄 [${requestId}] Tentando modelo: ${modelo}`);
                    
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`;
                    
                    // Timeout de 10 segundos apenas
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{
                                    text: `Você é assistente da Fernandes Technology. Responda em português de forma natural: ${message}`
                                }]
                            }],
                            generationConfig: {
                                maxOutputTokens: 150,
                                temperature: 0.7
                            }
                        }),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (response.ok) {
                        const data = await response.json();
                        reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        
                        if (reply) {
                            context.log(`✅ [${requestId}] Modelo ${modelo} funcionou!`);
                            break;
                        }
                    } else {
                        const errorText = await response.text();
                        context.log(`⚠️ [${requestId}] Modelo ${modelo} falhou: ${response.status}`);
                        lastError = { status: response.status, body: errorText };
                    }

                } catch (modelError) {
                    context.log(`⚠️ [${requestId}] Erro com modelo ${modelo}:`, modelError.message);
                    lastError = modelError;
                }
            }

            // Se algum modelo funcionou
            if (reply) {
                context.res = {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: { reply }
                };
                return;
            }

            // Nenhum modelo funcionou - retorna resposta amigável
            context.log.error(`❌ [${requestId}] Todos os modelos falharam`);
            
            // RESPOSTA DE FALLBACK amigável
            const fallbackReplies = [
                "Olá! No momento estou com dificuldades técnicas. Por favor, tente novamente em alguns instantes ou entre em contato pelo e-mail contato@fernandesit.com.",
                "Desculpe, estou enfrentando uma instabilidade. Você pode me perguntar novamente ou enviar um e-mail para contato@fernandesit.com.",
                "Ops! Algo deu errado. Tente novamente ou fale conosco pelo e-mail contato@fernandesit.com."
            ];
            
            context.res = {
                status: 200, // 200 mesmo em erro para não quebrar o front
                headers: { 'Content-Type': 'application/json' },
                body: { 
                    reply: fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)],
                    fallback: true
                }
            };
            return;
        }

        // Método não permitido
        context.res = {
            status: 405,
            body: { error: 'Método não permitido' }
        };

    } catch (error) {
        context.log.error('💥 [${requestId}] Erro fatal:', error);
        
        // SEMPRE retornar algo para o front
        context.res = {
            status: 200, // 200 para não quebrar o front
            headers: { 'Content-Type': 'application/json' },
            body: { 
                reply: "Estou com dificuldades técnicas no momento. Por favor, tente novamente mais tarde ou envie um e-mail para contato@fernandesit.com.",
                error: true
            }
        };
    }
};