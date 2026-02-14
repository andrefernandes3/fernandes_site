module.exports = async function (context, req) {
    context.log('=== FUNÇÃO EXECUTADA ===');
    context.log('Método:', req.method);
    
    const resposta = {
        status: 200,
        headers: {
            'Content-Type': 'application/json'
        },
        body: {
            mensagem: 'Função funcionou!',
            metodo: req.method,
            timestamp: new Date().toISOString()
        }
    };
    
    context.log('Enviando resposta:', resposta);
    context.res = resposta;
};