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
    const maxRequests = 10;
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

// 🟢 CORREÇÃO FORENSE: Leitura à prova de bala para Microsoft O365 e Google
function extractAuthDetails(headers) {
    const authDetails = { spf: null, dkim: null, dmarc: null, autenticado: false, dominioAutenticado: null };
    if (!headers) return authDetails;
    
    // Unifica cabeçalhos dobrados (line wrapping)
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

function extractSender(headers) {
    const senderInfo = { nome_exibicao: 'Não identificado', email_real: 'Não identificado' };
    if (!headers) return senderInfo;
    const normHeaders = headers.replace(/\r?\n\s+/g, ' ');

    const returnPathMatch = normHeaders.match(/Return-Path:\s*<([^>]+)>/i);
    if (returnPathMatch) senderInfo.email_real = returnPathMatch[1].trim();

    // Procura por "From:" no início da linha para evitar confusões com Authentication-Results
    const fromMatch = normHeaders.match(/(?:^|\n)From:\s*(.*?)(?=\n[A-Z]|$)/i);
    if (fromMatch) {
        let fromRaw = fromMatch[1].trim();
        senderInfo.nome_exibicao = fromRaw.replace(/<.*?>/g, '').trim() || fromRaw;
        
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
    // Extrai o IP oficial (Suporta IPv4 e os novos IPv6 da Microsoft)
    const ipMatch = normHeaders.match(/sender IP is ([0-9a-fA-F:.]+)/i) || normHeaders.match(/ip=([0-9a-fA-F:.]+)/i) || normHeaders.match(/\[(\d{1,3}(?:\.\d{1,3}){3})\]/);
    return ipMatch ? ipMatch[1] : null;
}

function detectarAnexoHTML(emailContent, headers) {
    if (!headers && !emailContent) return false;
    const bodyToCheck = (headers || '') + '\n' + (emailContent || '');
    // Verifica APENAS ficheiros em anexo genuínos, ignorando links no corpo
    const regexAnexoReal = /Content-Disposition:\s*attachment;[\s\S]*?filename=["']?[^"'\r\n]+\.html?["']?/i;
    const regexBase64HTML = /Content-Type:\s*text\/html;\s*name=["']?[^"'\r\n]+\.html?["']?/i;
    return regexAnexoReal.test(bodyToCheck) || regexBase64HTML.test(bodyToCheck);
}

function analisarUrlsSuspeitas(urls) {
    const evidencias = [];
    const urlsDetalhadas = [];
    for (const url of urls) {
        try {
            const parsed = new URL(url);
            const hostname = parsed.hostname.toLowerCase();
            const isCloud = CLOUD_PLATFORMS.some(p => hostname.includes(p));
            urlsDetalhadas.push({ url: url.substring(0, 100), dominio: hostname, isCloud });
            if (isCloud && hostname.includes('onmicrosoft.com')) {
                evidencias.push(`URL hospedada em subdomínio Azure/O365 suspeito (${hostname})`);
            }
        } catch (e) {}
    }
    return { evidencias, urlsDetalhadas };
}

const systemPrompt = `Você é um Analista de Segurança Sênior (Nível 3). Sua missão é detectar PHISHING com precisão cirúrgica, evitando FALSOS POSITIVOS em e-mails reais de grandes empresas e mercado internacional.

REGRAS DE CLASSIFICAÇÃO (SIGA ESTRITAMENTE NESTA ORDEM):
1. A REGRA DE OURO DA AUTENTICAÇÃO: Verifique a seção 'AUTENTICAÇÃO E ORIGEM'. Se a 'Autenticação completa válida' for SIM (SPF ou DKIM pass), o e-mail tem a sua infraestrutura técnica confirmada. SE O CONTEÚDO FOR MARKETING ou SERVIÇOS LEGÍTIMOS (como Microsoft Power Apps, SharePoint, Bancos, Aviação), o 'Nivel_Risco' DEVE ser entre 0 e 15 (SEGURO).
2. COMPROMETIMENTO DE NUVEM (O365 / AZURE): Se o e-mail passou no SPF/DKIM mas a Origem é uma conta '.onmicrosoft.com' genérica, e o remetente finge ser de uma entidade famosa (ex: AAA Survey, Recursos Humanos), o e-mail não é legítimo, mas sim Spam/Phishing utilizando contas gratuitas. O Risco deve ser > 70.
3. QUISHING E VOICEMAILS: Considere PERIGOSO (100%) e-mails sem autenticação que peçam para scannear um "Código QR" (Quishing) ou "Voice Message" simulada.
4. FALSIDADE IDEOLÓGICA BÁSICA: Compare o 'Nome de Exibição' com o 'Remetente Real'. Ignorar falhas em empresas de e-mail marketing. Penalizar apenas se um remetente tentar simular ser quem não é (ex: fingir ser a Receita Federal via gmail.com).

Retorne APENAS JSON válido com as chaves exatas:
- "Nivel_Risco" (Número inteiro de 0 a 100)
- "Veredito" ("SEGURO", "SUSPEITO", "PERIGOSO")
- "Motivos" (Array com no máximo 5 itens curtos e objetivos)
- "Recomendacao" (Texto direto com orientação, chave sem acento)`;

module.exports = async function (context, req) {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';

    context.res = { headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' } };

    if (!checkRateLimit(clientIp)) {
        context.res.status = 429; context.res.body = { error: 'Rate Limit', Nivel_Risco: 50, Veredito: 'SUSPEITO', Motivos: ['Muitas requisições'] };
        return;
    }

    const { emailContent, headers } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!emailContent || emailContent.trim().length < 10) {
        context.res.status = 400; context.res.body = { Nivel_Risco: 0, Veredito: 'SEGURO', Motivos: ['Conteúdo insuficiente'] };
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
    const analiseUrls = analisarUrlsSuspeitas(foundUrls);

    let cleanBodyProcessed = (emailContent || '').replace(/<[^>]*>?/gm, ' ').substring(0, 4000);
    let cleanHeadersProcessed = (headers || '').substring(0, 2000);

    let localScore = 0;
    const evidenciasFortes = [];
    const evidenciasLeves = [];

    if (temAnexoHTML) { localScore += 50; evidenciasFortes.push('E-mail contém anexo HTML real - técnica de clone de site de login'); }
    
    const knownScams = /receita federal|irregularidade cpf|irs tax|voicemail|qr code|scan the qr|milhas expirando|fatura de pe[çc]as|car safety kit|survey reward/i.test(cleanBodyProcessed);
    if (knownScams) { localScore += 30; evidenciasLeves.push('Conteúdo utiliza temas de golpes conhecidos ou iscas de pesquisa falsas'); }

    // Deteção Avançada de Nuvem (O365 Comprometido)
    const isCloudSpam = senderData.email_real.includes('.onmicrosoft.com') && authDetails.autenticado;
    if (isCloudSpam && !senderData.nome_exibicao.toLowerCase().includes('microsoft')) {
        localScore += 40; evidenciasFortes.push('Alerta de Nuvem: E-mail disparado de infraestrutura gratuita O365 simulando empresa real');
    }

    localScore = Math.min(100, localScore);

    const intelMastigada = `
AUTENTICAÇÃO E ORIGEM:
- Nome de Exibição: ${senderData.nome_exibicao}
- Remetente Real: ${senderData.email_real}
- IP Origem: ${senderIP || 'Não identificado'}
- SPF: ${authDetails.spf || 'Não encontrado'}
- DKIM: ${authDetails.dkim || 'Não encontrado'}
- Domínio Autenticado: ${authDetails.dominioAutenticado || 'Não identificado'}
- Autenticação completa válida: ${authDetails.autenticado ? 'SIM' : 'NÃO'}

ANEXOS: ${temAnexoHTML ? 'SIM (ALTA SUSPEITA)' : 'Não (Limpo)'}
EVIDÊNCIAS LOCAIS:
${evidenciasFortes.map(e => '🔴 ' + e).join('\n')}
${evidenciasLeves.map(e => '🟡 ' + e).join('\n')}
`;

    try {
        const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [ { role: "system", content: systemPrompt }, { role: "user", content: `EMAIL:\n${cleanBodyProcessed}\n\n${intelMastigada}` } ],
                response_format: { type: "json_object" }, max_tokens: 500, temperature: 0.1
            }), signal: controller.signal
        });
        clearTimeout(timeout);

        const data = await groqResponse.json();
        let analise = JSON.parse(data.choices[0].message.content.replace(/```json|```/g, '').trim());
        
        let riscoIA = Math.max(0, parseInt(analise.Nivel_Risco) || 50);
        if (evidenciasFortes.length > 0) riscoIA = Math.max(riscoIA, 80);
        
        const riscoFinal = Math.min(100, riscoIA);
        const motivosCombinados = [...evidenciasFortes.slice(0, 3)];
        if (Array.isArray(analise.Motivos)) analise.Motivos.slice(0,3).forEach(m => { if(!motivosCombinados.includes(m)) motivosCombinados.push(m) });
        
        analise = { Nivel_Risco: riscoFinal, Veredito: riscoFinal >= 80 ? 'PERIGOSO' : (riscoFinal >= 40 ? 'SUSPEITO' : 'SEGURO'), Motivos: motivosCombinados.slice(0, 5), Recomendacao: analise.Recomendacao };
        
        const respostaCompleta = {
            ...analise,
            detalhes_autenticacao: { spf: authDetails.spf || 'não verificado', dkim: authDetails.dkim || 'não verificado', dmarc: authDetails.dmarc || 'não verificado' },
            remetente: senderData.nome_exibicao, return_path: senderData.email_real, ip_remetente: senderIP || 'não identificado', anexo_html: temAnexoHTML
        };

        memoryCache.set(cacheKey, { data: respostaCompleta, timestamp: Date.now() });
        context.res.status = 200; context.res.body = respostaCompleta;

    } catch (error) {
        context.res.status = 200; context.res.body = { Nivel_Risco: localScore, Veredito: localScore >= 80 ? 'PERIGOSO' : 'SEGURO', Motivos: evidenciasFortes, Recomendacao: 'Análise Local' };
    }
};
