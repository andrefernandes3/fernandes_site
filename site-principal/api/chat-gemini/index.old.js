const fetch = require('node-fetch');

module.exports = async function (context, req) {
    context.log('========== INÍCIO ==========');
    
    try {
        if (req.method === 'GET') {
            context.res = {
                status: 200,
                body: { status: 'online' }
            };
            return;
        }

        if (req.method === 'POST') {
            const { message } = req.body || {};
            context.log('Mensagem:', message);

            const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
            
            if (!GEMINI_API_KEY) {
                context.res = {
                    status: 500,
                    body: { error: 'API Key não configurada' }
                };
                return;
            }

            // Usando modelo disponível na sua lista
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Você é o assistente virtual oficial da Fernandes Technology, uma empresa especializada em desenvolvimento de software e infraestrutura cloud.

INFORMAÇÕES OFICIAIS DA EMPRESA:
- Nome: Fernandes Technology
- Especialidades: Node.js, React, AWS, Azure, MongoDB, DevOps, Docker, ITMS
- Website: https://fernandesit.com
- E-mail: contato@fernandesit.com
- LinkedIn: https://linkedin.com/company/fernandes-technology
- Telefone: +55 (11) 93203-6967 (horário comercial)

HORÁRIO DE FUNCIONAMENTO:
- Segunda a Sexta: 9h às 18h
- Suporte emergencial: 24/7 para clientes com contrato

SERVIÇOS OFERECIDOS:
1. Desenvolvimento Web (Node.js, React)
2. Infraestrutura Cloud (AWS, Azure)
3. Consultoria DevOps
4. Bancos de Dados (MongoDB, SQL)
5. Migração para nuvem

REGRAS DE ATENDIMENTO:
1. Sempre se apresente como assistente da Fernandes Technology
2. Use linguagem profissional mas amigável, em português do Brasil
3. Para informações de contato, forneça os dados oficiais acima
4. Se perguntarem sobre preços, diga que é melhor conversar com nosso time comercial via e-mail
5. Se não souber algo, seja honesto e ofereça ajudar com o que está ao seu alcance
6. Mantenha respostas concisas mas completas
7. Destaque nossas especialidades quando relevante

CONTEXTO DA PERGUNTA: ${message}

Responda como assistente da Fernandes Technology:`
                        }]
                    }]
                })
            });

            const data = await response.json();

            if (!response.ok) {
                context.log.error('Erro Gemini:', data);
                context.res = {
                    status: 500,
                    body: { 
                        error: 'Erro na API do Gemini',
                        details: data.error?.message 
                    }
                };
                return;
            }

            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                         'Desculpe, não consegui processar.';
            
            context.res = {
                status: 200,
                body: { reply }
            };
            return;
        }

        context.res = {
            status: 405,
            body: { error: 'Método não permitido' }
        };

    } catch (error) {
        context.log.error('Erro:', error);
        context.res = {
            status: 500,
            body: { error: error.message }
        };
    }
};