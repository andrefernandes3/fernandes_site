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

    // Medidor de Risco
    document.getElementById('riskValue').textContent = `${res.Nivel_Risco}%`;
    const riskCircle = document.getElementById('riskCircle');
    riskCircle.setAttribute('stroke-dasharray', `${res.Nivel_Risco * 1.1}, 110`);

    let circleClass = 'suspeito';
    if (res.Nivel_Risco < 30) circleClass = 'seguro';
    else if (res.Nivel_Risco > 70) circleClass = 'perigoso';
    riskCircle.className.baseVal = `circle ${circleClass}`;

    // Veredito
    const statusLabel = document.getElementById('statusLabel');
    statusLabel.textContent = res.Veredito;
    statusLabel.className = `badge fs-3 ${circleClass === 'seguro' ? 'badge-success' : circleClass === 'perigoso' ? 'badge-danger' : 'badge-warning'}`;
    document.getElementById('recomendacao').innerHTML = res.Recomendacao.replace(/\n/g, '<br>');

    // Motivos
    const listaMotivos = document.getElementById('listaMotivos');
    listaMotivos.innerHTML = '';
    res.Motivos.forEach(m => {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.innerHTML = `<i class="bi bi-check-circle text-primary me-2"></i>${m}`;
        listaMotivos.appendChild(li);
    });

    // Alertas Especiais
    const alertasContainer = document.getElementById('alertasExtras');
    alertasContainer.innerHTML = '';
    
    if (res.Veredito !== 'SEGURO' && res.remetente && res.remetente.toLowerCase().includes('receita')) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert-section';
        alertDiv.innerHTML = `
            <h5><i class="bi bi-exclamation-triangle-fill text-danger"></i> 🚨 ALERTA GOVERNO</h5>
            <p class="mb-0"><strong>Receita Federal NUNCA</strong> pede regularização por e-mail com links.</p>
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
    container.className = 'detalhes-adicionais mt-4 card shadow-sm';
    
    const auth = res.detalhes_autenticacao;
    
    // Constrói a lista de URLs (se existirem)
    let urlsHtml = '';
    if (res.urls_encontradas && res.urls_encontradas.length > 0) {
        // Limita a 10 URLs no ecrã para não desformatar o PDF
        const urlsMostrar = res.urls_encontradas.slice(0, 10);
        const listaUrls = urlsMostrar.map(u => `<li class="list-group-item py-1 text-muted small" style="word-break: break-all;">${escapeHtml(u)}</li>`).join('');
        
        urlsHtml = `
            <div class="row mt-3 border-top pt-3">
                <div class="col-12">
                    <h5><i class="bi bi-link-45deg text-primary"></i> URLs e Links Detetados Forensicamente</h5>
                    <ul class="list-group list-group-flush border rounded">
                        ${listaUrls}
                    </ul>
                    ${res.urls_encontradas.length > 10 ? `<div class="text-muted small mt-1">+ ${res.urls_encontradas.length - 10} links ocultados.</div>` : ''}
                </div>
            </div>
        `;
    } else {
        urlsHtml = `
            <div class="row mt-3 border-top pt-3">
                <div class="col-12">
                    <h5><i class="bi bi-link-45deg text-secondary"></i> URLs e Links Detetados</h5>
                    <p class="text-muted small">Nenhum link web encontrado no corpo do e-mail.</p>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="card-body">
            <div class="row">
                <div class="col-md-4">
                    <h5><i class="bi bi-shield-lock"></i> Autenticação Email</h5>
                    <div class="auth-grid mt-2">
                        <div class="auth-item mb-1">
                            <span class="auth-label fw-bold me-2">SPF:</span>
                            <span class="auth-value badge ${getStatusClass(auth.spf)}">${escapeHtml(auth.spf || 'não verificado')}</span>
                        </div>
                        <div class="auth-item mb-1">
                            <span class="auth-label fw-bold me-2">DKIM:</span>
                            <span class="auth-value badge ${getStatusClass(auth.dkim)}">${escapeHtml(auth.dkim || 'não verificado')}</span>
                        </div>
                        <div class="auth-item mb-1">
                            <span class="auth-label fw-bold me-2">DMARC:</span>
                            <span class="auth-value badge ${getStatusClass(auth.dmarc)}">${escapeHtml(auth.dmarc || 'não verificado')}</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-8">
                    <h5><i class="bi bi-person-lines-fill"></i> Origem do Email</h5>
                    <div class="row mt-2 text-break">
                        <div class="col-12 mb-1"><strong>Nome:</strong> ${escapeHtml(res.remetente || 'Não identificado')}</div>
                        <div class="col-12 mb-1"><strong>SMTP:</strong> ${escapeHtml(res.return_path || 'Não identificado')}</div>
                        <div class="col-6 mb-1"><strong>IP:</strong> ${escapeHtml(res.ip_remetente || 'Não identificado')}</div>
                        <div class="col-6 mb-1"><strong>Domínio:</strong> ${escapeHtml(auth.dominio_autenticado || 'Não identificado')}</div>
                    </div>
                </div>
            </div>
            ${urlsHtml}
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

function gerarPDF() {
    const element = document.getElementById('resultPanel');
    const status = document.getElementById('statusLabel').innerText;
    
    const opt = {
        margin: [15, 10, 10, 10],
        filename: `PhishDetect-${status}-${new Date().toISOString().slice(0,10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    Swal.fire({
        title: 'Gerando PDF...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    html2pdf().set(opt).from(element).save().then(() => {
        Swal.fire('Sucesso!', 'Relatório salvo!', 'success');
    }).catch(err => {
        Swal.fire('Erro', 'Falha ao gerar PDF', 'error');
        console.error(err);
    });
}

// ==========================================
// LEITOR DE ARQUIVOS .EML
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const emlInput = document.getElementById('emlFileInput');
    const emailBody = document.getElementById('emailBody');
    const emailHeaders = document.getElementById('emailHeaders');
    
    // Detecta links ocultos na colagem
    emailBody.addEventListener('paste', function(e) {
        setTimeout(() => {
            const text = this.value;
            const links = text.match(/https?:\/\/[^\s<>"']+/g);
            if (links && links.length > 0) {
                this.value += `\n\n🔗 LINKS DETECTADOS:\n${links.slice(0,3).join('\n')}`;
            }
        }, 100);
    });

    // Leitor .eml
    emlInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        emailBody.value = '';
        emailHeaders.value = '';
        document.getElementById('resultPanel').classList.add('hidden');
        
        const reader = new FileReader();
        reader.onload = function(event) {
            const text = event.target.result;
            const separator = text.indexOf('\n\n') > 0 ? '\n\n' : '\r\n\r\n';
            const parts = text.split(separator);
            
            if (parts.length > 1) {
                emailHeaders.value = parts[0].trim();
                emailBody.value = parts.slice(1).join(separator).trim();
                emailHeaders.classList.remove('hidden');
                Swal.fire({ icon: 'success', title: '✅ Carregado', text: 'Headers extraídos! Clique Analisar.', timer: 2000 });
            } else {
                Swal.fire({ icon: 'error', title: 'Formato inválido', text: 'Não foi possível separar headers.' });
            }
            emlInput.value = '';
        };
        reader.readAsText(file, 'UTF-8');
    });
});
