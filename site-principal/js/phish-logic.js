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

function criarDetalhesAdicionais(res) {
    const container = document.createElement('div');
    container.className = 'detalhes-adicionais mt-5';

    const auth = res.detalhes_autenticacao || {};

    // 1. Constrói a lista de URLs
    let urlsHtml = '';
    if (res.urls_encontradas && res.urls_encontradas.length > 0) {
        const listaUrls = res.urls_encontradas.map(u =>
            `<li class="list-group-item py-3"><i class="bi bi-link-45deg me-2 text-primary fs-5"></i>${escapeHtml(u)}</li>`
        ).join('');

        urlsHtml = `
            <div class="row mt-5">
                <div class="col-12">
                    <h4><i class="bi bi-globe"></i> URLs e Links Detetados</h4>
                    <ul class="list-group list-group-flush border border-secondary rounded overflow-hidden">
                        ${listaUrls}
                    </ul>
                </div>
            </div>
        `;
    } else {
        urlsHtml = `
            <div class="row mt-5">
                <div class="col-12">
                    <h4><i class="bi bi-globe text-secondary"></i> URLs e Links Detetados</h4>
                    <p class="text-muted"><i class="bi bi-info-circle me-2"></i>Nenhum link web encontrado no corpo do e-mail.</p>
                </div>
            </div>
        `;
    }

    // 2. 🟢 O NOVO VISUALIZADOR DO URLSCAN (SANDBOX)
    let sandboxHtml = '';
    if (res.urlscan_uuid) {
        const printUrl = `https://urlscan.io/screenshots/${res.urlscan_uuid}.png`;
        const linkRelatorio = `https://urlscan.io/result/${res.urlscan_uuid}/`;

        sandboxHtml = `
            <div class="row mt-5">
                <div class="col-12">
                    <h4><i class="bi bi-camera text-primary"></i> Sandbox: Evidência Visual da Ameaça</h4>
                    <p class="text-muted mb-3"><small>Captura de ecrã segura gerada em ambiente isolado (urlscan.io).</small></p>
                    <div class="sandbox-container" style="background: #111; border: 1px solid #444; border-radius: 8px; overflow: hidden; position: relative; min-height: 350px; display: flex; align-items: center; justify-content: center;">
                        
                        <div id="loadingPrint" style="position: absolute; text-align: center; color: #00bcd4; z-index: 1;">
                            <div class="spinner-border mb-3" role="status" style="width: 3rem; height: 3rem;"></div>
                            <h5>A processar captura de ecrã...</h5>
                            <small class="text-muted">(Aguarde uns segundos)</small>
                        </div>

                        <img src="${printUrl}" data-attempts="0" style="width: 100%; height: auto; position: relative; z-index: 2; display: none;" 
                             onload="this.style.display='block'; document.getElementById('loadingPrint').style.display='none';" 
                             onerror="
                                let attempts = parseInt(this.getAttribute('data-attempts'));
                                if(attempts < 10) {
                                    this.setAttribute('data-attempts', attempts + 1);
                                    // Tenta de novo em 5 segundos, adicionando um carimbo de tempo para não ler cache
                                    setTimeout(() => this.src='${printUrl}?t=' + new Date().getTime(), 5000);
                                } else {
                                    // Desiste após 10 tentativas e mostra aviso forense
                                    document.getElementById('loadingPrint').innerHTML = '<i class=\\'bi bi-shield-x text-muted\\' style=\\'font-size: 3rem;\\'></i><br><h5 class=\\'mt-3 text-warning\\'>Captura de Ecrã Indisponível</h5><small class=\\'text-muted\\'>O site criminoso está offline ou possui proteção Anti-Bot.<br>Consulte o Relatório Técnico abaixo para dados de rede.</small>';
                                }
                             ">
                    </div>
                    <div class="mt-3 text-end">
                        <a href="${linkRelatorio}" target="_blank" class="btn btn-outline-info">
                            <i class="bi bi-box-arrow-up-right"></i> Ver Relatório Técnico no urlscan.io
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    // 3. Junta as 3 secções (Origem/Autenticação, URLs e Sandbox) no contentor final
    container.innerHTML = `
        <div class="card">
            <div class="card-body p-0">
                <div class="row g-4">
                    <div class="col-md-5">
                        <h4><i class="bi bi-shield-lock"></i> Autenticação</h4>
                        <div class="auth-grid">
                            <div class="auth-item mb-3">
                                <span class="auth-label">SPF</span>
                                <span class="auth-value badge ${getStatusClass(auth.spf)}">${escapeHtml(auth.spf || 'N/A')}</span>
                            </div>
                            <div class="auth-item mb-3">
                                <span class="auth-label">DKIM</span>
                                <span class="auth-value badge ${getStatusClass(auth.dkim)}">${escapeHtml(auth.dkim || 'N/A')}</span>
                            </div>
                            <div class="auth-item mb-0">
                                <span class="auth-label">DMARC</span>
                                <span class="auth-value badge ${getStatusClass(auth.dmarc)}">${escapeHtml(auth.dmarc || 'N/A')}</span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-7">
                        <h4><i class="bi bi-person-bounding-box"></i> Origem do Email</h4>
                        <div class="origem-box d-flex flex-column justify-content-center">
                            <div><strong>Nome:</strong> <span class="fw-bold">${escapeHtml(res.remetente || 'Não identificado')}</span></div>
                            <div><strong>SMTP:</strong> ${escapeHtml(res.return_path || 'Não identificado')}</div>
                            <div><strong>IP:</strong> ${escapeHtml(res.ip_remetente || 'Não identificado')}</div>
                            <div><strong>Domínio:</strong> ${escapeHtml(auth.dominio_autenticado || 'Não identificado')}</div>
                        </div>
                    </div>
                </div>
                ${urlsHtml}
                ${sandboxHtml}
            </div>
        </div>
    `;
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
// EXPORTAÇÃO DE RELATÓRIO FORENSE (PDF)
// ==========================================
function gerarPDF() {
    if (typeof html2pdf === 'undefined') {
        Swal.fire('Erro', 'A biblioteca de PDF não carregou. Atualize a página.', 'error');
        return;
    }

    const resultPanel = document.getElementById('resultPanel');
    const status = document.getElementById('statusLabel').innerText || 'Analise';

    if (resultPanel.classList.contains('hidden')) {
        Swal.fire('Atenção', 'Faça uma análise primeiro.', 'warning');
        return;
    }

    // 1. Esconde o botão verde temporariamente
    const btnPdf = resultPanel.querySelector('button[onclick="gerarPDF()"]');
    if (btnPdf) btnPdf.style.display = 'none';

    Swal.fire({
        title: 'Gerando Relatório...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    // 2. Volta ao topo da página para evitar cortes pelo scroll
    window.scrollTo(0, 0);

    // 3. A VERSÃO INFALÍVEL (O Truque da Moldura)
    // Guardamos o tamanho atual do seu painel panorâmico
    const widthOriginal = resultPanel.style.width;
    const maxWidthOriginal = resultPanel.style.maxWidth;
    const marginOriginal = resultPanel.style.margin;

    // Forçamos o painel a encolher para 800px (o tamanho perfeito de uma folha A4 em pé)
    resultPanel.style.width = '800px';
    resultPanel.style.maxWidth = '800px';
    resultPanel.style.margin = '0 auto';

    const opt = {
        margin: [10, 10, 10, 10],
        filename: `Relatorio-Phishing-${status}-${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: '#0f0f0f', // Mantém o seu fundo preto elegante
            scrollY: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
    };

    // 4. Tira a fotografia à página já redimensionada para A4
    html2pdf().set(opt).from(resultPanel).save()
        .then(() => {
            // Restaura o botão e as dimensões originais num milissegundo!
            if (btnPdf) btnPdf.style.display = 'inline-block';
            resultPanel.style.width = widthOriginal;
            resultPanel.style.maxWidth = maxWidthOriginal;
            resultPanel.style.margin = marginOriginal;

            Swal.fire('Sucesso!', 'Relatório PDF gerado com sucesso.', 'success');
        })
        .catch(err => {
            // Se houver erro, restaura o painel também
            if (btnPdf) btnPdf.style.display = 'inline-block';
            resultPanel.style.width = widthOriginal;
            resultPanel.style.maxWidth = maxWidthOriginal;
            resultPanel.style.margin = marginOriginal;

            Swal.fire('Erro', 'Falha ao criar PDF.', 'error');
            console.error('Erro:', err);
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