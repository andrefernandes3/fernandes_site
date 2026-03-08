// ==========================================
// LÓGICA DE ANÁLISE E COMUNICAÇÃO COM A API
// ==========================================
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

    // ==========================================
    // 🚨 1. INTERCEPTADOR SUPREMO (A Matemática atua ANTES do HTML)
    // ==========================================
    const nomeLimpo = res.remetente ? res.remetente.replace(/["']/g, '') : 'Desconhecido';
    
    let dominioBruto = res.detalhes_autenticacao?.dominio_autenticado;
    if (!dominioBruto || dominioBruto === 'N/A' || !dominioBruto.includes('.')) {
        dominioBruto = res.return_path?.split('@')[1] || 'Desconhecido';
    }
    
    const dominioFalso = extrairDominioRaiz(dominioBruto);
    const dominioReal = descobrirDominioRealDinamico(nomeLimpo, dominioFalso, res.dominio_oficial, res.Nivel_Risco || 0);
    const dominioFalsoLimpo = (dominioFalso || '').toLowerCase().trim();

    // A MÁGICA: Se a matemática detetar fraude, mas a IA disser que é seguro (<40)
    if (dominioReal !== dominioFalsoLimpo && (res.Nivel_Risco || 0) < 40) {
        console.warn("🚨 OVERRIDE: IA Enganada. Forçando Risco para 95%!");
        res.Nivel_Risco = 95;
        res.Veredito = 'PERIGOSO';
        res.Recomendacao = "ALERTA MÁXIMO: O nosso motor visual detetou uma fraude (Typosquatting/TLD Squatting) que tentou enganar a Inteligência Artificial. Trate como tentativa de golpe imediata!";
        
        // 🟢 A CORREÇÃO: Apagamos o array antigo da IA e criamos um novo apenas com as verdades do SOC!
        res.Motivos = [
            "🚨 O domínio de envio tenta falsificar o domínio oficial da empresa (Typosquatting/TLD Abuse).",
            "⚠️ O conteúdo do e-mail foi estruturado para enganar filtros de segurança e simular legitimidade."
        ];
    }

    // ==========================================
    // 2. DESENHO DO CARD MODERNO
    // ==========================================
    const percentual = res.Nivel_Risco || 0;

    const riskValue = document.getElementById('riskValue');
    if (riskValue) {
        riskValue.textContent = percentual + '%';
    }

    const riskGradient = document.getElementById('riskGradient');
    if (riskGradient) {
        const angle = (percentual / 100) * 360;
        let color;
        if (percentual < 30) color = '#10b981'; // verde
        else if (percentual <= 70) color = '#f59e0b'; // amarelo
        else color = '#dc2626'; // vermelho

        riskGradient.style.background = `conic-gradient(from 0deg, ${color} 0deg, ${color} ${angle}deg, #333 ${angle}deg, #333 360deg)`;
    }

    const riskBadge = document.getElementById('riskBadge');
    if (riskBadge) {
        let classeBadge = '';
        if (percentual < 30) classeBadge = 'seguro';
        else if (percentual <= 70) classeBadge = 'suspeito';
        else classeBadge = 'perigoso';

        riskBadge.textContent = res.Veredito || 'ANALISADO';
        riskBadge.className = `badge ${classeBadge}`;
    }

    const statusLabel = document.getElementById('statusLabel');
    let statusClasse = '';
    if (percentual < 30) statusClasse = 'badge-success';
    else if (percentual <= 70) statusClasse = 'badge-warning';
    else statusClasse = 'badge-danger';

    statusLabel.textContent = res.Veredito || 'ANALISADO';
    statusLabel.className = `badge fs-3 ${statusClasse}`;
    document.getElementById('recomendacao').innerHTML = (res.Recomendacao || 'Nenhuma recomendação específica.').replace(/\n/g, '<br>');

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
        alertDiv.innerHTML = `
            <div class="alert" style="background-color: #1e1e1e; border: 1px solid #333; border-left: 4px solid #dc2626; color: #ffffff;">
                <h5 style="color: #ffffff; font-weight: bold;"><i class="bi bi-exclamation-triangle-fill text-danger"></i> 🚨 ALERTA GOVERNO</h5>
                <p class="mb-0" style="color: #ffffff;"><strong>Receita Federal NUNCA</strong> pede regularização por e-mail com links.</p>
            </div>
        `;
        alertasContainer.appendChild(alertDiv);
    }

    // Passamos os domínios calculados para o criador de HTML
    if (res.detalhes_autenticacao) {
        const detalhes = criarDetalhesAdicionais(res, dominioReal, dominioFalso, nomeLimpo);
        panel.appendChild(detalhes);
    }

    panel.scrollIntoView({ behavior: 'smooth' });
}

