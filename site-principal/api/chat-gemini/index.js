// VERSÃO DE TESTE - SEM DEPENDÊNCIAS EXTERNAS
module.exports = async function (context, req) {
    context.log('🚀 Função executada em:', new Date().toISOString());
    
    try {
        if (req.method === 'GET') {
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: { 
                    status: 'online',
                    message: 'API do chat está funcionando!',
                    timestamp: new Date().toISOString()
                }
            };
            return;
        }

        if (req.method === 'POST') {
            const { message } = req.body || {};
            context.log('Mensagem recebida:', message);
            
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: { 
                    reply: `Eco: ${message || 'mensagem vazia'}`,
                    recebido: message
                }
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