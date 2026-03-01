const fetch = require('node-fetch');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const memoryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
let cachedDb = null;
const rateLimit = new Map();

// 🟢 Adicionados domínios muito abusados em B2B (Canva, DocuSign, Google Storage)
const CLOUD_PLATFORMS = ['run.app', 'cloudfunctions.net', 'azurewebsites.net', 'amazonaws.com', 'herokuapp.com', 'vercel.app', 'netlify.app', 'onmicrosoft.com', 'sharepoint.com', 'canva.com', 'docusign.net', 'storage.googleapis.com'];

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
    const maxRequests = 15;
    const hashedIp = crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'default_salt')).digest('hex');
    const userRequests = rateLimit.get(hashedIp) || [];
    const recentRequests = userRequests.filter(time => now - time < windowMs);
    if (recentRequests.length >= maxRequests) return false;
    recentRequests.push(now);
    rateLimit.set(hashedIp, recentRequests);
    return true;
}

// 🟢 NOVO: Descodificador de E-mails (Quoted-Printable e Base64)
function decodeEmailBody(text) {
    if (!text) return '';
    let decoded = text;

    // 1. Descodifica Quoted-Printable (Remove quebras de linha com "=")
    decoded = decoded.replace(/=\r?\n/g, '');
    decoded = decoded.replace(/=([0-9A-F]{2})/gi, (match, hex) => {
        try { return String.fromCharCode(parseInt(hex, 16)); } catch (e) { return match; }
    });

    // 2. Extrai e Descodifica blocos Base64 ocultos
    const b64Regex = /Content-Transfer-Encoding:\s*base64[\s\S]*?\r?\n\r?\n([a-zA-Z0-9+/=\r\n]+)/gi;
    let match;
    while ((match = b64Regex.exec(text)) !== null) {
        let payload = match[1].replace(/[\r\n\s]+/g, '');
        if (payload.length > 50) {
            try { decoded += '\n' + Buffer.from(payload, 'base64').toString('utf-8'); } catch (e) { }
        }
    }
    return decoded;
}

// 🟢 NOVO: Descasca links de proteção (Microsoft SafeLinks, etc.)
function unwrapSafeLinks(url) {
    try {
        if (url.includes('safelinks.protection.outlook.com')) {
            const parsed = new URL(url);
            const actualUrl = parsed.searchParams.get('url');
            if (actualUrl) return decodeURIComponent(actualUrl);
        }
    } catch (e) { }
    return url;
}

