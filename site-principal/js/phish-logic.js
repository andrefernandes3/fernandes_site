// Processador de EML com limite de tokens
class EMLProcessor {
    constructor() {
        this.MAX_TOKENS_ESTIMATE = 6000;
    }

    async processFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (event) => {
                try {
                    const content = event.target.result;
                    const lines = content.split('\n').slice(0, 200); // Máx 200 linhas
                    
                    // Headers importantes
                    const headers = {};
                    const importantHeaders = [
                        'from:', 'to:', 'subject:', 'date:', 
                        'received-spf:', 'dkim-signature:', 'dmarc:',
                        'return-path:', 'reply-to:', 'authentication-results:'
                    ];
                    
                    let bodyStart = 0;
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].toLowerCase();
                        if (line === '' || line === '\r') {
                            bodyStart = i + 1;
                            break;
                        }
                        
                        importantHeaders.forEach(h => {
                            if (line.startsWith(h)) {
                                const key = h.replace(':', '');
                                headers[key] = lines[i].substring(h.length).trim().substring(0, 200);
                            }
                        });
                    }
                    
                    // Corpo do email (limitado)
                    const body = lines.slice(bodyStart, bodyStart + 100).join('\n').substring(0, 4000);
                    
                    // Extrair links do corpo
                    const links = this.extractLinks(body);
                    
                    // Detectar frases suspeitas
                    const suspicious = this.detectSuspiciousPhrases(body);
                    
                    // Calcular estimativa de risco
                    const riskScore = this.calculateRiskScore(headers, links, suspicious);
                    
