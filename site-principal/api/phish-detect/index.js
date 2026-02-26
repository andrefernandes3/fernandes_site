const fetch = require('node-fetch');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

// CACHE NATIVO
const memoryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

let cachedDb = null;
const rateLimit = new Map();

const DOMINIOS_OFICIAIS = ['receita.fazenda.gov.br', 'gov.br', 'fazenda.gov.br', 'economia.gov.br'];
const CLOUD_PLATFORMS = ['run.app', 'cloudfunctions.net', 'azurewebsites.net', 'amazonaws.com', 'herokuapp.com', 'vercel.app', 'netlify.app', 'firebaseapp.com', 'web.app', 'pages.dev'];
const ESP_PLATFORMS = ['exct.net', 'sendgrid.net', 'salesforce.com', 'mailchimp.com', 'hubspot.com', 'emkt.com.br', 'marketingcloud.com'];

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
    
    // ✅ REGEX CORRETOS para Node.js (sem escapes duplos)
    const regexes = [
        /(https?:\/\/[^\s"'>\]\)]+)/gi,
        /href=["']([^"']+)["']/gi, 
        /src=["']([^"']+)["']/gi
    ];
    
    regexes.forEach(regex => {
        const matches = text.match(regex) || [];
        matches.forEach(m => {
            try {
                let cleanUrl = m;
                // Limpa href/src= se existir
                cleanUrl = cleanUrl.replace(/^href=["']|src=["']/, '').replace(/["']$/, '');
                // Valida URL
                new URL(cleanUrl.startsWith('http') ? cleanUrl : 'http://' + cleanUrl);
                urls.add(cleanUrl);
            } catch {}
        });
    });
    
    return Array.from(urls).slice(0, 20);
}


function extractAuthDetails(headers) {
    const authDetails = { spf: null, dkim: null, dmarc: null, raw: null, autenticado: false, dominioAutenticado: null, dominioConfiavel: false, motivo: null };
    if (!headers) return authDetails;
    
    // ✅ CORRIGIDO: Remove escapes duplos
    const normalizedHeaders = headers.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
    const authMatch = normalizedHeaders.match(/Authentication-Results:(.*?)(?:\n[A-Z]|\n\n|$)/is);
    if (authMatch) {
        authDetails.raw = authMatch[1].trim();
        const spfMatch = authDetails.raw.match(/spf=([^\s;]+)/i);
        if (spfMatch) authDetails.spf = spfMatch[1];
        const dkimMatch = authDetails.raw.match(/dkim=([^\s;]+)/i);
        if (dkimMatch) authDetails.dkim = dkimMatch[1];
        const dmarcMatch = authDetails.raw.match(/dmarc=([^\s;]+)/i);
        if (dmarcMatch) authDetails.dmarc = dmarcMatch[1];
        const spfDomainMatch = authDetails.raw.match(/spf=pass\s+smtp\.mailfrom=([^\s;]+)/i);
        const dkimDomainMatch = authDetails.raw.match(/dkim=pass\s+header\.d=([^\s;]+)/i);
        const fromDomainMatch = headers.match(/From:.*?<.*?@([^\s>]+)>/i);
        authDetails.dominioAutenticado = spfDomainMatch?.[1] || dkimDomainMatch?.[1] || fromDomainMatch?.[1] || null;
        if (authDetails.dominioAutenticado) {
            authDetails.dominioConfiavel = DOMINIOS_OFICIAIS.some(dom => authDetails.dominioAutenticado.includes(dom));
        }
        authDetails.autenticado = (authDetails.spf?.toLowerCase() === 'pass' && authDetails.dkim?.toLowerCase() === 'pass' && authDetails.dominioConfiavel);
        if (authDetails.spf === 'pass' && authDetails.dkim === 'pass' && !authDetails.dominioConfiavel) {
            authDetails.motivo = 'Autenticação passou, mas domínio não é oficial';
        }
    }
    return authDetails;
}

function extractSender(headers) {
    const senderInfo = { nome_exibicao: 'Não identificado', email_real: 'Não identificado' };
    if (!headers) return senderInfo;
    const returnPathMatch = headers.match(/Return-Path:\s*<?([^>\s]+)>?/i);
    if (returnPathMatch) senderInfo.email_real = returnPathMatch[1].trim();
    const fromMatch = headers.match(/From:?\s*(.*?)(?:\n[A-Z]|\n\n|$)/i);
    if (fromMatch) {
        const fromRaw = fromMatch[1].trim();
        senderInfo.nome_exibicao = fromRaw;
        if (senderInfo.email_real === 'Não identificado') {
            const emailMatch = fromRaw.match(/<([^>]+)>/);
            if (emailMatch) senderInfo.email_real = emailMatch[1].trim();
            else senderInfo.email_real = fromRaw;
        }
    }
    return senderInfo;
}

function extractSenderIP(headers) {
    if (!headers) return null;
    const ipMatch = headers.match(/\[(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]/);
    if (ipMatch) return ipMatch[1];
    const authResults = headers.match(/Authentication-Results:.*?smtp\.mailfrom=.*?ip=([^\s\];]+)/i);
    if (authResults) return authResults[1];
    return null;
}

function detectarAnexoHTML(emailContent) {
    if (!emailContent) return false;    
    // Procura APENAS por ficheiros anexados onde o nome termine em .htm ou .html
    // Ignora o corpo (text/html) que todos os e-mails legítimos usam
    const regexAnexo = /filename=["']?[^"'\r\n]+\.html?["']?/i;
    
    return regexAnexo.test(emailContent);
}

function analisarUrlsSuspeitas(urls) {
    const evidencias = [];
    const urlsDetalhadas = [];
    for (const url of urls) {
        try {
            const parsed = new URL(url);
            const hostname = parsed.hostname.toLowerCase();
            const detalhe = {
                url: url.substring(0, 100),
                dominio: hostname,
                isCloud: CLOUD_PLATFORMS.some(p => hostname.includes(p)),
                isESP: ESP_PLATFORMS.some(p => hostname.includes(p)),
                temDisfarceGov: url.includes('gov.br') && !hostname.includes('gov.br'),
                path: parsed.pathname
            };
            urlsDetalhadas.push(detalhe);
            if (detalhe.isCloud && detalhe.temDisfarceGov) evidencias.push(`URL em nuvem pública (${hostname}) com tentativa de disfarce gov.br - ALTA SUSPEITA`);
            else if (detalhe.isCloud) evidencias.push(`URL hospedada em nuvem pública (${hostname}) - requer verificação cuidadosa`);
            else if (detalhe.temDisfarceGov) evidencias.push(`URL tenta disfarçar destino incluindo gov.br no caminho: ${url.substring(0, 80)}`);
        } catch (e) {}
    }
    return { evidencias, urlsDetalhadas };
}

async function checkDomainAge(domain) {
    if (CLOUD_PLATFORMS.some(p => domain.includes(p))) return "Plataforma de nuvem pública (idade irrelevante)";
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`https://rdap.org/domain/${domain}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) return "Idade oculta (Proteção de Privacidade Normal)";
        const data = await res.json();
        const regEvent = data.events?.find(e => e.eventAction === 'registration');
        if (regEvent) {
            const ageDays = Math.floor((new Date() - new Date(regEvent.eventDate)) / (1000 * 60 * 60 * 24));
            return `${ageDays} dias`;
        }
        return "Privado (Normal)";
    } catch { return "Consulta indisponível (Ignorar, não é um risco)"; }
}

async function checkVirusTotal(domain) {
    const vtKey = process.env.VT_API_KEY;
    if (!vtKey) return null;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const response = await fetch(`https://www.virustotal.com/api/v3/domains/${domain}`, {
            method: 'GET',
            headers: { 'x-apikey': vtKey },
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!response.ok) return null;
        const data = await response.json();
        const stats = data.data.attributes.last_analysis_stats;
        const totalMalicious = (stats.malicious || 0) + (stats.phishing || 0) + (stats.malware || 0);
        if (totalMalicious > 0) return `ALERTA VERMELHO: ${totalMalicious} motores de antivírus classificaram este domínio como PERIGOSO/PHISHING!`;
        return "Limpo nos motores de antivírus";
    } catch (e) { return null; }
}

