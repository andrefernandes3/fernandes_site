const { MongoClient } = require("mongodb");
const nodemailer = require("nodemailer");

module.exports = async function (context, req) {
    // Cabeçalho para garantir JSON sempre
    const headers = { "Content-Type": "application/json" };

    const { email, lang } = req.body;
    const userLang = lang || 'pt';

    // Regex para validação no servidor
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
        context.res = {
            status: 400,
            headers: headers,
            body: {
                error: userLang === 'en' ? "A valid email is required" : "É necessário um e-mail válido"
            }
        };
        return;
    }

    try {
        // 1. SALVA NO BANCO
        const uri = process.env.MONGO_CONNECTION_STRING;
        if (uri) {
            const client = new MongoClient(uri);
            await client.connect();
            const database = client.db("fernandes_db");
            const collection = database.collection("newsletter_leads");

            const existing = await collection.findOne({ email: email });
            if (!existing) {
                await collection.insertOne({
                    email: email,
                    language: userLang,
                    subscribedAt: new Date(),
                    source: "website_footer"
                });
            }
            await client.close();
        }

        // 2. CONFIGURA O ENVIO (Zoho/Gmail/etc)
        const transporter = nodemailer.createTransport({
            host: "smtp.zoho.com", port: 465, secure: true,
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });

        // Prepara textos do cliente
        const content = userLang === 'en' ? {
            subject: "Welcome to Fernandes Technology!",
            title: "Thanks for subscribing!",
            message: "It's a pleasure to have you here. Soon I will share news about technology, development, and my new projects.",
            btnText: "Visit Website",
            footer: "© 2026 Fernandes Technology. No spam, just tech."
        } : {
            subject: "Bem-vindo à Fernandes Technology!",
            title: "Obrigado por se inscrever!",
            message: "É um prazer ter você por aqui. Em breve compartilharei novidades sobre tecnologia, desenvolvimento e meus novos projetos.",
            btnText: "Visitar Site",
            footer: "© 2026 Fernandes Technology. Sem spam, apenas tecnologia."
        };

        // Template HTML do Cliente
        const htmlTemplate = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #0d6efd; padding: 20px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Fernandes Technology</h1>
            </div>
            <div style="padding: 30px; background-color: #ffffff; color: #333333;">
                <h2 style="color: #212529; margin-top: 0;">${content.title}</h2>
                <p style="font-size: 16px; line-height: 1.5; color: #555555;">
                    ${content.message}
                </p>
                <div style="margin-top: 30px;">
                    <a href="https://fernandesit.com" style="background-color: #212529; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                        ${content.btnText}
                    </a>
                </div>
            </div>
            <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
                <p style="font-size: 12px; color: #888888; margin: 0;">
                    ${content.footer}
                </p>
            </div>
        </div>
        `;

        // 3. EXECUTA OS ENVIOS
        if (process.env.EMAIL_USER) {

            // A) Envio Principal: Para o Cliente (Com HTML Bonito)
            await transporter.sendMail({
                from: `"Fernandes Tech" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: content.subject,
                text: content.message,
                html: htmlTemplate
            });

            // B) Envio de Notificação: Para VOCÊ (Texto Simples)
            try {
                await transporter.sendMail({
                    from: `"Bot Newsletter" <${process.env.EMAIL_USER}>`,
                    to: "contato@fernandesit.com", // Seu e-mail
                    subject: `🔔 Novo Lead (${userLang.toUpperCase()}): ${email}`,
                    text: `Novo inscrito na newsletter!\n\nE-mail: ${email}\nIdioma: ${userLang}\nData: ${new Date().toLocaleString('pt-BR')}`
                });
            } catch (adminError) {
                // Se der erro só na sua notificação, logamos mas não travamos o site para o usuário
                context.log.error("Erro ao notificar admin:", adminError);
            }
        }

        // 4. RESPOSTA DE SUCESSO
        context.res = {
            status: 200,
            headers: headers,
            body: {
                message: userLang === 'en' ? "Success!" : "Sucesso!",
                details: "Cadastrado com sucesso."
            }
        };

    } catch (error) {
        context.log.error("Erro Newsletter:", error);
        context.res = {
            status: 500,
            headers: headers,
            body: {
                error: userLang === 'en' ? "Server error." : "Erro no servidor."
            }
        };
    }
};