const { MongoClient } = require("mongodb");
const nodemailer = require("nodemailer");

module.exports = async function (context, req) {
    // Garante resposta JSON para não quebrar o site
    const headers = { "Content-Type": "application/json" };
    
    const { email, lang } = req.body;
    const userLang = lang || 'pt'; // Se não vier idioma, assume PT

    if (!email) {
        context.res = { 
            status: 400, 
            headers: headers,
            body: { error: "Email is required" } 
        };
        return;
    }

    try {
        // --- 1. MONGODB (Salva o Lead) ---
        const uri = process.env.MONGODB_URI;
        if (uri) {
            const client = new MongoClient(uri);
            await client.connect();
            const database = client.db("fernandes_tech_db"); // Nome do seu banco
            const collection = database.collection("newsletter_subscribers");

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

        // --- 2. CONFIGURAÇÃO DE E-MAIL ---
        // Se usar Gmail, Outlook ou Zoho, configure as variáveis no Azure
        const transporter = nodemailer.createTransport({
            service: 'gmail', // Ou 'Zoho', ou remova service e use host/port
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // --- 3. ENVIO 1: NOTIFICAÇÃO PARA VOCÊ (ADMIN) ---
        // Este e-mail avisa você que alguém se inscreveu
        if (process.env.EMAIL_USER) {
            try {
                await transporter.sendMail({
                    from: `"Bot do Site" <${process.env.EMAIL_USER}>`,
                    to: "contato@fernandesit.com", // Corrigido (estava fernandestit)
                    subject: `🔔 Novo Lead (${userLang.toUpperCase()}): ${email}`,
                    text: `Novo inscrito na Newsletter!\n\nE-mail: ${email}\nIdioma: ${userLang}\nData: ${new Date().toLocaleString()}`
                });
            } catch (adminError) {
                context.log.error("Erro ao notificar admin:", adminError);
                // Não paramos o código aqui, o importante é o cliente receber
            }
        }

        // --- 4. ENVIO 2: BOAS-VINDAS PARA O CLIENTE (HTML BONITO) ---
        
        // Textos Dinâmicos baseados no idioma
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

        // Template HTML (Design Azul/Branco/Cinza)
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

        if (process.env.EMAIL_USER) {
            await transporter.sendMail({
                from: `"Fernandes Tech" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: content.subject,
                text: content.message, 
                html: htmlTemplate
            });
        }

        // --- 5. RESPOSTA FINAL (JSON) ---
        context.res = {
            status: 200,
            headers: headers,
            body: { 
                message: userLang === 'en' ? "Success!" : "Sucesso!",
                details: "Cadastrado e notificado."
            }
        };

    } catch (error) {
        context.log.error("Erro Geral Newsletter:", error);
        context.res = {
            status: 500,
            headers: headers,
            body: { 
                error: userLang === 'en' ? "Server error." : "Erro no servidor."
            }
        };
    }
};