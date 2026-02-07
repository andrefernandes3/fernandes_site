const nodemailer = require('nodemailer');

module.exports = async function (context, req) {
    const { email } = req.body;

    if (!email) {
        context.res = { status: 400, body: "E-mail obrigatório" };
        return;
    }

    // Reutiliza as configs do Zoho que já funcionam
    const transporter = nodemailer.createTransport({
        host: "smtp.zoho.com",
        port: 465,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    try {
        // 1. Avisa VOCÊ que tem um novo inscrito
        await transporter.sendMail({
            from: `"Newsletter Site" <${process.env.EMAIL_USER}>`,
            to: "contato@fernandestechnology.tech", // Seu e-mail
            subject: `🔔 Novo Inscrito na Newsletter: ${email}`,
            text: `O e-mail ${email} acabou de se inscrever no site.`
        });

        // 2. (Opcional) Manda e-mail de boas-vindas para o cliente
        await transporter.sendMail({
            from: `"André Fernandes" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Bem-vindo à Fernandes Technology!",
            html: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2>Obrigado por se inscrever!</h2>
                    <p>É um prazer ter você por aqui. Em breve compartilharei novidades sobre tecnologia, desenvolvimento e meus novos projetos.</p>
                    <br>
                    <p>Atenciosamente,<br><strong>André Fernandes</strong></p>
                </div>
            `
        });

        context.res = { status: 200, body: "Sucesso" };
    } catch (error) {
        context.log.error("Erro Newsletter:", error);
        context.res = { status: 500, body: "Erro interno" };
    }
};