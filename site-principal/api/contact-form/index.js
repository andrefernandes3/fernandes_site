const nodemailer = require('nodemailer');

module.exports = async function (context, req) {
    // Recebe os dados do formulário
    const { name, email, phone, message } = req.body;

    // Configuração com variáveis de ambiente (Segurança)
    const transporter = nodemailer.createTransport({
    host: "smtp.zoho.com", // Servidor oficial do Zoho
    port: 465,            // Porta segura para SSL
    secure: true,         // Obrigatório true para porta 465
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

    try {
        await transporter.sendMail({
    from: `"${name}" <${process.env.EMAIL_USER}>`, // O remetente oficial deve ser o teu Zoho
    replyTo: email, // O e-mail do cliente vai aqui (para poderes responder diretamente)
    to: "contato@fernandesit.com",
    subject: `Novo Contato do Site: ${name}`,
    text: `Nome: ${name}\nE-mail: ${email}\nTelefone: ${phone}\nMensagem: ${message}`,
});

        context.res = { status: 200, body: "Enviado com sucesso!" };
    } catch (error) {
        context.res = { status: 500, body: "Erro ao enviar e-mail." };
    }
};
