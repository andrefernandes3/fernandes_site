const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');

// CACHE NATIVO (Substitui o 'node-cache' que estava a causar o erro 500)
const memoryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos em milissegundos

let cachedDb = null;

// Rate limiting simples nativo
const rateLimit = new Map();

async function connectDb() {
    if (cachedDb) return cachedDb;
    const client = new MongoClient(process.env.MONGO_CONNECTION_STRING);
    await client.connect();
    cachedDb = client.db('fernandes_db');
    return cachedDb;
}

function checkRateLimit(ip) {
    const now = Date.now();
    const windowMs = 60000; // 1 minuto
    const maxRequests = 10;
    
    const userRequests = rateLimit.get(ip) || [];
    const recentRequests = userRequests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= maxRequests) {
        return false;
    }
    
    recentRequests.push(now);
    rateLimit.set(ip, recentRequests);
    return true;
}

function extractUrls(text) {
    if (!text) return [];
    
    const urls = new Set();
    const regexes = [
        /(https?:\/\/[^\s"'\>\]\)]+)/g,
        /href=["'](https?:\/\/[^"']+)["']/gi,
        /src=["'](https?:\/\/[^"']+)["']/gi
    ];
    
    regexes.forEach(regex => {
        const matches = text.match(regex) || [];
        matches.forEach(m => {
            try {
                const cleanUrl = m.replace(/^(href|src)=["']/, '').replace(/["']$/, '');
                new URL(cleanUrl);
                urls.add(cleanUrl);
            } catch {
                // Ignora URLs inválidas
            }
        });
    });
    
    return Array.from(urls).slice(0, 20);
}

async function checkDomainAge(domain) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        const res = await fetch(`https://rdap.org/domain/${domain}`, {
            signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (!res.ok) return "Desconhecida";
        
        const data = await res.json();
        const regEvent = data.events?.find(e => e.eventAction === 'registration');
        
        if (regEvent) {
            const ageDays = Math.floor((new Date() - new Date(regEvent.eventDate)) / (1000 * 60 * 60 * 24));
            return `${ageDays} dias`;
        }
        return "Privado";
    } catch (e) {
        return "Falha";
    }
}

module.exports = async function (context, req) {
    const startTime = Date.now();
    
    // Rate limiting
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
    if (!checkRateLimit(clientIp)) {
        context.res = { 
            status: 429, 
            body: { 
                error: 'Muitas requisições',
                Nivel_Risco: 50,
                Veredito: 'SUSPEITO',
                Motivos: ['Rate limit excedido', 'Análise temporariamente indisponível'],
                Recomendacao: 'Aguarde 1 minuto antes de nova análise'
            }
        };
        return;
    }
    
    if (req.method !== 'POST') {
        context.res = { status: 405, body: { error: 'Método não permitido' } };
        return;
    }

    const { emailContent, headers } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    // Verificar Cache Nativo
    const cacheKey = Buffer.from((emailContent || '') + (headers || '')).toString('base64').substring(0, 100);
    const cachedItem = memoryCache.get(cacheKey);
    
    // Se existe no cache e ainda não expirou
    if (cachedItem && (Date.now() - cachedItem.timestamp < CACHE_TTL)) {
        context.log('Resultado retornado do cache');
        context.res = { status: 200, body: cachedItem.data };
        return;
    }

    // Extrair URLs
    const foundUrls = extractUrls(emailContent || '');
    
    // Preparar conteúdo para IA (LIMITADO)
    let cleanBody = emailContent || 'Não fornecido';
    if (cleanBody.length > 6000) {
        cleanBody = cleanBody.substring(0, 6000) + '... [CONTEÚDO CORTADO POR LIMITE DE TOKENS]';
    }

    let cleanHeaders = headers || 'Não fornecidos';
    if (cleanHeaders !== 'Não fornecidos' && cleanHeaders.length > 2000) {
        cleanHeaders = cleanHeaders.substring(0, 2000) + '... [HEADERS CORTADOS]';
    }

    // Investigação de domínios (limitada)
    let domainIntel = "Nenhum link detectado.";
    if (foundUrls.length > 0) {
        const uniqueDomains = [...new Set(foundUrls.map(u => {
            try { 
                return new URL(u).hostname.replace('www.', ''); 
            } catch { 
                return null; 
            }
        }).filter(Boolean))];
        
        domainIntel = "DOMÍNIOS:\n";
        const domainsToCheck = uniqueDomains.slice(0, 5); // Máx 5 domínios
        
        for (const domain of domainsToCheck) {
            const ageInfo = await checkDomainAge(domain);
            domainIntel += `- ${domain} (${ageInfo})\n`;
        }
    }

    const systemPrompt = `Você é um Analista de Segurança. Analise e-mails para detectar PHISHING.
Retorne JSON com:
- "Nivel_Risco" (0-100)
- "Veredito" (SEGURO, SUSPEITO, PERIGOSO)
- "Motivos" (array máx 5 itens)
- "Recomendacao" (texto curto sem acento na chave)`;

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
                    { role: "user", content: `EMAIL:\n${cleanBody}\n\nHEADERS:\n${cleanHeaders}\n\n${domainIntel}` }
                ],
                response_format: { type: "json_object" },
                max_tokens: 500 // Limitar resposta
            })
        });

        if (!groqResponse.ok) {
            throw new Error(`Erro IA: ${groqResponse.status}`);
        }

        const data = await groqResponse.json();
        let rawContent = data.choices[0].message.content.replace(/```json|```/g, '').trim();
        
        let analise;
        try {
            analise = JSON.parse(rawContent);
            // Validar e sanitizar
            analise = {
                Nivel_Risco: Math.min(100, Math.max(0, parseInt(analise.Nivel_Risco) || 50)),
                Veredito: ['SEGURO', 'SUSPEITO', 'PERIGOSO'].includes(analise.Veredito) ? analise.Veredito : 'SUSPEITO',
                Motivos: (Array.isArray(analise.Motivos) ? analise.Motivos : ['Análise automática']).slice(0, 5),
                Recomendacao: (analise.Recomendacao || 'Consulte um especialista').substring(0, 200)
            };
        } catch {
            analise = {
                Nivel_Risco: 50,
                Veredito: 'SUSPEITO',
                Motivos: ['Erro no formato da resposta'],
                Recomendacao: 'Recomendamos análise manual'
            };
        }

        // Salvar no banco (apenas metadados)
        try {
            const db = await connectDb();
            await db.collection('phishing_threats').insertOne({
                timestamp: new Date(),
                analise: {
                    Nivel_Risco: analise.Nivel_Risco,
                    Veredito: analise.Veredito
                },
                ip: clientIp,
                duration: Date.now() - startTime
            });
        } catch (dbError) {
            context.log('Erro ao salvar no banco:', dbError);
        }

        // Guardar no Novo Cache Nativo
        memoryCache.set(cacheKey, {
            data: analise,
            timestamp: Date.now()
        });

        context.log('Análise concluída', { 
            duration: Date.now() - startTime,
            urls: foundUrls.length,
            veredito: analise.Veredito 
        });

        context.res = { status: 200, body: analise };

    } catch (error) {
        context.log('Erro na análise:', error);
        
        // Fallback seguro
        context.res = {
            status: 200,
            body: {
                Nivel_Risco: 50,
                Veredito: 'SUSPEITO',
                Motivos: ['Erro na análise automática', 'Revisão manual necessária'],
                Recomendacao: 'Falha técnica. Encaminhe para análise manual.'
            }
        };
    }
};