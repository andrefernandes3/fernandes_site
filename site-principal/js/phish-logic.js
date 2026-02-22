// ==========================================
// LÓGICA DE ANÁLISE E COMUNICAÇÃO COM A API
// ==========================================

async function processarAnalise() {
    const btn = document.getElementById('btnAnalisar');
    const originalText = btn.innerHTML;
    
    const emailContent = document.getElementById('emailBody').value.trim();
    const headers = document.getElementById('emailHeaders').value.trim();

    if (!emailContent) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Por favor, cole o conteúdo do e-mail ou carregue um arquivo .eml.', timer: 3000, showConfirmButton: false });
        } else {
            alert('Por favor, cole o conteúdo do e-mail.');
        }
        return;
    }

    // LIMPEZA PRÉVIA: Esconde o painel e apaga tabelas antigas para não misturar dados
    const panel = document.getElementById('resultPanel');
    panel.classList.add('hidden');
    const oldDetails = panel.querySelectorAll('.detalhes-adicionais, .alert-section');
    oldDetails.forEach(el => el.remove());

    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Analisando...';
    btn.disabled = true;

    try {
        const response = await fetch('/api/phish-detect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emailContent, headers })
        });

        if (!response.ok) throw new Error('Erro na análise do backend');

        const data = await response.json();
        exibirResultados(data);

    } catch (error) {
        console.error('Erro Técnico:', error);
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'error', title: 'Erro de Análise', text: 'Houve uma falha ao comunicar com o servidor. Tente novamente.', timer: 4000 });
        } else {
            alert('Erro de Análise: Houve uma falha ao comunicar com o servidor.');
        }
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ==========================================
// EXIBIÇÃO DE RESULTADOS
// ==========================================

function exibirResultados(res) {
    const panel = document.getElementById('resultPanel');
    panel.classList.remove('hidden');

    // Atualiza Medidor de Risco
    const riskValue = document.getElementById('riskValue');
    riskValue.textContent = `${res.Nivel_Risco}%`;

    const riskCircle = document.getElementById('riskCircle');
    riskCircle.setAttribute('stroke-dasharray', `${res.Nivel_Risco}, 100`);

    let circleClass = 'suspeito';
    if (res.Nivel_Risco < 30) circleClass = 'seguro';
    else if (res.Nivel_Risco > 70) circleClass = 'perigoso';
    riskCircle.className.baseVal = `circle ${circleClass}`;

    // Veredito e Recomendação
    const statusLabel = document.getElementById('statusLabel');
    statusLabel.textContent = res.Veredito;
    statusLabel.className = circleClass;
    document.getElementById('recomendacao').innerHTML = escapeHtml(res.Recomendacao);

    // Lista de Motivos
    const listaMotivos = document.getElementById('listaMotivos');
    listaMotivos.innerHTML = '';
    res.Motivos.forEach(m => {
        const li = document.createElement('li');
        li.innerHTML = escapeHtml(m);
        listaMotivos.appendChild(li);
    });

    // Alertas Dinâmicos de Órgãos Oficiais
    if (res.Veredito !== 'SEGURO' && res.remetente && res.remetente.toLowerCase().includes('receita')) {
        const alertSection = document.createElement('div');
        alertSection.className = 'alert-section';
        alertSection.innerHTML = `<h4>Alerta Governamental</h4><p>A Receita Federal não envia links para regularizar CPF por e-mail.</p>`;
        panel.appendChild(alertSection);
    }

    // Tabela de Detalhes de Autenticação e Domínios
    if (res.detalhes_autenticacao) {
        const detalhesContainer = criarDetalhesAdicionais(res);
        panel.appendChild(detalhesContainer);
    }

    // Rola a página suavemente para o resultado
    panel.scrollIntoView({ behavior: 'smooth' });
}

