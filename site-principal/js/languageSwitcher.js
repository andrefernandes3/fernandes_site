const translations = {
    en: {
        home: "Home",
        about: "About",
        contact: "Contact",
        portfolio: "Portfolio",
        bootstrapTemplateTitle: "Innovative Solutions to Modernize Your Business",
        bootstrapTemplateDescription: "At Fernandes Technology, we offer innovative solutions to modernize your business. Explore our services and discover how we can help you.",
        copyright: "Copyright &copy; Fernandes Technology 2025",
        privacy: "Privacy",
        terms: "Terms",
        contactUs: "Request a Quote",
        ourServices: "Our Services",
        features_title: "End-to-end Digital Transformation.",
        feature_custom_dev_title: "Custom Development",
        feature_custom_dev_desc: "Web systems and custom tools tailored to your workflow.",
        feature_cloud_title: "Cloud & Infrastructure",
        feature_cloud_desc: "Cloud migration and server management with a focus on high availability.",
        feature_security_title: "Information Security",
        feature_security_desc: "Data protection and compliance to keep your business secure.",
        feature_support_title: "Specialized Support",
        feature_support_desc: "Agile technical support to ensure your operation never stops.",
        newsletter_title: "Tech News & Insights.",
        newsletter_desc: "Sign up to receive updates about our projects.",
        newsletter_placeholder: "Your best email...",
        newsletter_btn: "Subscribe",
        newsletter_spam: "We promise not to send spam.",
        newsletterPrivacy: "We care about your privacy and will never share your data.",
        // --- ABOUT PAGE (Add this) ---
        about_title: "Our Mission is to Simplify Technology.",
        about_subtitle: "Born from a passion for development and infrastructure, Fernandes Technology connects Brazilian and American companies to the digital future.",
        about_story_title: "From Brazil to the World",
        about_story_text: "Founded by André Fernandes, our consultancy aims to offer enterprise-level software architecture for companies seeking agility. With experience in international projects, we bring Silicon Valley best practices adapted to your business reality.",
        
        // Tech Stack Section
        tech_stack_title: "Technologies We Master",
        tech_stack_subtitle: "Modern tools for performance and scalability.",

        // Values
        about_values_intro: "Our Core Pillars.",
        value_1_title: "Constant Innovation",
        value_1_desc: "We stay updated with the latest market stacks (Next.js, Serverless, AI).",
        value_2_title: "Global Presence",
        value_2_desc: "Proven experience serving clients in Brazil and the United States.",
        value_3_title: "Lean Agility",
        value_3_desc: "Our lean structure allows for quick responses without corporate bureaucracy."
    },
    pt: {
        home: "Início",
        about: "Sobre",
        contact: "Contato",
        portfolio: "Portfólio",
        bootstrapTemplateTitle: "Soluções Inovadoras para Modernizar seu Negócio",
        bootstrapTemplateDescription: "Na Fernandes Technology, oferecemos soluções inovadoras para modernizar seu negócio. Conheça nossos serviços e descubra como podemos ajudar você.",
        copyright: "Copyright &copy; Fernandes Technology 2025",
        privacy: "Privacidade",
        terms: "Termos",
        contactUs: "Solicitar Orçamento",
        ourServices: "Nossos Serviços",
        features_title: "Transformação Digital de ponta a ponta.",
        feature_custom_dev_title: "Desenvolvimento Sob Medida",
        feature_custom_dev_desc: "Sistemas web e ferramentas personalizadas para o seu fluxo de trabalho.",
        feature_cloud_title: "Cloud & Infraestrutura",
        feature_cloud_desc: "Migração para nuvem e gestão de servidores com foco em alta disponibilidade.",
        feature_security_title: "Segurança da Informação",
        feature_security_desc: "Proteção de dados e conformidade para manter sua empresa segura.",
        feature_support_title: "Suporte Especializado",
        feature_support_desc: "Atendimento técnico ágil para garantir que sua operação nunca pare.",
        newsletter_title: "Novidades Tech & Insights.",
        newsletter_desc: "Cadastre-se para receber atualizações sobre nossos projetos.",
        newsletter_placeholder: "Seu melhor e-mail...",
        newsletter_btn: "Increver-se",
        newsletter_spam: "Prometemos não enviar spam.",
        newsletterPrivacy: "Nós nos importamos com a privacidade e nunca compartilharemos seus dados.",
        // --- PÁGINA SOBRE (Adicione isto) ---
        about_title: "Nossa Missão é Simplificar a Tecnologia.",
        about_subtitle: "Nascida da paixão pelo desenvolvimento e infraestrutura, a Fernandes Technology conecta empresas brasileiras e americanas ao futuro digital.",
        about_story_title: "Do Brasil para o Mundo",
        about_story_text: "Fundada por André Fernandes, nossa consultoria nasceu com o objetivo de oferecer arquitetura de software de nível enterprise para empresas que buscam agilidade. Com experiência em projetos internacionais, trazemos as melhores práticas do Vale do Silício adaptadas à realidade do seu negócio.",
        
        // Seção Tech Stack
        tech_stack_title: "Tecnologias que Dominamos",
        tech_stack_subtitle: "Ferramentas modernas para performance e escalabilidade.",

        // Valores
        about_values_intro: "Pilares da nossa atuação.",
        value_1_title: "Inovação Constante",
        value_1_desc: "Estamos sempre atualizados com as últimas stacks do mercado (Next.js, Serverless, AI).",
        value_2_title: "Presença Global",
        value_2_desc: "Experiência comprovada atendendo clientes no Brasil e nos Estados Unidos.",
        value_3_title: "Agilidade ME",
        value_3_desc: "A estrutura de Microempresa permite respostas rápidas, sem burocracia corporativa."
    }
};

// Função para aplicar as traduções
function applyTranslations(lang) {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            element.textContent = translations[lang][key];
        }
    });
}

// Evento para mudar o idioma
document.getElementById('languageSelector').addEventListener('change', function () {
    const lang = this.value;
    localStorage.setItem('selectedLanguage', lang); // Armazenar o idioma selecionado
    applyTranslations(lang); // Aplicar as traduções
});

// Carregar o idioma salvo ao iniciar a página
window.addEventListener('DOMContentLoaded', function () {
    const savedLang = localStorage.getItem('selectedLanguage') || 'pt'; // Recuperar o idioma salvo ou usar 'pt' como padrão
    const languageSelector = document.getElementById('languageSelector');

    // Definir o valor do seletor de idioma
    if (languageSelector) {
        languageSelector.value = savedLang;
    }

    // Aplicar as traduções
    applyTranslations(savedLang);
});