// Versão de diagnóstico: retorna um JSON simples para qualquer requisição
module.exports = async function (context, req) {
    context.log('🎯 Função de diagnóstico foi executada!');
    context.log('Método da requisição:', req.method);
    
    // Resposta sempre em JSON, com status 200
    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json'
        },
        body: {
            status: "ok",
            message: "Função de diagnóstico está funcionando!",
            method: req.method,
            timestamp: new Date().toISOString()
        }
    };
    context.log('✅ Resposta enviada.');
};