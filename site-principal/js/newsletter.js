document.addEventListener('DOMContentLoaded', () => {
    const newsletterForm = document.getElementById('newsletterForm');

    // Se o formulário não existir nesta página, paramos aqui
    if (!newsletterForm) return;

    newsletterForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = document.getElementById('newsletterBtn');
        const emailInput = document.getElementById('newsletterEmail');
        
        // CORREÇÃO AQUI: Usamos a chave correta 'selectedLanguage'
        const currentLang = localStorage.getItem('selectedLanguage') || 'pt';
        const isEnglish = currentLang === 'en';

        // Textos Dinâmicos para o Botão e Alertas
        const texts = {
            saving: isEnglish ? "Joining..." : "A entrar...",
            btnDefault: isEnglish ? "Subscribe" : "Assinar",
            successTitle: isEnglish ? "Subscribed!" : "Inscrito!",
            successText: isEnglish ? "Thanks for joining our tech list." : "Obrigado por se juntar à nossa lista de tecnologia.",
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
                body: JSON.stringify({ 
                    email: emailInput.value,
                    hp: document.getElementById('newsletter_hp').value, // Anti-spam
                    lang: currentLang // Envia o idioma para o servidor
                })
            });

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: texts.successTitle,
                    text: texts.successText,
                    timer: 3000,
                    showConfirmButton: false,
                    confirmButtonColor: '#0d6efd'
                });
                
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
            btn.innerText = texts.btnDefault;
            btn.disabled = false;
        }
    });
});