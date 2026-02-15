const fetch = require('node-fetch');

module.exports = async function (context, req) {
    context.log('🚀 Função executada');

    try {
        if (req.method === 'GET') {
            context.res = { status: 200, body: { status: 'online' } };
            return;
        }

        if (req.method === 'POST') {
            const { message, history, lang } = req.body || {};
            context.log(`📝 Mensagem: "${message}"`);

            if (!message) {
                context.res = { status: 200, body: { reply: "Olá! Como posso ajudar?" } };
                return;
            }

            const apiKey = process.env.GROQ_API_KEY;

            if (!apiKey) {
                context.res = { status: 200, body: { reply: "Estou com dificuldades técnicas." } };
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
            - Alaska (UTC-9): Quando são 9h em Brasília (UTC-3), são 3h no Alaska (UTC-9)
            - Nova York (UTC-5): Quando são 9h em Brasília, são 7h em Nova York
            - Califórnia (UTC-8): Quando são 9h em Brasília, são 5h na Califórnia
            
            Para falar com a Fernandes Technology durante nosso horário comercial (9h-18h Brasília):
            - Alaska (UTC-9): Das 15h às 23h no horário do Alaska? NÃO! Isso está ERRADO!
            
            CONTA CORRETA:
            - Se são 9h em Brasília (UTC-3), no Alaska (UTC-9) são: 9h - 4h = 5h
            - Se são 18h em Brasília (UTC-3), no Alaska (UTC-9) são: 18h - 4h = 14h
            
            PORTANTO, horário comercial da empresa no Alaska:
            ✅ DAS 5h ÀS 14h (horário do Alaska)
            
            Se o cliente disser "das 15h às 18h no horário do Alaska", isso corresponde a:
            - 15h no Alaska = 19h em Brasília (fora do horário comercial)
            - 18h no Alaska = 22h em Brasília (fora do horário comercial)

            TABELA DE FUSOS (use como referência):
${Object.entries(fusos).map(([key, value]) => `- ${value.nome}: UTC${value.utc >= 0 ? '+' : ''}${value.utc}`).join('\n')}

            IMPORTANTE SOBRE HORÁRIO DE VERÃO:
             Arizona (Phoenix) NÃO adota horário de verão
            - Havaí NÃO adota horário de verão
            - Demais estados dos EUA: verão de março a novembro (UTC-4, -5, -6, -7)
            - Brasil: verão de outubro a fevereiro (UTC-2)

            🚫 PERGUNTAS PROIBIDAS (você NÃO responde):
            - Traduções ("como diz boa noite em inglês")
            - Conhecimentos gerais ("quem descobriu o Brasil")
            - Matemática ("quanto é 2+2")
            - Entretenimento ("me conte uma piada")
            - Clima, previsão do tempo
            - Notícias atuais
            - Qualquer assunto NÃO relacionado à tecnologia/negócios da empresa
            - Conselhos pessoais
            - Tópicos políticos ou religiosos
            - Piadas ou conversas casuais

            📋 COMO RESPONDER PERGUNTAS FORA DO ESCOPO:
            - "Desculpe, sou assistente exclusivo da Fernandes Technology e só posso ajudar com informações sobre a empresa e seus serviços. Para outras perguntas, recomendo consultar um especialista no assunto."
            - "Meu foco é auxiliar com questões relacionadas à Fernandes Technology. Posso ajudar com informações sobre nossos serviços de desenvolvimento Node.js, React, cloud (AWS/Azure) ou DevOps!"
            - "Essa pergunta está fora do meu escopo. Posso ajudar com informações sobre a Fernandes Technology, como nossos serviços de consultoria em nuvem ou desenvolvimento de software."

            📋 INFORMAÇÕES OFICIAIS (use estas):
            - Fundador: André Fernandes
            - Missão: Conectar empresas do Brasil e EUA ao futuro digital
            - Especialidades: Node.js, React, AWS, Azure, MongoDB, DevOps, Docker
            - Website: https://fernandesit.com
            - E-mail: contato@fernandesit.com , https://fernandesit.com/contact.html
            - LinkedIn: /company/fernandes-technology
            - Horário comercial: Segunda a sexta, 9h às 18h
            - Atendimento: Brasil e Estados Unidos

            📋 SOBRE ORÇAMENTOS:
            - SEMPRE responder: "Para um orçamento personalizado, por favor envie um e-mail para contato@fernandesit.com com os detalhes do seu projeto. Nosso time comercial retornará em até 24h."

            🎯 COMPORTAMENTO:
            - Responda SEMPRE em ${lang === 'en' ? 'inglês' : 'português do Brasil'}
            - Seja profissional, educado e direto
            - Mantenha o foco ABSOLUTO nos assuntos da empresa
            - Se a pergunta for sobre tecnologias que a empresa NÃO trabalha, diga que não oferecem esse serviço
            - NUNCA invente informações - se não souber, diga que não tem essa informação`;

            // Formata as mensagens
            const mensagensFormatadas = [];

            // Adiciona sistema
            mensagensFormatadas.push({
                role: "system",
                content: systemPrompt
            });

            // Adiciona histórico (se existir)
            if (history && Array.isArray(history)) {
                history.forEach(msg => {
                    mensagensFormatadas.push({
                        role: msg.isUser ? "user" : "assistant",
                        content: msg.text
                    });
                });
            }

            // Adiciona mensagem atual
            mensagensFormatadas.push({
                role: "user",
                content: message
            });

            // Modelos em ordem de preferência
            const modelos = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"];
            let reply = null;

            for (const modelo of modelos) {
                try {
                    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: modelo,
                            messages: mensagensFormatadas,
                            temperature: 0.5, // Mais baixo para respostas mais consistentes
                            max_tokens: 400
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        reply = data.choices?.[0]?.message?.content;
                        if (reply) break;
                    }
                } catch (err) {
                    context.log(`Modelo ${modelo} falhou:`, err.message);
                }
            }

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: { reply: reply || "Desculpe, não entendi. Pode perguntar sobre nossos serviços?" }
            };
            return;
        }

        context.res = { status: 405, body: { error: 'Método não permitido' } };

    } catch (error) {
        context.log.error('Erro:', error);
        context.res = { status: 200, body: { reply: "Erro de conexão. Tente novamente!" } };
    }
};