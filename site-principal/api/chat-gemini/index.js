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
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                    body: { 
                        reply: "Estou com dificuldades técnicas. Tente novamente mais tarde.",
                        fallback: true
                    }
                };
                return;
            }

            // ==========================================
            // CHAMADA À API GROQ
            // ==========================================
            
            const url = "https://api.groq.com/openai/v1/chat/completions";
            
            // Lista de modelos gratuitos da Groq (todos gratuitos!)
            const modelos = [
                "llama3-8b-8192",      // Mais rápido
                "llama3-70b-8192",     // Mais potente
                "mixtral-8x7b-32768",  // Alternativa
                "gemma2-9b-it"         // Outra opção
            ];
            
            let reply = null;
            let tentativas = 0;
            
            // Tenta até 3 vezes com modelos diferentes
            while (tentativas < modelos.length && !reply) {
                const modelo = modelos[tentativas];
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
                                    - Missão: Conectar empresas do Brasil e EUA ao futuro digital
                                    - Especialidades: Node.js, React, AWS, Azure, MongoDB, DevOps e IA
                                    - Website: https://fernandesit.com
                                    - Contato: contato@fernandesit.com
                                    
                                    Regras:
                                    1. Responda em português do Brasil
                                    2. Seja profissional mas amigável
                                    3. Se não souber algo, sugira contato por e-mail
                                    4. Mantenha respostas concisas` 
                                },
                                { role: "user", content: message }
                            ],
                            temperature: 0.7,
                            max_tokens: 200
                        })
                    });

                    const data = await response.json();
                    
                    if (!response.ok) {
                        context.log(`⚠️ [${requestId}] Modelo ${modelo} falhou:`, data.error?.message);
                        continue; // Tenta próximo modelo
                    }

                    reply = data.choices?.[0]?.message?.content;
                    
                    if (reply) {
                        context.log(`✅ [${requestId}] Sucesso com modelo ${modelo}!`);
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

            // Fallback amigável
            const fallbacks = [
                "Olá! Estou processando muitas solicitações agora. Pode repetir a pergunta?",
                "Desculpe, tive uma pequena instabilidade. Me diga novamente?",
                "Estou aqui! Só um momento de sobrecarga. Pode repetir?",
                "Ops! A conexão falhou. O que você disse mesmo?"
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