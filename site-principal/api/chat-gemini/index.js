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
            context.log(`📚 Histórico recebido: ${history?.length || 0} mensagens`);

            if (!message) {
                context.res = { status: 200, body: { reply: "Olá! Como posso ajudar?" } };
                return;
            }

            const apiKey = process.env.GROQ_API_KEY;
            
            if (!apiKey) {
                context.res = { status: 200, body: { reply: "Estou com dificuldades técnicas." } };
                return;
            }

            // Formata as mensagens para a Groq
            const mensagensFormatadas = [];
            
            // Instrução de sistema
            mensagensFormatadas.push({
                role: "system",
                content: `Você é o assistente da Fernandes Technology. 
                Fundador: André Fernandes.
                Especialidades: Node.js, React, AWS, Azure, MongoDB, DevOps.
                Website: https://fernandesit.com
                E-mail: contato@fernandesit.com
                Responda em ${lang === 'en' ? 'inglês' : 'português do Brasil'} de forma profissional e amigável.
                MANTENHA O CONTEXTO da conversa!`
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
                            temperature: 0.7,
                            max_tokens: 500
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
                body: { reply: reply || "Pode repetir a pergunta?" }
            };
            return;
        }

        context.res = { status: 405, body: { error: 'Método não permitido' } };

    } catch (error) {
        context.log.error('Erro:', error);
        context.res = { status: 200, body: { reply: "Erro de conexão. Tente novamente!" } };
    }
};