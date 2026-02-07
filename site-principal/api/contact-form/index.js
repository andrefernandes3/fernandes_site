const nodemailer = require('nodemailer');

module.exports = async function (context, req) {
    const { name, email, phone, message, hp_field } = req.body;
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
        await transporter.sendMail({
            from: `"${name}" <${process.env.EMAIL_USER}>`,
            replyTo: email,
            to: "contato@fernandestechnology.tech",
            subject: `Novo Contato: ${name}`,
            text: `Nome: ${name}\nE-mail: ${email}\nTelefone: ${phone}\nMensagem: ${message}`,
        });
        context.res = { status: 200, body: "Enviado!" };
    } catch (error) {
        context.res = { status: 500, body: "Erro no envio." };
    }
};