const nodemailer = require('nodemailer');
const { MongoClient } = require('mongodb');

const mongoUri = process.env.MONGO_CONNECTION_STRING;

module.exports = async function (context, req) {
    // 1. Recebe o 'lang' do frontend (padrão 'pt' se não vier nada)
    const { name, email, phone, message, subject, hp_field, lang = 'pt' } = req.body;
    const turnstileToken = req.body['cf-turnstile-response'];

    // --- SEGURANÇA ---
    if (hp_field) {
        context.res = { status: 200, body: "OK" };
        return;
    }

    const verifyURL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    const result = await fetch(verifyURL, {
        method: 'POST',
        body: `secret=${process.env.TURNSTILE_SECRET}&response=${turnstileToken}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const outcome = await result.json();
    if (!outcome.success) {
        context.res = { status: 400, body: "Captcha Error" };
        return;
    }

    // --- MONGODB (Salva o contato) ---
    if (mongoUri) {
        try {
            const client = new MongoClient(mongoUri);
            await client.connect();
            await client.db('fernandes_db').collection('contacts').insertOne({
                name, email, phone, subject, message, lang, // Salva o idioma no banco
                receivedAt: new Date(),
                status: 'new',
                source: 'contact_form'
            });
            await client.close();
        } catch (e) { context.log.error("Erro Mongo:", e); }
    }

    // --- TRADUÇÃO (Define os textos baseado no 'lang') ---
    const isEn = lang === 'en';

    const texts = {
        subjectClient: isEn ? `Request Received: ${subject}` : `Recebemos sua solicitação: ${subject}`,
        title: isEn ? `Hello, ${name}!` : `Olá, ${name}!`,
        intro: isEn ? "We successfully received your message. Thank you for considering Fernandes Technology." : "Recebemos sua mensagem com sucesso. Obrigado por considerar a Fernandes Technology para o seu projeto.",
        detailsTitle: isEn ? "Subject:" : "Assunto:",
        sla: isEn ? "Our technical team (Brazil/USA) is already analyzing your request. We will return within <strong>24 business hours</strong>." : "Nossa equipe técnica (Brasil/EUA) já está analisando sua solicitação. Retornaremos em até <strong>24 horas úteis</strong>.",
        regards: isEn ? "Best regards," : "Atenciosamente,",
        role: "Founder & Lead Developer",
        footerLoc: isEn ? "São Paulo, BR | New Jersey, USA" : "São Paulo, BR | New Jersey, EUA",
        footerRights: isEn ? "© 2026 Fernandes Technology. All rights reserved." : "© 2026 Fernandes Technology. Todos os direitos reservados."
    };

    // --- TEMPLATE DE E-MAIL ---
    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'Segoe UI', sans-serif; color: #333; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
            .header { background-color: #212529; padding: 20px; text-align: center; }
            .header h1 { color: #fff; margin: 0; font-size: 22px; }
            .header span { color: #0d6efd; }
            .content { padding: 30px 20px; background-color: #fff; }
            .details { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #0d6efd; }
            .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #6c757d; border-top: 1px solid #e0e0e0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header"><h1>Fernandes <span>Technology</span></h1></div>
            <div class="content">
                <h2 style="color: #212529; margin-top: 0;">${texts.title}</h2>
                <p>${texts.intro}</p>
                <div class="details">
                    <p style="margin: 0;"><strong>${texts.detailsTitle}</strong> ${subject}</p>
                    <p style="margin: 5px 0 0 0; font-size: 0.9em; color: #555;">Ticket ID: #${Date.now().toString().slice(-6)}</p>
                </div>
                <p>${texts.sla}</p>
                <br>
                <p style="margin-bottom: 0;">${texts.regards}</p>
                <p style="margin-top: 5px;"><strong>André Fernandes</strong><br>${texts.role}</p>
            </div>
            <div class="footer">
                <p>${texts.footerLoc}</p>
                <p>${texts.footerRights}</p>
            </div>
        </div>
    </body>
    </html>
    `;

    // --- ENVIO ---
    const transporter = nodemailer.createTransport({
        host: "smtp.zoho.com",
        port: 465,
        secure: true,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    try {
        // 1. Aviso para VOCÊ (Com indicador de idioma no assunto)
        await transporter.sendMail({
            from: `"${name}" <${process.env.EMAIL_USER}>`,
            replyTo: email,
            to: "contato@fernandesit.com",
            subject: `[Contato ${lang.toUpperCase()}] ${subject} - ${name}`,
            text: `Novo Contato (${lang})!\n\nNome: ${name}\nEmail: ${email}\nTel: ${phone}\nMensagem:\n${message}`
        });

        // 2. Resposta para o CLIENTE (Traduzida e Bonita)
        await transporter.sendMail({
            from: `"Fernandes Technology" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: texts.subjectClient,
            html: htmlTemplate
        });

        context.res = { status: 200, body: "Sucesso" };
    } catch (error) {
        context.log.error(error);
        context.res = { status: 500, body: "Erro envio" };
    }
};