const systemPrompt = `Você é um Analista de Segurança Sênior (Nível 3). Sua missão é detectar PHISHING com precisão cirúrgica, evitando FALSOS POSITIVOS em e-mails reais de grandes empresas e mercado internacional.

REGRAS DE CLASSIFICAÇÃO (SIGA ESTRITAMENTE NESTA ORDEM):
1. A REGRA DE OURO DA AUTENTICAÇÃO: Verifique a seção 'AUTENTICAÇÃO E ORIGEM'. Se SPF e DKIM estiverem 'pass' (ou verificados), o e-mail é CRIPTOGRAFICAMENTE LEGÍTIMO. Nestes casos, o 'Nivel_Risco' DEVE OBRIGATORIAMENTE ser entre 0 e 10, e o Veredito DEVE ser 'SEGURO'. Jamais classifique como suspeito.
2. DOMÍNIOS DE MARKETING E TERCEIROS: Grandes empresas (Bancos, Companhias Aéreas, Fornecedores Aeroespaciais como Aircraft Spruce/Aviall, IRS, etc.) usam variações do seu nome e plataformas de disparo. Se a Regra 1 passou, ignore o fato dos links serem de terceiros ou estranhos.
3. SITES DESCONHECIDOS/OCULTOS: Se a investigação do domínio retornar 'Idade oculta' ou 'Privado', isso é NORMAL. Não aumente o risco.
4. CÓDIGO ESTRANHO: Ignore códigos como "=3D" ou tags HTML soltas.
5. GOLPES COMUNS E QUISHING: Apenas considere PERIGOSO e-mails ameaçadores, financeiros (falsas faturas B2B) ou e-mails de "Novo Voicemail" que peçam para scannear um "Código QR" (Quishing) SE falharem na Regra 1.
6. FALSIDADE IDEOLÓGICA (O GOLPE DO FROM): Compare o 'Nome de Exibição' com o 'Remetente Real'. Se o Nome de Exibição for uma entidade famosa (ex: Receita Federal, IRS, Delta, Aircraft Spruce, Aviall, Boeing) mas o 'Remetente Real (Return-Path)' for um domínio genérico (ex: gmail.com, run.app) ou ligeiramente alterado (ex: aircraft-spruce-support.com), isso é Falsificação Escancarada (Spoofing). O risco é 100% PERIGOSO.

Retorne APENAS JSON válido com as chaves exatas:
- "Nivel_Risco" (Número inteiro de 0 a 100)
- "Veredito" ("SEGURO", "SUSPEITO", "PERIGOSO")
- "Motivos" (Array com no máximo 5 itens curtos e objetivos)
- "Recomendacao" (Texto direto com orientação ao usuário, chave sem acento)`;

