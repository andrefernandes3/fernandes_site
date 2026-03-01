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
                    <p class="text-info mb-3" style="font-size: 0.95em;">
    <i class="bi bi-shield-check me-1"></i> Captura de ecrã segura gerada em ambiente isolado (urlscan.io).</p>
                </div>
            </div>
        `;
    }

    // 2. 🟢 O NOVO VISUALIZADOR DO URLSCAN (SANDBOX)
    let sandboxHtml = '';
    if (res.urlscan_uuid) {
        const linkRelatorio = `https://urlscan.io/result/${res.urlscan_uuid}/`;

        sandboxHtml = `
            <div class="row mt-5">
                <div class="col-12">
                    <h4><i class="bi bi-camera text-primary"></i> Sandbox: Evidência Visual da Ameaça</h4>
                    <p class="text-muted mb-3"><small>Captura de ecrã segura gerada em ambiente isolado (urlscan.io).</small></p>
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

        // 🚀 Dispara o "Motor Silencioso" 100 milissegundos após o painel ser criado
        setTimeout(() => { pollUrlScanImage(res.urlscan_uuid); }, 100);
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
// EXPORTAÇÃO DE RELATÓRIO PDF (Alinhamento Perfeito)
// ==========================================
function gerarPDF() {
    const botoes = document.querySelector('.mt-4.text-end');
    if (botoes) botoes.style.display = 'none';

    const elemento = document.getElementById('resultPanel');
    
    // 1. 🛡️ TRUQUE DE ALINHAMENTO: Congelar o layout do Bootstrap
    // Vamos forçar as colunas a comportarem-se como num ecrã de PC gigante, ignorando responsividade
    const authCol = document.querySelector('.col-md-5');
    const origCol = document.querySelector('.col-md-7');
    
    if (authCol) { authCol.classList.remove('col-md-5'); authCol.classList.add('col-5'); }
    if (origCol) { origCol.classList.remove('col-md-7'); origCol.classList.add('col-7'); }

    // Forçamos o painel a ter exatos 1200px de largura para a "fotografia" não espremer o texto
    const originalWidth = elemento.style.width;
    elemento.style.width = '1200px';

    // 2. Configurações Profissionais (Com Proteção de Quebra de Página)
    const opt = {
        margin:       [15, 10, 15, 10], // Margens [Cima, Direita, Baixo, Esquerda]
        filename:     `Relatorio-Phishing-${new Date().toISOString().slice(0, 10)}.pdf`,
        image:        { type: 'jpeg', quality: 1.0 },
        html2canvas:  { 
            scale: 2, 
            useCORS: true, // Garante que a imagem do urlscan aparece
            backgroundColor: '#1a1a1a', 
            windowWidth: 1200,
            scrollY: 0 // Impede que o PDF saia cortado se a página estiver "scrollada" para baixo
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        // 🟢 NOVO: Evita que as caixas ou a imagem sejam cortadas a meio da folha A4
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] } 
    };

    Swal.fire({
        title: 'A Formatar Relatório...',
        text: 'A estabilizar o layout e a capturar a evidência visual.',
        icon: 'info',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    // 3. Gerar o PDF
    html2pdf().set(opt).from(elemento).save().then(() => {
        // 4. 🧹 LIMPEZA: Reverte o site ao estado normal após gerar o PDF
        if (botoes) botoes.style.display = 'block';
        elemento.style.width = originalWidth;
        if (authCol) { authCol.classList.remove('col-5'); authCol.classList.add('col-md-5'); }
        if (origCol) { origCol.classList.remove('col-7'); origCol.classList.add('col-md-7'); }
        Swal.close();
    }).catch(err => {
        console.error('Erro ao gerar PDF:', err);
        if (botoes) botoes.style.display = 'block';
        elemento.style.width = originalWidth;
        if (authCol) { authCol.classList.remove('col-5'); authCol.classList.add('col-md-5'); }
        if (origCol) { origCol.classList.remove('col-7'); origCol.classList.add('col-md-7'); }
        Swal.fire('Erro', 'Ocorreu um problema ao gerar o documento.', 'error');
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