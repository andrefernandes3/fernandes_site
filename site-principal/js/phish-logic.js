// ==========================================
// LÓGICA DE ANÁLISE E COMUNICAÇÃO COM A API
// ==========================================
//versao que funciona
async function processarAnalise() {
    const btn = document.getElementById('btnAnalisar');
    const originalText = btn.innerHTML;

    const emailContent = document.getElementById('emailBody').value.trim();
    const headers = document.getElementById('emailHeaders').value.trim();

    if (!emailContent) {
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Por favor, cole o conteúdo do e-mail ou carregue um arquivo .eml.', timer: 3000, showConfirmButton: false });
        return;
    }

    const panel = document.getElementById('resultPanel');
    panel.classList.add('hidden');
    const oldDetails = panel.querySelectorAll('.detalhes-adicionais, .alert-section');
    oldDetails.forEach(el => el.remove());

    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Analisando...';
    btn.disabled = true;

    try {
        const response = await fetch('/api/phish-detect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emailContent, headers })
        });

        if (!response.ok) throw new Error(`Erro ${response.status}: ${response.statusText}`);

        const data = await response.json();
        exibirResultados(data);

    } catch (error) {
        console.error('Erro:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro de Conexão',
            text: 'Verifique se o servidor está online. ' + error.message,
            footer: '<small>Tente novamente em alguns segundos</small>'
        });
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function exibirResultados(res) {
    const panel = document.getElementById('resultPanel');
    panel.classList.remove('hidden');

    // ===== CARD MODERNO =====
    const percentual = res.Nivel_Risco || 0;

    // Atualizar o percentual
    const riskValue = document.getElementById('riskValue');
    if (riskValue) {
        riskValue.textContent = percentual + '%';
    }

    // Atualizar o gradiente
    const riskGradient = document.getElementById('riskGradient');
    if (riskGradient) {
        const angle = (percentual / 100) * 360;

        // Definir cor baseada no nível de risco
        let color;
        if (percentual < 30) {
            color = '#10b981'; // verde - seguro
        } else if (percentual <= 70) {
            color = '#f59e0b'; // amarelo - suspeito
        } else {
            color = '#dc2626'; // vermelho - perigoso
        }

        riskGradient.style.background = `conic-gradient(from 0deg, ${color} 0deg, ${color} ${angle}deg, #333 ${angle}deg, #333 360deg)`;
    }

    // Atualizar o badge
    const riskBadge = document.getElementById('riskBadge');
    if (riskBadge) {
        let classeBadge = '';
        if (percentual < 30) classeBadge = 'seguro';
        else if (percentual <= 70) classeBadge = 'suspeito';
        else classeBadge = 'perigoso';

        riskBadge.textContent = res.Veredito || 'ANALISADO';
        riskBadge.className = `badge ${classeBadge}`;
    }

    // Veredito
    const statusLabel = document.getElementById('statusLabel');
    let statusClasse = '';
    if (percentual < 30) statusClasse = 'badge-success';
    else if (percentual <= 70) statusClasse = 'badge-warning';
    else statusClasse = 'badge-danger';

    statusLabel.textContent = res.Veredito || 'ANALISADO';
    statusLabel.className = `badge fs-3 ${statusClasse}`;
    document.getElementById('recomendacao').innerHTML = (res.Recomendacao || 'Nenhuma recomendação específica.').replace(/\n/g, '<br>');

    // Motivos
    const listaMotivos = document.getElementById('listaMotivos');
    listaMotivos.innerHTML = '';
    if (res.Motivos && res.Motivos.length > 0) {
        res.Motivos.forEach(m => {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.innerHTML = `<i class="bi bi-check-circle text-primary me-2"></i>${m}`;
            listaMotivos.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.innerHTML = `<i class="bi bi-check-circle text-primary me-2"></i>Nenhum motivo específico identificado.`;
        listaMotivos.appendChild(li);
    }

    // Alertas Especiais
    const alertasContainer = document.getElementById('alertasExtras');
    alertasContainer.innerHTML = '';

    if (res.Veredito !== 'SEGURO' && res.remetente && res.remetente.toLowerCase().includes('receita')) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert-section mb-3';
        // Removemos o 'alert-danger' do Bootstrap e forçamos o fundo escuro e letras brancas
        alertDiv.innerHTML = `
            <div class="alert" style="background-color: #1e1e1e; border: 1px solid #333; border-left: 4px solid #dc2626; color: #ffffff;">
                <h5 style="color: #ffffff; font-weight: bold;"><i class="bi bi-exclamation-triangle-fill text-danger"></i> 🚨 ALERTA GOVERNO</h5>
                <p class="mb-0" style="color: #ffffff;"><strong>Receita Federal NUNCA</strong> pede regularização por e-mail com links.</p>
            </div>
        `;
        alertasContainer.appendChild(alertDiv);
    }

    if (res.detalhes_autenticacao) {
        const detalhes = criarDetalhesAdicionais(res);
        panel.appendChild(detalhes);
    }

    panel.scrollIntoView({ behavior: 'smooth' });
}

// ==========================================
// CRIAÇÃO DOS DETALHES ADICIONAIS (Completo)
// ==========================================
function criarDetalhesAdicionais(res) {
    const container = document.createElement('div');
    container.className = 'detalhes-adicionais mt-5';

    // ==========================================
    // 1. INJEÇÃO DA ANÁLISE DO VIRUSTOTAL (Lateral)
    // ==========================================
    const painelAlertas = document.getElementById('alertasExtras');
    if (res.vt_stats) {
            // 🚩 NOVO: Cenário de Domínio Fantasma (Erro 404 no VT)
            if (res.vt_stats.fantasma) {
                painelAlertas.innerHTML += `
                    <div class="alert mt-3 shadow-sm" style="border: 1px solid #ffc107; background: #332701;">
                        <h5 class="alert-heading" style="color: #ffc107;">
                            <i class="bi bi-exclamation-triangle-fill me-2"></i> VirusTotal: Domínio Fantasma
                        </h5>
                        <p class="mb-0 text-light" style="font-size: 0.9em;">
                            O domínio <strong class="text-warning">${res.vt_stats.dominio}</strong> não possui qualquer histórico na base de dados. <br><br>
                            Isto é uma <strong>Red Flag</strong> severa: indica um site recém-criado, frequentemente usado em ataques de Phishing direcionados antes que os antivírus os consigam detetar.
                        </p>
                    </div>
                `;
            } 
            // Cenário Normal: O VT conhece o domínio
            else {
                const malicious = res.vt_stats.malicious || 0;
                const suspicious = res.vt_stats.suspicious || 0;
                const isMalicious = malicious > 0 || suspicious > 0;
                const totalAlertas = malicious + suspicious;

                const vtColor = isMalicious ? 'danger' : 'success';
                const vtTitle = isMalicious ? 'Ameaça Detetada' : 'Domínio Limpo';
                const vtText = isMalicious 
                    ? `<strong>${totalAlertas} motores</strong> de antivírus marcaram o link como malicioso ou suspeito.` 
                    : `Nenhum motor de antivírus sinalizou o link alvo.`;

                painelAlertas.innerHTML += `
                    <div class="alert alert-${vtColor} mt-3 shadow-sm" style="border: 1px solid #444; background: #222;">
                        <h5 class="alert-heading text-${vtColor}">
                            <img src="https://www.virustotal.com/gui/images/favicon.ico" style="width:16px; margin-right:5px; margin-top:-3px;">
                            VirusTotal: ${vtTitle}
                        </h5>
                        <p class="mb-0 text-light" style="font-size: 0.9em;">${vtText}</p>
                    </div>
                `;
            }
        }
   
   // ==========================================
    // 2. PAINEL DE AUTENTICAÇÃO, ORIGEM E SPOOFING
    // ==========================================
    const auth = res.detalhes_autenticacao || {};
    const spfColor = auth.spf === 'pass' ? 'success' : (auth.spf === 'none' ? 'secondary' : 'danger');
    const dkimColor = auth.dkim === 'pass' ? 'success' : (auth.dkim === 'none' ? 'secondary' : 'danger');
    const dmarcColor = auth.dmarc === 'pass' ? 'success' : (auth.dmarc === 'none' ? 'secondary' : 'danger');

    // Extração Limpa de Variáveis
    const nomeLimpo = res.remetente ? res.remetente.replace(/["']/g, '') : 'Desconhecido';
    // 🟢 CORREÇÃO: Trava de segurança para garantir que é um Domínio real (tem de ter um ponto)
    let dominioBruto = auth.dominio_autenticado;
    if (!dominioBruto || dominioBruto === 'N/A' || !dominioBruto.includes('.')) {
        // Se o Backend se enganou e mandou "no-reply", nós cortamos o SMTP e pegamos o "fernandesit.com"
        dominioBruto = res.return_path?.split('@')[1] || 'Desconhecido';
    }

    // 🟢 TUNING DE SOC: Extrator de Domínio Raiz (Remove subdomínios como user.hostinger)
    function extrairDominioRaiz(dominio) {
        if (dominio === 'Desconhecido' || dominio === 'N/A') return dominio;
        const partes = dominio.split('.');
        if (partes.length > 2) {
            if (partes[partes.length - 2] === 'com' || partes[partes.length - 2] === 'co' || partes[partes.length - 2] === 'gov') {
                return partes.slice(-3).join('.');
            }
            return partes.slice(-2).join('.');
        }
        return dominio;
    }
    const dominioFalso = extrairDominioRaiz(dominioBruto);

// 🟢 MOTOR DINÂMICO DE TYPOSQUATTING (IA + Engenharia Reversa)
    function descobrirDominioRealDinamico(nome, dominioFalso, dominioDaIA) {
        // 1. A INTELIGÊNCIA ARTIFICIAL
        if (dominioDaIA && dominioDaIA !== 'N/A' && dominioDaIA !== 'Desconhecido') {
            return dominioDaIA.toLowerCase();
        }

        const nomeLower = (nome || '').toLowerCase();
        let desofuscado = (dominioFalso || '').toLowerCase();

        // 2. DESOFUSCAÇÃO MATEMÁTICA CONDICIONAL (A Prova de Balas)
        // Só substitui o número pela letra se o remetente NÃO usar esse número no nome!
        // Assim, a B3 não vira "be", mas o "amaz0n" vira "amazon".
        if (!nomeLower.includes('0')) desofuscado = desofuscado.replace(/0/g, 'o');
        if (!nomeLower.includes('1')) desofuscado = desofuscado.replace(/1/g, 'l');
        if (!nomeLower.includes('3')) desofuscado = desofuscado.replace(/3/g, 'e');
        if (!nomeLower.includes('5')) desofuscado = desofuscado.replace(/5/g, 's');
        desofuscado = desofuscado.replace(/rn/g, 'm').replace(/@/g, 'a');

        if (desofuscado !== (dominioFalso || '').toLowerCase()) return desofuscado;

        // 3. EXTRATOR DINÂMICO (Plano C)
        if (nomeLower === 'desconhecido' || nomeLower.includes('@')) {
            return dominioFalso.toLowerCase(); 
        }

        if (nomeLower.includes('.') && !nomeLower.includes(' ') && /\.[a-z]{2,3}$/.test(nomeLower)) {
            return nomeLower; 
        }

        const nomeSemAcentos = nomeLower.normalize('NFD').replace(/[\u0300-\u036f]/g, "");

        let marcaExtraida = nomeSemAcentos
            .replace(/ceo|suporte|support|admin|atendimento|equipe|faturamento|cartao|banco|loja|oficial/g, '')
            .replace(/[^a-z0-9]/g, '');

        if (marcaExtraida.length > 2 && marcaExtraida.length < 20) {
            let terminacao = '.com';
            if (dominioFalso && dominioFalso.includes('.')) {
                terminacao = dominioFalso.substring(dominioFalso.indexOf('.'));
            }
            return `${marcaExtraida}${terminacao}`.toLowerCase(); 
        }

        return dominioFalso.toLowerCase(); 
    }
    const dominioReal = descobrirDominioRealDinamico(nomeLimpo, dominioFalso, res.dominio_oficial);

    const authOriginHtml = `
        <div class="row mt-4">
            <div class="col-6">
                <div class="card p-3 h-100 shadow-sm auth-item" style="background: #222 !important; border: 1px solid #444 !important; color: #fff !important;">
                    <h5 class="border-bottom border-secondary pb-2" style="color: #00bcd4 !important;"><i class="bi bi-shield-lock"></i> Autenticação</h5>
                    <ul class="list-unstyled mt-3 mb-0">
                        <li class="mb-2 d-flex justify-content-between"><span>SPF:</span> <span class="badge bg-${spfColor}">${auth.spf || 'N/A'}</span></li>
                        <li class="mb-2 d-flex justify-content-between"><span>DKIM:</span> <span class="badge bg-${dkimColor}">${auth.dkim || 'N/A'}</span></li>
                        <li class="d-flex justify-content-between"><span>DMARC:</span> <span class="badge bg-${dmarcColor}">${auth.dmarc || 'N/A'}</span></li>
                    </ul>
                </div>
            </div>
            <div class="col-6">
                <div class="card p-3 h-100 shadow-sm origem-box" style="background: #222 !important; border: 1px solid #444 !important; color: #fff !important;">
                    <h5 class="border-bottom border-secondary pb-2" style="color: #00bcd4 !important;"><i class="bi bi-person-lines-fill"></i> Origem do Email</h5>
                    <ul class="list-unstyled mt-3 mb-0" style="word-break: break-all;">
                        <li class="mb-2"><strong style="color: #00bcd4 !important;">Nome:</strong> ${nomeLimpo}</li>
                        <li class="mb-2"><strong style="color: #00bcd4 !important;">SMTP:</strong> ${res.return_path || 'N/A'}</li>
                        <li class="mb-2"><strong style="color: #00bcd4 !important;">IP:</strong> ${res.ip_remetente || 'N/A'}</li>
                        <li><strong style="color: #00bcd4 !important;">Domínio:</strong> ${dominioFalso}</li>
                    </ul>
                </div>
            </div>
        </div>

        <div class="row mt-3 mb-4">
            <div class="col-12">
                <div class="card p-3 shadow-sm" style="background: #1a1a1a !important; border: 1px dashed #666 !important; color: #fff !important;">
                    <h6 style="color: #ff9800 !important; margin-bottom: 15px;"><i class="bi bi-mask"></i> Análise Visual: Typosquatting (Domínio Falso vs Real)</h6>
                    <div class="d-flex justify-content-between text-center" style="display: flex !important; flex-direction: row !important;">
                        
                        <div style="flex: 1; border-right: 1px solid #444; padding-right: 10px;">
                            <small style="color: #aaa !important;">O que o Hacker usou (A Fraude):</small><br>
                            <strong style="font-size: 0.9em; color: #ff6b6b !important; word-break: break-all;">
                                ${res.return_path || 'Desconhecido'}
                            </strong><br>
                            <strong style="font-size: 1.1em; font-family: 'Courier New', monospace; color: #ff6b6b !important;">
                                [ ${dominioFalso} ]
                            </strong>
                        </div>
                        
                        <div style="flex: 0.5; align-self: center; font-size: 1.5em; color: #666 !important;">
                            <i class="bi bi-arrow-left-right"></i> VS <i class="bi bi-arrow-left-right"></i>
                        </div>

                        <div style="flex: 1; padding-left: 10px;">
                            <small style="color: #aaa !important;">O que a vítima esperava (O Legítimo):</small><br>
                            <strong style="font-size: 1.1em; font-family: 'Courier New', monospace; color: #00bcd4 !important;">
                                ${dominioReal}
                            </strong>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    `;

    // ==========================================
    // 3. CONSTRUÇÃO DA LISTA DE URLs
    // ==========================================
    let urlsHtml = '';
    if (res.urls_encontradas && res.urls_encontradas.length > 0) {
        const escapeHtml = (unsafe) => unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        
        const listaUrls = res.urls_encontradas.map(u => 
            `<li class="list-group-item py-3" style="word-break: break-all;">
                <i class="bi bi-link-45deg me-2 text-primary fs-5"></i>
                ${escapeHtml(u)}
            </li>`
        ).join('');

        urlsHtml = `
            <div class="row mt-4">
                <div class="col-12">
                    <h4><i class="bi bi-globe text-info"></i> URLs e Links Detetados</h4>
                    <ul class="list-group list-group-flush border border-secondary rounded overflow-hidden mt-3">
                        ${listaUrls}
                    </ul>
                </div>
            </div>
        `;
    } else {
        urlsHtml = `
            <div class="row mt-4">
                <div class="col-12">
                    <h4><i class="bi bi-globe text-secondary"></i> URLs e Links Detetados</h4>
                    <p class="text-muted mt-2">Nenhum link web encontrado no corpo deste e-mail.</p>
                </div>
            </div>
        `;
    }

    // ==========================================
    // 4. VISUALIZADOR DA SANDBOX (urlscan.io)
    // ==========================================
    let sandboxHtml = '';
    if (res.urlscan_uuid) {
        const linkRelatorio = `https://urlscan.io/result/${res.urlscan_uuid}/`;

        sandboxHtml = `
            <div class="row mt-5">
                <div class="col-12">
                    <h4><i class="bi bi-camera text-primary"></i> Sandbox: Evidência Visual</h4>
                    <p class="text-info mb-3" style="font-size: 0.95em;">
                        <i class="bi bi-shield-check me-1"></i> Captura de ecrã segura gerada em ambiente isolado (urlscan.io).
                    </p>
                    <div class="sandbox-container" style="background: #111; border: 1px solid #444; border-radius: 8px; overflow: hidden; position: relative; min-height: 350px; display: flex; align-items: center; justify-content: center;">
                        
                        <div id="loadingPrint_${res.urlscan_uuid}" style="position: absolute; text-align: center; color: #00bcd4; z-index: 1;">
                            <div class="spinner-border mb-3" role="status" style="width: 3rem; height: 3rem;"></div>
                            <h5>A processar captura de ecrã...</h5>
                            <small class="text-muted">(A nuvem pode demorar até 60 segundos)</small>
                        </div>

                        <img id="imgPrint_${res.urlscan_uuid}" style="width: 100%; height: auto; position: relative; z-index: 2; display: none;">
                    </div>
                    <div class="mt-3 text-end">
                        <a href="${linkRelatorio}" target="_blank" class="btn btn-outline-info">
                            <i class="bi bi-box-arrow-up-right"></i> Ver Relatório Técnico no urlscan.io
                        </a>
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => { pollUrlScanImage(res.urlscan_uuid); }, 100);
    }

    // Junta Tudo no Container Central
    container.innerHTML = authOriginHtml + urlsHtml + sandboxHtml;

    return container;
}
// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function getStatusClass(value) {
    if (!value) return 'badge-secondary';
    const val = value.toLowerCase();
    if (val.includes('pass') || val.includes('success')) return 'badge-success';
    if (val.includes('fail') || val.includes('hardfail')) return 'badge-danger';
    if (val.includes('softfail') || val.includes('neutral')) return 'badge-warning';
    return 'badge-secondary';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toggleHeaders() {
    const headers = document.getElementById('emailHeaders');
    headers.classList.toggle('hidden');
}

// ==========================================
// EXPORTAÇÃO DE RELATÓRIO PDF (Com Nome Dinâmico)
// ==========================================
function gerarPDF() {
    Swal.fire({
        title: 'A Preparar Documento...',
        text: 'O Relatório Forense será aberto. Selecione "Guardar como PDF" no destino.',
        icon: 'info',
        timer: 1500,
        showConfirmButton: false
    }).then(() => {
        setTimeout(() => {
            // 1. Guarda o título original do site
            const tituloOriginal = document.title;
            
            // 2. Capta o Veredito atual (Seguro, Suspeito ou Perigoso)
            const veredito = document.getElementById('statusLabel').innerText || 'Analise';
            
            // 3. Cria um carimbo de tempo único (ex: 2026-03-02_15-30-45)
            const agora = new Date();
            const dataFormatada = agora.toISOString().slice(0, 10); // YYYY-MM-DD
            const horaFormatada = agora.toTimeString().slice(0, 8).replace(/:/g, '-'); // HH-MM-SS
            
            // 4. Monta o nome profissional do ficheiro
            const nomeFicheiro = `Relatorio-Phishing-${veredito}_${dataFormatada}_${horaFormatada}`;
            
            // 5. Troca o título do site invisivelmente
            document.title = nomeFicheiro;

            // 6. Chama a impressora nativa
            window.print();

            // 7. Assim que a janela de impressão fecha, restaura o título original
            document.title = tituloOriginal;
            
        }, 500);
    });
}
// ==========================================
// LEITOR DE ARQUIVOS .EML
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const emlInput = document.getElementById('emlFileInput');
    const emailBody = document.getElementById('emailBody');
    const emailHeaders = document.getElementById('emailHeaders');

    // Leitor .eml
    emlInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;

        // 🟢 BLINDAGEM: Rejeita tudo o que não seja .eml
        if (!file.name.toLowerCase().endsWith('.eml')) {
            Swal.fire({
                icon: 'warning',
                title: 'Formato Inválido',
                text: 'Por favor, envie apenas ficheiros no formato .eml (o formato bruto padrão da internet).',
                background: '#222',
                color: '#eee',
                confirmButtonColor: '#00bcd4'
            });
            this.value = ''; // Limpa o campo para o utilizador tentar novamente
            return;
        }

        emailBody.value = '';
        emailHeaders.value = '';
        document.getElementById('resultPanel').classList.add('hidden');

        const reader = new FileReader();
        reader.onload = function (event) {
            const text = event.target.result;
            const separator = text.indexOf('\n\n') > 0 ? '\n\n' : '\r\n\r\n';
            const parts = text.split(separator);

            if (parts.length > 1) {
                emailHeaders.value = parts[0].trim();
                emailBody.value = parts.slice(1).join(separator).trim();
                emailHeaders.classList.remove('hidden');
                Swal.fire({ icon: 'success', title: '✅ Carregado', text: 'Headers extraídos!', timer: 2000 });
            } else {
                Swal.fire({ icon: 'error', title: 'Formato inválido', text: 'Não foi possível separar headers.' });
            }
            emlInput.value = '';
        };
        reader.readAsText(file, 'UTF-8');
    });
});

// Inicialização
document.addEventListener('DOMContentLoaded', function () {
    const riskValue = document.getElementById('riskValue');
    if (riskValue && riskValue.textContent === '') {
        riskValue.textContent = '0%';
    }
});

// ==========================================
// MOTOR DE POLLING (BACKGROUND) DO URLSCAN
// ==========================================
function pollUrlScanImage(uuid, attempts = 0) {
    const maxAttempts = 15; // 15 tentativas no total
    const imgUrl = `https://urlscan.io/screenshots/${uuid}.png`;
    const loaderId = `loadingPrint_${uuid}`;
    const imgId = `imgPrint_${uuid}`;

    // 🧠 A MÁGICA: Dá 15 segundos de "avanço" à nuvem na 1ª tentativa. Depois procura a cada 5 segundos.
    const delay = attempts === 0 ? 15000 : 5000;

    setTimeout(() => {
        // Cria uma imagem fantasma para testar se já existe sem dar erros feios na tela
        const img = new Image();

        img.onload = () => {
            // SUCESSO! A foto já existe no servidor. Vamos mostrá-la!
            const targetImg = document.getElementById(imgId);
            const loader = document.getElementById(loaderId);
            if (targetImg && loader) {
                targetImg.src = img.src;
                targetImg.style.display = 'block';
                loader.style.display = 'none';
            }
        };

        img.onerror = () => {
            // FALHA: A foto ainda não está pronta.
            if (attempts < maxAttempts) {
                // Tenta outra vez silenciosamente
                pollUrlScanImage(uuid, attempts + 1);
            } else {
                // DESISTE: O tempo esgotou (mais de 1 minuto) ou o hacker bloqueou a foto.
                const loader = document.getElementById(loaderId);
                if (loader) {
                    loader.innerHTML = `
                        <i class="bi bi-shield-x text-muted" style="font-size: 3rem;"></i><br>
                        <h5 class="mt-3 text-warning">Captura de Ecrã Indisponível</h5>
                        <small class="text-muted">Tempo esgotado ou site com bloqueio Anti-Bot.<br>Consulte o Relatório Técnico abaixo.</small>
                    `;
                }
            }
        };

        // Pede a imagem com um código de tempo para furar a cache do navegador
        img.src = `${imgUrl}?t=${new Date().getTime()}`;
    }, delay);
}

// ==========================================
// TUTORIAL DE EXPORTAÇÃO DE .EML
// ==========================================
function mostrarAjudaEml() {
    Swal.fire({
        title: 'Como salvar o arquivo .eml?',
        html: `
            <div style="text-align: left; font-size: 0.95em; color: #ccc;">
                <p><strong class="text-danger"><i class="bi bi-google"></i> Gmail:</strong> Abra o e-mail, clique nos 3 pontos (canto superior direito) e escolha <b class="text-light">"Baixar a mensagem"</b>.</p>
                <p><strong class="text-info"><i class="bi bi-microsoft"></i> Outlook:</strong> Abra o e-mail, clique nos 3 pontos, vá a "Mais ações" e escolha <b class="text-light">"Salvar"</b> ou "Salvar como".</p>
                <p><strong class="text-secondary"><i class="bi bi-apple"></i> Apple Mail:</strong> Arraste o e-mail diretamente para a sua Área de Trabalho (Desktop).</p>
            </div>
        `,
        icon: 'info',
        background: '#222',
        color: '#eee',
        confirmButtonColor: '#00bcd4',
        confirmButtonText: 'Entendido!'
    });
}
