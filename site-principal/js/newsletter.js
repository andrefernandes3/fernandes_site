document.addEventListener('DOMContentLoaded', () => {
    // Seleciona os elementos usando os IDs atuais da sua index.html
    const btn = document.getElementById('button-newsletter');
    const emailInput = document.getElementById('newsletterInput');

    // Se os elementos não existirem nesta página, o script para aqui (evita erros em outras páginas)
    if (!btn || !emailInput) return;

    // 1. Feedback Visual em tempo real (Bordas Verde/Vermelha)
    emailInput.addEventListener('input', function () {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const value = this.value.trim();

        if (value === "") {
            this.classList.remove('is-valid', 'is-invalid');
        } else if (emailRegex.test(value)) {
            this.classList.add('is-valid');
            this.classList.remove('is-invalid');
        } else {
            this.classList.add('is-invalid');
            this.classList.remove('is-valid');
        }
    });

    // 2. Lógica de Envio ao clicar no botão
    btn.addEventListener('click', async function () {
        const email = emailInput.value.trim();
        const currentLang = localStorage.getItem('selectedLanguage') || 'pt'; //
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        // Dicionário de mensagens traduzidas
        const messages = {
            pt: {
                error_empty: 'Por favor, digite seu e-mail.',
                error_invalid_title: 'E-mail inválido',
                error_invalid: 'Por favor, insira um e-mail válido.',
                already_registered: 'Este e-mail já está na nossa lista!',
                error_server: 'Erro ao conectar. Tente novamente.',
                loading: 'Salvando...',
                success_title: 'Sucesso!',
                success_text: 'E-mail cadastrado na nossa base!'
            },
            en: {
                error_empty: 'Please enter your email.',
                error_invalid_title: 'Invalid Email',
                error_invalid: 'Please enter a valid email address.',
                already_registered: 'This email is already subscribed!',
                error_server: 'Connection error. Try again.',
                loading: 'Saving...',
                success_title: 'Success!',
                success_text: 'Email registered in our database!'
            }
        };

        const text = messages[currentLang];

        // Validação de campo vazio
        if (!email) {
            Swal.fire({ title: 'Ops!', text: text.error_empty, icon: 'warning', confirmButtonColor: '#0d6efd' });
            return;
        }

        // Validação de formato (Regex)
        if (!emailRegex.test(email)) {
            Swal.fire({ title: text.error_invalid_title, text: text.error_invalid, icon: 'error', confirmButtonColor: '#0d6efd' });
            return;
        }

        // UI Loading
        const originalBtnText = btn.innerText;
        btn.innerText = text.loading;
        btn.disabled = true;

        try {
            const response = await fetch('/api/newsletter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, lang: currentLang })
            });

            const data = await response.json();

            if (response.ok) {
                Swal.fire({ title: text.success_title, text: text.success_text, icon: 'success' });
                emailInput.value = '';
                emailInput.classList.remove('is-valid');
            } else if (response.status === 409) {
                // Trata e-mail já existente (vindo do backend ajustado)
                Swal.fire({ title: 'Info', text: text.already_registered, icon: 'info' });
            } else {
                throw new Error(data.error);
            }

        } catch (error) {
            console.error("Erro Newsletter:", error);
            Swal.fire({
                title: 'Erro',
                text: text.error_server,
                icon: 'error',
                confirmButtonColor: '#0d6efd'
            });
        } finally {
            btn.innerText = originalBtnText;
            btn.disabled = false;
        }
    });
});