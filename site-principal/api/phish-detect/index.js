const fetch = require('node-fetch');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

// CACHE NATIVO
const memoryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

let cachedDb = null;
const rateLimit = new Map();

// Limpeza automática do cache a cada 10 minutos
setInterval(() => {
    const now = Date.now();
    let deleted = 0;
    for (const [key, value] of memoryCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            memoryCache.delete(key);
            deleted++;
        }
    }
    if (deleted > 0) {
        console.log(`Cache limpo: ${deleted} itens removidos. Restam: ${memoryCache.size}`);
    }
}, 10 * 60 * 1000);

async function connectDb() {
    if (cachedDb) return cachedDb;
    const client = new MongoClient(process.env.MONGO_CONNECTION_STRING);
    await client.connect();
    cachedDb = client.db('fernandes_db');
    return cachedDb;
}

function checkRateLimit(ip) {
    const now = Date.now();
    const windowMs = 60000;
    const maxRequests = 10;
    
    // Anonimização do IP
    const hashedIp = crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'default_salt')).digest('hex');

    const userRequests = rateLimit.get(hashedIp) || [];
    const recentRequests = userRequests.filter(time => now - time < windowMs);

    if (recentRequests.length >= maxRequests) return false;

    recentRequests.push(now);
    rateLimit.set(hashedIp, recentRequests);
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
            } catch { }
        });
    });

    return Array.from(urls).slice(0, 20);
}

// Função para extrair detalhes de autenticação
function extractAuthDetails(headers) {
    const authDetails = { spf: null, dkim: null, dmarc: null, raw: null };
    if (!headers) return authDetails;

    const authMatch = headers.match(/Authentication-Results:(.*?)(?:\n[A-Z]|\n\n|$)/is);
    if (authMatch) {
        authDetails.raw = authMatch[1].trim();
        const spfMatch = authDetails.raw.match(/spf=([^\s;]+)/i);
        if (spfMatch) authDetails.spf = spfMatch[1];
        const dkimMatch = authDetails.raw.match(/dkim=([^\s;]+)/i);
        if (dkimMatch) authDetails.dkim = dkimMatch[1];
        const dmarcMatch = authDetails.raw.match(/dmarc=([^\s;]+)/i);
        if (dmarcMatch) authDetails.dmarc = dmarcMatch[1];
    }
    return authDetails;
}

function extractSender(headers) {
    if (!headers) return 'Não identificado';
    const fromMatch = headers.match(/From:?\s*(.*?)(?:\n[A-Z]|\n\n|$)/i);
    if (fromMatch) return fromMatch[1].trim();
    return 'Não identificado';
}

function extractSenderIP(headers) {
    if (!headers) return null;
    const ipMatch = headers.match(/\[(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]/);
    if (ipMatch) return ipMatch[1];
    const authResults = headers.match(/Authentication-Results:.*?smtp\.mailfrom=.*?ip=([^\s\];]+)/i);
    if (authResults) return authResults[1];
    return null;
}

async function checkDomainAge(domain) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        const res = await fetch(`https://rdap.org/domain/${domain}`, {
            signal: controller.signal
        });
        
        clearTimeout(timeout);
        if (!res.ok) return "Idade oculta (Proteção de Privacidade Normal)";
        
        const data = await res.json();
        const regEvent = data.events?.find(e => e.eventAction === 'registration');
        
        if (regEvent) {
            const ageDays = Math.floor((new Date() - new Date(regEvent.eventDate)) / (1000 * 60 * 60 * 24));
            return `${ageDays} dias`;
        }
        return "Privado (Normal)";
    } catch {
        return "Consulta indisponível (Ignorar, não é um risco)";
    }
}

