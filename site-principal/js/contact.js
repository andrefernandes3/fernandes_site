document.addEventListener('DOMContentLoaded', () => {
    // 1. Configuração do Telefone (Mantido)
    const phoneInput = document.querySelector("#phone");
    let iti;
    if (phoneInput && window.intlTelInput) {
        iti = window.intlTelInput(phoneInput, {
            initialCountry: "br",
            preferredCountries: ["br", "us"],
            utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.19/js/utils.js",
            separateDialCode: true
        });
    }

    const contactForm = document.getElementById('contactForm');
    const emailInput = document.getElementById('email'); // Captura o campo de e-mail

    if (contactForm) {
        // --- NOVO: Feedback Visual em Tempo Real ---
        emailInput.addEventListener('input', function() {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (this.value.trim() === "") {
                this.classList.remove('is-valid', 'is-invalid');
            } else if (emailRegex.test(this.value.trim())) {
                this.classList.add('is-valid');
                this.classList.remove('is-invalid');
            } else {
                this.classList.add('is-invalid');
                this.classList.remove('is-valid');
            }
        });

        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const currentLang = localStorage.getItem('selectedLanguage') || 'pt';
            const isEnglish = currentLang === 'en';
            const emailValue = emailInput.value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            const texts = {
                emailTitle: isEnglish ? 'Invalid Email' : 'E-mail inválido',
                emailText: isEnglish ? 'Please enter a complete email (ex: name@domain.com).' : 'Por favor, insira um e-mail completo (ex: nome@dominio.com).',
                phoneTitle: isEnglish ? 'Invalid Phone' : 'Telefone inválido',
                phoneText: isEnglish ? 'Check the number and country.' : 'Verifique o número e o país selecionado.',
                btnSending: isEnglish ? "Sending..." : "Enviando...",
                successTitle: isEnglish ? 'Sent!' : 'Enviado!',
                successText: isEnglish ? 'We will contact you soon.' : 'Entraremos em contato em breve.',
                errorTitle: isEnglish ? 'Error' : 'Erro',
                errorText: isEnglish ? 'Try again later.' : 'Tente novamente mais tarde.'
            };

            // --- NOVA VALIDAÇÃO DE E-MAIL (Bloqueia @gm, @hotmail sem o .com, etc) ---
            if (!emailRegex.test(emailValue)) {
                Swal.fire({
                    icon: 'error',
                    title: texts.emailTitle,
                    text: texts.emailText,
                    confirmButtonColor: '#0d6efd'
                });
                return;
            }

            // --- VALIDAÇÃO DE TELEFONE (Mantido) ---
            if (iti && !iti.isValidNumber()) {
                Swal.fire({ icon: 'error', title: texts.phoneTitle, text: texts.phoneText });
                return;
            }

            // --- LÓGICA DE ENVIO (Mantido e Intocado) ---
            const btn = contactForm.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            const turnstileResponse = typeof turnstile !== 'undefined' ? turnstile.getResponse() : '';

            btn.innerText = texts.btnSending;
            btn.disabled = true;

            const formData = {
                name: document.getElementById('name').value,
                email: emailValue,
                phone: iti ? iti.getNumber() : document.getElementById('phone').value,
                subject: document.getElementById('subject').value,
                message: document.getElementById('message').value,
                hp_field: document.getElementById('hp_field').value,
                'cf-turnstile-response': turnstileResponse,
                lang: currentLang
            };

            try {
                const response = await fetch('/api/contact-form', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                if (response.ok) {
                    Swal.fire({ icon: 'success', title: texts.successTitle, text: texts.successText, confirmButtonColor: '#0d6efd' });
                    contactForm.reset();
                    if (typeof turnstile !== 'undefined') turnstile.reset();
                    emailInput.classList.remove('is-valid'); 
                } else {
                    throw new Error();
                }
            } catch (error) {
                Swal.fire({ icon: 'error', title: texts.errorTitle, text: texts.errorText });
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }
});