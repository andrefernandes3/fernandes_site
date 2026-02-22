async function processarAnalise() {
    const email = document.getElementById('emailBody').value;
    const headers = document.getElementById('emailHeaders').value;
    const btn = document.getElementById('btnAnalisar');
    
    if (!email) return alert("Por favor, cole o conteúdo do e-mail.");

    // Visual de carregamento
    btn.innerText = "Consultando Inteligência Artificial...";
    btn.disabled = true;

    try {
        const response = await fetch('/api/phish-detect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emailContent: email, headers: headers })
        });

        const data = await response.json();
        exibirResultados(data);
    } catch (error) {
        alert("Erro na análise. Tente novamente.");
    } finally {
        btn.innerText = "Analisar Ameaça Agora";
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

    panel.classList.remove('hidden');
    
    // Atualiza o Círculo de Risco
    const corClass = res.Nivel_Risco > 70 ? 'perigoso' : (res.Nivel_Risco > 30 ? 'suspeito' : 'seguro');
    riskCircle.setAttribute('stroke-dasharray', `${res.Nivel_Risco}, 100`);
    riskCircle.className.baseVal = `circle ${corClass}`;
    
    riskValue.innerText = `${res.Nivel_Risco}%`;
    statusLabel.innerText = res.Veredito;
    // (Aviso: Isto fica dentro da sua função exibirResultados)
    statusLabel.className = corClass;
    recomendacao.innerText = res.Recomendacao; // <-- ACENTO REMOVIDO AQUI

    // Limpa e preenche motivos
    lista.innerHTML = "";
    res.Motivos.forEach(m => {
        const li = document.createElement('li');
        li.innerText = m;
        lista.appendChild(li);
    });

    panel.scrollIntoView({ behavior: 'smooth' });
}

function toggleHeaders() {
    const h = document.getElementById('emailHeaders');
    h.classList.toggle('hidden');
}

// Envolvemos AMBOS os eventos (Colar e Ficheiro .eml) para garantirmos que a página carregou
document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. INTERCETOR DE COLAR LINKS OCULTOS ---
    const emailBodyInput = document.getElementById('emailBody');
    if (emailBodyInput) {
        emailBodyInput.addEventListener('paste', function(e) {
            const htmlData = e.clipboardData.getData('text/html');
            if (htmlData) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlData, 'text/html');
                const links = doc.querySelectorAll('a'); 
                let urls = [];
                links.forEach(link => {
                    if (link.href && link.href.startsWith('http')) urls.push(link.href);
                });
                const uniqueUrls = [...new Set(urls)];
                if (uniqueUrls.length > 0) {
                    setTimeout(() => {
                        this.value += "\n\n[ANÁLISE DO SISTEMA: LINKS OCULTOS DETETADOS NA MENSAGEM]\n";
                        this.value += uniqueUrls.join("\n");
                    }, 50);
                }
            }
        });
    }

    // --- 2. LEITOR DE FICHEIROS .EML ---
    const emlInput = document.getElementById('emlFileInput');
    if (emlInput) {
        emlInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(event) {
                const text = event.target.result;
                const separador = text.indexOf('\r\n\r\n') !== -1 ? '\r\n\r\n' : '\n\n';
                const parts = text.split(separador);
                
                if (parts.length > 1) {
                    // Preenche automaticamente
                    document.getElementById('emailHeaders').value = parts[0]; 
                    document.getElementById('emailBody').value = parts.slice(1).join(separador); 
                    
                    // Mostra o botão de headers caso esteja oculto
                    document.getElementById('emailHeaders').classList.remove('hidden');

                    Swal.fire({
                        icon: 'success',
                        title: 'Ficheiro Carregado',
                        text: 'Cabeçalhos e corpo extraídos com sucesso. Clique em Analisar!',
                        timer: 2000,
                        showConfirmButton: false
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Formato Inválido',
                        text: 'Não foi possível ler este ficheiro .eml corretamente.'
                    });
                }
            };
            reader.readAsText(file);
        });
    }
});