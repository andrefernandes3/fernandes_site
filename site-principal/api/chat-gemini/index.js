// TESTE MÍNIMO ABSOLUTO
module.exports = async function (context, req) {
    context.res = {
        status: 200,
        body: { mensagem: "OK" }
    };
};