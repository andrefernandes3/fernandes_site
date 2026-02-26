const fetch = require('node-fetch');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const memoryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
let cachedDb = null;
const rateLimit = new Map();

const CLOUD_PLATFORMS = ['run.app', 'cloudfunctions.net', 'azurewebsites.net', 'amazonaws.com', 'herokuapp.com', 'vercel.app', 'netlify.app', 'onmicrosoft.com', 'sharepoint.com'];

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of memoryCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) memoryCache.delete(key);
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
    const maxRequests = 15; // Aumentado para evitar bloqueios nos seus testes
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
    const regexes = [ /(https?:\/\/[^\s"'>\]\)]+)/gi, /href=["']([^"']+)["']/gi ];
    regexes.forEach(regex => {
        const matches = text.match(regex) || [];
        matches.forEach(m => {
            try {
                let cleanUrl = m.replace(/^href=["']/, '').replace(/["']$/, '');
                new URL(cleanUrl.startsWith('http') ? cleanUrl : 'http://' + cleanUrl);
                urls.add(cleanUrl);
            } catch {}
        });
    });
    return Array.from(urls).slice(0, 20);
}

// 🟢 NOVO MOTOR FORENSE: Lê corretamente cabeçalhos complexos da Microsoft (O365) e Google
function extractAuthDetails(headers) {
    const authDetails = { spf: null, dkim: null, dmarc: null, autenticado: false, dominioAutenticado: null };
    if (!headers) return authDetails;
    
    // Normaliza linhas dobradas
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

// 🟢 CORREÇÃO DO NOME "=": Extrai o Nome e E-mail Real perfeitamente
function extractSender(headers) {
    const senderInfo = { nome_exibicao: 'Não identificado', email_real: 'Não identificado' };
    if (!headers) return senderInfo;
    const normHeaders = headers.replace(/\r?\n\s+/g, ' ');

    const returnPathMatch = normHeaders.match(/Return-Path:\s*<([^>]+)>/i);
    if (returnPathMatch) senderInfo.email_real = returnPathMatch[1].trim();

    // Impede que leia a palavra "from" dentro de Authentication-Results
    const fromMatch = normHeaders.match(/(?:^|\n)From:\s*(.*?)(?=\n[A-Z]|$)/i);
    if (fromMatch) {
        let fromRaw = fromMatch[1].trim();
        // Remove os <email> para sobrar só o nome bonito
        senderInfo.nome_exibicao = fromRaw.replace(/<.*?>/g, '').trim() || fromRaw;
        
        if (senderInfo.email_real === 'Não identificado') {
            const emailMatch = fromRaw.match(/<([^>]+)>/);
            if (emailMatch) senderInfo.email_real = emailMatch[1].trim();
        }
    }
    return senderInfo;
}

// 🟢 LÊ IPV6 DA MICROSOFT ALÉM DOS ANTIGOS IPV4
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

const systemPrompt = `Você é um Analista de Segurança Sênior (Nível 3). Sua missão é detectar PHISHING com precisão cirúrgica, evitando FALSOS POSITIVOS em e-mails reais.

REGRAS DE CLASSIFICAÇÃO:
1. AUTENTICAÇÃO FORTE: Se 'Autenticação válida' for SIM (SPF ou DKIM pass), e o conteúdo for serviços conhecidos (SharePoint, Power Apps, Bancos), o 'Nivel_Risco' DEVE ser menor que 10.
2. ABUSO DE NUVEM: Se o domínio for '.onmicrosoft.com' genérico mas fingir ser AAA Survey ou HR, o Risco é 90+.
3. QUISHING: E-mails pedindo para scan de "Código QR" (VoiceMail falso) são 100% PERIGOSOS.

Retorne JSON: "Nivel_Risco" (0-100), "Veredito" (SEGURO, SUSPEITO, PERIGOSO), "Motivos" (array curto) e "Recomendacao" (texto direto).`;

module.exports = async function (context, req) {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';

    context.res = { headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' } };

    // Se bater limite de acessos, envia resposta formatada corretamente
    if (!checkRateLimit(clientIp)) {
        context.res.status = 429;
        context.res.body = { 
            Nivel_Risco: 50, Veredito: 'SUSPEITO', Motivos: ['Sistema anti-spam ativado: Limite de análises excedido.'], Recomendacao: 'Aguarde 1 minuto.',
            detalhes_autenticacao: { spf: 'nd', dkim: 'nd', dmarc: 'nd', dominio_autenticado: 'nd' },
            remetente: 'Sistema Proteção', return_path: 'nd', ip_remetente: clientIp
        };
        return;
    }

    const { emailContent, headers } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!emailContent || emailContent.trim().length < 10) {
        context.res.status = 400; 
        context.res.body = { Nivel_Risco: 0, Veredito: 'SEGURO', Motivos: ['Conteúdo insuficiente'] };
        return;
    }

    // Cache Hash seguro
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

    let cleanBodyProcessed = (emailContent || '').replace(/<[^>]*>?/gm, ' ').substring(0, 4000);
    let localScore = 0;
    const evidenciasFortes = [];
    const evidenciasLeves = [];

    if (temAnexoHTML) { localScore += 50; evidenciasFortes.push('Anexo HTML detetado - técnica comum de clone de login'); }
    
    const isCloudSpam = senderData.email_real.includes('.onmicrosoft.com') && authDetails.autenticado;
    if (isCloudSpam && !senderData.nome_exibicao.toLowerCase().includes('microsoft')) {
        localScore += 60; evidenciasFortes.push('Abuso de Nuvem: Enviado de conta O365 gratuita simulando empresa legítima');
    }

    const knownScams = /receita federal|irregularidade cpf|voicemail|qr code|scan the qr|milhas expirando|car safety kit|survey reward/i.test(cleanBodyProcessed);
    if (knownScams) { localScore += 40; evidenciasLeves.push('Conteúdo contém iscas clássicas de golpes (QR Codes, Pesquisas Falsas)'); }

    // Inteligência de Risco Dinâmico
    if (authDetails.autenticado && localScore === 0) localScore = 5;
    else if (!authDetails.autenticado && localScore < 50) localScore += 20;

    localScore = Math.min(100, localScore);

    const intelMastigada = `
    ORIGEM:
    - Nome: ${senderData.nome_exibicao}
    - SMTP Real: ${senderData.email_real}
    - IP: ${senderIP || 'Não identificado'}
    - SPF: ${authDetails.spf} | DKIM: ${authDetails.dkim}
    - Autenticação válida: ${authDetails.autenticado ? 'SIM' : 'NÃO'}
    EVIDÊNCIAS LOCAIS: ${evidenciasFortes.join(' | ')}
    `;

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
        if (authDetails.autenticado && evidenciasFortes.length === 0 && !knownScams) riscoFinal = Math.min(riscoFinal, 15);

        const respostaCompleta = {
            Nivel_Risco: riscoFinal,
            Veredito: riscoFinal >= 80 ? 'PERIGOSO' : (riscoFinal >= 40 ? 'SUSPEITO' : 'SEGURO'),
            Motivos: analise.Motivos || evidenciasFortes,
            Recomendacao: analise.Recomendacao || 'Analise com cautela.',
            detalhes_autenticacao: { spf: authDetails.spf, dkim: authDetails.dkim, dmarc: authDetails.dmarc, dominio_autenticado: authDetails.dominioAutenticado },
            remetente: senderData.nome_exibicao, return_path: senderData.email_real, ip_remetente: senderIP || 'Não identificado', anexo_html: temAnexoHTML
        };

        memoryCache.set(cacheKey, { data: respostaCompleta, timestamp: Date.now() });
        context.res.status = 200; context.res.body = respostaCompleta;

    } catch (error) {
        // Fallback Seguro à prova de falhas (Garante que os dados do remetente vão para a UI)
        context.res.status = 200; 
        context.res.body = { 
            Nivel_Risco: localScore, 
            Veredito: localScore >= 80 ? 'PERIGOSO' : (localScore >= 40 ? 'SUSPEITO' : 'SEGURO'), 
            Motivos: evidenciasFortes.length > 0 ? evidenciasFortes : ['Análise Heurística Rápida (IA Indisponível)'], 
            Recomendacao: 'Análise gerada localmente.',
            detalhes_autenticacao: { spf: authDetails.spf, dkim: authDetails.dkim, dmarc: authDetails.dmarc, dominio_autenticado: authDetails.dominioAutenticado },
            remetente: senderData.nome_exibicao, return_path: senderData.email_real, ip_remetente: senderIP || 'Não identificado', anexo_html: temAnexoHTML
        };
    }
};
