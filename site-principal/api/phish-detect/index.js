const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');

// Reutilizando sua lógica de Connection Pooling
let cachedDb = null;

async function connectDb() {
    if (cachedDb) return cachedDb;
    const client = new MongoClient(process.env.MONGO_CONNECTION_STRING);
    await client.connect();
    cachedDb = client.db('fernandes_db');
    return cachedDb;
}

module.exports = async function (context, req) {
    if (req.method === 'POST') {
        const { emailContent, headers } = req.body;
        const apiKey = process.env.GROQ_API_KEY;

        const systemPrompt = `Você é um Analista de Segurança da Fernandes Technology.
        Sua tarefa é analisar o conteúdo de e-mails para detectar PHISHING.
        Analise: senso de urgência, erros gramaticais, links suspeitos e tom da mensagem.
        Retorne um JSON com:
        1. Nivel_Risco (0 a 100)
        2. Veredito (SEGURO, SUSPEITO ou PERIGOSO)
        3. Motivos (lista de pontos encontrados)
        4. Recomendação (o que o usuário deve fazer)`;

        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: `Analise este e-mail:\n\nCONTEÚDO: ${emailContent}\n\nHEADERS: ${headers || 'Não fornecidos'}` }
                    ],
                    response_format: { type: "json_object" } // Garante que a resposta venha como JSON
                })
            });

            const data = await groqResponse.json();
            let rawContent = data.choices[0].message.content;

            // Limpa qualquer formatação markdown (```json ... ```) que a IA possa adicionar por engano
            rawContent = rawContent.replace(/```json/i, '').replace(/```/g, '').trim();

            const result = JSON.parse(rawContent);

            // Salva a ameaça no MongoDB para seu banco de dados de inteligência
            const db = await connectDb();
            await db.collection('phishing_threats').insertOne({
                timestamp: new Date(),
                analise,
                ip: req.headers['x-forwarded-for']?.split(',')[0] || "IP oculto"
            });

            context.res = { status: 200, body: analise };
        } catch (error) {
            context.res = { status: 500, body: { error: "Falha na análise técnica." } };
        }
    }
};