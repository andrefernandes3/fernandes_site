const fetch = require('node-fetch');
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
    
    const userRequests = rateLimit.get(ip) || [];
    const recentRequests = userRequests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= maxRequests) return false;
    
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
            } catch {}
        });
    });
    
    return Array.from(urls).slice(0, 20);
}

// NOVA FUNÇÃO: Extrair detalhes de autenticação
function extractAuthDetails(headers) {
    const authDetails = {
        spf: null,
        dkim: null,
        dmarc: null,
        raw: null
    };
    
    if (!headers) return authDetails;
    
    // Procurar por Authentication-Results
    const authMatch = headers.match(/Authentication-Results:(.*?)(?:\n[A-Z]|\n\n|$)/is);
    if (authMatch) {
        authDetails.raw = authMatch[1].trim();
        
        // Extrair SPF
        const spfMatch = authDetails.raw.match(/spf=([^\s;]+)/i);
        if (spfMatch) authDetails.spf = spfMatch[1];
        
        // Extrair DKIM
        const dkimMatch = authDetails.raw.match(/dkim=([^\s;]+)/i);
        if (dkimMatch) authDetails.dkim = dkimMatch[1];
        
        // Extrair DMARC
        const dmarcMatch = authDetails.raw.match(/dmarc=([^\s;]+)/i);
        if (dmarcMatch) authDetails.dmarc = dmarcMatch[1];
    }
    
    return authDetails;
}

// NOVA FUNÇÃO: Extrair remetente
function extractSender(headers) {
    if (!headers) return 'Não identificado';
    
    // Procurar por From:
    const fromMatch = headers.match(/From:?\s*(.*?)(?:\n[A-Z]|\n\n|$)/i);
    if (fromMatch) {
        return fromMatch[1].trim();
    }
    
    return 'Não identificado';
}

// NOVA FUNÇÃO: Extrair IP do remetente
function extractSenderIP(headers) {
    if (!headers) return null;
    
    // Procurar por Received: ou IP do remetente
    const ipMatch = headers.match(/\[(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]/);
    if (ipMatch) {
        return ipMatch[1];
    }
    
    // Tentar encontrar no Authentication-Results
    const authResults = headers.match(/Authentication-Results:.*?smtp\.mailfrom=.*?ip=([^\s\];]+)/i);
    if (authResults) {
        return authResults[1];
    }
    
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
        if (!res.ok) return "Desconhecida";
        
        const data = await res.json();
        const regEvent = data.events?.find(e => e.eventAction === 'registration');
        
        if (regEvent) {
            const ageDays = Math.floor((new Date() - new Date(regEvent.eventDate)) / (1000 * 60 * 60 * 24));
            return `${ageDays} dias`;
        }
        return "Privado";
    } catch {
        return "Falha";
    }
}

