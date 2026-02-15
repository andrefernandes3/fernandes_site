const fetch = require('node-fetch');

module.exports = async function (context, req) {
    // TIMESTAMP para rastrear
    const startTime = new Date().toISOString();
    context.log(`🚀 [${startTime}] Função iniciada`);
    
    try {
        // === TESTE 1: GET ===
        if (req.method === 'GET') {
            context.log('📊 Requisição GET recebida');
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: { 
                    status: 'online',
                    timestamp: startTime,
                    message: 'API funcionando!'
                }
            };
            context.log('✅ GET respondido');
            return;
        }

        // === TESTE 2: POST ===
        if (req.method === 'POST') {
            context.log('📥 Requisição POST recebida');
            
            // Verificar body
            if (!req.body) {
                context.log.warn('⚠️ Body vazio');
                context.res = {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: { error: 'Body não fornecido' }
                };
                return;
            }

            const { message } = req.body;
            context.log(`📝 Mensagem: "${message}"`);

            if (!message) {
                context.res = {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: { error: 'Mensagem não fornecida' }
                };
                return;
            }

            // Verificar API Key
            const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
            context.log(`🔑 API Key presente: ${GEMINI_API_KEY ? 'SIM' : 'NÃO'}`);
            
            if (!GEMINI_API_KEY) {
                context.log.error('❌ API Key não configurada');
                context.res = {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                    body: { error: 'API Key não configurada no servidor' }
                };
                return;
            }

            // Preparar chamada ao Gemini
            const model = 'gemini-2.5-flash'; // Modelo confirmado na sua lista
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
            
            context.log(`🌐 Chamando Gemini com modelo: ${model}`);
            
            // Fazer a requisição com timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 segundos timeout
            
            try {
                const fetchResponse = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: `Você é assistente da Fernandes Technology. Responda em português: ${message}`
                            }]
                        }],
                        generationConfig: {
                            maxOutputTokens: 200,
                            temperature: 0.7
                        }
                    }),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                context.log(`📡 Status Gemini: ${fetchResponse.status}`);

                // Tentar ler a resposta mesmo se não for OK
                const responseText = await fetchResponse.text();
                context.log(`📄 Resposta bruta: ${responseText.substring(0, 200)}...`);
                
                // Tentar parsear como JSON
                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (e) {
                    context.log.error('❌ Resposta não é JSON válido');
                    context.res = {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' },
                        body: { 
                            error: 'Resposta inválida do Gemini',
                            raw: responseText.substring(0, 100)
                        }
                    };
                    return;
                }

                if (!fetchResponse.ok) {
                    context.log.error('❌ Erro Gemini:', data.error);
                    context.res = {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' },
                        body: { 
                            error: 'Erro na API do Gemini',
                            details: data.error?.message || 'Erro desconhecido'
                        }
                    };
                    return;
                }

                // Extrair resposta
                const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
                
                if (!reply) {
                    context.log.error('❌ Resposta vazia do Gemini');
                    context.res = {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' },
                        body: { error: 'Gemini retornou resposta vazia' }
                    };
                    return;
                }

                context.log('✅ Resposta gerada com sucesso');
                context.res = {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: { reply }
                };
                
            } catch (fetchError) {
                clearTimeout(timeoutId);
                context.log.error('❌ Erro no fetch:', fetchError.message);
                
                if (fetchError.name === 'AbortError') {
                    context.res = {
                        status: 504,
                        headers: { 'Content-Type': 'application/json' },
                        body: { error: 'Timeout na chamada ao Gemini' }
                    };
                } else {
                    context.res = {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' },
                        body: { error: `Erro na chamada: ${fetchError.message}` }
                    };
                }
            }
            
            return;
        }

        // Método não permitido
        context.log(`❌ Método não suportado: ${req.method}`);
        context.res = {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
            body: { error: 'Método não permitido' }
        };

    } catch (error) {
        // Erro NÃO CAPTURADO (o pior tipo)
        context.log.error('💥 ERRO CATASTRÓFICO NÃO CAPTURADO:', error);
        context.log.error('Stack:', error.stack);
        
        // SEMPRE retornar JSON, mesmo em erro
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: { 
                error: 'Erro interno no servidor',
                details: error.message,
                type: error.name
            }
        };
    } finally {
        const endTime = new Date().toISOString();
        context.log(`🏁 [${endTime}] Função finalizada`);
    }
};