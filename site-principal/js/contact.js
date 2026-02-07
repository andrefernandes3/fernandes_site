document.addEventListener('DOMContentLoaded', () => {
    // 1. Configuração do Telefone (DDI)
    const phoneInput = document.querySelector("#phone");
    let iti;

    // Só ativa se o campo existir e a biblioteca carregou
    if (phoneInput && window.intlTelInput) {
        iti = window.intlTelInput(phoneInput, {
            initialCountry: "br",
            preferredCountries: ["br", "us"],
            utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.19/js/utils.js",
            separateDialCode: true
        });
    }

    // 2. Envio do Formulário
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // --- DETECÇÃO DE IDIOMA PARA O JAVASCRIPT ---
            const currentLang = localStorage.getItem('selectedLanguage') || 'pt';
            const isEnglish = currentLang === 'en';

            // Dicionário de mensagens do JS
            const texts = {
                phoneTitle: isEnglish ? 'Invalid Phone' : 'Telefone inválido',
                phoneText: isEnglish ? 'Check the number and country.' : 'Verifique o número e o país selecionado.',
                btnSending: isEnglish ? "Sending..." : "Enviando...", // <--- O QUE VOCÊ PEDIU
                successTitle: isEnglish ? 'Success!' : 'Sucesso!',
                successText: isEnglish ? 'Message sent successfully.' : 'Mensagem enviada com sucesso.',
                errorTitle: isEnglish ? 'Error' : 'Erro',
                errorText: isEnglish ? 'Could not send. Try again.' : 'Não foi possível enviar. Tente novamente.'
            };

            // Validação do Telefone
            if (iti && !iti.isValidNumber()) {
                Swal.fire({ icon: 'warning', title: texts.phoneTitle, text: texts.phoneText });
                return;
            }

            const btn = document.getElementById('submitButton');
            const originalText = btn.innerText; // Guarda o texto original ("Enviar" ou "Send")
            
            // Aplica a tradução no estado de carregamento
            btn.innerText = texts.btnSending; 
            btn.disabled = true;

            const turnstileResponse = document.querySelector('[name="cf-turnstile-response"]')?.value;

            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                phone: iti ? iti.getNumber() : document.getElementById('phone').value,
                subject: document.getElementById('subject').value,
                message: document.getElementById('message').value,
                hp_field: document.getElementById('hp_field').value,
                'cf-turnstile-response': turnstileResponse,
                lang: currentLang // Envia para a API saber qual e-mail mandar
            };

            try {
                const response = await fetch('/api/contact-form', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                if (response.ok) {
                    Swal.fire({ 
                        icon: 'success', 
                        title: texts.successTitle, 
                        text: texts.successText,
                        confirmButtonColor: '#0d6efd'
                    });
                    contactForm.reset();
                    if (typeof turnstile !== 'undefined') turnstile.reset();
                } else {
                    throw new Error();
                }
            } catch (error) {
                Swal.fire({ icon: 'error', title: texts.errorTitle, text: texts.errorText });
            } finally {
                btn.innerText = originalText; // Devolve o texto original do botão
                btn.disabled = false;
            }
        });
    }
});