function criarDetalhesAdicionais(res) {
    const container = document.createElement('div');
    container.className = 'detalhes-adicionais';
    container.innerHTML = `
        <div class="auth-details">
            <h4>Detalhes de Autenticação Forense</h4>
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
        </div>

        <div class="sender-details">
            <h4>Análise de Origem</h4>
            <div class="sender-info">
                <div class="info-item"><strong>Nome de Exibição:</strong> ${escapeHtml(res.remetente)}</div>
                <div class="info-item"><strong>Remetente Real (SMTP):</strong> ${escapeHtml(res.return_path || 'Não identificado')}</div>
                <div class="info-item"><strong>IP Origem:</strong> ${escapeHtml(res.ip_remetente)}</div>
            </div>
        </div>

        <div class="dominios-details">
            <h4>Domínios Inspecionados</h4>
            <ul id="dominiosList" class="dominios-list"></ul>
        </div>
    `;

    const dominiosList = container.querySelector('#dominiosList');
    if (res.dominios_analisados && res.dominios_analisados.length > 0) {
        res.dominios_analisados.forEach(dom => {
            const li = document.createElement('li');
            
            // Etiqueta do VirusTotal
            const vtInfo = dom.vt ? ` | <span style="color: ${dom.vt.includes('ALERTA') ? '#ff4444' : '#00C851'}"><strong>VT:</strong> ${escapeHtml(dom.vt)}</span>` : '';
            
            li.innerHTML = `<span class="domain-name"><strong>${escapeHtml(dom.dominio)}</strong></span> | Idade: ${escapeHtml(dom.age || dom.idade)}${vtInfo}`;
            dominiosList.appendChild(li);
        });
    } else {
        dominiosList.innerHTML = '<li>Nenhum link suspeito detetado.</li>';
    }

    return container;
}

// ==========================================
// FUNÇÕES AUXILIARES E EXPORTAÇÃO
// ==========================================

function getStatusClass(value) {
    if (!value) return 'badge-secondary';
    value = value.toLowerCase();
    if (value.includes('pass') || value.includes('success')) return 'badge-success';
    if (value.includes('fail') || value.includes('hardfail')) return 'badge-danger';
    if (value.includes('softfail')) return 'badge-warning';
    return 'badge-neutral';
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

// Função para gerar PDF do Relatório
function gerarPDF() {
    if (typeof html2pdf === 'undefined') {
        alert('A biblioteca de PDF ainda não foi carregada. Verifique o seu phish.html.');
        return;
    }
    
    const element = document.getElementById('resultPanel');
    const status = document.getElementById('statusLabel').innerText;
    
    const opt = {
        margin:       10,
        filename:     `Relatorio-Phishing-${status}-${new Date().getTime()}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const btn = document.querySelector('button[onclick="gerarPDF()"]');
    if(btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = 'A gerar PDF...';
        btn.disabled = true;

        html2pdf().set(opt).from(element).save().then(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        });
    }
}

// ==========================================
// LEITURA DE ARQUIVO .EML (Limpo e Forense)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const emlInput = document.getElementById('emlFileInput');
    const emailBody = document.getElementById('emailBody');
    const emailHeaders = document.getElementById('emailHeaders');
    
    // Intercetar colagem de links ocultos
    if (emailBody) {
        emailBody.addEventListener('paste', function(e) {
            const htmlData = e.clipboardData.getData('text/html');
            if (htmlData) {
                const links = htmlData.match(/href=["'](https?:\/\/[^"']+)["']/gi);
                if (links && links.length > 0) {
                    const cleanLinks = links.map(l => l.replace(/href=["']/i, '').replace(/["']$/, ''));
                    setTimeout(() => {
                        this.value += '\n\n[LINKS OCULTOS DETETADOS]\n' + [...new Set(cleanLinks)].join('\n');
                    }, 100);
                }
            }
        });
    }

    // Leitor do Ficheiro .eml
    if (emlInput) {
        emlInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            // Limpa caixas e painéis de análises anteriores
            emailBody.value = '';
            emailHeaders.value = '';
            const panel = document.getElementById('resultPanel');
            if(panel) panel.classList.add('hidden');
            
            const reader = new FileReader();
            reader.onload = function(event) {
                const text = event.target.result;
                const separador = text.indexOf('\r\n\r\n') !== -1 ? '\r\n\r\n' : '\n\n';
                const parts = text.split(separador);
                
                if (parts.length > 1) {
                    emailHeaders.value = parts[0]; 
                    emailBody.value = parts.slice(1).join(separador); 
                    emailHeaders.classList.remove('hidden');

                    if (typeof Swal !== 'undefined') {
                        Swal.fire({ icon: 'success', title: 'Ficheiro Carregado', text: 'Cabeçalhos extraídos perfeitamente. Clique em Analisar!', timer: 2000, showConfirmButton: false });
                    }
                } else {
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({ icon: 'error', title: 'Formato Inválido', text: 'Não foi possível ler os cabeçalhos deste ficheiro .eml.' });
                    }
                }
                
                emlInput.value = '';
            };
            reader.readAsText(file);
        });
    }
});