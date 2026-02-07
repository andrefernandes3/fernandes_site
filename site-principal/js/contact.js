document.addEventListener('DOMContentLoaded', () => {
    
    // Verifica se o campo de telefone existe antes de tentar ativar a biblioteca
    const phoneInput = document.querySelector("#phone");
    if (!phoneInput) return; // Se não tiver telefone nessa página, para aqui.

    // Inicializa a biblioteca de DDI
    const iti = window.intlTelInput(phoneInput, {
        initialCountry: "br",
        preferredCountries: ["br", "us"],
        utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.19/js/utils.js",
        separateDialCode: true
    });

    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Validação do Telefone
            if (!iti.isValidNumber()) {
                Swal.fire({ icon: 'warning', title: 'Telefone inválido', text: 'Verifique o número e o país selecionado.' });
                return;
            }

            const btn = document.getElementById('submitButton');
            const originalText = btn.innerText;
            btn.innerText = "A enviar...";
            btn.disabled = true;

            const turnstileResponse = document.querySelector('[name="cf-turnstile-response"]')?.value;

            // Pega o número formatado (ex: +5511999999999)
            const formattedPhone = iti.getNumber();

            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                phone: formattedPhone, 
                subject: document.getElementById('subject').value,
                message: document.getElementById('message').value,
                hp_field: document.getElementById('hp_field').value,
                'cf-turnstile-response': turnstileResponse
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
                        text: 'Mensagem enviada. Entraremos em contato em breve.',
                        confirmButtonColor: '#0d6efd'
                    });
                    contactForm.reset();
                    if (typeof turnstile !== 'undefined') turnstile.reset();
                } else {
                    throw new Error();
                }
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Erro', text: 'Não foi possível enviar. Tente novamente.' });
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }
});