module.exports = async function (context, req) {
    const startTime = Date.now();
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';

    context.res = {
        headers: {
            'Content-Type': 'application/json',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Cache-Control': 'no-store'
        }
    };

    if (!checkRateLimit(clientIp)) {
        context.res.status = 429;
        context.res.body = {
            error: 'Muitas requisições',
            Nivel_Risco: 50,
            Veredito: 'SUSPEITO',
            Motivos: ['Rate limit excedido'],
            Recomendacao: 'Aguarde 1 minuto'
        };
        return;
    }

    if (req.method !== 'POST') {
        context.res.status = 405;
        context.res.body = { error: 'Método não permitido' };
        return;
    }

    const { emailContent, headers } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!emailContent || emailContent.trim().length < 10) {
        context.res.status = 400;
        context.res.body = {
            error: 'Conteúdo insuficiente',
            Nivel_Risco: 0,
            Veredito: 'SEGURO',
            Motivos: ['Conteúdo muito curto para análise'],
            Recomendacao: 'Cole mais conteúdo do e-mail'
        };
        return;
    }

    const cacheKey = Buffer.from((emailContent || '') + (headers || '')).toString('base64').substring(0, 100);
    const cachedItem = memoryCache.get(cacheKey);

    if (cachedItem && (Date.now() - cachedItem.timestamp < CACHE_TTL)) {
        context.log.info('Cache HIT');
        context.res.status = 200;
        context.res.body = cachedItem.data;
        return;
    }

    const foundUrls = extractUrls(emailContent || '');
    const authDetails = extractAuthDetails(headers);
    const sender = extractSender(headers);
    const senderIP = extractSenderIP(headers);

    let cleanBodyProcessed = emailContent || 'Não fornecido';
    cleanBodyProcessed = cleanBodyProcessed.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
    if (cleanBodyProcessed.length > 4000) {
        cleanBodyProcessed = cleanBodyProcessed.substring(0, 4000) + '... [CORTADO]';
    }

    let cleanHeadersProcessed = headers || 'Não fornecidos';
    if (cleanHeadersProcessed !== 'Não fornecidos' && cleanHeadersProcessed.length > 2000) {
        cleanHeadersProcessed = cleanHeadersProcessed.substring(0, 2000) + '... [CORTADO]';
    }

    let domainIntel = "Nenhum link detectado.";
    const domainDetails = [];

    if (foundUrls.length > 0) {
        const uniqueDomains = [...new Set(foundUrls.map(u => {
            try { return new URL(u).hostname.replace('www.', ''); } catch { return null; }
        }).filter(Boolean))];

        domainIntel = "DOMÍNIOS:\n";
        const domainsToCheck = uniqueDomains.slice(0, 5);

        const ageResults = await Promise.all(
            domainsToCheck.map(domain => checkDomainAge(domain).then(age => ({ domain, age })))
        );

        ageResults.forEach(info => {
            domainIntel += `- ${info.domain} (${info.age})\n`;
            domainDetails.push({ domain: info.domain, age: info.age });
        });
    }

    const knownScams = /receita federal|irregularidade cpf|suspensão do cpf|bloqueio do cpf/i.test(cleanBodyProcessed);
    let localScore = 0;
    
    if (knownScams && !foundUrls.some(u => u.includes('gov.br'))) {
        localScore += 40;
    }

    const systemPrompt = `Você é um Analista de Segurança Sênior (Nível 3). Sua missão é detectar PHISHING com precisão cirúrgica, evitando FALSOS POSITIVOS em e-mails reais.

REGRAS DE CLASSIFICAÇÃO (SIGA ESTRITAMENTE):
1. AUTENTICAÇÃO É SOBERANA: Leia os dados de "AUTENTICAÇÃO DO SERVIDOR". Se SPF e DKIM estiverem "pass" (ou verificados), o e-mail tem origem confirmada.
2. DOMÍNIOS DE MARKETING: Grandes empresas (como Enel, Bancos, etc.) usam variações do seu domínio (ex: info-enel.com) ou plataformas de marketing (ex: exct.net, Salesforce, SendGrid) para hospedar imagens e links. Se o e-mail passou no SPF/DKIM e os links pertencerem a plataformas de marketing ou variações do nome da empresa, o e-mail é 100% LEGÍTIMO E SEGURO (Risco < 10%).
3. SITES DESCONHECIDOS: Se a idade do domínio estiver "oculta" ou "indisponível", isso é NORMAL devido a leis de privacidade.
4. CÓDIGO ESTRANHO: Ignore fragmentos como "=3D" ou tags soltas.
5. GOLPES COMUNS NO BRASIL: Receita Federal NÃO envia e-mails com links para regularizar CPF.
6. E-MAILS BANCÁRIOS LEGÍTIMOS: Focam em benefícios; verifique domínios oficiais.

Retorne APENAS JSON válido com:
- "Nivel_Risco" (0-100. Obrigatoriamente < 10% se a Regra 1 for cumprida)
- "Veredito" (SEGURO, SUSPEITO, PERIGOSO)
- "Motivos" (array máx 5 itens)
- "Recomendacao" (texto direto, sem acento na chave)`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const intelMastigada = `
        AUTENTICAÇÃO DO SERVIDOR:
        - Remetente: ${sender}
        - IP de Origem: ${senderIP || 'Desconhecido'}
        - Validação SPF: ${authDetails.spf || 'Não encontrado'}
        - Validação DKIM: ${authDetails.dkim || 'Não encontrado'}
        - Validação DMARC: ${authDetails.dmarc || 'Não encontrado'}
        `;

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
                    { role: "user", content: `EMAIL:\n${cleanBodyProcessed}\n\n${intelMastigada}\n\n${domainIntel}\n\nHEADERS BRUTOS:\n${cleanHeadersProcessed}` }
                ],
                response_format: { type: "json_object" },
                max_tokens: 500,
                temperature: 0.0
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!groqResponse.ok) {
            throw new Error(`Erro IA: ${groqResponse.status}`);
        }

        const data = await groqResponse.json();
        let rawContent = data.choices[0].message.content.replace(/```json|```/g, '').trim();

        let analise;
        try {
            analise = JSON.parse(rawContent);
            let riscoFinal = Math.min(100, Math.max(0, parseInt(analise.Nivel_Risco) || 50));
            riscoFinal = Math.min(95, riscoFinal + localScore);
            
            analise = {
                Nivel_Risco: riscoFinal,
                Veredito: ['SEGURO', 'SUSPEITO', 'PERIGOSO'].includes(analise.Veredito) ? analise.Veredito : 'SUSPEITO',
                Motivos: (Array.isArray(analise.Motivos) ? analise.Motivos : ['Análise automática']).slice(0, 5),
                Recomendacao: (analise.Recomendacao || 'Consulte um especialista').substring(0, 200)
            };
        } catch {
            analise = { Nivel_Risco: 50, Veredito: 'SUSPEITO', Motivos: ['Erro formato IA'], Recomendacao: 'Análise manual' };
        }

        const respostaCompleta = {
            ...analise,
            detalhes_autenticacao: {
                spf: authDetails.spf || 'não verificado',
                dkim: authDetails.dkim || 'não verificado',
                dmarc: authDetails.dmarc || 'não verificado',
                raw: authDetails.raw || 'não disponível'
            },
            remetente: sender,
            ip_remetente: senderIP || 'não identificado',
            urls_encontradas: foundUrls.slice(0, 10),
            dominios_analisados: domainDetails
        };

        try {
            const db = await connectDb();
            await db.collection('phishing_threats').insertOne({
                timestamp: new Date(),
                analise: { Nivel_Risco: analise.Nivel_Risco, Veredito: analise.Veredito },
                ip: clientIp, remetente: sender, urls: foundUrls.length
            });
        } catch (dbError) {}

        memoryCache.set(cacheKey, { data: respostaCompleta, timestamp: Date.now() });

        context.res.status = 200;
        context.res.body = respostaCompleta;

    } catch (error) {
        context.res.status = 200;
        context.res.body = {
            Nivel_Risco: Math.min(95, 50 + localScore),
            Veredito: 'SUSPEITO',
            Motivos: ['Erro na comunicação com a Inteligência Artificial'],
            Recomendacao: 'Falha técnica. ' + error.message,
            detalhes_autenticacao: { spf: 'não verificado', dkim: 'não verificado', dmarc: 'não verificado', raw: 'não disponível' },
            remetente: sender || 'não identificado',
            ip_remetente: senderIP || 'não identificado',
            urls_encontradas: foundUrls.slice(0, 10),
            dominios_analisados: domainDetails
        };
    }
};