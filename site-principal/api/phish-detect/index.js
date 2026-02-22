const fetch = require('node-fetch');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

// CACHE NATIVO
const memoryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

let cachedDb = null;
const rateLimit = new Map();

// Domínios esperados para órgãos oficiais (expandir conforme necessário)
const DOMINIOS_OFICIAIS = [
    'receita.fazenda.gov.br',
    'gov.br',
    'fazenda.gov.br',
    'economia.gov.br'
];

// Plataformas de nuvem pública (NÃO confiáveis para conteúdo sensível)
const CLOUD_PLATFORMS = [
    'run.app',
    'cloudfunctions.net',
    'azurewebsites.net',
    'amazonaws.com',
    'herokuapp.com',
    'vercel.app',
    'netlify.app',
    'firebaseapp.com',
    'web.app',
    'pages.dev'
];

// Plataformas de email marketing (podem ser legítimas)
const ESP_PLATFORMS = [
    'exct.net',
    'sendgrid.net',
    'salesforce.com',
    'mailchimp.com',
    'hubspot.com',
    'emkt.com.br',
    'marketingcloud.com'
];

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

// ==================== FUNÇÕES MELHORADAS ====================

function extractAuthDetails(headers) {
    const authDetails = { 
        spf: null, 
        dkim: null, 
        dmarc: null, 
        raw: null,
        autenticado: false,
        dominioAutenticado: null,
        dominioConfiavel: false,
        motivo: null
    };
    
    if (!headers) return authDetails;

    // Procura pelo cabeçalho Authentication-Results
    const authMatch = headers.match(/Authentication-Results:(.*?)(?:\n[A-Z]|\n\n|$)/is);
    if (authMatch) {
        authDetails.raw = authMatch[1].trim();
        
        // Extrair resultados SPF, DKIM, DMARC
        const spfMatch = authDetails.raw.match(/spf=([^\s;]+)/i);
        if (spfMatch) authDetails.spf = spfMatch[1];
        
        const dkimMatch = authDetails.raw.match(/dkim=([^\s;]+)/i);
        if (dkimMatch) authDetails.dkim = dkimMatch[1];
        
        const dmarcMatch = authDetails.raw.match(/dmarc=([^\s;]+)/i);
        if (dmarcMatch) authDetails.dmarc = dmarcMatch[1];
        
        // EXTRAIR DOMÍNIO AUTENTICADO (CRÍTICO!)
        // Tenta extrair do SPF primeiro
        const spfDomainMatch = authDetails.raw.match(/spf=pass\s+smtp\.mailfrom=([^\s;]+)/i);
        // Se não achou, tenta do DKIM
        const dkimDomainMatch = authDetails.raw.match(/dkim=pass\s+header\.d=([^\s;]+)/i);
        // Última tentativa: extrair do campo from nos cabeçalhos brutos
        const fromDomainMatch = headers.match(/From:.*?<.*?@([^\s>]+)>/i);
        
        authDetails.dominioAutenticado = 
            spfDomainMatch?.[1] || 
            dkimDomainMatch?.[1] || 
            fromDomainMatch?.[1] || 
            null;
        
        // Verificar se o domínio autenticado é confiável (gov.br)
        if (authDetails.dominioAutenticado) {
            authDetails.dominioConfiavel = DOMINIOS_OFICIAIS.some(dom => 
                authDetails.dominioAutenticado.includes(dom)
            );
        }
        
        // Se passou na autenticação E o domínio é confiável
        authDetails.autenticado = (
            authDetails.spf?.toLowerCase() === 'pass' && 
            authDetails.dkim?.toLowerCase() === 'pass' &&
            authDetails.dominioConfiavel
        );
        
        if (authDetails.spf === 'pass' && authDetails.dkim === 'pass' && !authDetails.dominioConfiavel) {
            authDetails.motivo = 'Autenticação passou, mas domínio não é oficial';
        }
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

function extractReturnPath(headers) {
    if (!headers) return null;
    const returnPathMatch = headers.match(/Return-Path:?\s*<([^>]+)>/i);
    if (returnPathMatch) return returnPathMatch[1];
    return null;
}

function detectarAnexoHTML(emailContent) {
    if (!emailContent) return false;
    
    // Verifica se é um anexo HTML (arquivo .htm ou .html no conteúdo)
    const temAnexoHTML = (
        emailContent.includes('Content-Type: text/html') ||
        emailContent.includes('filename=".htm') ||
        emailContent.includes('filename=".html') ||
        (emailContent.includes('<html') && emailContent.includes('</html>') && emailContent.length < 500000)
    );
    
    return temAnexoHTML;
}

function analisarUrlsSuspeitas(urls) {
    const evidencias = [];
    const urlsDetalhadas = [];
    
    for (const url of urls) {
        try {
            const parsed = new URL(url);
            const hostname = parsed.hostname.toLowerCase();
            
            // Detalhes da URL
            const detalhe = {
                url: url.substring(0, 100),
                dominio: hostname,
                isCloud: CLOUD_PLATFORMS.some(p => hostname.includes(p)),
                isESP: ESP_PLATFORMS.some(p => hostname.includes(p)),
                temDisfarceGov: url.includes('gov.br') && !hostname.includes('gov.br'),
                path: parsed.pathname
            };
            
            urlsDetalhadas.push(detalhe);
            
            // Gerar evidências
            if (detalhe.isCloud && detalhe.temDisfarceGov) {
                evidencias.push(`URL em nuvem pública (${hostname}) com tentativa de disfarce gov.br - ALTA SUSPEITA`);
            } else if (detalhe.isCloud) {
                evidencias.push(`URL hospedada em nuvem pública (${hostname}) - requer verificação cuidadosa`);
            } else if (detalhe.temDisfarceGov) {
                evidencias.push(`URL tenta disfarçar destino incluindo gov.br no caminho: ${url.substring(0, 80)}`);
            }
            
        } catch (e) {
            // URL inválida, ignorar
        }
    }
    
    return { evidencias, urlsDetalhadas };
}

async function checkDomainAge(domain) {
    // Para domínios de nuvem pública, a idade é irrelevante
    if (CLOUD_PLATFORMS.some(p => domain.includes(p))) {
        return "Plataforma de nuvem pública (idade irrelevante)";
    }
    
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000); // reduzido para 3s
        
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

// ==================== SYSTEM PROMPT CORRIGIDO ====================

const systemPrompt = `Você é um Analista de Segurança Sênior (Nível 3). Sua missão é detectar PHISHING com precisão cirúrgica, evitando FALSOS POSITIVOS em e-mails reais de grandes empresas.

REGRAS DE CLASSIFICAÇÃO (SIGA ESTRITAMENTE NESTA ORDEM):

1. AUTENTICAÇÃO NÃO É SOBERANA SEM CONTEXTO: Verifique 'AUTENTICAÇÃO DO SERVIDOR'. 
   Se SPF e DKIM estiverem 'pass', isso significa que o E-MAIL VEIO DO SERVIDOR AUTORIZADO PELO DOMÍNIO REMETENTE.
   PORÉM, você DEVE verificar se o DOMÍNIO AUTENTICADO CORRESPONDE AO DOMÍNIO ESPERADO para aquela empresa.
   Exemplo: Se o e-mail diz ser da Receita Federal mas o domínio autenticado é @dominio-falso.com, o risco é ALTÍSSIMO, mesmo com SPF/DKIM pass.

2. ANEXOS HTML SÃO ALTAMENTE SUSPEITOS: Arquivos .htm ou .html anexados são usados para clonar sites oficiais localmente. Se o e-mail contém um anexo HTML, isso é um FORTE indicador de phishing, especialmente se o assunto for urgente.

3. PLATAFORMAS DE TERCEIROS:
   - EMAIL MARKETING (ex: exct.net, sendgrid.net, salesforce.com): Podem ser legítimos se o remetente for uma empresa conhecida e o conteúdo não for alarmista.
   - NUVEM PÚBLICA (ex: run.app, cloudfunctions.net, azurewebsites.net, amazonaws.com): NÃO SÃO CONFIÁVEIS para conteúdo sensível. Qualquer um pode hospedar phishing lá. Se encontrar links em nuvem pública + tema de urgência + órgão público = PHISHING CERTEIRO.

4. OFUSCAÇÃO DE URL: URLs que tentam incluir "gov.br" no meio do caminho (ex: sso.cidadania.gov.br@run.app) ou como subdomínio enganoso são TENTATIVAS DE DISFARCE e indicam phishing.

5. GOLPES BRASILEIROS (REGRA DE OURO):
   - A Receita Federal NUNCA envia links de regularização por e-mail. Use o e-CAC com certificado digital.
   - Órgãos públicos usam portais seguros (gov.br) com HTTPS e domínio oficial.
   - Se o e-mail mencionar "suspensão de CPF", "bloqueio de conta", "dívida ativa" ou "regularização urgente" e tiver link para clicar, é 99% PHISHING.

6. PRAZOS URGENTES: E-mails que criam senso de urgência ("prazo final amanhã", "última chance") são táticas de engenharia social.

Retorne APENAS JSON válido com as chaves exatas:
- "Nivel_Risco" (Número inteiro de 0 a 100)
- "Veredito" ("SEGURO", "SUSPEITO", "PERIGOSO")
- "Motivos" (Array com no máximo 5 itens curtos e objetivos)
- "Recomendacao" (Texto direto com orientação ao usuário, chave sem acento)`;

// ==================== FUNÇÃO PRINCIPAL ====================

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

    // Extrair informações básicas
    const foundUrls = extractUrls(emailContent || '');
    const authDetails = extractAuthDetails(headers);
    const sender = extractSender(headers);
    const senderIP = extractSenderIP(headers);
    const returnPath = extractReturnPath(headers);
    
    // DETECÇÕES AVANÇADAS
    const temAnexoHTML = detectarAnexoHTML(emailContent);
    const analiseUrls = analisarUrlsSuspeitas(foundUrls);
    const temDisfarceGov = analiseUrls.evidencias.some(e => e.includes('disfarce'));

    // Processar corpo do email (limpar HTML)
    let cleanBodyProcessed = emailContent || 'Não fornecido';
    cleanBodyProcessed = cleanBodyProcessed.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
    if (cleanBodyProcessed.length > 4000) {
        cleanBodyProcessed = cleanBodyProcessed.substring(0, 4000) + '... [CORTADO]';
    }

    // Processar headers
    let cleanHeadersProcessed = headers || 'Não fornecidos';
    if (cleanHeadersProcessed !== 'Não fornecidos' && cleanHeadersProcessed.length > 2000) {
        cleanHeadersProcessed = cleanHeadersProcessed.substring(0, 2000) + '... [CORTADO]';
    }

    // Análise de domínios
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

    // ==================== CÁLCULO DE RISCO LOCAL ====================
    
    let localScore = 0;
    const evidenciasFortes = [];
    const evidenciasLeves = [];

    // Evidência 1: Remetente alega ser órgão público mas domínio não é oficial
    const remetenteLower = sender.toLowerCase();
    if (remetenteLower.includes('receita') || remetenteLower.includes('federal')) {
        if (!authDetails.dominioConfiavel && authDetails.dominioAutenticado) {
            localScore += 40;
            evidenciasFortes.push(`Remetente alega ser Receita Federal mas domínio autenticado é ${authDetails.dominioAutenticado} (não oficial)`);
        } else if (!authDetails.dominioAutenticado) {
            localScore += 30;
            evidenciasLeves.push('Remetente alega ser órgão público mas autenticação não confirma domínio');
        }
    }

    // Evidência 2: Anexo HTML (CRÍTICO!)
    if (temAnexoHTML) {
        localScore += 50;
        evidenciasFortes.push('E-mail contém anexo HTML - técnica comum de clone de site oficial');
    }

    // Evidência 3: URLs em nuvem pública com disfarce
    if (temDisfarceGov) {
        localScore += 50;
        evidenciasFortes.push('URL tenta disfarçar destino incluindo gov.br no caminho - TÉCNICA DE PHISHING');
    }

    // Evidência 4: URLs em nuvem pública sem disfarce, mas com tema sensível
    const urlsCloud = analiseUrls.urlsDetalhadas.filter(u => u.isCloud);
    if (urlsCloud.length > 0 && (remetenteLower.includes('receita') || remetenteLower.includes('federal'))) {
        localScore += 40;
        evidenciasFortes.push(`URL hospedada em nuvem pública (${urlsCloud[0].dominio}) para assunto de órgão público - ALTAMENTE SUSPEITO`);
    }

    // Evidência 5: Golpes conhecidos (CPF, Receita, etc.)
    const knownScams = /receita federal|irregularidade cpf|suspens[ãa]o do cpf|bloqueio do cpf|d[íi]vida ativa|regularize imediatamente/i.test(cleanBodyProcessed);
    if (knownScams) {
        localScore += 30;
        evidenciasLeves.push('Conteúdo utiliza temas clássicos de golpe (CPF, dívida ativa, Receita Federal)');
    }

    // Evidência 6: Prazo urgente
    const hasUrgency = /prazo final|última chance|imediata|urgente|11\/02|amanh[ãa]/i.test(cleanBodyProcessed);
    if (hasUrgency) {
        localScore += 20;
        evidenciasLeves.push('E-mail cria senso de urgência (tática de engenharia social)');
    }

    // Evidência 7: Return-Path diferente do From
    if (returnPath && sender.includes('<') && sender.includes('@')) {
        const fromDomain = sender.match(/<.*?@([^\s>]+)>/i)?.[1];
        const returnPathDomain = returnPath.split('@')[1];
        if (fromDomain && returnPathDomain && fromDomain !== returnPathDomain) {
            localScore += 30;
            evidenciasFortes.push(`Return-Path (${returnPathDomain}) diferente do domínio do remetente (${fromDomain})`);
        }
    }

    // Cap the local score (max 100)
    localScore = Math.min(100, localScore);

    // Preparar intel para a IA
    const intelMastigada = `
AUTENTICAÇÃO DO SERVIDOR:
- Remetente (From): ${sender}
- Return-Path: ${returnPath || 'Não informado'}
- IP de Origem: ${senderIP || 'Desconhecido'}
- Validação SPF: ${authDetails.spf || 'Não encontrado'}
- Validação DKIM: ${authDetails.dkim || 'Não encontrado'}
- Domínio Autenticado: ${authDetails.dominioAutenticado || 'Não identificado'}
- Domínio é oficial (gov.br): ${authDetails.dominioConfiavel ? 'SIM' : 'NÃO'}
- Autenticação completa válida: ${authDetails.autenticado ? 'SIM' : 'NÃO'}
- Observação: ${authDetails.motivo || 'Nenhuma'}

ANEXOS DETECTADOS:
- Anexo HTML: ${temAnexoHTML ? 'SIM (ALTA SUSPEITA)' : 'Não'}

EVIDÊNCIAS DE PHISHING DETECTADAS PELO SISTEMA:
${evidenciasFortes.map(e => '🔴 ' + e).join('\n')}
${evidenciasLeves.map(e => '🟡 ' + e).join('\n')}
${evidenciasFortes.length === 0 && evidenciasLeves.length === 0 ? 'Nenhuma evidência automática detectada' : ''}

ANÁLISE DE URLs:
${analiseUrls.urlsDetalhadas.map(u => 
    `- ${u.url.substring(0, 80)}...\n  Domínio: ${u.dominio} | Nuvem: ${u.isCloud} | Disfarce gov: ${u.temDisfarceGov}`
).join('\n')}

${domainIntel}
`;

    try {
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
                    { role: "user", content: `EMAIL:\n${cleanBodyProcessed}\n\n${intelMastigada}\n\nHEADERS BRUTOS:\n${cleanHeadersProcessed}` }
                ],
                response_format: { type: "json_object" },
                max_tokens: 500,
                temperature: 0.1 // Aumentei ligeiramente para dar mais nuance
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
            
            // COMBINAR SCORE DA IA COM SCORE LOCAL (de forma inteligente)
            let riscoIA = Math.min(100, Math.max(0, parseInt(analise.Nivel_Risco) || 50));
            
            // Regra: Se temos evidências fortes, o score mínimo é 80
            if (evidenciasFortes.length > 0) {
                riscoIA = Math.max(riscoIA, 80);
            }
            
            // Se temos evidências muito fortes (anexo HTML + disfarce gov), força 100
            if (temAnexoHTML && temDisfarceGov) {
                riscoIA = 100;
                analise.Veredito = 'PERIGOSO';
            }
            
            // Se o domínio autenticado não é confiável mas a IA deu baixo risco, corrigir
            if (!authDetails.dominioConfiavel && authDetails.dominioAutenticado && riscoIA < 70) {
                riscoIA = Math.max(riscoIA, 70);
            }
            
            const riscoFinal = Math.min(100, Math.max(0, riscoIA));
            
            // Construir motivos combinados
            const motivosCombinados = [];
            
            // Adicionar evidências fortes primeiro
            evidenciasFortes.slice(0, 3).forEach(e => motivosCombinados.push(e));
            
            // Adicionar motivos da IA (limitado)
            if (Array.isArray(analise.Motivos)) {
                analise.Motivos.slice(0, 3).forEach(m => {
                    if (!motivosCombinados.includes(m)) {
                        motivosCombinados.push(m);
                    }
                });
            }
            
            // Adicionar evidências leves se ainda tiver espaço
            if (motivosCombinados.length < 5) {
                evidenciasLeves.slice(0, 5 - motivosCombinados.length).forEach(e => {
                    if (!motivosCombinados.includes(e)) {
                        motivosCombinados.push(e);
                    }
                });
            }
            
            analise = {
                Nivel_Risco: riscoFinal,
                Veredito: riscoFinal >= 80 ? 'PERIGOSO' : (riscoFinal >= 40 ? 'SUSPEITO' : 'SEGURO'),
                Motivos: motivosCombinados.slice(0, 5),
                Recomendacao: analise.Recomendacao || 'Consulte um especialista'
            };
            
        } catch (e) {
            // Fallback em caso de erro de parsing
            analise = { 
                Nivel_Risco: localScore, 
                Veredito: localScore >= 80 ? 'PERIGOSO' : (localScore >= 40 ? 'SUSPEITO' : 'SEGURO'), 
                Motivos: evidenciasFortes.length > 0 ? evidenciasFortes.slice(0, 5) : ['Análise automática baseada em heurísticas'],
                Recomendacao: 'Erro no formato da resposta da IA. Análise baseada em regras locais.'
            };
        }

        const respostaCompleta = {
            ...analise,
            detalhes_autenticacao: {
                spf: authDetails.spf || 'não verificado',
                dkim: authDetails.dkim || 'não verificado',
                dmarc: authDetails.dmarc || 'não verificado',
                dominio_autenticado: authDetails.dominioAutenticado || 'não identificado',
                dominio_confiavel: authDetails.dominioConfiavel,
                autenticacao_valida: authDetails.autenticado
            },
            remetente: sender,
            return_path: returnPath,
            ip_remetente: senderIP || 'não identificado',
            anexo_html: temAnexoHTML,
            urls_encontradas: foundUrls.slice(0, 10),
            dominios_analisados: domainDetails,
            evidencias: {
                fortes: evidenciasFortes,
                leves: evidenciasLeves
            }
        };

        // Salvar no banco (opcional)
        try {
            const db = await connectDb();
            await db.collection('phishing_threats').insertOne({
                timestamp: new Date(),
                analise: { Nivel_Risco: analise.Nivel_Risco, Veredito: analise.Veredito },
                ip: clientIp, 
                remetente: sender, 
                urls: foundUrls.length,
                anexo_html: temAnexoHTML
            });
        } catch (dbError) {
            // Ignora erro de banco
        }

        memoryCache.set(cacheKey, { data: respostaCompleta, timestamp: Date.now() });

        context.res.status = 200;
        context.res.body = respostaCompleta;

    } catch (error) {
        // Fallback em caso de erro na API
        context.res.status = 200;
        context.res.body = {
            Nivel_Risco: localScore,
            Veredito: localScore >= 80 ? 'PERIGOSO' : (localScore >= 40 ? 'SUSPEITO' : 'SEGURO'),
            Motivos: evidenciasFortes.length > 0 ? evidenciasFortes.slice(0, 5) : ['Erro na comunicação com a IA, análise baseada em regras locais'],
            Recomendacao: 'Falha técnica. ' + error.message,
            detalhes_autenticacao: {
                spf: authDetails.spf || 'não verificado',
                dkim: authDetails.dkim || 'não verificado',
                dmarc: authDetails.dmarc || 'não verificado',
                dominio_autenticado: authDetails.dominioAutenticado || 'não identificado',
                dominio_confiavel: authDetails.dominioConfiavel
            },
            remetente: sender || 'não identificado',
            return_path: returnPath,
            ip_remetente: senderIP || 'não identificado',
            anexo_html: temAnexoHTML,
            urls_encontradas: foundUrls.slice(0, 10),
            dominios_analisados: domainDetails,
            evidencias: {
                fortes: evidenciasFortes,
                leves: evidenciasLeves
            }
        };
    }
};