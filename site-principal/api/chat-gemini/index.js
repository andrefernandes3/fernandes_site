// VERSÃO FUNCIONAL COMPROVADA
module.exports = async function (context, req) {
    context.log('🚀 INÍCIO DA EXECUÇÃO');
    
    try {
        // Responder GET com status da API
        if (req.method === 'GET') {
            context.log('📥 Requisição GET recebida');
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    status: 'online',
                    funcao: 'chat-gemini',
                    timestamp: new Date().toISOString()
                }
            };
            context.log('📤 Resposta GET enviada');
            return;
        }

        // Processar POST
        if (req.method === 'POST') {
            context.log('📥 Requisição POST recebida');
            context.log('Corpo da requisição:', JSON.stringify(req.body));
            
            const { message } = req.body || {};
            context.log('Mensagem extraída:', message);
            
            // Resposta de sucesso
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    reply: `Recebi sua mensagem: "${message || 'vazia'}"`,
                    timestamp: new Date().toISOString()
                }
            };
            context.log('📤 Resposta POST enviada');
            return;
        }

        // Outros métodos
        context.log('❌ Método não suportado:', req.method);
        context.res = {
            status: 405,
            body: { error: 'Método não permitido' }
        };

    } catch (error) {
        context.log.error('💥 ERRO CATASTRÓFICO:', error);
        context.log.error('Stack:', error.stack);
        
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                error: 'Erro interno no servidor',
                detalhe: error.message,
                stack: error.stack
            }
        };
    } finally {
        context.log('🏁 FIM DA EXECUÇÃO');
    }
};