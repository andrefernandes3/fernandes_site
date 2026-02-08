const { MongoClient } = require("mongodb");
const nodemailer = require("nodemailer");

module.exports = async function (context, req) {
    // 1. Prepara resposta JSON (Isso corrige o erro do print)
    const headers = { "Content-Type": "application/json" };
    
    const { email, lang } = req.body;
    const userLang = lang || 'pt';

    if (!email) {
        context.res = { 
            status: 400, 
            headers: headers,
            body: { error: userLang === 'en' ? "Email is required" : "E-mail é obrigatório" } 
        };
        return;
    }

    try {
        // 2. SALVA NO BANCO (Independente do idioma!)
        const uri = process.env.MONGODB_URI;
        if (uri) {
            const client = new MongoClient(uri);
            await client.connect();
            const database = client.db("fernandes_tech_db");
            const collection = database.collection("newsletter_subscribers");

            // Verifica duplicidade
            const existing = await collection.findOne({ email: email });
            if (!existing) {
                await collection.insertOne({
                    email: email,
                    language: userLang, // Salva se é PT ou EN
                    subscribedAt: new Date(),
                    source: "website_footer"
                });
            }
            await client.close();
        }

        const transporter = nodemailer.createTransport({
        host: "smtp.zoho.com", port: 465, secure: true,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

        const emailContent = userLang === 'en' ? {
            subject: "Welcome to Fernandes Technology!",
            text: "Hello! You are now subscribed to our tech newsletter.",
            html: "<h3>Welcome!</h3><p>You are now subscribed to Fernandes Technology newsletter.</p>"
        } : {
            subject: "Bem-vindo à Fernandes Technology!",
            text: "Olá! Você está inscrito na nossa newsletter de tecnologia.",
            html: "<h3>Bem-vindo!</h3><p>Obrigado por se inscrever na newsletter da Fernandes Technology.</p>"
        };

        if (process.env.EMAIL_USER) {
            await transporter.sendMail({
                from: `"Fernandes Tech" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: emailContent.subject,
                text: emailContent.text,
                html: emailContent.html
            });
        }

        // 4. RETORNA SUCESSO (EM JSON CORRETO)
        context.res = {
            status: 200,
            headers: headers,
            body: { 
                // Aqui mandamos um Objeto {}, não a palavra "Sucesso" solta
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