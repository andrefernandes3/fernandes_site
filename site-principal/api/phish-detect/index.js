const fetch = require('node-fetch');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const memoryCache = new Map();
// 🟢 CACHE REDUZIDO PARA 15 SEGUNDOS DURANTE OS TESTES (para não bloquear as suas atualizações)
const CACHE_TTL = 15 * 1000; 
let cachedDb = null;
const rateLimit = new Map();

const CLOUD_PLATFORMS = ['run.app', 'cloudfunctions.net', 'azurewebsites.net', 'amazonaws.com', 'herokuapp.com', 'vercel.app', 'netlify.app', 'onmicrosoft.com', 'sharepoint.com', 'canva.com', 'docusign.net', 'storage.googleapis.com'];

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of memoryCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) memoryCache.delete(key);
    }
}, 60 * 1000);

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
    const maxRequests = 20; 
    const hashedIp = crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'default_salt')).digest('hex');
    const userRequests = rateLimit.get(hashedIp) || [];
    const recentRequests = userRequests.filter(time => now - time < windowMs);
    if (recentRequests.length >= maxRequests) return false;
    recentRequests.push(now);
    rateLimit.set(hashedIp, recentRequests);
    return true;
}

function decodeEmailBody(text) {
    if (!text) return '';
    let decoded = text;
    decoded = decoded.replace(/=\r?\n/g, '');
    decoded = decoded.replace(/=([0-9A-F]{2})/gi, (match, hex) => {
        try { return String.fromCharCode(parseInt(hex, 16)); } catch(e) { return match; }
    });
    const b64Regex = /Content-Transfer-Encoding:\s*base64[\s\S]*?\r?\n\r?\n([a-zA-Z0-9+/=\r\n]+)/gi;
    let match;
    while ((match = b64Regex.exec(text)) !== null) {
        let payload = match[1].replace(/[\r\n\s]+/g, '');
        if (payload.length > 50) {
            try { decoded += '\n' + Buffer.from(payload, 'base64').toString('utf-8'); } catch(e) {}
        }
    }
    return decoded;
}

function unwrapSafeLinks(url) {
    try {
        if (url.includes('safelinks.protection.outlook.com')) {
            const parsed = new URL(url);
            const actualUrl = parsed.searchParams.get('url');
            if (actualUrl) return decodeURIComponent(actualUrl);
        }
    } catch(e) {}
    return url;
}

