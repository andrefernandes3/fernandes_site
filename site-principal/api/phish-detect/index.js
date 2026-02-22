const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');

// Reutilizando a lógica de Connection Pooling da Fernandes Technology
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

        // --- NOVO CÓDIGO DE LIMPEZA AQUI ---
        let cleanHeaders = headers || 'Não fornecidos';
        if (cleanHeaders !== 'Não fornecidos') {
            // Se encontrar a tag que indica o início de um conteúdo base64/gigante
            const base64Index = cleanHeaders.indexOf('Content-Transfer-Encoding: base64');
            if (base64Index !== -1) {
                // Corta o cabeçalho nesse ponto, ignorando o lixo ilegível
                cleanHeaders = cleanHeaders.substring(0, base64Index) + '\n[Aviso: O restante do código base64 foi removido para análise técnica]';
            }
        }
        // --- FIM DO CÓDIGO DE LIMPEZA ---

        const systemPrompt = `Você é um Analista de Segurança da Fernandes Technology.
        Sua tarefa é analisar o conteúdo de e-mails para detectar PHISHING.
        Analise: senso de urgência, erros gramaticais, links suspeitos e tom da mensagem.
        Retorne um JSON OBRIGATÓRIAMENTE com as seguintes chaves exatas:
        - "Nivel_Risco" (número de 0 a 100)
        - "Veredito" (texto: SEGURO, SUSPEITO ou PERIGOSO)
        - "Motivos" (array de strings com os pontos encontrados)
        - "Recomendacao" (texto com o que o usuário deve fazer, sem acento na chave)`;

        try {
            // 1. Faz a chamada para a IA (Nome da variável corrigido para groqResponse)
            const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
                    response_format: { type: "json_object" } 
                })
            });

            // 2. Proteção: Verifica se a Groq devolveu algum erro (ex: e-mail muito grande)
            if (!groqResponse.ok) {
                const errorData = await groqResponse.text();
                throw new Error(`Erro interno da IA (Status ${groqResponse.status}): ${errorData}`);
            }

            // 3. Lê os dados da resposta
            const data = await groqResponse.json();
            let rawContent = data.choices[0].message.content;

            // 4. Limpa qualquer formatação markdown extra
            rawContent = rawContent.replace(/```json/i, '').replace(/```/g, '').trim();

            // 5. Converte para o objeto final (Nome da variável corrigido para 'analise')
            const analise = JSON.parse(rawContent);

            // 6. Salva a ameaça no MongoDB para histórico
            const db = await connectDb();
            await db.collection('phishing_threats').insertOne({
                timestamp: new Date(),
                analise,
                ip: req.headers['x-forwarded-for']?.split(',')[0] || "IP oculto"
            });

            // 7. Devolve o sucesso para o frontend
            context.res = { status: 200, body: analise };

        } catch (error) {
            context.log('Erro na análise detalhado:', error);
            context.res = {
                status: 500,
                body: { 
                    error: 'Falha na análise técnica.',
                    detalhe_tecnico: error.message 
                }
            };
        }
    } else {
        context.res = { status: 405, body: "Método não permitido" };
    }
};