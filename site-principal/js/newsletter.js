document.addEventListener('DOMContentLoaded', () => {
    const newsletterForm = document.getElementById('newsletterForm');

    // Se o formulário não existir nesta página, paramos aqui para evitar erros
    if (!newsletterForm) return;

    newsletterForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = document.getElementById('newsletterBtn');
        const emailInput = document.getElementById('newsletterEmail');

        // 1. Detectar Idioma Atual
        const currentLang = localStorage.getItem('language') || 'pt';
        const isEnglish = currentLang === 'en';

        // 2. Textos Dinâmicos
        const texts = {
            saving: isEnglish ? "Saving..." : "Salvando...",
            btnDefault: isEnglish ? "Subscribe" : "Assinar",
            successTitle: isEnglish ? "Subscribed!" : "Inscrito!",
            successText: isEnglish ? "Thanks for joining our list." : "Obrigado por se juntar à nossa lista.",
            errorTitle: isEnglish ? "Oops..." : "Ops...",
            errorText: isEnglish ? "Error subscribing. Try again." : "Erro ao cadastrar. Tente novamente."
        };

        const originalText = btn.innerText;
        btn.innerText = texts.saving;
        btn.disabled = true;

        try {
            const response = await fetch('/api/newsletter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Dentro do objeto que é enviado no body:
                body: JSON.stringify({
                    email: emailInput.value,
                    hp: document.getElementById('newsletter_hp').value // Envia o valor do honeypot
                })
            });

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: texts.successTitle,
                    text: texts.successText,
                    timer: 3000,
                    showConfirmButton: false
                });

                // CORREÇÃO CRÍTICA: Reset direto no elemento do formulário
                newsletterForm.reset();

            } else {
                throw new Error();
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: texts.errorTitle,
                text: texts.errorText,
            });
        } finally {
            btn.innerText = texts.btnDefault; // Restaura o texto original (ou traduzido)
            btn.disabled = false;
        }
    });
});