const nodemailer = require('nodemailer');

module.exports = async function (context, req) {
    const { name, email, phone, message, subject, hp_field } = req.body;
    const turnstileToken = req.body['cf-turnstile-response'];

    // 1. Verificação Honeypot
    if (hp_field) {
        context.log("Bot detectado via Honeypot.");
        context.res = { status: 200, body: "OK" };
        return;
    }

    // 2. Verificação Cloudflare Turnstile
    const verifyURL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    const result = await fetch(verifyURL, {
        method: 'POST',
        body: `secret=${process.env.TURNSTILE_SECRET}&response=${turnstileToken}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const outcome = await result.json();
    if (!outcome.success) {
        context.res = { status: 400, body: "Falha na verificação de segurança." };
        return;
    }

    // 3. Configuração Zoho (Se passar nas verificações acima)
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
        // 1. Enviar e-mail de notificação para VOCÊ
        await transporter.sendMail({
            from: `"${name}" <${process.env.EMAIL_USER}>`,
            replyTo: email,
            to: "contato@fernandestechnology.tech", // Ajustado para o seu e-mail de recebimento
            subject: `[${subject}] Novo Contato: ${name}`,
            text: `Assunto: ${subject}\nNome: ${name}\nE-mail: ${email}\nTelefone: ${phone}\nMensagem: ${message}`,
        });

        // 2. Enviar Auto-Resposta para o CLIENTE
        await transporter.sendMail({
            from: `"Fernandes Technology" <${process.env.EMAIL_USER}>`,
            to: email, 
            subject: "Recebemos sua mensagem | Fernandes Technology",
            html: `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
                    <h2 style="color: #0d6efd;">Olá, ${name}!</h2>
                    <p>Obrigado por entrar em contato com a <strong>Fernandes Technology</strong>.</p>
                    <p>Recebemos sua solicitação sobre <strong>${subject}</strong> e já estamos analisando as informações.</p>
                    <p>Entraremos em contato em até 24 horas úteis.</p>
                    <br>
                    <hr style="border: 0; border-top: 1px solid #eee;">
                    <p style="font-size: 0.8em; color: #777; text-align: center;">
                        <strong>Fernandes Technology</strong><br>
                        Esta é uma mensagem automática, não é necessário respondê-la.
                    </p>
                </div>
            `
        });

        // Só responde sucesso ao navegador após os DOIS e-mails serem enviados
        context.res = { 
            status: 200, 
            body: "Mensagens enviadas com sucesso!" 
        };

    } catch (error) {
        context.log.error("Erro ao enviar e-mail:", error);
        context.res = { 
            status: 500, 
            body: "Erro interno ao processar o envio." 
        };
    }
};