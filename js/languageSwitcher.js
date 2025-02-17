const translations = {
    en: {
        missionTitle: "Our mission is to make technology simpler for everyone.",
        missionText: "At Fernandes Technology, we believe that efficient and innovative IT solutions should be accessible to every business. We provide expert consulting, cutting-edge technology implementation, and ongoing support to help your organization achieve its goals. Use our free services or support us by purchasing our premium solutions to drive your digital transformation.",
        readStory: "Read our story",
        home: "Home",
        about: "About",
        contact: "Contact",
        blog: "Blog",
        portfolio: "Portfolio",
        ourTeam: "Our team",
        dedicatedToQuality: "Dedicated to quality and your success",
        ourFounding: "Our founding",
        growthBeyond: "Growth & beyond",
        founderCEO: "Founder & CEO",
        cfo: "CFO",
        operationsManager: "Operations Manager",
        cto: "CTO",
        copyright: "Copyright &copy; Fernandes Technology 2025",
        privacy: "Privacy",
        terms: "Terms",
        contactUs: "Contact",
        bootstrapTemplateTitle: "A Bootstrap 5 template for modern businesses",
        bootstrapTemplateDescription: "Quickly design and customize responsive mobile-first sites with Bootstrap, the world’s most popular front-end open source toolkit!",
        getStarted: "Get Started",
        learnMore: "Learn More",
        betterWayTitle: "A better way to start building.",
        featuredTitle: "Featured title",
        featuredText: "Paragraph of text beneath the heading to explain the heading. Here is just a bit more text.",
        testimonialText: "\"Working with Start Bootstrap templates has saved me tons of development time when building new projects! Starting with a Bootstrap template just makes things easier!\"",
        testimonialAuthor: "Tom Ato",
        testimonialRole: "CEO, Pomodoro",
        blogSectionTitle: "From our blog",
        blogSectionDescription: "Lorem ipsum, dolor sit amet consectetur adipisicing elit. Eaque fugit ratione dicta mollitia. Officiis ad.",
        newsletterTitle: "New products, delivered to you.",
        newsletterDescription: "Sign up for our newsletter for the latest updates.",
        newsletterPlaceholder: "Email address...",
        newsletterButton: "Sign up",
        newsletterPrivacy: "We care about privacy, and will never share your data.",
        name: "Full Name"
	},
    pt: {
        missionTitle: "Nossa missão é simplificar a tecnologia para todos.",
        missionText: "Na Fernandes Technology, acreditamos que soluções de TI eficientes e inovadoras devem estar ao alcance de todas as empresas. Oferecemos consultoria especializada, implementação de tecnologias de ponta e suporte contínuo para ajudar sua organização a alcançar seus objetivos. Utilize nossos serviços gratuitos ou apoie-nos adquirindo nossas soluções premium para impulsionar sua transformação digital.",
        readStory: "Leia nossa história",
        home: "Início",
        about: "Sobre",
        contact: "Contato",
        blog: "Blog",
        portfolio: "Portfólio",
        ourTeam: "Nossa equipe",
        dedicatedToQuality: "Dedicados à qualidade e ao seu sucesso",
        ourFounding: "Nossa fundação",
        growthBeyond: "Crescimento e além",
        founderCEO: "Fundador & CEO",
        cfo: "CFO",
        operationsManager: "Gerente de Operações",
        cto: "CTO",
        copyright: "Copyright &copy; Fernandes Technology 2025",
        privacy: "Privacidade",
        terms: "Termos",
        contactUs: "Contato",
        bootstrapTemplateTitle: "Um template Bootstrap 5 para negócios modernos",
        bootstrapTemplateDescription: "Projete e personalize rapidamente sites responsivos com foco em dispositivos móveis usando Bootstrap, o kit de ferramentas front-end de código aberto mais popular do mundo!",
        getStarted: "Começar",
        learnMore: "Saiba Mais",
        betterWayTitle: "Uma maneira melhor de começar a construir.",
        featuredTitle: "Título em destaque",
        featuredText: "Parágrafo de texto abaixo do título para explicar o título. Aqui está um pouco mais de texto.",
        testimonialText: "\"Trabalhar com os templates do Start Bootstrap economizou muito tempo de desenvolvimento ao criar novos projetos! Começar com um template Bootstrap torna as coisas mais fáceis!\"",
        testimonialAuthor: "Tom Ato",
        testimonialRole: "CEO, Pomodoro",
        blogSectionTitle: "Do nosso blog",
        blogSectionDescription: "Lorem ipsum, dolor sit amet consectetur adipisicing elit. Eaque fugit ratione dicta mollitia. Officiis ad.",
        newsletterTitle: "Novos produtos, entregues a você.",
        newsletterDescription: "Assine nossa newsletter para as últimas atualizações.",
        newsletterPlaceholder: "Endereço de e-mail...",
        newsletterButton: "Assinar",
        newsletterPrivacy: "Nós nos importamos com a privacidade e nunca compartilharemos seus dados.",
        name: "Nome Completo"
	}
};

// Evento para mudar o idioma
document.getElementById('languageSelector').addEventListener('change', function () {
    const lang = this.value;
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[lang][key]) {
            element.textContent = translations[lang][key];
		}
	});
});

// Carregar o idioma padrão (português) ao iniciar a página
window.addEventListener('DOMContentLoaded', function () {
    const defaultLang = 'pt'; // Definir o idioma padrão como português
    const languageSelector = document.getElementById('languageSelector');
	
    // Definir o valor do seletor de idioma para 'pt'
    if (languageSelector) {
        languageSelector.value = defaultLang;
	}
	
    // Aplicar as traduções em português
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[defaultLang][key]) {
            element.textContent = translations[defaultLang][key];
		}
	});
});