                    resolve({
                        headers,
                        body: body.substring(0, 3000), // Limite final
                        links: links.slice(0, 15),
                        suspicious: suspicious.slice(0, 5),
                        riskScore,
                        from: headers.from || 'Desconhecido',
                        subject: headers.subject || 'Sem assunto',
                        spf: headers['received-spf'] || headers['spf'] || 'Não verificado',
                        dkim: headers['dkim-signature'] ? 'Presente' : 'Ausente',
                        dmarc: headers['dmarc'] || 'Não verificado'
                    });
                    
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    extractLinks(text) {
        if (!text) return [];
        
        const links = new Set();
        const urlRegex = /(https?:\/\/[^\s"\'<>\]\)]+)/gi;
        const hrefRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
        
        let match;
        while ((match = urlRegex.exec(text)) !== null) {
            try {
                const url = new URL(match[1]);
                links.add(url.hostname.replace('www.', ''));
            } catch {
                links.add(match[1].substring(0, 100));
            }
        }
        
        while ((match = hrefRegex.exec(text)) !== null) {
            try {
                const url = new URL(match[1]);
                links.add(url.hostname.replace('www.', ''));
            } catch {
                links.add(match[1].substring(0, 100));
            }
        }
        
        return Array.from(links);
    }

    detectSuspiciousPhrases(text) {
        if (!text) return [];
        
        const phrases = [];
        const lowerText = text.toLowerCase();
        
        const patterns = [
            { pattern: /verif[iy]que? sua conta/i, desc: 'Pedido de verificação' },
            { pattern: /atualize seus dados/i, desc: 'Atualização cadastral' },
            { pattern: /bloqueamos? sua conta/i, desc: 'Ameaça de bloqueio' },
            { pattern: /dados banc[áa]rios/i, desc: 'Dados bancários' },
            { pattern: /senha expirou/i, desc: 'Senha expirada' },
            { pattern: /pagamento pendente/i, desc: 'Pagamento pendente' },
            { pattern: /confirmar identidade/i, desc: 'Confirmação de identidade' },
            { pattern: /heran[cç]a|pr[eê]mio/i, desc: 'Golpe financeiro' },
            { pattern: /urgente|imediato|r[aá]pido/i, desc: 'Tom de urgência' },
            { pattern: /anexo|documento anexo/i, desc: 'Menção a anexo' }
        ];
        
        patterns.forEach(p => {
            if (p.pattern.test(lowerText)) {
                phrases.push(p.desc);
            }
        });
        
        return [...new Set(phrases)];
    }

    calculateRiskScore(headers, links, suspicious) {
        let score = 0;
        
        // SPF/DKIM ausente ou falha
        if (headers['received-spf']?.toLowerCase().includes('fail')) score += 25;
        if (headers['dkim-signature'] === undefined) score += 15;
        if (headers['dmarc']?.toLowerCase().includes('fail')) score += 15;
        
        // Links encurtados
        const shortLinks = links.filter(l => 
            l.includes('bit.ly') || l.includes('tinyurl') || 
            l.includes('goo.gl') || l.includes('ow.ly')
        ).length;
        score += shortLinks * 8;
        
        // Domínios suspeitos
        const suspiciousDomains = links.filter(l => 
            l.includes('.tk') || l.includes('.ml') || l.includes('.ga')
        ).length;
        score += suspiciousDomains * 10;
        
        // Frases suspeitas
        score += suspicious.length * 6;
        
        return Math.min(95, score);
    }
}

// Instância global do processador
const emlProcessor = new EMLProcessor();

async function processarAnalise() {
    const email = document.getElementById('emailBody').value.trim();
    const headers = document.getElementById('emailHeaders').value;
    const btn = document.getElementById('btnAnalisar');
    
    if (!email) {
        Swal.fire({
            icon: 'warning',
            title: 'Atenção',
            text: 'Por favor, cole o conteúdo do e-mail.',
            timer: 3000,
            showConfirmButton: false
        });
        return;
    }

    // Visual de carregamento
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Analisando...';
    btn.disabled = true;

    try {
        const response = await fetch('/api/phish-detect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                emailContent: email.substring(0, 6000), // Limitar no frontend também
                headers: headers 
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        exibirResultados(data);
        
    } catch (error) {
        console.error('Erro:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro na Análise',
            text: 'Não foi possível analisar o e-mail. Tente novamente.',
            timer: 3000,
            showConfirmButton: false
        });
    } finally {
        btn.innerHTML = '🔍 Analisar Ameaça Agora';
        btn.disabled = false;
    }
}

function exibirResultados(res) {
    const panel = document.getElementById('resultPanel');
    const riskCircle = document.getElementById('riskCircle');
    const riskValue = document.getElementById('riskValue');
    const statusLabel = document.getElementById('statusLabel');
    const recomendacao = document.getElementById('recomendacao');
    const lista = document.getElementById('listaMotivos');

    const detalhesContainer = document.getElementById('detalhesContainer') || criarContainerDetalhes();

    panel.classList.remove('hidden');
    
    // Atualiza o Círculo de Risco
    const nivel = Math.min(100, Math.max(0, parseInt(res.Nivel_Risco) || 50));
    const corClass = nivel > 70 ? 'perigoso' : (nivel > 30 ? 'suspeito' : 'seguro');
    
    riskCircle.setAttribute('stroke-dasharray', `${nivel}, 100`);
    riskCircle.className.baseVal = `circle ${corClass}`;
    
    riskValue.innerText = `${nivel}%`;
    statusLabel.innerText = res.Veredito || 'SUSPEITO';
    statusLabel.className = `status-${corClass}`;
    recomendacao.innerText = res.Recomendacao || 'Consulte um especialista em segurança';

    // Limpa e preenche motivos
    lista.innerHTML = "";
    const motivos = Array.isArray(res.Motivos) ? res.Motivos : ['Análise automática realizada'];
    motivos.slice(0, 5).forEach(m => {
        const li = document.createElement('li');
        li.innerText = m;
        lista.appendChild(li);
    });

   // NOVO: Preencher detalhes de autenticação
    if (res.detalhes_autenticacao) {
        document.getElementById('spfDetail').innerHTML = `
            <span class="badge ${getStatusClass(res.detalhes_autenticacao.spf)}">
                ${res.detalhes_autenticacao.spf}
            </span>
        `;
        document.getElementById('dkimDetail').innerHTML = `
            <span class="badge ${getStatusClass(res.detalhes_autenticacao.dkim)}">
                ${res.detalhes_autenticacao.dkim}
            </span>
        `;
        document.getElementById('dmarcDetail').innerHTML = `
            <span class="badge ${getStatusClass(res.detalhes_autenticacao.dmarc)}">
                ${res.detalhes_autenticacao.dmarc}
            </span>
        `;
        
        if (res.detalhes_autenticacao.raw) {
            document.getElementById('authRaw').innerText = res.detalhes_autenticacao.raw;
        }
    }

    // NOVO: Preencher informações do remetente
    if (res.remetente) {
        document.getElementById('remetenteInfo').innerHTML = `
            <div class="info-item">
                <strong>De:</strong> ${escapeHtml(res.remetente)}
            </div>
            ${res.ip_remetente ? `
            <div class="info-item">
                <strong>IP:</strong> ${escapeHtml(res.ip_remetente)}
            </div>
            ` : ''}
        `;
    }

    // NOVO: Preencher URLs encontradas
    if (res.urls_encontradas && res.urls_encontradas.length > 0) {
        const urlsList = document.getElementById('urlsList');
        urlsList.innerHTML = '';
        res.urls_encontradas.forEach(url => {
            const li = document.createElement('li');
            try {
                const urlObj = new URL(url);
                const isSuspicious = verificarUrlSuspeita(urlObj);
                li.className = isSuspicious ? 'url-suspeita' : '';
                li.innerHTML = `
                    <span class="url-domain">${escapeHtml(urlObj.hostname)}</span>
                    <span class="url-full">${escapeHtml(url)}</span>
                    ${isSuspicious ? '<span class="badge warning">⚠️ Suspeita</span>' : ''}
                `;
            } catch {
                li.innerHTML = escapeHtml(url);
            }
            urlsList.appendChild(li);
        });
        document.getElementById('urlsContainer').classList.remove('hidden');
    }

    // NOVO: Preencher domínios analisados
    if (res.dominios_analisados && res.dominios_analisados.length > 0) {
        const dominiosList = document.getElementById('dominiosList');
        dominiosList.innerHTML = '';
        res.dominios_analisados.forEach(dom => {
            const li = document.createElement('li');
            const idade = parseInt(dom.age);
            const isRecente = idade < 30; // Menos de 30 dias
            li.className = isRecente ? 'dominio-recente' : '';
            li.innerHTML = `
                <span class="domain-name">${escapeHtml(dom.domain)}</span>
                <span class="domain-age ${isRecente ? 'recente' : ''}">${escapeHtml(dom.age)}</span>
                ${isRecente ? '<span class="badge danger">🆕 Domínio recente</span>' : ''}
            `;
            dominiosList.appendChild(li);
        });
        document.getElementById('dominiosContainer').classList.remove('hidden');
    }

    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Função auxiliar para criar container de detalhes
function criarContainerDetalhes() {
    const panel = document.getElementById('resultPanel');
    const details = document.querySelector('.details');
    
    const container = document.createElement('div');
    container.id = 'detalhesContainer';
    container.className = 'detalhes-adicionais';
    container.innerHTML = `
        <div class="auth-details">
            <h4>🔐 Autenticação do E-mail</h4>
            <div class="auth-grid">
                <div class="auth-item">
                    <span class="auth-label">SPF:</span>
                    <span id="spfDetail" class="auth-value">-</span>
                </div>
                <div class="auth-item">
                    <span class="auth-label">DKIM:</span>
                    <span id="dkimDetail" class="auth-value">-</span>
                </div>
                <div class="auth-item">
                    <span class="auth-label">DMARC:</span>
                    <span id="dmarcDetail" class="auth-value">-</span>
                </div>
            </div>
            <details class="auth-raw">
                <summary>Ver detalhes completos</summary>
                <pre id="authRaw"></pre>
            </details>
        </div>

        <div class="sender-details">
            <h4>📧 Informações do Remetente</h4>
            <div id="remetenteInfo" class="sender-info"></div>
        </div>

        <div id="urlsContainer" class="urls-details hidden">
            <h4>🔗 URLs Encontradas</h4>
            <ul id="urlsList" class="urls-list"></ul>
        </div>

        <div id="dominiosContainer" class="dominios-details hidden">
            <h4>🌐 Domínios Analisados</h4>
            <ul id="dominiosList" class="dominios-list"></ul>
        </div>
    `;
    
    panel.insertBefore(container, details.nextSibling);
    return container;
}

function getStatusClass(value) {
    if (!value) return 'badge-secondary';
    value = value.toLowerCase();
    if (value.includes('pass') || value.includes('success')) return 'badge-success';
    if (value.includes('fail') || value.includes('hardfail')) return 'badge-danger';
    if (value.includes('softfail')) return 'badge-warning';
    if (value.includes('neutral') || value.includes('none')) return 'badge-neutral';
    return 'badge-secondary';
}

function verificarUrlSuspeita(urlObj) {
    const dominiosEncurtadores = ['bit.ly', 'tinyurl.com', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly'];
    const tldsSuspeitos = ['.tk', '.ml', '.ga', '.cf', '.xyz', '.top', '.work'];
    
    const hostname = urlObj.hostname;
    
    // Verificar encurtadores
    if (dominiosEncurtadores.some(d => hostname.includes(d))) return true;
    
    // Verificar TLDs suspeitos
    if (tldsSuspeitos.some(tld => hostname.endsWith(tld))) return true;
    
    // Verificar subdomínios excessivos
    const parts = hostname.split('.');
    if (parts.length > 4) return true;
    
    return false;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toggleHeaders() {
    const h = document.getElementById('emailHeaders');
    h.classList.toggle('hidden');
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    const emailBody = document.getElementById('emailBody');
    const emlInput = document.getElementById('emlFileInput');
    
    // Interceptar colagem
    if (emailBody) {
        emailBody.addEventListener('paste', function(e) {
            setTimeout(() => {
                const htmlData = e.clipboardData.getData('text/html');
                if (htmlData) {
                    const links = emlProcessor.extractLinks(htmlData);
                    if (links.length > 0) {
                        this.value += '\n\n[LINKS DETECTADOS]\n' + links.join('\n');
                    }
                }
            }, 100);
        });
    }

    // Handler para arquivos .eml
    if (emlInput) {
        emlInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.name.toLowerCase().endsWith('.eml')) {
                Swal.fire({
                    icon: 'error',
                    title: 'Arquivo Inválido',
                    text: 'Por favor, selecione um arquivo .eml válido.',
                    timer: 3000,
                    showConfirmButton: false
                });
                return;
            }

            const btn = document.getElementById('btnAnalisar');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processando...';
            btn.disabled = true;

            try {
                const result = await emlProcessor.processFile(file);
                
                // Criar resumo otimizado para análise
                const resumo = `[ANÁLISE DE ARQUIVO .EML]\n` +
                    `De: ${result.from}\n` +
                    `Assunto: ${result.subject}\n` +
                    `SPF: ${result.spf}\n` +
                    `DKIM: ${result.dkim}\n` +
                    `DMARC: ${result.dmarc}\n` +
                    `Risco Estimado: ${result.riskScore}%\n\n` +
                    `FRASES SUSPEITAS:\n${result.suspicious.join('\n') || 'Nenhuma'}\n\n` +
                    `LINKS DETECTADOS (${result.links.length}):\n${result.links.join('\n')}\n\n` +
                    `CONTEÚDO:\n${result.body}`;

                document.getElementById('emailBody').value = resumo;
                
                // Mostrar headers completos como opcional
                if (Object.keys(result.headers).length > 0) {
                    document.getElementById('emailHeaders').value = JSON.stringify(result.headers, null, 2);
                    document.getElementById('emailHeaders').classList.remove('hidden');
                }

                // Calcular estimativa de tokens
                const tokensEstimados = Math.ceil(resumo.length / 4);
                
                Swal.fire({
                    icon: 'success',
                    title: 'Arquivo Processado',
                    html: `
                        <b>De:</b> ${result.from}<br>
                        <b>Links:</b> ${result.links.length}<br>
                        <b>Tokens Estimados:</b> ~${tokensEstimados}<br>
                        <b>Risco:</b> ${result.riskScore}%<br>
                        <small>Pronto para análise!</small>
                    `,
                    timer: 3000,
                    showConfirmButton: false
                });
                
            } catch (error) {
                console.error('Erro:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: 'Não foi possível processar o arquivo .eml',
                    timer: 3000,
                    showConfirmButton: false
                });
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
                emlInput.value = ''; // Limpar para permitir mesmo arquivo novamente
            }
        });
    }
});