module.exports = async function (context, req) {
    const startTime = Date.now();
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';

    context.res = {
        headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store' }
    };

    if (!checkRateLimit(clientIp)) {
        context.res.status = 429;
        context.res.body = { error: 'Muitas requisições', Nivel_Risco: 50, Veredito: 'SUSPEITO', Motivos: ['Rate limit excedido'], Recomendacao: 'Aguarde 1 minuto' };
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
        context.res.body = { error: 'Conteúdo insuficiente', Nivel_Risco: 0, Veredito: 'SEGURO', Motivos: ['Conteúdo muito curto para análise'], Recomendacao: 'Cole mais conteúdo do e-mail' };
        return;
    }

    const cacheKey = crypto.createHash('sha256').update((emailContent || '') + (headers || '')).digest('hex');
    const cachedItem = memoryCache.get(cacheKey);

    if (cachedItem && (Date.now() - cachedItem.timestamp < CACHE_TTL)) {
        context.log.info('Cache HIT');
        context.res.status = 200;
        context.res.body = cachedItem.data;
        return;
    }

    const foundUrls = extractUrls(emailContent || '');
    const authDetails = extractAuthDetails(headers);
    const senderData = extractSender(headers);
    const senderIP = extractSenderIP(headers);
    const temAnexoHTML = detectarAnexoHTML(emailContent);
    const analiseUrls = analisarUrlsSuspeitas(foundUrls);
    const temDisfarceGov = analiseUrls.evidencias.some(e => e.includes('disfarce'));

    let cleanBodyProcessed = emailContent || 'Não fornecido';
    cleanBodyProcessed = cleanBodyProcessed.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
    if (cleanBodyProcessed.length > 4000) cleanBodyProcessed = cleanBodyProcessed.substring(0, 4000) + '... [CORTADO]';

    let cleanHeadersProcessed = headers || 'Não fornecidos';
    if (cleanHeadersProcessed !== 'Não fornecidos' && cleanHeadersProcessed.length > 2000) cleanHeadersProcessed = cleanHeadersProcessed.substring(0, 2000) + '... [CORTADO]';

    // ==================== CÁLCULO DE RISCO LOCAL (MOVIDO PARA CIMA) ====================
    let localScore = 0;
    const evidenciasFortes = [];
    const evidenciasLeves = [];

    // Análise de domínios (Agora o VirusTotal pode somar pontos ao localScore sem crashar)
    let domainIntel = "Nenhum link detectado.";
    const domainDetails = [];

    if (foundUrls.length > 0) {
        const uniqueDomains = [...new Set(foundUrls.map(u => {
            try { return new URL(u).hostname.replace('www.', ''); } catch { return null; }
        }).filter(Boolean))];

        domainIntel = "DOMÍNIOS:\n";
        const domainsToCheck = uniqueDomains.slice(0, 5);

        const ageResults = await Promise.all(
            domainsToCheck.map(async domain => {
                const age = await checkDomainAge(domain);
                const vtResult = await checkVirusTotal(domain);
                return { domain, age, vtResult };
            })
        );

        ageResults.forEach(info => {
            let infoLinha = `- ${info.domain} (Idade: ${info.age})`;
            if (info.vtResult) {
                infoLinha += ` | VirusTotal: ${info.vtResult}`;
                if (info.vtResult.includes('ALERTA VERMELHO')) {
                    localScore += 100;
                    evidenciasFortes.push(`O domínio ${info.domain} está na BLACKLIST global de cibercrime (VirusTotal)!`);
                }
            }
            domainIntel += `${infoLinha}\n`;
            domainDetails.push({ domain: info.domain, age: info.age, vt: info.vtResult });
        });
    }

    const remetenteLower = senderData.nome_exibicao.toLowerCase();
    if (remetenteLower.includes('receita') || remetenteLower.includes('federal')) {
        if (!authDetails.dominioConfiavel && authDetails.dominioAutenticado) {
            localScore += 40;
            evidenciasFortes.push(`Remetente alega ser Receita Federal mas domínio autenticado é ${authDetails.dominioAutenticado}`);
        } else if (!authDetails.dominioAutenticado) {
            localScore += 30;
            evidenciasLeves.push('Remetente alega ser órgão público mas autenticação não confirma domínio');
        }
    }

    if (temAnexoHTML) { localScore += 50; evidenciasFortes.push('E-mail contém anexo HTML - técnica de clone de site oficial'); }
    if (temDisfarceGov) { localScore += 50; evidenciasFortes.push('URL tenta disfarçar destino com gov.br - TÉCNICA DE PHISHING'); }
    
    const urlsCloud = analiseUrls.urlsDetalhadas.filter(u => u.isCloud);
    if (urlsCloud.length > 0 && (remetenteLower.includes('receita') || remetenteLower.includes('federal'))) {
        localScore += 40; evidenciasFortes.push(`URL em nuvem pública (${urlsCloud[0].dominio}) para órgão público`);
    }

   // Evidência: Golpes conhecidos (Fisco, Voos, B2B e QUISHING/QR Codes)
    const knownScams = /receita federal|irregularidade cpf|d[íi]vida ativa|irs tax|voicemail|voice message|qr code|scan the qr|milhas expirando|voo cancelado|aircraft spruce|aviall|fatura de pe[çc]as|purchase order/i.test(cleanBodyProcessed);
    if (knownScams) {
        localScore += 30; evidenciasLeves.push('Conteúdo utiliza temas de golpes conhecidos (Fisco, Voos, B2B, ou pedidos para scannear Códigos QR/Voicemails)');
    }

    // Evidência: Prazo urgente (Português e Inglês)
    const hasUrgency = /prazo final|última chance|imediata|urgente|urgent|act now|immediate action required|expires today/i.test(cleanBodyProcessed);
    if (hasUrgency) {
        localScore += 20; evidenciasLeves.push('E-mail cria senso de urgência (tática clássica de engenharia social)');
    }

    if (senderData.email_real !== 'Não identificado' && senderData.nome_exibicao.includes('@')) {
        const fromDomainMatch = senderData.nome_exibicao.match(/<.*?@([^\s>]+)>/i);
        const fromDomain = fromDomainMatch ? fromDomainMatch[1] : senderData.nome_exibicao.split('@')[1];
        const returnPathDomain = senderData.email_real.split('@')[1];
        if (fromDomain && returnPathDomain && fromDomain.toLowerCase() !== returnPathDomain.toLowerCase()) {
            localScore += 30; evidenciasFortes.push(`Remetente Real (${returnPathDomain}) é diferente do exibição (${fromDomain})`);
        }
    }

    localScore = Math.min(100, localScore);

    const intelMastigada = `
AUTENTICAÇÃO E ORIGEM:
- Nome de Exibição: ${senderData.nome_exibicao}
- Remetente Real: ${senderData.email_real}
- IP Origem: ${senderIP || 'Desconhecido'}
- SPF: ${authDetails.spf || 'Não encontrado'}
- DKIM: ${authDetails.dkim || 'Não encontrado'}
- Domínio Autenticado: ${authDetails.dominioAutenticado || 'Não identificado'}
- Oficial (gov.br): ${authDetails.dominioConfiavel ? 'SIM' : 'NÃO'}

ANEXOS: ${temAnexoHTML ? 'SIM (ALTA SUSPEITA)' : 'Não'}

EVIDÊNCIAS LOCAIS (INCLUI VIRUSTOTAL):
${evidenciasFortes.map(e => '🔴 ' + e).join('\n')}
${evidenciasLeves.map(e => '🟡 ' + e).join('\n')}

ANÁLISE DE URLs:
${analiseUrls.urlsDetalhadas.map(u => `- ${u.url.substring(0, 80)}... | Nuvem: ${u.isCloud}`).join('\n')}
${domainIntel}
`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [ { role: "system", content: systemPrompt }, { role: "user", content: `EMAIL:\n${cleanBodyProcessed}\n\n${intelMastigada}\n\nHEADERS:\n${cleanHeadersProcessed}` } ],
                response_format: { type: "json_object" },
                max_tokens: 500, temperature: 0.1
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);
        if (!groqResponse.ok) throw new Error(`Erro IA: ${groqResponse.status}`);

        const data = await groqResponse.json();
        let analise = JSON.parse(data.choices[0].message.content.replace(/```json|```/g, '').trim());
        
        let riscoIA = Math.min(100, Math.max(0, parseInt(analise.Nivel_Risco) || 50));
        if (evidenciasFortes.length > 0) riscoIA = Math.max(riscoIA, 80);
        if (temAnexoHTML && temDisfarceGov) { riscoIA = 100; analise.Veredito = 'PERIGOSO'; }
        
        const riscoFinal = Math.min(100, Math.max(0, riscoIA));
        const motivosCombinados = [...evidenciasFortes.slice(0, 3)];
        
        if (Array.isArray(analise.Motivos)) {
            analise.Motivos.slice(0, 3).forEach(m => { if (!motivosCombinados.includes(m)) motivosCombinados.push(m); });
        }
        
        analise = { Nivel_Risco: riscoFinal, Veredito: riscoFinal >= 80 ? 'PERIGOSO' : (riscoFinal >= 40 ? 'SUSPEITO' : 'SEGURO'), Motivos: motivosCombinados.slice(0, 5), Recomendacao: analise.Recomendacao || 'Consulte um especialista' };
        
        const respostaCompleta = {
            ...analise,
            detalhes_autenticacao: { spf: authDetails.spf || 'não verificado', dkim: authDetails.dkim || 'não verificado', dmarc: authDetails.dmarc || 'não verificado', dominio_autenticado: authDetails.dominioAutenticado || 'não identificado', dominio_confiavel: authDetails.dominioConfiavel, autenticacao_valida: authDetails.autenticado },
            remetente: senderData.nome_exibicao, return_path: senderData.email_real, ip_remetente: senderIP || 'não identificado', anexo_html: temAnexoHTML, urls_encontradas: foundUrls.slice(0, 10), dominios_analisados: domainDetails, evidencias: { fortes: evidenciasFortes, leves: evidenciasLeves }
        };

        try {
            const db = await connectDb();
            await db.collection('phishing_threats').insertOne({
                timestamp: new Date(), analise: { Nivel_Risco: analise.Nivel_Risco, Veredito: analise.Veredito }, ip: clientIp, remetente: senderData.email_real, urls: foundUrls.length, anexo_html: temAnexoHTML
            });
        } catch (dbError) {}

        memoryCache.set(cacheKey, { data: respostaCompleta, timestamp: Date.now() });
        context.res.status = 200;
        context.res.body = respostaCompleta;

    } catch (error) {
        context.res.status = 200;
        context.res.body = {
            Nivel_Risco: localScore, Veredito: localScore >= 80 ? 'PERIGOSO' : (localScore >= 40 ? 'SUSPEITO' : 'SEGURO'), Motivos: evidenciasFortes.length > 0 ? evidenciasFortes.slice(0, 5) : ['Erro na IA, análise baseada em regras locais'], Recomendacao: 'Falha técnica. ' + error.message,
            detalhes_autenticacao: { spf: authDetails.spf || 'não verificado', dkim: authDetails.dkim || 'não verificado', dmarc: authDetails.dmarc || 'não verificado', dominio_autenticado: authDetails.dominioAutenticado || 'não identificado', dominio_confiavel: authDetails.dominioConfiavel },
            remetente: senderData.nome_exibicao || 'não identificado', return_path: senderData.email_real || 'não identificado', ip_remetente: senderIP || 'não identificado', anexo_html: temAnexoHTML, urls_encontradas: foundUrls.slice(0, 10), dominios_analisados: domainDetails, evidencias: { fortes: evidenciasFortes, leves: evidenciasLeves }
        };
    }
};
