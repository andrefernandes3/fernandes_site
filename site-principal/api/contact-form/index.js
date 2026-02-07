const nodemailer = require('nodemailer');

module.exports = async function (context, req) {
    // Recebe os dados do formulário
    const { name, email, phone, message } = req.body;

    // Configuração com variáveis de ambiente (Segurança)
    let transporter = nodemailer.createTransport({
        service: 'gmail', // Ou o seu provedor profissional
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    try {
        await transporter.sendMail({
            from: `"${name}" <${email}>`,
            to: "contato@fernandesit.com",
            subject: `Novo Contato do Site: ${name}`,
            text: `Nome: ${name}\nE-mail: ${email}\nTelefone: ${phone}\nMensagem: ${message}`,
        });

        context.res = { status: 200, body: "Enviado com sucesso!" };
    } catch (error) {
        context.res = { status: 500, body: "Erro ao enviar e-mail." };
    }
};
