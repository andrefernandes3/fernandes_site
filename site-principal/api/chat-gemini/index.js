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