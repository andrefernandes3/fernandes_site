const nodemailer = require('nodemailer');
const { MongoClient } = require('mongodb');

// Pegue essa string do seu MongoDB Atlas (igual usou no projeto Quiz)
const mongoUri = process.env.MONGO_CONNECTION_STRING; 

module.exports = async function (context, req) {
    const { email, hp } = req.body;

    // 1. Proteção Anti-Spam (Honeypot)
    if (hp) {
        // Se o campo invisível foi preenchido, é um bot.
        // Fingimos sucesso para o bot não tentar de novo.
        context.res = { status: 200, body: "Sucesso" };
        return;
    }

    if (!email) {
        context.res = { status: 400, body: "E-mail obrigatório" };
        return;
    }

    try {
        // 2. Salvar no MongoDB
        if (mongoUri) {
            const client = new MongoClient(mongoUri);
            await client.connect();
            const database = client.db('fernandes_db'); // Nome do seu banco
            const collection = database.collection('newsletter_leads');

            // Verifica se já existe para não duplicar
            const existingUser = await collection.findOne({ email: email });
            if (!existingUser) {
                await collection.insertOne({
                    email: email,
                    subscribedAt: new Date(),
                    source: 'site_footer',
                    active: true
                });
            }
            await client.close();
        }

        // 3. Enviar Notificação por E-mail (Código existente)
        const transporter = nodemailer.createTransport({
            host: "smtp.zoho.com",
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        await transporter.sendMail({
            from: `"Newsletter Site" <${process.env.EMAIL_USER}>`,
            to: "contato@fernandestechnology.tech",
            subject: `🔔 Novo Lead: ${email}`,
            text: `O e-mail ${email} foi salvo no banco de dados e inscrito na newsletter.`
        });

        // 4. Auto-resposta para o cliente
        await transporter.sendMail({
            from: `"Fernandes Technology" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Bem-vindo! | Fernandes Technology",
            html: `
                <div style="font-family: Arial, sans-serif;">
                    <h2 style="color: #0d6efd;">Obrigado por se inscrever!</h2>
                    <p>Você agora faz parte da nossa lista exclusiva de tecnologia.</p>
                </div>
            `
        });

        context.res = { status: 200, body: "Sucesso" };

    } catch (error) {
        context.log.error("Erro Newsletter:", error);
        // Mesmo se der erro no banco, tentamos não mostrar erro 500 para o usuário se for algo simples
        context.res = { status: 500, body: "Erro interno" };
    }
};