module.exports = async function (context, req) {
    const startTime = Date.now();
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
    
    // Headers de segurança
    context.res = {
        headers: {
            'Content-Type': 'application/json',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Cache-Control': 'no-store'
        }
    };

    // Rate limiting
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

    // Validação básica
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

    // Cache
    const cacheKey = Buffer.from((emailContent || '') + (headers || '')).toString('base64').substring(0, 100);
    const cachedItem = memoryCache.get(cacheKey);
    
    if (cachedItem && (Date.now() - cachedItem.timestamp < CACHE_TTL)) {
        context.log.info('Cache HIT', { key: cacheKey.substring(0, 10) });
        context.res.status = 200;
        context.res.body = cachedItem.data;
        return;
    }

    context.log.info('Cache MISS', { key: cacheKey.substring(0, 10) });

    // Processamento
    const foundUrls = extractUrls(emailContent || '');
    
    // Extrair informações detalhadas
    const authDetails = extractAuthDetails(headers);
    const sender = extractSender(headers);
    const senderIP = extractSenderIP(headers);
    
    // MELHORIA 1: Limpeza de HTML e Limite reduzido
    let cleanBody = emailContent || 'Não fornecido';
    cleanBody = cleanBody.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
    if (cleanBody.length > 4000) {
        cleanBody = cleanBody.substring(0, 4000) + '... [CORTADO]';
    }

    let cleanHeaders = headers || 'Não fornecidos';
    if (cleanHeaders !== 'Não fornecidos' && cleanHeaders.length > 2000) {
        cleanHeaders = cleanHeaders.substring(0, 2000) + '... [CORTADO]';
    }

    // Investigação de domínios (limitada)
    let domainIntel = "Nenhum link detectado.";
    const domainDetails = [];
    
    if (foundUrls.length > 0) {
        const uniqueDomains = [...new Set(foundUrls.map(u => {
            try { 
                return new URL(u).hostname.replace('www.', ''); 
            } catch { 
                return null; 
            }
        }).filter(Boolean))];
        
        domainIntel = "DOMÍNIOS:\n";
        const domainsToCheck = uniqueDomains.slice(0, 5);
        
        // MELHORIA 3: Consultas WHOIS Paralelas (Velocidade Extrema)
        const ageResults = await Promise.all(
            domainsToCheck.map(domain => checkDomainAge(domain).then(age => ({ domain, age })))
        );
        
        ageResults.forEach(info => {
            domainIntel += `- ${info.domain} (${info.age})\n`;
            domainDetails.push({ domain: info.domain, age: info.age });
        });
    }

    // MELHORIA 4: Engenharia de Prompt (Chain of Thought)
    const systemPrompt = `Você é um Analista de Segurança Sênior. Sua missão é detectar PHISHING.
    
REGRAS DE ANÁLISE RIGOROSAS:
1. Compare os domínios informados na seção 'DOMÍNIOS' com o remetente alegado no texto.
2. Domínios com menos de 30 dias de vida ou nomes confusos representam risco EXTREMO.
3. Ignore formatação quebrada se os links forem legítimos.

Retorne APENAS JSON válido com:
- "Nivel_Risco" (0-100. Acima de 70 se houver links recém-criados ou falsos)
- "Veredito" (SEGURO, SUSPEITO, PERIGOSO)
- "Motivos" (array máx 5 itens explicando o racional técnico)
- "Recomendacao" (texto curto de ação sem acento na chave)`;

    try {
        // Timeout para a API
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

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
                max_tokens: 500,
                // MELHORIA 2: Frieza analítica máxima (Temperatura 0)
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

        // Adicionar informações detalhadas à resposta
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

        // Salvar no banco (não crítico)
        try {
            const db = await connectDb();
            await db.collection('phishing_threats').insertOne({
                timestamp: new Date(),
                analise: {
                    Nivel_Risco: analise.Nivel_Risco,
                    Veredito: analise.Veredito
                },
                ip: clientIp,
                remetente: sender,
                urls: foundUrls.length,
                duration: Date.now() - startTime
            });
        } catch (dbError) {
            context.log.error('Erro no banco:', dbError);
        }

        // Salvar no cache
        memoryCache.set(cacheKey, {
            data: respostaCompleta,
            timestamp: Date.now()
        });

        context.log.info('Análise concluída', { 
            duration: Date.now() - startTime,
            urls: foundUrls.length,
            veredito: analise.Veredito,
            risco: analise.Nivel_Risco,
            remetente: sender
        });

        context.res.status = 200;
        context.res.body = respostaCompleta;

    } catch (error) {
        context.log.error('Erro na análise:', error);
        
        context.res.status = 200;
        context.res.body = {
            Nivel_Risco: 50,
            Veredito: 'SUSPEITO',
            Motivos: ['Erro na análise automática'],
            Recomendacao: error.name === 'AbortError' 
                ? 'Tempo limite excedido. Tente novamente.'
                : 'Falha técnica. Encaminhe para análise manual.',
            detalhes_autenticacao: {
                spf: authDetails.spf || 'não verificado',
                dkim: authDetails.dkim || 'não verificado',
                dmarc: authDetails.dmarc || 'não verificado',
                raw: authDetails.raw || 'não disponível'
            },
            remetente: sender || 'não identificado',
            ip_remetente: senderIP || 'não identificado',
            urls_encontradas: foundUrls.slice(0, 10),
            dominios_analisados: domainDetails
        };
    }
};