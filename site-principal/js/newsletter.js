<script>
    document.getElementById('newsletterForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = document.getElementById('newsletterBtn');
        const emailInput = document.getElementById('newsletterEmail');
        
        const originalText = btn.innerText;
        btn.innerText = "Salvnado..."; // Feedback visual
        btn.disabled = true;

        try {
            const response = await fetch('/api/newsletter', { // Nova API que criaremos
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailInput.value })
            });

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Inscrito!',
                    text: 'Obrigado por se juntar à nossa lista.',
                    timer: 3000,
                    showConfirmButton: false
                });
                emailInput.value = ''; // Limpa o campo
            } else {
                throw new Error();
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Ops...',
                text: 'Erro ao cadastrar. Tente novamente.',
            });
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
</script>