// ==========================================
// CRIAÇÃO DOS DETALHES ADICIONAIS
// ==========================================
function criarDetalhesAdicionais(res, dominioReal, dominioFalso, nomeLimpo) {
    const container = document.createElement('div');
    container.className = 'detalhes-adicionais mt-5';

    // 1. ANÁLISE DO VIRUSTOTAL
    const painelAlertas = document.getElementById('alertasExtras');
    if (res.vt_stats) {
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
        } else {
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

    // 2. PAINEL DE AUTENTICAÇÃO E ORIGEM
    const auth = res.detalhes_autenticacao || {};
    const spfColor = auth.spf === 'pass' ? 'success' : (auth.spf === 'none' ? 'secondary' : 'danger');
    const dkimColor = auth.dkim === 'pass' ? 'success' : (auth.dkim === 'none' ? 'secondary' : 'danger');
    const dmarcColor = auth.dmarc === 'pass' ? 'success' : (auth.dmarc === 'none' ? 'secondary' : 'danger');

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

    // 3. CONSTRUÇÃO DA LISTA DE URLs
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

    // 4. VISUALIZADOR DA SANDBOX (urlscan.io)
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

    container.innerHTML = authOriginHtml + urlsHtml + sandboxHtml;
    return container;
}

// ==========================================
// FUNÇÕES GLOBAIS DA ENGENHARIA DO DOMÍNIO
// ==========================================

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

function descobrirDominioRealDinamico(nome, dominioFalso, dominioDaIA, nivelRisco){
    const nomeLower = (nome || '').toLowerCase().trim();
    const dominioFalsoLower = (dominioFalso || '').toLowerCase().trim();

    if(!dominioFalsoLower.includes('.')) return dominioFalsoLower;

    const partes = dominioFalsoLower.split('.');
    let tld = '';
    let dominioCore = '';
    let subdominio = '';

    // 🧠 NOVIDADE: Detetor de TLDs Compostos (.com.br, .gov.br, .co.uk)
    const penultimaParte = partes.length >= 3 ? partes[partes.length - 2] : '';
    const tldsDuplos = ['com', 'gov', 'org', 'net', 'co', 'edu', 'jus', 'mil'];

    if (partes.length >= 3 && tldsDuplos.includes(penultimaParte)) {
        tld = partes[partes.length - 2] + '.' + partes[partes.length - 1]; // Ex: "com.br"
        dominioCore = partes[partes.length - 3]; // Ex: "b3"
        subdominio = partes.slice(0, partes.length - 3).join('.');
    } else {
        tld = partes[partes.length - 1]; // Ex: "com"
        dominioCore = partes.length >= 2 ? partes[partes.length - 2] : ''; // Ex: "amazon"
        subdominio = partes.slice(0, partes.length - 2).join('.');
    }

    // ================================
    // 1️⃣ LISTA DE TLD SUSPEITOS
    // ================================
    const tldsSuspeitos = [
        'xyz','online','site','top','vip','shop','tech',
        'store','click','live','info','cc','work','today',
        'support','email','digital','world','buzz','cloud'
    ];
    const tldSuspeito = tldsSuspeitos.includes(tld);

    // ================================
    // 2️⃣ NORMALIZAÇÃO ANTI-HOMOGLYPH
    // ================================
    function normalizar(texto){
        return texto
        .replace(/0/g,'o').replace(/1/g,'l').replace(/3/g,'e')
        .replace(/5/g,'s').replace(/7/g,'t').replace(/@/g,'a')
        .replace(/\$/g,'s').replace(/!/g,'i').replace(/rn/g,'m')
        .replace(/vv/g,'w').replace(/[^a-z0-9]/g,'');
    }
    const dominioNormal = normalizar(dominioCore);

    // ================================
    // 3️⃣ EXTRAÇÃO DINÂMICA DE MARCA
    // ================================
    let marca = nomeLower
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g,"")
        .replace(/[^a-z0-9]/g,'');

    if(marca.length > 20) marca = marca.substring(0,20);

    // ================================
    // 4️⃣ LEVENSHTEIN (similaridade)
    // ================================
    function levenshtein(a,b){
        if(!a || !b) return 99;
        const matrix = [];
        for(let i=0;i<=b.length;i++) matrix[i] = [i];
        for(let j=0;j<=a.length;j++) matrix[0][j] = j;
        for(let i=1;i<=b.length;i++){
            for(let j=1;j<=a.length;j++){
                if(b.charAt(i-1) === a.charAt(j-1))
                    matrix[i][j] = matrix[i-1][j-1];
                else
                    matrix[i][j] = Math.min(
                        matrix[i-1][j-1] + 1,
                        matrix[i][j-1] + 1,
                        matrix[i-1][j] + 1
                    );
            }
        }
        return matrix[b.length][a.length];
    }

    // ================================
    // 5️⃣ SCORE DE FRAUDE
    // ================================
    let score = 0;
    if(tldSuspeito) score += 40;
    if(subdominio.length > 0) score += 15;
    if(dominioNormal !== dominioCore) score += 20;
    if(marca){
        const dist = levenshtein(dominioNormal,marca);
        if(dist <= 2) score += 35;
    }
    if(nivelRisco > 60) score += 25;

    // ================================
    // 6️⃣ TLD SQUATTING
    // ================================
    if(tldSuspeito && dominioNormal.length > 3){
        return dominioNormal + '.com';
    }

    // ================================
    // 7️⃣ TYPOSQUATTING
    // ================================
    if(marca){
        const dist = levenshtein(dominioNormal,marca);
        if(dist <= 2){
            return marca + '.com';
        }
    }

    // ================================
    // 8️⃣ SUBDOMÍNIO ENGANOSO
    // ================================
    if(subdominio){
        const primeiroSub = subdominio.split('.')[0];
        if(nomeLower.includes(primeiroSub)){
            return primeiroSub + '.com';
        }
    }

    // ================================
    // 9️⃣ IA (somente se seguro)
    // ================================
    if(dominioDaIA && dominioDaIA !== 'N/A' && dominioDaIA !== 'Desconhecido' && score < 30){
        return dominioDaIA.toLowerCase().trim();
    }

    // ================================
    // 🔟 SCORE ALTO → CORREÇÃO
    // ================================
    if(score >= 45 && dominioNormal.length > 3){
        return dominioNormal + '.com';
    }

    return dominioFalsoLower;
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
        title: 'Gerando o Documento...',
        text: 'O Relatório Forense será aberto. Selecione "Salvar como PDF" no destino.',
        icon: 'info',
        timer: 1500,
        showConfirmButton: false
    }).then(() => {
        setTimeout(() => {
            const tituloOriginal = document.title;
            
            // 1. Pega o Veredito
            const veredito = document.getElementById('statusLabel') ? document.getElementById('statusLabel').innerText : 'Analise';
            
            // 2. Tenta capturar o remetente da tela (Assumindo que você tem um elemento com ID 'remetente' ou similar)
            // Se o ID no seu HTML for diferente, altere o 'remetenteEmail' abaixo para o ID correto
            const elementoRemetente = document.getElementById('nomeRemetente') || document.getElementById('remetente'); 
            let remetenteTexto = elementoRemetente ? elementoRemetente.innerText : 'Desconhecido';
            
            // Limpa caracteres especiais do remetente para não dar erro ao salvar no Windows/Mac
            const remetenteLimpo = remetenteTexto.replace(/[^a-zA-Z0-9_\-\.]/g, '_').substring(0, 30);
            
            // 3. Formata Data e Hora
            const agora = new Date();
            const dataFormatada = agora.toISOString().slice(0, 10);
            const horaFormatada = agora.toTimeString().slice(0, 8).replace(/:/g, '-');
            
            // 4. Monta o nome final corporativo
            const nomeFicheiro = `SOC_Relatorio_${veredito}_${remetenteLimpo}_${dataFormatada}_${horaFormatada}`;
            
            // Aplica o título para o PDF ler
            document.title = nomeFicheiro;
            window.print();
            
            // 5. Restaura o título original com um atraso de segurança (1.5s)
            // Isso garante que a janela de impressão teve tempo de ler o 'nomeFicheiro'
            setTimeout(() => {
                document.title = tituloOriginal;
            }, 1500);
            
        }, 500);
    });
}

