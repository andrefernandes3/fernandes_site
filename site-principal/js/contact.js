const phoneInput = document.querySelector("#phone");
const iti = window.intlTelInput(phoneInput, {
    initialCountry: "br",
    preferredCountries: ["br", "us"],
    utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.19/js/utils.js",
    separateDialCode: true
});

document.getElementById('contactForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!iti.isValidNumber()) {
        Swal.fire({ icon: 'error', title: 'Telefone inválido' });
        return;
    }

    const btn = document.getElementById('submitButton');
    btn.innerText = "A enviar...";
    btn.disabled = true;

    const turnstileResponse = document.querySelector('[name="cf-turnstile-response"]')?.value;

    const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        phone: iti.getNumber(),
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
            Swal.fire({ icon: 'success', title: 'Sucesso!', text: 'Mensagem enviada.' });
            e.target.reset();
        } else { throw new Error(); }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Tente novamente.' });
    } finally {
        btn.innerText = "Enviar Mensagem";
        btn.disabled = false;
    }
});
