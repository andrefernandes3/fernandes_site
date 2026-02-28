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
        alertDiv.innerHTML = `
            <div class="alert alert-danger">
                <h5><i class="bi bi-exclamation-triangle-fill"></i> 🚨 ALERTA GOVERNO</h5>
                <p class="mb-0"><strong>Receita Federal NUNCA</strong> pede regularização por e-mail com links.</p>
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
    container.className = 'detalhes-adicionais mt-4';

    const auth = res.detalhes_autenticacao || {};

    // Constrói a lista de URLs
    let urlsHtml = '';
    if (res.urls_encontradas && res.urls_encontradas.length > 0) {
        const listaUrls = res.urls_encontradas.map(u => `<li class="list-group-item py-2" style="word-break: break-all;">${escapeHtml(u)}</li>`).join('');

        urlsHtml = `
            <div class="row mt-4 border-top pt-4">
                <div class="col-12">
                    <h4><i class="bi bi-link-45deg text-primary"></i> URLs e Links Detetados Forensicamente</h4>
                    <ul class="list-group list-group-flush border rounded">
                        ${listaUrls}
                    </ul>
                </div>
            </div>
        `;
    } else {
        urlsHtml = `
            <div class="row mt-4 border-top pt-4">
                <div class="col-12">
                    <h4><i class="bi bi-link-45deg text-secondary"></i> URLs e Links Detetados</h4>
                    <p class="text-muted">Nenhum link web encontrado no corpo do e-mail.</p>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="card">
            <div class="card-body">
                <div class="row">
                    <div class="col-md-5">
                        <h4><i class="bi bi-shield-lock"></i> Autenticação Email</h4>
                        <div class="auth-grid mt-3">
                            <div class="auth-item mb-3">
                                <span class="auth-label fw-bold me-2">SPF:</span>
                                <span class="auth-value badge ${getStatusClass(auth.spf)}">${escapeHtml(auth.spf || 'não verificado')}</span>
                            </div>
                            <div class="auth-item mb-3">
                                <span class="auth-label fw-bold me-2">DKIM:</span>
                                <span class="auth-value badge ${getStatusClass(auth.dkim)}">${escapeHtml(auth.dkim || 'não verificado')}</span>
                            </div>
                            <div class="auth-item mb-3">
                                <span class="auth-label fw-bold me-2">DMARC:</span>
                                <span class="auth-value badge ${getStatusClass(auth.dmarc)}">${escapeHtml(auth.dmarc || 'não verificado')}</span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-7">
                        <h4><i class="bi bi-person-lines-fill"></i> Origem do Email</h4>
                        <div class="mt-3">
                            <div class="mb-3"><strong>Nome:</strong> ${escapeHtml(res.remetente || 'Não identificado')}</div>
                            <div class="mb-3"><strong>SMTP:</strong> ${escapeHtml(res.return_path || 'Não identificado')}</div>
                            <div class="mb-3"><strong>IP:</strong> ${escapeHtml(res.ip_remetente || 'Não identificado')}</div>
                            <div class="mb-3"><strong>Domínio:</strong> ${escapeHtml(auth.dominio_autenticado || 'Não identificado')}</div>
                        </div>
                    </div>
                </div>
                ${urlsHtml}
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

