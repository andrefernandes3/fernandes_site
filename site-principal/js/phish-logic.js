// Processador de EML com limite de tokens
class EMLProcessor {
    constructor() {
        this.MAX_TOKENS_ESTIMATE = 6000;
        this.MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    }

    async processFile(file) {
        return new Promise((resolve, reject) => {
            // Validações iniciais
            if (file.size > this.MAX_FILE_SIZE) {
                return reject(new Error('Arquivo muito grande (máx 5MB)'));
            }
            if (!file.name.toLowerCase().endsWith('.eml')) {
                return reject(new Error('Tipo de arquivo inválido'));
            }

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
                    
                    // Checagem de datas suspeitas
                    const dateSuspicious = this.checkSuspiciousDates(headers.date, body);
                    
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
                        dmarc: headers['dmarc'] || 'Não verificado',
                        dateSuspicious // Novo campo
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
        const urlRegex = /(https?:\/\/[^\s"\'<>\]\)]{1,200})/gi; // Otimizado contra ReDoS
        const hrefRegex = /href=["'](https?:\/\/[^"']{1,200})["']/gi;
        
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
            { pattern: /anexo|documento anexo/i, desc: 'Menção a anexo' },
            // Novos patterns para golpes brasileiros
            { pattern: /irregularidade fiscal|pendência fiscal|suspensão do cpf|bloqueio do cpf|restrição ativa/i, desc: 'Ameaça de irregularidade governamental' },
            { pattern: /prazo final|regularize imediatamente/i, desc: 'Urgência falsa governamental' },
            { pattern: /receita federal|ministério da fazenda/i, desc: 'Imitação de órgão oficial' }
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

    // Nova função: Checar datas suspeitas
    checkSuspiciousDates(emailDate, body) {
        const now = new Date();
        if (emailDate) {
            const parsedDate = new Date(emailDate);
            if (parsedDate > now) return 'Data do e-mail no futuro (suspeito)';
        }
        
        const dateRegex = /\d{2}\/\d{2}\/\d{4}/g;
        const datesInBody = body.match(dateRegex) || [];
        for (let d of datesInBody) {
            const parsedD = new Date(d.split('/').reverse().join('-'));
            if (parsedD > now || (now - parsedD) / (1000 * 60 * 60 * 24) < 0) return 'Datas inconsistentes ou expiradas no corpo';
        }
        return null;
    }
}

// Instância global do processador
const emlProcessor = new EMLProcessor();

// Função para processar análise (corrigida e adicionada)
async function processarAnalise() {
    const btn = document.getElementById('btnAnalisar');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Analisando...';
    btn.disabled = true;

    const emailContent = document.getElementById('emailBody').value.trim();
    const headers = document.getElementById('emailHeaders').value.trim();

    if (!emailContent) {
        Swal.fire({
            icon: 'warning',
            title: 'Atenção',
            text: 'Por favor, cole o conteúdo do e-mail ou carregue um arquivo .eml.',
            timer: 3000,
            showConfirmButton: false
        });
        btn.innerHTML = originalText;
        btn.disabled = false;
        return;
    }

    try {
        // Enviar para o backend (ajuste o URL para sua Azure Function)
        const response = await fetch('https://your-azure-function-url.azurewebsites.net/api/analyze', { // Substitua pelo URL real da function
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                emailContent,
                headers
            })
        });

        if (!response.ok) {
            throw new Error('Erro na análise do backend');
        }

        const data = await response.json();
        
        // Exibir resultados
        exibirResultados(data);

        document.getElementById('resultPanel').classList.remove('hidden');

    } catch (error) {
        console.error('Erro:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Não foi possível realizar a análise.',
            timer: 3000,
            showConfirmButton: false
        });
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Função para exibir resultados (ajustada)
function exibirResultados(res) {
    const panel = document.getElementById('resultPanel');
    panel.classList.remove('hidden');

    // Atualizar medidor de risco
    const riskValue = document.getElementById('riskValue');
    riskValue.textContent = `${res.Nivel_Risco}%`;

    const riskCircle = document.getElementById('riskCircle');
    riskCircle.setAttribute('stroke-dasharray', `${res.Nivel_Risco}, 100`);

    let circleClass = 'suspeito';
    if (res.Nivel_Risco < 30) circleClass = 'seguro';
    else if (res.Nivel_Risco > 70) circleClass = 'perigoso';
    riskCircle.className = `circle ${circleClass}`;

    // Veredito
    const statusLabel = document.getElementById('statusLabel');
    statusLabel.textContent = res.Veredito;
    statusLabel.className = `status-${res.Veredito.toLowerCase()}`;

    // Recomendação
    document.getElementById('recomendacao').innerHTML = escapeHtml(res.Recomendacao);

    // Motivos
    const listaMotivos = document.getElementById('listaMotivos');
    listaMotivos.innerHTML = '';
    res.Motivos.forEach(m => {
        const li = document.createElement('li');
        li.innerHTML = escapeHtml(m);
        listaMotivos.appendChild(li);
    });

    // Nova: Adicionar alertas relacionados se suspeito
    if (res.Veredito !== 'SEGURO') {
        const alertSection = document.createElement('div');
        alertSection.innerHTML = `<h4>Alertas Relacionados</h4><p>Ex.: Receita Federal não envia e-mails com links para regularizar CPF. Verifique em <a href="https://www.gov.br/receitafederal/pt-br">gov.br</a>.</p>`;
        panel.appendChild(alertSection);
    }

    // Detalhes adicionais (autenticação, etc.)
    const detalhesContainer = criarDetalhesAdicionais(res);
    panel.appendChild(detalhesContainer);
}

// Função auxiliar para detalhes adicionais (do código original)
function criarDetalhesAdicionais(res) {
    const container = document.createElement('div');
    container.className = 'detalhes-adicionais';
    container.innerHTML = `
        <div class="auth-details">
            <h4>Detalhes de Autenticação</h4>
            <div class="auth-grid">
                <div class="auth-item">
                    <span class="auth-label">SPF</span>
                    <span class="auth-value badge ${getStatusClass(res.detalhes_autenticacao.spf)}">${escapeHtml(res.detalhes_autenticacao.spf)}</span>
                </div>
                <div class="auth-item">
                    <span class="auth-label">DKIM</span>
                    <span class="auth-value badge ${getStatusClass(res.detalhes_autenticacao.dkim)}">${escapeHtml(res.detalhes_autenticacao.dkim)}</span>
                </div>
                <div class="auth-item">
                    <span class="auth-label">DMARC</span>
                    <span class="auth-value badge ${getStatusClass(res.detalhes_autenticacao.dmarc)}">${escapeHtml(res.detalhes_autenticacao.dmarc)}</span>
                </div>
            </div>
            <details class="auth-raw">
                <summary>Ver detalhes técnicos</summary>
                <pre>${escapeHtml(res.detalhes_autenticacao.raw)}</pre>
            </details>
        </div>

        <div class="sender-details">
            <h4>Informações do Remetente</h4>
            <div class="sender-info">
                <div class="info-item"><strong>De:</strong> ${escapeHtml(res.remetente)}</div>
                <div class="info-item"><strong>IP Origem:</strong> ${escapeHtml(res.ip_remetente)}</div>
            </div>
        </div>

        <div class="urls-details">
            <h4>URLs Encontradas</h4>
            <ul id="urlsList" class="urls-list"></ul>
        </div>

        <div class="dominios-details">
            <h4>Domínios Analisados</h4>
            <ul id="dominiosList" class="dominios-list"></ul>
        </div>
    `;
    
    // Preencher URLs
    const urlsList = container.querySelector('#urlsList');
    res.urls_encontradas.forEach(url => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="url-full">${escapeHtml(url)}</span>`;
        urlsList.appendChild(li);
    });

    // Preencher Domínios
    const dominiosList = container.querySelector('#dominiosList');
    res.dominios_analisados.forEach(dom => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="domain-name">${escapeHtml(dom.dominio)}</span> <span class="domain-age">${escapeHtml(dom.idade)}</span>`;
        dominiosList.appendChild(li);
    });

    return container;
}

// Funções auxiliares (do original)
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
                        <b>De:</b> ${escapeHtml(result.from)}<br>
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
                    text: error.message || 'Não foi possível processar o arquivo .eml',
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