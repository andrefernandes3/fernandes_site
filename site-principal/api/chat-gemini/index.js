// Versão de teste SEM Gemini
module.exports = async function (context, req) {
    context.log('🚀 Função de TESTE iniciada');

    try {
        if (req.method === 'GET') {
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: { message: "API de teste está online!" }
            };
            return;
        }

        if (req.method === 'POST') {
            const { message } = req.body;
            context.log('Mensagem recebida no POST:', message);

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: { reply: `Você disse: "${message}". A API de teste funcionou!` }
            };
            return;
        }

        context.res = {
            status: 405,
            body: "Método não permitido"
        };
    } catch (error) {
        context.log('Erro na função de teste:', error);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: { error: error.message }
        };
    }
};