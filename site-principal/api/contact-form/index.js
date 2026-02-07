const nodemailer = require('nodemailer');
const { MongoClient } = require('mongodb');

// Pega a string de conexão do Azure
const mongoUri = process.env.MONGO_CONNECTION_STRING;

module.exports = async function (context, req) {
    const { name, email, phone, message, subject, hp_field } = req.body;
    const turnstileToken = req.body['cf-turnstile-response'];

    // --- 1. SEGURANÇA (Honeypot + Turnstile) ---
    if (hp_field) {
        context.res = { status: 200, body: "OK" }; // Engana o bot
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
        context.res = { status: 400, body: "Falha na verificação de segurança (Captcha)." };
        return;
    }

    // --- 2. BANCO DE DADOS (MongoDB) ---
    // Adicionado para garantir que o contato seja salvo antes do e-mail
    if (mongoUri) {
        try {
            const client = new MongoClient(mongoUri);
            await client.connect();
            const database = client.db('fernandes_db');
            const collection = database.collection('contacts'); // Cria a coleção 'contacts'

            await collection.insertOne({
                name,
                email,
                phone,
                subject,
                message,
                receivedAt: new Date(),
                status: 'new', // Útil para seu controle interno depois
                source: 'contact_form'
            });
            await client.close();
        } catch (dbError) {
            context.log.error("Erro ao salvar no MongoDB:", dbError);
            // Não paramos o código: prioridade é enviar o e-mail se o banco falhar
        }
    }

    // --- 3. ENVIO DE E-MAILS (Com Template Profissional) ---
    const transporter = nodemailer.createTransport({
        host: "smtp.zoho.com",
        port: 465,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    // Template HTML Profissional (Responsivo e com Branding)
    // Dica: Futuramente, podemos trocar esse HTML baseado no idioma (req.body.lang)
    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
            .header { background-color: #212529; padding: 20px; text-align: center; }
            .header h1 { color: #fff; margin: 0; font-size: 22px; }
            .header span { color: #0d6efd; } /* Azul Bootstrap */
            .content { padding: 30px 20px; background-color: #fff; }
            .details { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #0d6efd; }
            .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #6c757d; border-top: 1px solid #e0e0e0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Fernandes <span>Technology</span></h1>
            </div>
            <div class="content">
                <h2 style="color: #212529; margin-top: 0;">Olá, ${name}!</h2>
                <p>Recebemos sua mensagem com sucesso. Obrigado por considerar a Fernandes Technology para o seu projeto.</p>
                
                <div class="details">
                    <p style="margin: 0;"><strong>Assunto:</strong> ${subject}</p>
                    <p style="margin: 5px 0 0 0; font-size: 0.9em; color: #555;">Ticket ID: #${Date.now().toString().slice(-6)}</p>
                </div>

                <p>Nossa equipe técnica (Brasil/EUA) já está analisando sua solicitação. Retornaremos em até <strong>24 horas úteis</strong>.</p>
                
                <br>
                <p style="margin-bottom: 0;">Atenciosamente,</p>
                <p style="margin-top: 5px;"><strong>André Fernandes</strong><br>Founder & Lead Developer</p>
            </div>
            <div class="footer">
                <p>São Paulo, BR | New Jersey, USA</p>
                <p>© 2026 Fernandes Technology. Todos os direitos reservados.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        // 3.1 Notificação para VOCÊ (Texto simples é melhor para leitura rápida)
        await transporter.sendMail({
            from: `"${name}" <${process.env.EMAIL_USER}>`,
            replyTo: email,
            to: "contato@fernandestechnology.tech",
            subject: `[Lead] ${subject} - ${name}`,
            text: `Novo Lead!\n\nNome: ${name}\nEmail: ${email}\nTel: ${phone}\nAssunto: ${subject}\n\nMensagem:\n${message}`
        });

        // 3.2 Auto-Resposta para o CLIENTE (Com o novo HTML)
        await transporter.sendMail({
            from: `"Fernandes Technology" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Recebemos sua solicitação: ${subject}`,
            html: htmlTemplate
        });

        context.res = { status: 200, body: "Sucesso!" };
    } catch (error) {
        context.log.error("Erro envio e-mail:", error);
        context.res = { status: 500, body: "Erro interno no envio." };
    }
};