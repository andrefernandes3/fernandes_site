const fetch = require('node-fetch');

module.exports = async function (context, req) {
    const requestId = Math.random().toString(36).substring(7);
    context.log(`🚀 [${requestId}] Iniciando com Groq`);
    
    try {
        if (req.method === 'GET') {
            context.res = { 
                status: 200, 
                headers: { 'Content-Type': 'application/json' },
                body: { status: 'online', engine: 'Groq' } 
            };
            return;
        }

        if (req.method === 'POST') {
            const { message } = req.body || {};
            context.log(`📝 [${requestId}] Mensagem: "${message}"`);

            if (!message) {
                context.res = {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: { error: 'Mensagem não fornecida' }
                };
                return;
            }

            const apiKey = process.env.GROQ_API_KEY;
            context.log(`🔑 [${requestId}] API Key presente: ${apiKey ? 'SIM' : 'NÃO'}`);

            if (!apiKey) {
                context.log.error(`❌ [${requestId}] API Key não configurada`);
                context.res = {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: { 
                        reply: "Estou com dificuldades técnicas. Tente novamente mais tarde.",
                        fallback: true
                    }
                };
                return;
            }

            // ==========================================
            // MODELOS GROQ CONFIRMADOS (2026)
            // ==========================================
            
            const url = "https://api.groq.com/openai/v1/chat/completions";
            
            // ✅ MODELOS QUE FUNCIONAM GARANTIDO
            const modelos = [
                "llama-3.3-70b-versatile",     // Meta - Versátil e rápido
                "llama-3.1-8b-instant",        // Meta - Super rápido
                "gemma2-9b-it",                 // Google - Bom equilíbrio
                "mixtral-8x7b-32768",           // Mistral - Contexto grande
                "llama-3.2-3b-preview",         // Pequeno e rápido
                "llama-3.2-1b-preview"          // Minúsculo e instantâneo
            ];
            
            let reply = null;
            let tentativas = 0;
            
            // Tenta cada modelo em ordem
            for (const modelo of modelos) {
                tentativas++;
                
                try {
                    context.log(`🔄 [${requestId}] Tentativa ${tentativas} - Modelo: ${modelo}`);
                    
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: modelo,
                            messages: [
                                { 
                                    role: "system", 
                                    content: `Você é o assistente oficial da Fernandes Technology.
                                    
                                    INFORMAÇÕES DA EMPRESA:
                                    - Fundador: André Fernandes
                                    - Especialidades: Node.js, React, AWS, Azure, MongoDB, DevOps
                                    - Website: https://fernandesit.com
                                    - Contato: contato@fernandesit.com
                                    - Missão: Conectar empresas do Brasil e EUA ao futuro digital
                                    
                                    Regras de atendimento:
                                    1. Responda sempre em português do Brasil
                                    2. Seja profissional mas amigável
                                    3. Mantenha respostas claras e diretas
                                    4. Se não souber algo, sugira contato por e-mail` 
                                },
                                { role: "user", content: message }
                            ],
                            temperature: 0.7,
                            max_tokens: 300
                        })
                    });

                    const data = await response.json();
                    
                    if (!response.ok) {
                        context.log(`⚠️ [${requestId}] Modelo ${modelo} falhou:`, data.error?.message);
                        continue;
                    }

                    reply = data.choices?.[0]?.message?.content;
                    
                    if (reply) {
                        context.log(`✅ [${requestId}] SUCESSO com modelo ${modelo}!`);
                        break;
                    }

                } catch (err) {
                    context.log(`⚠️ [${requestId}] Erro com modelo ${modelo}:`, err.message);
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

            // Fallback amigável se todos falharem
            context.log.error(`❌ [${requestId}] Todos os modelos falharam`);
            
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: { 
                    reply: "Estou processando muitas solicitações agora. Pode repetir a pergunta?",
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