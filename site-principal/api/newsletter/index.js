const nodemailer = require('nodemailer');
const { MongoClient } = require('mongodb');

const mongoUri = process.env.MONGO_CONNECTION_STRING;

module.exports = async function (context, req) {
    // 1. Recebe 'lang' (padrão 'pt' se falhar)
    const { email, hp, lang = 'pt' } = req.body;

    // --- SEGURANÇA (Honeypot) ---
    if (hp) {
        context.res = { status: 200, body: "Sucesso" };
        return;
    }

    if (!email) {
        context.res = { status: 400, body: "Email required" };
        return;
    }

    // --- MONGODB (Salva o lead com o idioma) ---
    if (mongoUri) {
        try {
            const client = new MongoClient(mongoUri);
            await client.connect();
            const database = client.db('fernandes_db');
            const collection = database.collection('newsletter_leads');

            // Verifica duplicidade
            const existingUser = await collection.findOne({ email: email });
            if (!existingUser) {
                await collection.insertOne({
                    email: email,
                    lang: lang, // Importante para campanhas futuras segmentadas por idioma
                    subscribedAt: new Date(),
                    source: 'site_footer',
                    active: true
                });
            }
            await client.close();
        } catch (error) {
            context.log.error("Erro Mongo Newsletter:", error);
        }
    }

    // --- TRADUÇÃO DO E-MAIL ---
    const isEn = lang === 'en';
    
    const texts = {
        subject: isEn ? "Welcome to Fernandes Technology!" : "Bem-vindo à Fernandes Technology!",
        title: isEn ? "Thanks for subscribing!" : "Obrigado por se inscrever!",
        intro: isEn ? "It's a pleasure to have you here. You will now receive updates on technology, development, and our new projects." : "É um prazer ter você por aqui. Em breve compartilharei novidades sobre tecnologia, desenvolvimento e meus novos projetos.",
        footer: isEn ? "© 2026 Fernandes Technology. No spam, only tech." : "© 2026 Fernandes Technology. Sem spam, apenas tecnologia."
    };

    // --- TEMPLATE VISUAL ---
    const htmlTemplate = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333; max-width: 600px; border: 1px solid #e0e0e0; margin: 0 auto;">
            <div style="background-color: #0d6efd; padding: 20px; text-align: center;">
                <h1 style="color: #fff; margin: 0; font-size: 24px;">Fernandes Technology</h1>
            </div>
            <div style="padding: 30px;">
                <h2 style="color: #212529; margin-top: 0;">${texts.title}</h2>
                <p style="font-size: 16px; line-height: 1.6;">${texts.intro}</p>
                <br>
                <a href="https://fernandesit.com" style="background-color: #212529; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Visit Website</a>
            </div>
            <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #6c757d; border-top: 1px solid #e0e0e0;">
                <p>${texts.footer}</p>
            </div>
        </div>
    `;

    // --- ENVIO ---
    const transporter = nodemailer.createTransport({
        host: "smtp.zoho.com", port: 465, secure: true,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    try {
        // 1. Notificação para VOCÊ
        await transporter.sendMail({
            from: `"Newsletter Bot" <${process.env.EMAIL_USER}>`,
            to: "contato@fernandestit.com",
            subject: `🔔 Novo Lead (${lang.toUpperCase()}): ${email}`,
            text: `O e-mail ${email} inscreveu-se na versão ${lang.toUpperCase()} do site.`
        });

        // 2. Boas-vindas para o CLIENTE
        await transporter.sendMail({
            from: `"André Fernandes Tech" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: texts.subject,
            html: htmlTemplate
        });

        context.res = { status: 200, body: "Sucesso" };
    } catch (error) {
        context.log.error("Erro envio email:", error);
        context.res = { status: 500, body: "Erro interno" };
    }
};