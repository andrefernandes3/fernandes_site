document.addEventListener('DOMContentLoaded', () => {
    // 1. Configuração do Telefone (DDI)
    const phoneInput = document.querySelector("#phone");
    let iti;

    // Só tenta ativar se o campo existir e a biblioteca estiver carregada
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

            // Validação do Telefone
            if (iti && !iti.isValidNumber()) {
                Swal.fire({ icon: 'warning', title: 'Telefone inválido', text: 'Verifique o número.' });
                return;
            }

            const btn = document.getElementById('submitButton');
            const originalText = btn.innerText;
            btn.innerText = "A enviar...";
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
                lang: localStorage.getItem('selectedLanguage') || 'pt'
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
                        title: 'Sucesso!', 
                        text: 'Mensagem enviada.',
                        confirmButtonColor: '#0d6efd'
                    });
                    contactForm.reset();
                    if (typeof turnstile !== 'undefined') turnstile.reset();
                } else {
                    throw new Error();
                }
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Erro', text: 'Tente novamente.' });
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }
});