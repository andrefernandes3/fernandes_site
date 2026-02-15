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
                body: { status: 'online', requestId }
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
                    body: { error: 'Erro de configuração' }
                };
                return;
            }

            // ==========================================
            // SISTEMA DE RETRY AUTOMÁTICO
            // ==========================================
            
            const MODELOS = [
                'gemini-2.5-flash',
                'gemini-2.0-flash',
                'gemini-pro-latest'
            ];
            
            let tentativas = 0;
            const MAX_TENTATIVAS = 3;
            let reply = null;
            
            // Tenta até 3 vezes com diferentes modelos
            while (tentativas < MAX_TENTATIVAS && !reply) {
                tentativas++;
                
                for (const modelo of MODELOS) {
                    try {
                        context.log(`🔄 [${requestId}] Tentativa ${tentativas} - Modelo: ${modelo}`);
                        
                        // Delay entre tentativas (exponencial)
                        if (tentativas > 1) {
                            const delay = 1000 * Math.pow(2, tentativas - 1);
                            context.log(`⏳ [${requestId}] Aguardando ${delay}ms...`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                        
                        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`;
                        
                        // Timeout de 15 segundos
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 15000);

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
                                context.log(`✅ [${requestId}] Sucesso na tentativa ${tentativas} com ${modelo}!`);
                                break;
                            }
                        } else {
                            const errorText = await response.text();
                            context.log(`⚠️ [${requestId}] Modelo ${modelo} falhou: ${response.status}`);
                            
                            // Se for erro 429 (rate limit), tenta próximo modelo imediatamente
                            if (response.status === 429) {
                                context.log(`⏰ [${requestId}] Rate limit detectado, tentando outro modelo...`);
                                continue;
                            }
                        }

                    } catch (modelError) {
                        context.log(`⚠️ [${requestId}] Erro com modelo ${modelo}:`, modelError.message);
                        
                        // Se for erro de timeout, tenta próximo
                        if (modelError.name === 'AbortError') {
                            context.log(`⏰ [${requestId}] Timeout, tentando outro modelo...`);
                        }
                    }
                }
            }

            // Se conseguiu resposta
            if (reply) {
                context.res = {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: { reply }
                };
                return;
            }

            // ==========================================
            // RESPOSTAS DE FALLBACK VARIADAS
            // ==========================================
            
            context.log.error(`❌ [${requestId}] Todas tentativas falharam`);
            
            const fallbacks = [
                "Olá! Estou com um pouco de movimento agora. Pode repetir a pergunta?",
                "Desculpe, estou processando muitas solicitações. Pode tentar novamente?",
                "Ops! A conexão deu uma instabilidade. Me pergunte de novo?",
                "Estou aqui! Só um momento de sobrecarga. Pode repetir?",
                "Peço desculpas, tive uma pequena falha. O que você disse mesmo?"
            ];
            
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: { 
                    reply: fallbacks[Math.floor(Math.random() * fallbacks.length)],
                    fallback: true
                }
            };
            return;
        }

        context.res = {
            status: 405,
            body: { error: 'Método não permitido' }
        };

    } catch (error) {
        context.log.error('💥 Erro fatal:', error);
        
        // ÚLTIMO RECURSO - sempre retorna algo
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: { 
                reply: "Estou com dificuldades técnicas. Por favor, tente novamente em alguns instantes.",
                fallback: true
            }
        };
    }
};