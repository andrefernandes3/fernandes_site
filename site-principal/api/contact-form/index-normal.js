const nodemailer = require("nodemailer");

module.exports = async function (context, req) {
    try {
        // Dados do formulário
        const { name, email, phone, message, hp_field } = req.body || {};

        // 🛑 Validação Honeypot (anti-bot)
        if (hp_field) {
            context.log("Bot detectado via honeypot.");
            context.res = {
                status: 200,
                body: "Mensagem processada."
            };
            return;
        }

        // Validação básica
        if (!name || !email || !message) {
            context.res = {
                status: 400,
                body: "Campos obrigatórios não preenchidos."
            };
            return;
        }

        // Configuração do transporte (Zoho)
        const transporter = nodemailer.createTransport({
            host: "smtp.zoho.com",
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Conteúdo do e-mail
        const mailOptions = {
            from: `"Contato Site" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER,
            replyTo: email,
            subject: "Novo contato pelo site",
            html: `
                <h3>Novo contato</h3>
                <p><strong>Nome:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Telefone:</strong> ${phone || "Não informado"}</p>
                <p><strong>Mensagem:</strong></p>
                <p>${message}</p>
            `
        };

        await transporter.sendMail(mailOptions);

        context.res = {
            status: 200,
            body: "Mensagem enviada com sucesso!"
        };
    } catch (error) {
        context.log.error("Erro ao enviar e-mail:", error);
        context.res = {
            status: 500,
            body: "Erro interno ao processar a mensagem."
        };
    }
};