function extractUrls(text) {
    if (!text) return [];
    const urls = new Set();
    const decodedText = decodeEmailBody(text); 
    
    const regexes = [ /(https?:\/\/[^\s"'>\]\)]+)/gi, /href=["']([^"']+)["']/gi ];
    regexes.forEach(regex => {
        const matches = decodedText.match(regex) || [];
        matches.forEach(m => {
            try {
                let cleanUrl = m.replace(/^href=["']/, '').replace(/["']$/, '');
                cleanUrl = cleanUrl.startsWith('http') ? cleanUrl : 'http://' + cleanUrl;
                cleanUrl = unwrapSafeLinks(cleanUrl);
                new URL(cleanUrl); 
                urls.add(cleanUrl);
            } catch {}
        });
    });
    return Array.from(urls).slice(0, 20);
}

function extractAuthDetails(headers) {
    const authDetails = { spf: null, dkim: null, dmarc: null, autenticado: false, dominioAutenticado: null };
    if (!headers) return authDetails;
    const normHeaders = headers.replace(/\r?\n\s+/g, ' ');
    
    const spfMatch = normHeaders.match(/spf=(pass|fail|softfail|none|neutral|permerror|temperror)/i);
    if (spfMatch) authDetails.spf = spfMatch[1].toLowerCase();
    
    const dkimMatch = normHeaders.match(/dkim=(pass|fail|none)/i);
    if (dkimMatch) authDetails.dkim = dkimMatch[1].toLowerCase();
    
    const dmarcMatch = normHeaders.match(/dmarc=(pass|fail|bestguesspass|none)/i);
    if (dmarcMatch) authDetails.dmarc = dmarcMatch[1].toLowerCase();
    
    const dkimDomainMatch = normHeaders.match(/header\.d=([a-zA-Z0-9.-]+)/i);
    const spfDomainMatch = normHeaders.match(/smtp\.mailfrom=([a-zA-Z0-9.-]+)/i);
    authDetails.dominioAutenticado = (dkimDomainMatch?.[1] || spfDomainMatch?.[1] || '').toLowerCase();
    authDetails.autenticado = (authDetails.spf === 'pass' || authDetails.dkim === 'pass');
    return authDetails;
}

function decodeRFC2047(text) {
    if (!text) return text;
    return text.replace(/=\?([^?]+)\?([qb])\?([^?]*)\?=/gi, (match, charset, encoding, data) => {
        try {
            if (encoding.toLowerCase() === 'b') return Buffer.from(data, 'base64').toString('utf-8');
            else if (encoding.toLowerCase() === 'q') {
                let qText = data.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (m, hex) => String.fromCharCode(parseInt(hex, 16)));
                return Buffer.from(qText, 'binary').toString('utf-8');
            }
        } catch (e) {}
        return match;
    });
}

function extractSender(headers) {
    const senderInfo = { nome_exibicao: 'Não identificado', email_real: 'Não identificado' };
    if (!headers) return senderInfo;
    const normHeaders = headers.replace(/\r?\n\s+/g, ' ');

    const returnPathMatch = normHeaders.match(/Return-Path:\s*<([^>]+)>/i);
    if (returnPathMatch) senderInfo.email_real = returnPathMatch[1].trim();

    const fromMatch = normHeaders.match(/(?:^|\n)From:\s*(.*?)(?=\n[A-Z]|$)/i);
    if (fromMatch) {
        let fromRaw = fromMatch[1].trim();
        let nameRaw = fromRaw.replace(/<.*?>/g, '').trim() || fromRaw;
        senderInfo.nome_exibicao = decodeRFC2047(nameRaw);
        
        if (senderInfo.email_real === 'Não identificado') {
            const emailMatch = fromRaw.match(/<([^>]+)>/);
            if (emailMatch) senderInfo.email_real = emailMatch[1].trim();
        }
    }
    return senderInfo;
}

function extractSenderIP(headers) {
    if (!headers) return null;
    const normHeaders = headers.replace(/\r?\n\s+/g, ' ');
    const ipMatch = normHeaders.match(/sender IP is ([0-9a-fA-F:.]+)/i) || normHeaders.match(/ip=([0-9a-fA-F:.]+)/i) || normHeaders.match(/\[(\d{1,3}(?:\.\d{1,3}){3})\]/);
    return ipMatch ? ipMatch[1] : null;
}

function detectarAnexoHTML(emailContent, headers) {
    if (!headers && !emailContent) return false;
    const bodyToCheck = (headers || '') + '\n' + (emailContent || '');
    const regexAnexoReal = /Content-Disposition:\s*attachment;[\s\S]*?filename=["']?[^"'\r\n]+\.html?["']?/i;
    const regexBase64HTML = /Content-Type:\s*text\/html;\s*name=["']?[^"'\r\n]+\.html?["']?/i;
    return regexAnexoReal.test(bodyToCheck) || regexBase64HTML.test(bodyToCheck);
}

const systemPrompt = `Você é um Analista de Segurança Sênior (Nível 3). Sua missão é detectar PHISHING com precisão cirúrgica.
REGRAS DE CLASSIFICAÇÃO:
1. AUTENTICAÇÃO FORTE: Se 'Autenticação válida' for SIM (SPF/DKIM pass), e o conteúdo for de serviços legítimos, Nivel_Risco < 15.
2. ABUSO DE NUVEM (BEC): Se um e-mail com domínios gratuitos (ex: onmicrosoft.com) tentar passar-se por uma empresa legítima, o risco é PERIGOSO.
3. QUISHING E B2B SCAM: E-mails sem autenticação contendo falsas faturas (DocuSign, Canva, SharePoint) são 100% PERIGOSOS.
Retorne JSON: "Nivel_Risco" (0-100), "Veredito" (SEGURO, SUSPEITO, PERIGOSO), "Motivos" (array curto) e "Recomendacao".`;

module.exports = async function (context, req) {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
    context.res = { headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' } };

    if (!checkRateLimit(clientIp)) {
        context.res.status = 429;
        context.res.body = { Nivel_Risco: 50, Veredito: 'SUSPEITO', Motivos: ['Limite excedido'], Recomendacao: 'Aguarde 1 min.' };
        return;
    }

    const { emailContent, headers } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!emailContent || emailContent.trim().length < 10) {
        context.res.status = 400; 
        context.res.body = { Nivel_Risco: 0, Veredito: 'SEGURO', Motivos: ['Conteúdo insuficiente'] };
        return;
    }

    const cacheKey = crypto.createHash('sha256').update((emailContent || '') + (headers || '')).digest('hex');
    const cachedItem = memoryCache.get(cacheKey);
    if (cachedItem && (Date.now() - cachedItem.timestamp < CACHE_TTL)) {
        context.res.status = 200; context.res.body = cachedItem.data; return;
    }

    const foundUrls = extractUrls(emailContent || '');
    const authDetails = extractAuthDetails(headers);
    const senderData = extractSender(headers);
    const senderIP = extractSenderIP(headers);
    const temAnexoHTML = detectarAnexoHTML(emailContent, headers);
    
    let cleanBodyProcessed = decodeEmailBody(emailContent || '').replace(/<[^>]*>?/gm, ' ').substring(0, 4000);
    
    let localScore = 0;
    const evidenciasFortes = [];
    const evidenciasLeves = [];

    if (temAnexoHTML) { localScore += 50; evidenciasFortes.push('Anexo HTML detetado - técnica comum de clone de login'); }
    if (foundUrls.some(u => u.includes('canva.com') || u.includes('docusign.net'))) { localScore += 40; evidenciasFortes.push('E-mail contém link para Canva/DocuSign'); }
    if (senderData.email_real.includes('.onmicrosoft.com') && !senderData.nome_exibicao.toLowerCase().includes('microsoft')) { localScore += 60; evidenciasFortes.push('Abuso de Nuvem (O365)'); }
    if (/quotation|multilinesrvcs|canva|docusign|receita federal|voicemail|qr code|fatura de pe[çc]as/i.test(cleanBodyProcessed)) { localScore += 40; evidenciasLeves.push('Iscas clássicas de golpes'); }

    if (authDetails.autenticado && localScore === 0) localScore = 5;
    else if (!authDetails.autenticado && localScore < 50) localScore += 20;
    localScore = Math.min(100, localScore);

    // 🟢 urlscan.io COM ANTI-OBFUSCAÇÃO
    let urlscanUuid = null;
    if (foundUrls && foundUrls.length > 0 && process.env.URLSCAN_API_KEY) {
        try {
            let primeiraUrl = foundUrls[0];
            try {
                const urlObj = new URL(primeiraUrl);
                if (urlObj.username || urlObj.password) {
                    // Corta o falso usuário da URL para não ser bloqueado (o truque do @)
                    primeiraUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}${urlObj.search}`;
                }
            } catch (e) { }

            const scanResponse = await fetch('https://urlscan.io/api/v1/scan/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'API-Key': process.env.URLSCAN_API_KEY },
                body: JSON.stringify({ url: primeiraUrl, visibility: 'public' })
            });

            if (scanResponse.ok) {
                const scanData = await scanResponse.json();
                if (scanData.uuid) urlscanUuid = scanData.uuid;
            }
        } catch (e) { console.error('Falha no urlscan:', e); }
    }

    const intelMastigada = `ORIGEM: Nome: ${senderData.nome_exibicao} | SMTP: ${senderData.email_real} | IP: ${senderIP} | SPF: ${authDetails.spf}
URLs (${foundUrls.length}): ${foundUrls.slice(0, 5).join('\n')}
EVIDÊNCIAS: ${evidenciasFortes.join(' | ')}`;

    try {
        const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8000);
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [ { role: "system", content: systemPrompt }, { role: "user", content: `EMAIL:\n${cleanBodyProcessed}\n\n${intelMastigada}` } ],
                response_format: { type: "json_object" }, max_tokens: 300, temperature: 0.1
            }), signal: controller.signal
        });
        clearTimeout(timeout);

        const data = await groqResponse.json();
        let analise = JSON.parse(data.choices[0].message.content);
        
        let riscoFinal = parseInt(analise.Nivel_Risco) || localScore;
        if (evidenciasFortes.length > 0) riscoFinal = Math.max(riscoFinal, 80);

        const respostaCompleta = {
            Nivel_Risco: riscoFinal, Veredito: riscoFinal >= 80 ? 'PERIGOSO' : (riscoFinal >= 40 ? 'SUSPEITO' : 'SEGURO'),
            Motivos: analise.Motivos || evidenciasFortes, Recomendacao: analise.Recomendacao || 'Analise.',
            detalhes_autenticacao: { spf: authDetails.spf, dkim: authDetails.dkim, dmarc: authDetails.dmarc, dominio_autenticado: authDetails.dominioAutenticado },
            remetente: senderData.nome_exibicao, return_path: senderData.email_real, ip_remetente: senderIP, anexo_html: temAnexoHTML,
            urls_encontradas: foundUrls, 
            urlscan_uuid: urlscanUuid // 🟢 Envia a foto
        };

        try {
            const db = await connectDb();
            await db.collection('analises_phishing').insertOne({ data_analise: new Date(), ip_cliente: clientIp, remetente_analisado: senderData.email_real, resultado: respostaCompleta, ia_utilizada: true });
        } catch (e) {}

        memoryCache.set(cacheKey, { data: respostaCompleta, timestamp: Date.now() });
        context.res.status = 200; context.res.body = respostaCompleta;

    } catch (error) {
        context.res.status = 200; 
        const falhaCompleta = { 
            Nivel_Risco: localScore, Veredito: localScore >= 80 ? 'PERIGOSO' : (localScore >= 40 ? 'SUSPEITO' : 'SEGURO'), 
            Motivos: evidenciasFortes.length > 0 ? evidenciasFortes : ['Análise Heurística Rápida'], Recomendacao: 'Motor de IA excedeu tempo.',
            detalhes_autenticacao: { spf: authDetails.spf, dkim: authDetails.dkim, dmarc: authDetails.dmarc, dominio_autenticado: authDetails.dominioAutenticado },
            remetente: senderData.nome_exibicao, return_path: senderData.email_real, ip_remetente: senderIP, anexo_html: temAnexoHTML,
            urls_encontradas: foundUrls, urlscan_uuid: urlscanUuid 
        };
        try {
            const db = await connectDb();
            await db.collection('analises_phishing').insertOne({ data_analise: new Date(), ip_cliente: clientIp, remetente_analisado: senderData.email_real, resultado: falhaCompleta, ia_utilizada: false, erro_gerado: error.message });
        } catch (e) {}
        context.res.body = falhaCompleta;
    }
};