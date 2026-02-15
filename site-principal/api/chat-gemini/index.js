const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');

module.exports = async function (context, req) {
    const requestId = Math.random().toString(36).substring(7);
    context.log(`🚀 [${requestId}] Função executada`);

    try {
        // ==========================================
        // GET - Health check
        // ==========================================
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

        // ==========================================
        // POST - Processar mensagem
        // ==========================================
        if (req.method === 'POST') {
            const { message, history, lang } = req.body || {};
            context.log(`📝 [${requestId}] Mensagem: "${message}"`);

            if (!message) {
                context.res = {
                    status: 200,
                    body: { reply: "Olá! Como posso ajudar?" }
                };
                return;
            }

            const apiKey = process.env.GROQ_API_KEY;

            if (!apiKey) {
                context.log.error(`❌ [${requestId}] GROQ_API_KEY não configurada`);
                context.res = {
                    status: 200,
                    body: { reply: "Estou com dificuldades técnicas no momento. Tente novamente mais tarde." }
                };
                return;
            }

            // ==========================================
            // TABELA DE FUSOS HORÁRIOS (CORRETA!)
            // ==========================================
            const fusos = {
                // Brasil
                "brasília": { utc: -3, nome: "Brasília" },
                "são paulo": { utc: -3, nome: "São Paulo" },
                "rio": { utc: -3, nome: "Rio de Janeiro" },

                // EUA
                "nova york": { utc: -5, nome: "Nova York", verao: -4 },
                "new york": { utc: -5, nome: "New York", verao: -4 },
                "miami": { utc: -5, nome: "Miami", verao: -4 },
                "chicago": { utc: -6, nome: "Chicago", verao: -5 },
                "denver": { utc: -7, nome: "Denver", verao: -6 },
                "phoenix": { utc: -7, nome: "Phoenix", verao: -7 }, // Arizona NÃO muda!
                "arizona": { utc: -7, nome: "Arizona", verao: -7 }, // Não muda
                "los angeles": { utc: -8, nome: "Los Angeles", verao: -7 },
                "california": { utc: -8, nome: "Califórnia", verao: -7 },
                "san francisco": { utc: -8, nome: "San Francisco", verao: -7 },
                "seattle": { utc: -8, nome: "Seattle", verao: -7 },
                "alaska": { utc: -9, nome: "Alaska", verao: -8 },
                "anchorage": { utc: -9, nome: "Anchorage", verao: -8 },
                "honolulu": { utc: -10, nome: "Honolulu", verao: -10 }, // Havaí não muda
                "havaí": { utc: -10, nome: "Havaí", verao: -10 },

                // Outros
                "londres": { utc: 0, nome: "Londres", verao: 1 },
                "portugal": { utc: 0, nome: "Portugal", verao: 1 },
                "lisboa": { utc: 0, nome: "Lisboa", verao: 1 },
                "tokyo": { utc: 9, nome: "Tóquio", verao: 9 },
                "japão": { utc: 9, nome: "Japão", verao: 9 },
                "australia": { utc: 11, nome: "Austrália (Sydney)", verao: 11 }
            };

            // ==========================================
            // PROMPT DE SISTEMA COM FOCO ABSOLUTO
            // ==========================================
            const systemPrompt = `Você é o assistente virtual OFICIAL e EXCLUSIVO da Fernandes Technology, uma empresa brasileira de tecnologia.

🚫 REGRA DE OURO: Você SOMENTE responde perguntas relacionadas à:
- Fernandes Technology (história, fundador, missão, valores)
- Serviços da empresa (Node.js, React, AWS, Azure, MongoDB, DevOps)
- Contato (e-mail, telefone, website, LinkedIn)
- Orçamentos e propostas (sempre encaminhando para e-mail)
- Tecnologias que a empresa trabalha
- Projetos e cases de sucesso (se houver informação)

⏰ REGRA DE OURO SOBRE HORÁRIOS:
- Horário de funcionamento da Fernandes Technology: Segunda a sexta, das 9h às 18h (horário de Brasília - UTC-3)
- Clientes nos EUA: Horário de Brasília é geralmente 2 horas A FRENTE do horário da costa leste (UTC-5)

📍 EXEMPLOS DE CONVERSÃO CORRETA:
- Alaska (UTC-9): 9h Brasília = 3h Alaska | 18h Brasília = 14h Alaska
- Nova York (UTC-5): 9h Brasília = 7h NY | 18h Brasília = 17h NY
- Califórnia (UTC-8): 9h Brasília = 5h CA | 18h Brasília = 14h CA

PORTANTO, horário comercial da empresa:
- Alaska: 5h às 14h (horário local)
- Arizona: 5h às 14h (horário local) 
- Califórnia: 6h às 15h (horário local)
- Nova York: 9h às 18h (horário local)

TABELA DE FUSOS:
${Object.entries(fusos).map(([key, value]) => `- ${value.nome}: UTC${value.utc >= 0 ? '+' : ''}${value.utc}`).join('\n')}

IMPORTANTE SOBRE HORÁRIO DE VERÃO:
- Arizona (Phoenix) NÃO adota horário de verão
- Havaí NÃO adota horário de verão
- Demais estados dos EUA: verão de março a novembro
- Brasil: verão de outubro a fevereiro

🚫 PERGUNTAS PROIBIDAS (você NÃO responde):
- Traduções ("como diz boa noite em inglês")
- Conhecimentos gerais ("quem descobriu o Brasil")
- Matemática ("quanto é 2+2")
- Entretenimento ("me conte uma piada")
- Clima, previsão do tempo
- Notícias atuais
- Qualquer assunto NÃO relacionado à tecnologia/negócios da empresa

📋 COMO RESPONDER PERGUNTAS FORA DO ESCOPO:
- "Desculpe, sou assistente exclusivo da Fernandes Technology e só posso ajudar com informações sobre a empresa e seus serviços."
- "Meu foco é auxiliar com questões relacionadas à Fernandes Technology. Posso ajudar com informações sobre nossos serviços de desenvolvimento Node.js, React, cloud (AWS/Azure) ou DevOps!"

📋 INFORMAÇÕES OFICIAIS (use estas):
- Fundador: André Fernandes
- Missão: Conectar empresas do Brasil e EUA ao futuro digital
- Especialidades: Node.js, React, AWS, Azure, MongoDB, DevOps, Docker
- Website: https://fernandesit.com
- E-mail: contato@fernandesit.com , https://fernandesit.com/contact.html
- LinkedIn: /company/fernandes-technology
- Horário comercial: Segunda a sexta, 9h às 18h (Brasília)
- Atendimento: Brasil e Estados Unidos

📋 SOBRE ORÇAMENTOS:
- SEMPRE responder: "Para um orçamento personalizado, por favor envie um e-mail para contato@fernandesit.com com os detalhes do seu projeto. Nosso time comercial retornará em até 24h."

🎯 COMPORTAMENTO:
- Responda SEMPRE em ${lang === 'en' ? 'inglês' : 'português do Brasil'}
- Seja profissional, educado e direto
- Mantenha o foco ABSOLUTO nos assuntos da empresa
- NUNCA invente informações - se não souber, diga que não tem essa informação`;

            // Formata as mensagens
            const mensagensFormatadas = [
                { role: "system", content: systemPrompt },
                ...(history?.map(m => ({ role: m.isUser ? "user" : "assistant", content: m.text })) || []),
                { role: "user", content: message }
            ];

            // Modelos em ordem de preferência
            const modelos = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"];
            let reply = null;
            let modeloUsado = null;

            for (const modelo of modelos) {
                try {
                    context.log(`🔄 [${requestId}] Tentando modelo: ${modelo}`);

                    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: modelo,
                            messages: mensagensFormatadas,
                            temperature: 0.5,
                            max_tokens: 400
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        reply = data.choices?.[0]?.message?.content;
                        modeloUsado = modelo;
                        if (reply) {
                            context.log(`✅ [${requestId}] Sucesso com modelo: ${modelo}`);
                            break;
                        }
                    } else {
                        const erro = await response.text();
                        context.log(`⚠️ [${requestId}] Modelo ${modelo} falhou: ${response.status}`);
                    }
                } catch (err) {
                    context.log(`⚠️ [${requestId}] Erro com modelo ${modelo}:`, err.message);
                }
            }

            // Fallback se nenhum modelo funcionar
            if (!reply) {
                reply = "Desculpe, estou processando muitas solicitações agora. Pode repetir a pergunta?";
                context.log(`⚠️ [${requestId}] Usando fallback - todos modelos falharam`);
            }

            // ==========================================
            // SALVAR NO MONGODB (se configurado)
            // ==========================================
            if (process.env.MONGO_CONNECTION_STRING) {
                try {
                    const client = new MongoClient(process.env.MONGO_CONNECTION_STRING);
                    await client.connect();
                    const db = client.db('fernandes_db');

                    // ✅ FORMA CORRETA: Salvar sempre em UTC e tratar na exibição
                    // O MongoDB já salva em UTC por padrão, não precisa ajustar!
                    const dataUTC = new Date(); // Isso já é UTC

                    // Se você quiser SALVAR o horário de Brasília (UTC-3) no banco:
                    // 🔴 ATENÇÃO: Isso NÃO é recomendado! Melhor salvar UTC e converter na hora de exibir.

                    // Opção 1: Salvar UTC (RECOMENDADO)
                    await db.collection('chat_logs').insertOne({
                        requestId,
                        timestamp: dataUTC, // ✅ UTC (recomendado)
                        prompt: message,
                        resposta: reply,
                        modelo: modeloUsado || 'fallback',
                        idioma: lang || 'pt-BR',
                        historico: history?.length || 0
                    });

                    // Opção 2: Se você REALMENTE quer salvar no horário de Brasília:
                    // (NÃO RECOMENDADO - pode causar problemas com fusos)
                    /*
                    const dataBrasil = new Date(dataUTC.getTime() - (3 * 60 * 60 * 1000));
                    await db.collection('chat_logs').insertOne({
                        requestId,
                        timestamp_brasil: dataBrasil, // Horário de Brasília
                        timestamp_utc: dataUTC,        // UTC também para referência
                        prompt: message,
                        resposta: reply,
                        modelo: modeloUsado || 'fallback',
                        idioma: lang || 'pt-BR',
                        historico: history?.length || 0
                    });
                    */

                    await client.close();
                    context.log(`✅ [${requestId}] Conversa salva no MongoDB (UTC)`);
                } catch (dbError) {
                    context.log.error(`❌ [${requestId}] Erro ao salvar no MongoDB:`, dbError.message);
                }
            }

            // Resposta final
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: { reply }
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
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: { reply: "Erro de conexão. Tente novamente!" }
        };
    }
};