/// ==========================================
// EXPORTAÇÃO DE RELATÓRIO FORENSE (PDF)
// ==========================================
function gerarPDF() {
    if (typeof html2pdf === 'undefined') {
        Swal.fire('Erro', 'A biblioteca de PDF não carregou. Atualize a página.', 'error');
        return;
    }

    const resultPanel = document.getElementById('resultPanel');
    const status = document.getElementById('statusLabel').innerText || 'Analise';

    // Verifica se há resultado para exportar
    if (resultPanel.classList.contains('hidden')) {
        Swal.fire('Atenção', 'Faça uma análise primeiro.', 'warning');
        return;
    }

    Swal.fire({
        title: 'Gerando Relatório...',
        text: 'A formatar o documento forense...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    window.scrollTo(0, 0);

    // Cria um container completo para o PDF com todos os estilos
    const pdfContainer = document.createElement('div');
    pdfContainer.id = 'pdf-container';
    pdfContainer.className = 'pdf-mode';
    pdfContainer.style.backgroundColor = '#0f0f0f';
    pdfContainer.style.padding = '20px';
    pdfContainer.style.width = '800px';
    pdfContainer.style.margin = '0 auto';
    pdfContainer.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";

    // Clona o resultPanel
    const clonePanel = resultPanel.cloneNode(true);
    clonePanel.id = 'clone-for-pdf';
    clonePanel.classList.add('pdf-mode');
    clonePanel.style.backgroundColor = '#0f0f0f';
    clonePanel.style.color = '#ffffff';
    clonePanel.style.borderLeft = '5px solid #00bcd4';
    clonePanel.style.padding = '30px';
    clonePanel.style.margin = '0';

    // Remove o botão de gerar PDF do clone
    const btnClone = clonePanel.querySelector('button[onclick="gerarPDF()"]');
    if (btnClone) btnClone.remove();

    // Garante que o card moderno está visível
    const modernCard = clonePanel.querySelector('.risk-modern-card');
    if (modernCard) {
        modernCard.style.display = 'inline-block';
    }

    // Garante que os cards de autenticação tenham fundo escuro
    const cards = clonePanel.querySelectorAll('.card');
    cards.forEach(card => {
        card.style.backgroundColor = '#1a1a1a';
        card.style.border = '1px solid #333';
    });

    const listItems = clonePanel.querySelectorAll('.list-group-item');
    listItems.forEach(item => {
        item.style.backgroundColor = '#222';
        item.style.color = '#fff';
        item.style.borderLeft = '5px solid #00bcd4';
    });

    const alerts = clonePanel.querySelectorAll('.alert');
    alerts.forEach(alert => {
        alert.style.backgroundColor = '#222';
        alert.style.border = '1px solid #dc2626';
        alert.style.color = '#fff';
    });

    // Adiciona o clone ao container
    pdfContainer.appendChild(clonePanel);

    // Adiciona ao body temporariamente
    pdfContainer.style.position = 'absolute';
    pdfContainer.style.left = '-9999px';
    pdfContainer.style.top = '0';
    document.body.appendChild(pdfContainer);

    // Inclui todos os estilos necessários
    const styles = document.querySelectorAll('link[rel="stylesheet"], style');
    let stylesHTML = '';
    styles.forEach(style => {
        if (style.tagName === 'LINK') {
            stylesHTML += `<link rel="stylesheet" href="${style.href}">`;
        } else {
            stylesHTML += `<style>${style.innerHTML}</style>`;
        }
    });

    const opt = {
        margin: [10, 10, 10, 10],
        filename: `Relatorio-Phishing-${status}-${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: '#0f0f0f',
            logging: false,
            allowTaint: false,
            foreignObjectRendering: false
        },
        jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait'
        },
        pagebreak: { mode: ['css', 'legacy'] }
    };

    // Injeta estilos no clone via onclone
    opt.html2canvas.onclone = function (clonedDoc) {
        const container = clonedDoc.getElementById('pdf-container');
        if (container) {
            // Aplica estilos adicionais garantindo fundo escuro
            container.style.backgroundColor = '#0f0f0f';

            const panel = clonedDoc.getElementById('clone-for-pdf');
            if (panel) {
                panel.style.backgroundColor = '#0f0f0f';
                panel.style.color = '#ffffff';

                // Força fundo escuro em todos os elementos
                const allElements = panel.querySelectorAll('*');
                allElements.forEach(el => {
                    if (el.tagName !== 'svg' && el.tagName !== 'path') {
                        // Mantém textos brancos
                        if (window.getComputedStyle(el).color === 'rgb(0, 0, 0)') {
                            el.style.color = '#ffffff';
                        }
                    }
                });

                // Cards
                const cards = panel.querySelectorAll('.card');
                cards.forEach(card => {
                    card.style.backgroundColor = '#1a1a1a';
                    card.style.border = '1px solid #333';
                });

                // List items
                const items = panel.querySelectorAll('.list-group-item');
                items.forEach(item => {
                    item.style.backgroundColor = '#222';
                    item.style.color = '#ffffff';
                    item.style.borderLeft = '5px solid #00bcd4';
                });

                // Auth items
                const authItems = panel.querySelectorAll('.auth-item');
                authItems.forEach(item => {
                    item.style.backgroundColor = 'transparent';
                });

                // Badges
                const badges = panel.querySelectorAll('.badge');
                badges.forEach(badge => {
                    if (badge.classList.contains('badge-success')) {
                        badge.style.backgroundColor = '#10b981';
                    } else if (badge.classList.contains('badge-warning')) {
                        badge.style.backgroundColor = '#f59e0b';
                    } else if (badge.classList.contains('badge-danger')) {
                        badge.style.backgroundColor = '#dc2626';
                    } else if (badge.classList.contains('badge-secondary')) {
                        badge.style.backgroundColor = '#4b5563';
                    }
                    badge.style.color = '#ffffff';
                });
            }
        }
    };

    html2pdf().set(opt).from(pdfContainer).save()
        .then(() => {
            document.body.removeChild(pdfContainer);
            Swal.fire('Sucesso!', 'Relatório gerado com sucesso.', 'success');
        })
        .catch(err => {
            document.body.removeChild(pdfContainer);
            Swal.fire('Erro', 'Falha ao criar PDF.', 'error');
            console.error('Erro detalhado:', err);
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