const nodemailer = require('nodemailer');
const { MongoClient } = require('mongodb');

// Pega a conexão do ambiente do Azure
const mongoUri = process.env.MONGO_CONNECTION_STRING;

module.exports = async function (context, req) {
    const { name, email, phone, message, subject, hp_field } = req.body;
    const turnstileToken = req.body['cf-turnstile-response'];

    // 1. Verificação Honeypot (Anti-Bot Simples)
    if (hp_field) {
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

    // 3. SALVAR NO MONGODB (Novo Bloco)
    if (mongoUri) {
        try {
            const client = new MongoClient(mongoUri);
            await client.connect();
            const database = client.db('fernandes_db'); // Nome do seu Banco
            const collection = database.collection('contacts'); // Nome da Coleção

            await collection.insertOne({
                name,
                email,
                phone,
                subject,
                message,
                receivedAt: new Date(),
                source: 'contact_form'
            });
            await client.close();
        } catch (dbError) {
            context.log.error("Erro ao salvar no MongoDB:", dbError);
            // Não paramos o código aqui para garantir que o e-mail chegue mesmo se o banco falhar
        }
    } else {
        context.log.warn("MONGO_CONNECTION_STRING não definida. Pulando salvamento.");
    }

    // 4. Envio de E-mails (Nodemailer)
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
        // E-mail para VOCÊ
        await transporter.sendMail({
            from: `"${name}" <${process.env.EMAIL_USER}>`,
            replyTo: email,
            to: "contato@fernandesit.com",
            subject: `[${subject}] Novo Contato: ${name}`,
            text: `Nome: ${name}\nE-mail: ${email}\nTelefone: ${phone}\nMensagem: ${message}`,
        });

        // Auto-resposta para o CLIENTE
        await transporter.sendMail({
            from: `"Fernandes Technology" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Recebemos sua mensagem | Fernandes Technology",
            html: `
                <div style="font-family: sans-serif; color: #333;">
                    <h2>Olá, ${name}!</h2>
                    <p>Recebemos sua mensagem sobre <strong>${subject}</strong>.</p>
                    <p>Entraremos em contato em breve.</p>
                </div>
            `
        });

        context.res = { status: 200, body: "Enviado!" };
    } catch (error) {
        context.log.error("Erro de e-mail:", error);
        context.res = { status: 500, body: "Erro no envio." };
    }
};