// ==========================================
// LEITOR DE ARQUIVOS .EML E INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const emlInput = document.getElementById('emlFileInput');
    const emailBody = document.getElementById('emailBody');
    const emailHeaders = document.getElementById('emailHeaders');

    emlInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.eml')) {
            Swal.fire({
                icon: 'warning',
                title: 'Formato Inválido',
                text: 'Por favor, envie apenas ficheiros no formato .eml (o formato bruto padrão da internet).',
                background: '#222',
                color: '#eee',
                confirmButtonColor: '#00bcd4'
            });
            this.value = ''; 
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

    const riskValue = document.getElementById('riskValue');
    if (riskValue && riskValue.textContent === '') {
        riskValue.textContent = '0%';
    }
});

// ==========================================
// MOTOR DE POLLING (BACKGROUND) DO URLSCAN
// ==========================================
function pollUrlScanImage(uuid, attempts = 0) {
    const maxAttempts = 15;
    const imgUrl = `https://urlscan.io/screenshots/${uuid}.png`;
    const loaderId = `loadingPrint_${uuid}`;
    const imgId = `imgPrint_${uuid}`;

    const delay = attempts === 0 ? 15000 : 5000;

    setTimeout(() => {
        const img = new Image();

        img.onload = () => {
            const targetImg = document.getElementById(imgId);
            const loader = document.getElementById(loaderId);
            if (targetImg && loader) {
                targetImg.src = img.src;
                targetImg.style.display = 'block';
                loader.style.display = 'none';
            }
        };

        img.onerror = () => {
            if (attempts < maxAttempts) {
                pollUrlScanImage(uuid, attempts + 1);
            } else {
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
