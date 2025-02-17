document.addEventListener('DOMContentLoaded', function() {
    const select = document.querySelector('.custom-select');
    const selectedOption = select.querySelector('.selected-option');
    const options = select.querySelectorAll('.options li');

    selectedOption.addEventListener('click', function() {
        select.classList.toggle('open');
    });

    options.forEach(option => {
        option.addEventListener('click', function() {
            selectedOption.innerHTML = option.innerHTML;
            select.classList.remove('open');
            const selectedValue = option.getAttribute('data-value');
            console.log('Selected value:', selectedValue); // Aqui você pode atualizar o idioma
        });
    });

    // Fechar o seletor ao clicar fora
    document.addEventListener('click', function(event) {
        if (!select.contains(event.target)) {
            select.classList.remove('open');
        }
    });
});