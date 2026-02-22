const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');

let cachedDb = null;

async function connectDb() {
    if (cachedDb) return cachedDb;
    const client = new MongoClient(process.env.MONGO_CONNECTION_STRING);
    await client.connect();
    cachedDb = client.db('fernandes_db');
    return cachedDb;
}

// NOVO: Função para descobrir a idade do domínio
async function checkDomainAge(domain) {
    try {
        const res = await fetch(`https://rdap.org/domain/${domain}`);
        if (!res.ok) return "Desconhecida (Possível domínio falso ou ccTLD oculto)";

        const data = await res.json();
        // Procura a data de registo ("registration")
        const regEvent = data.events?.find(e => e.eventAction === 'registration');
        if (regEvent) {
            const ageDays = Math.floor((new Date() - new Date(regEvent.eventDate)) / (1000 * 60 * 60 * 24));
            return `Criado a: ${new Date(regEvent.eventDate).toLocaleDateString()} (${ageDays} dias de vida)`;
        }
        return "Data oculta pela privacidade do domínio";
    } catch (e) {
        return "Falha ao verificar";
    }
}

module.exports = async function (context, req) {
    if (req.method === 'POST') {
        const { emailContent, headers } = req.body;
        const apiKey = process.env.GROQ_API_KEY;

        // 1. EXTRAÇÃO DE LINKS (Fazemos isto ANTES de cortar o texto)
        const urlRegex = /(https?:\/\/[^\s"'>]+)/g;
        const foundUrls = (emailContent || '').match(urlRegex) || [];

        // 2. CORTE DE SEGURANÇA PARA O CORPO DO E-MAIL (Máx 8000 caracteres)
        let cleanBody = emailContent || 'Não fornecido';
        if (cleanBody.length > 8000) {
            cleanBody = cleanBody.substring(0, 8000) + '\n\n[AVISO DA API: O e-mail era demasiado longo e o código HTML irrelevante foi cortado para análise.]';
        }

        // 3. LIMPEZA E CORTE PARA OS CABEÇALHOS (Máx 4000 caracteres)
        let cleanHeaders = headers || 'Não fornecidos';
        if (cleanHeaders !== 'Não fornecidos') {
            const base64Index = cleanHeaders.indexOf('Content-Transfer-Encoding: base64');
            if (base64Index !== -1) {
                cleanHeaders = cleanHeaders.substring(0, base64Index) + '\n[CORTADO: Restante código base64 removido]';
            }
            if (cleanHeaders.length > 4000) {
                cleanHeaders = cleanHeaders.substring(0, 4000) + '\n[CORTADO: Cabeçalho reduzido por segurança]';
            }
        }

        // 4. INVESTIGAÇÃO DE DOMÍNIOS (Com os links guardados no passo 1)
        let domainIntel = "Nenhum link detetado na mensagem.";
        if (foundUrls.length > 0) {
            const uniqueDomains = [...new Set(foundUrls.map(u => {
                try { return new URL(u).hostname; } catch (e) { return null; }
            }).filter(Boolean))];

            domainIntel = "INVESTIGAÇÃO DE DOMÍNIOS:\n";
            for (const domain of uniqueDomains.slice(0, 3)) { // Verifica no máximo 3 domínios para ser rápido
                const ageInfo = await checkDomainAge(domain);
                domainIntel += `- Domínio: ${domain} | Info: ${ageInfo}\n`;
            }
        }

        const systemPrompt = `Você é um Analista de Segurança Sénior da Fernandes Technology.
        Sua tarefa é analisar e-mails para detectar PHISHING.
        
        ATENÇÃO ESPECIAL: Foi fornecida abaixo uma "Investigação de Domínios". Se o e-mail disser ser de uma grande empresa (ex: Bradesco, Apple), mas os domínios extraídos tiverem poucos dias de vida ou nomes esquisitos, classifique IMEDIATAMENTE como PERIGOSO e explique isso nos motivos.
        
        Retorne um JSON OBRIGATÓRIAMENTE com as chaves exatas:
        - "Nivel_Risco" (número de 0 a 100)
        - "Veredito" (SEGURO, SUSPEITO ou PERIGOSO)
        - "Motivos" (array de strings com os pontos encontrados)
        - "Recomendacao" (texto com o que o usuário deve fazer)`;

        try {
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
                        // Usamos o cleanBody e cleanHeaders aqui!
                        { role: "user", content: `Analise este e-mail:\n\nCONTEÚDO: ${cleanBody}\n\nHEADERS: ${cleanHeaders}\n\n${domainIntel}` }
                    ],
                    response_format: { type: "json_object" }
                })
            });

            if (!groqResponse.ok) {
                const errorData = await groqResponse.text();
                throw new Error(`Erro IA (Status ${groqResponse.status}): ${errorData}`);
            }

            const data = await groqResponse.json();
            let rawContent = data.choices[0].message.content.replace(/```json/i, '').replace(/```/g, '').trim();
            const analise = JSON.parse(rawContent);

            const db = await connectDb();
            await db.collection('phishing_threats').insertOne({
                timestamp: new Date(),
                analise,
                ip: req.headers['x-forwarded-for']?.split(',')[0] || "IP oculto"
            });

            context.res = { status: 200, body: analise };

        } catch (error) {
            context.log('Erro na análise:', error);
            context.res = {
                status: 500,
                body: { error: 'Falha na análise técnica.', detalhe_tecnico: error.message }
            };
        }
    } else {
        context.res = { status: 405, body: "Método não permitido" };
    }
};