// 🟢 ATUALIZADO: Extração de URLs com Desempacotamento
function extractUrls(text) {
    if (!text) return [];
    const urls = new Set();
    const decodedText = decodeEmailBody(text); // Transforma código num texto legível

    const regexes = [/(https?:\/\/[^\s"'>\]\)]+)/gi, /href=["']([^"']+)["']/gi];
    regexes.forEach(regex => {
        const matches = decodedText.match(regex) || [];
        matches.forEach(m => {
            try {
                let cleanUrl = m.replace(/^href=["']/, '').replace(/["']$/, '');
                cleanUrl = cleanUrl.startsWith('http') ? cleanUrl : 'http://' + cleanUrl;
                cleanUrl = unwrapSafeLinks(cleanUrl); // Descasca a proteção
                new URL(cleanUrl); // Valida se é URL
                urls.add(cleanUrl);
            } catch { }
        });
    });
    return Array.from(urls).slice(0, 20);
}

function getOrganizationalDomain(domain) {
    if (!domain) return null;
    const parts = domain.toLowerCase().split('.');
    if (parts.length <= 2) return domain.toLowerCase();
    return parts.slice(-2).join('.');
}

function extractFromDomain(headers) {
    if (!headers) return null;
    const norm = headers.replace(/\r?\n\s+/g, ' ');
    const match = norm.match(/From:.*?<([^>]+)>/i);
    if (!match) return null;
    const email = match[1].trim().toLowerCase();
    return email.split('@')[1] || null;
}

function extractAuthDetails(headers) {
    const authDetails = {
        spf: null,
        dkim: null,
        dmarc: null,
        spfDomain: null,
        dkimDomain: null,
        fromDomain: null,
        alinhamento: 'fail',
        autenticado: false
    };

    if (!headers) return authDetails;

    const normHeaders = headers.replace(/\r?\n\s+/g, ' ');

    // SPF
    const spfMatch = normHeaders.match(/spf=(pass|fail|softfail|none|neutral|permerror|temperror)/i);
    if (spfMatch) authDetails.spf = spfMatch[1].toLowerCase();

    const spfDomainMatch = normHeaders.match(/smtp\.mailfrom=([a-zA-Z0-9.-]+)/i);
    if (spfDomainMatch) authDetails.spfDomain = spfDomainMatch[1].toLowerCase();

    // DKIM
    const dkimMatch = normHeaders.match(/dkim=(pass|fail|none)/i);
    if (dkimMatch) authDetails.dkim = dkimMatch[1].toLowerCase();

    const dkimDomainMatch = normHeaders.match(/header\.d=([a-zA-Z0-9.-]+)/i);
    if (dkimDomainMatch) authDetails.dkimDomain = dkimDomainMatch[1].toLowerCase();

    // DMARC
    const dmarcMatch = normHeaders.match(/dmarc=(pass|fail|bestguesspass|none)/i);
    if (dmarcMatch) authDetails.dmarc = dmarcMatch[1].toLowerCase();

    // FROM
    authDetails.fromDomain = extractFromDomain(headers);

    // ===== ALINHAMENTO REAL =====
    const fromOrg = getOrganizationalDomain(authDetails.fromDomain);
    const spfOrg = getOrganizationalDomain(authDetails.spfDomain);
    const dkimOrg = getOrganizationalDomain(authDetails.dkimDomain);

    const spfAligned = authDetails.spf === 'pass' && fromOrg && spfOrg && fromOrg === spfOrg;
    const dkimAligned = authDetails.dkim === 'pass' && fromOrg && dkimOrg && fromOrg === dkimOrg;

    if (spfAligned || dkimAligned) {
        authDetails.alinhamento = 'pass';
        authDetails.autenticado = true;
    } else {
        authDetails.alinhamento = 'fail';
        authDetails.autenticado = false;
    }

    return authDetails;
}

// 🟢 NOVO: Tradutor de Nomes de E-mail (Descodifica RFC 2047 como =?utf-8?q?...)
function decodeRFC2047(text) {
    if (!text) return text;
    return text.replace(/=\?([^?]+)\?([qb])\?([^?]*)\?=/gi, (match, charset, encoding, data) => {
        try {
            if (encoding.toLowerCase() === 'b') {
                return Buffer.from(data, 'base64').toString('utf-8');
            } else if (encoding.toLowerCase() === 'q') {
                // Limpa o Quoted-Printable e converte de volta para UTF-8
                let qText = data.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (m, hex) => {
                    return String.fromCharCode(parseInt(hex, 16));
                });
                return Buffer.from(qText, 'binary').toString('utf-8');
            }
        } catch (e) { }
        return match;
    });
}

// 🟢 ATUALIZADO: Extrai o remetente e passa pelo tradutor
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

        // Aplica o nosso novo tradutor para limpar o nome!
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
        } catch (e) { }
    }
    return { evidencias, urlsDetalhadas };
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
        context.res.body = { Nivel_Risco: 50, Veredito: 'SUSPEITO', Motivos: ['Limite de requisições excedido.'], Recomendacao: 'Aguarde 1 minuto.' };
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

    // 🟢 Extração com Desencriptação Integrada
    const foundUrls = extractUrls(emailContent || '');
    const authDetails = extractAuthDetails(headers);
    const senderData = extractSender(headers);
    const senderIP = extractSenderIP(headers);
    const temAnexoHTML = detectarAnexoHTML(emailContent, headers);
    const analiseUrls = analisarUrlsSuspeitas(foundUrls);

    // Desencriptamos também o corpo para análise Heurística Local
    let cleanBodyProcessed = decodeEmailBody(emailContent || '').replace(/<[^>]*>?/gm, ' ').substring(0, 4000);

    let localScore = 0;
    const evidenciasFortes = [];
    const evidenciasLeves = [];

    if (temAnexoHTML) { localScore += 50; evidenciasFortes.push('Anexo HTML detetado - técnica comum de clone de login'); }

    // Alerta específico para links do Canva / DocuSign escondidos
    const hasAbusedPlatform = foundUrls.some(u => u.includes('canva.com') || u.includes('docusign.net'));
    if (hasAbusedPlatform) {
        localScore += 40; evidenciasFortes.push('E-mail contém link para Canva / DocuSign (Muito usado em Phishing B2B)');
    }

    const isCloudSpam = senderData.email_real.includes('.onmicrosoft.com') && authDetails.autenticado;
    if (isCloudSpam && !senderData.nome_exibicao.toLowerCase().includes('microsoft')) {
        localScore += 60; evidenciasFortes.push('Abuso de Nuvem: Enviado de conta O365 gratuita simulando empresa legítima');
    }

    const knownScams = /quotation|multilinesrvcs|canva|docusign|receita federal|voicemail|qr code|fatura de pe[çc]as/i.test(cleanBodyProcessed);
    if (knownScams) { localScore += 40; evidenciasLeves.push('Conteúdo contém iscas clássicas de golpes (Faturas falsas, DocuSign)'); }

    if (authDetails.autenticado && localScore === 0) localScore = 5;
    else if (!authDetails.autenticado && localScore < 50) localScore += 20;

    localScore = Math.min(100, localScore);

    // 🟢 NOVA INTEGRAÇÃO: urlscan.io (Raio-X forense)
    let urlscanUuid = null;
    if (foundUrls && foundUrls.length > 0 && process.env.URLSCAN_API_KEY) {
        try {
            const primeiraUrl = foundUrls[0];
            const scanResponse = await fetch('https://urlscan.io/api/v1/scan/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'API-Key': process.env.URLSCAN_API_KEY
                },
                body: JSON.stringify({
                    url: primeiraUrl,
                    visibility: 'public' // Mantemos como public para os limites gratuitos
                })
            });

            if (scanResponse.ok) {
                const scanData = await scanResponse.json();
                if (scanData.uuid) {
                    urlscanUuid = scanData.uuid; // Guardamos o identificador único da foto
                }
            }
        } catch (e) {
            console.error('Falha ao contactar urlscan.io:', e);
        }
    }

    const intelMastigada = `
    ORIGEM:
    - Nome: ${senderData.nome_exibicao}
    - SMTP Real: ${senderData.email_real}
    - IP: ${senderIP || 'Não identificado'}
    - SPF: ${authDetails.spf} | DKIM: ${authDetails.dkim}
    - Autenticação válida: ${authDetails.autenticado ? 'SIM' : 'NÃO'}
    URLs ENCONTRADAS (${foundUrls.length}):
    ${foundUrls.slice(0, 5).join('\n')}
    EVIDÊNCIAS LOCAIS: ${evidenciasFortes.join(' | ')}
    `;

    try {
        const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8000);
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `EMAIL:\n${cleanBodyProcessed}\n\n${intelMastigada}` }],
                response_format: { type: "json_object" }, max_tokens: 300, temperature: 0.1
            }), signal: controller.signal
        });
        clearTimeout(timeout);

        const data = await groqResponse.json();
        let analise = JSON.parse(data.choices[0].message.content);

        let riscoFinal = parseInt(analise.Nivel_Risco) || localScore;
        if (evidenciasFortes.length > 0) riscoFinal = Math.max(riscoFinal, 80);
        if (authDetails.autenticado && evidenciasFortes.length === 0 && !knownScams && !hasAbusedPlatform) riscoFinal = Math.min(riscoFinal, 15);

        const respostaCompleta = {
            Nivel_Risco: riscoFinal,
            Veredito: riscoFinal >= 80 ? 'PERIGOSO' : (riscoFinal >= 40 ? 'SUSPEITO' : 'SEGURO'),
            Motivos: analise.Motivos || evidenciasFortes,
            Recomendacao: analise.Recomendacao || 'Analise com cautela.',
            detalhes_autenticacao: {
                spf: authDetails.spf,
                dkim: authDetails.dkim,
                dmarc: authDetails.dmarc,
                alinhamento: authDetails.alinhamento,
                from_domain: authDetails.fromDomain,
                spf_domain: authDetails.spfDomain,
                dkim_domain: authDetails.dkimDomain
            },
            remetente: senderData.nome_exibicao, return_path: senderData.email_real, ip_remetente: senderIP || 'Não identificado', anexo_html: temAnexoHTML,
            urls_encontradas: foundUrls,
            urlscan_uuid: urlscanUuid
        };

        // 🟢 SALVA NO BANCO DE DADOS (SUCESSO COM IA)
        try {
            const db = await connectDb();
            await db.collection('analises_phishing').insertOne({
                data_analise: new Date(),
                ip_cliente: clientIp,
                remetente_analisado: senderData.email_real,
                resultado: respostaCompleta,
                ia_utilizada: true
            });
        } catch (dbErr) { console.error('Erro ao salvar no MongoDB (Sucesso):', dbErr); }

        memoryCache.set(cacheKey, { data: respostaCompleta, timestamp: Date.now() });
        context.res.status = 200; context.res.body = respostaCompleta;

    } catch (error) {
        context.res.status = 200;
        const falhaCompleta = {
            Nivel_Risco: localScore,
            Veredito: localScore >= 80 ? 'PERIGOSO' : (localScore >= 40 ? 'SUSPEITO' : 'SEGURO'),
            Motivos: evidenciasFortes.length > 0 ? evidenciasFortes : ['Análise Heurística Rápida'],
            Recomendacao: 'Análise gerada localmente. O motor de IA excedeu o tempo de resposta.',
            detalhes_autenticacao: { spf: authDetails.spf, dkim: authDetails.dkim, dmarc: authDetails.dmarc, dominio_autenticado: authDetails.dominioAutenticado },
            remetente: senderData.nome_exibicao, return_path: senderData.email_real, ip_remetente: senderIP || 'Não identificado', anexo_html: temAnexoHTML,
            urls_encontradas: foundUrls,
            urlscan_uuid: urlscanUuid
        };

        // 🟢 SALVA NO BANCO DE DADOS MESMO SE O GROQ FALHAR (FALLBACK)
        try {
            const db = await connectDb();
            await db.collection('analises_phishing').insertOne({
                data_analise: new Date(),
                ip_cliente: clientIp,
                remetente_analisado: senderData.email_real,
                resultado: falhaCompleta,
                ia_utilizada: false, // Regista no BD que esta análise foi feita sem a ajuda do Groq
                erro_gerado: error.message
            });
        } catch (dbErr) { console.error('Erro ao salvar no MongoDB (Falha):', dbErr); }

        context.res.body = falhaCompleta;
    }
};
