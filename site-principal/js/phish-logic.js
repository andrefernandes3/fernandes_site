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
    statusLabel.className = corClass;
    recomendacao.innerText = res.Recomendação;

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

// Intercepta a ação de "Colar" para extrair links ocultos
document.addEventListener('DOMContentLoaded', () => {
    const emailBodyInput = document.getElementById('emailBody');
    
    if (emailBodyInput) {
        emailBodyInput.addEventListener('paste', function(e) {
            // Tenta capturar a versão HTML (rica) do que foi copiado
            const htmlData = e.clipboardData.getData('text/html');
            
            if (htmlData) {
                // Cria um documento virtual para procurar os links
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlData, 'text/html');
                const links = doc.querySelectorAll('a'); // Encontra todas as tags de link
                
                let urls = [];
                links.forEach(link => {
                    // Pega apenas links externos válidos (http/https)
                    if (link.href && link.href.startsWith('http')) {
                        urls.push(link.href);
                    }
                });

                // Limpa links duplicados
                const uniqueUrls = [...new Set(urls)];

                // Se encontrou algum link oculto, adiciona no final do texto
                if (uniqueUrls.length > 0) {
                    setTimeout(() => {
                        this.value += "\n\n[ANÁLISE DO SISTEMA: LINKS OCULTOS DETETADOS NA MENSAGEM]\n";
                        this.value += uniqueUrls.join("\n");
                    }, 50); // Aguarda o navegador colar o texto normal primeiro
                }
            }
        });
    }
});