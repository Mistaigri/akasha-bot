// Commande pour afficher les infos de build d'un personnage de Genshin Impact

// Couleurs associées à chaque élément pour les embeds
const elementColors = {
    'Anémo': 0x5EDFC5,    // turquoise clair
    'Géo': 0xD4AF37,      // or jaune/ocre
    'Électro': 0x8A2BE2,  // violet électrique
    'Dendro': 0x228B22,   // vert forêt
    'Hydro': 0x1E90FF,    // bleu océan
    'Pyro': 0xFF4500,     // rouge feu
    'Cryo': 0xADD8E6      // bleu clair (blanc/bleu)
};
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');
const personnages = require('../data/personnages.json');

// Fonction pour récupérer les infos de build d'un personnage à partir de son nom
async function fetchInfosPersonnage(nomRecherche) {
    // Aller chercher le lien du personnage sur la page de la Gazette de Teyvat
    const res = await axios.get('https://lagazettedeteyvat.fr/personnages');
    // Utiliser Cheerio pour parser le HTML et trouver le lien du personnage
    const $ = cheerio.load(res.data);
    // Trouver le lien du personnage en comparant les noms (en ignorant la casse)
    const linkEl = $('a.elementor-element').filter((_, el) =>
        $(el).find('h5').text().trim().toLowerCase()
        === nomRecherche.toLowerCase()
    ).first(); // Prendre le premier résultat trouvé (s'il y en a plusieurs, on prend le premier)
    if (!linkEl.length) return;

    // Récupérer l'URL du personnage et sa miniature
    const url = linkEl.attr('href');
    const thumb = linkEl.find('.elementor-element-9f2ca69 img')
        .first().attr('data-src');

    // Aller chercher les infos de build sur la page du personnage
    const pagePerso = await axios.get(url);
    const $$ = cheerio.load(pagePerso.data);

    // Récupérer la rareté, l'image du build et les autres infos nécessaires pour l'embed
    const rarete = $$('.elementor-post-info__terms-list-item')
        .filter((_, el) => $$(el).text()?.includes('★'))
        .first().text().trim();
    const buildImage = $$('img')
        .filter((_, el) => $$(el).attr('data-src')?.includes('build'))
        .first().attr('data-src');

    // Retourner un objet avec toutes les infos nécessaires pour construire l'embed
    return {
        nom: linkEl.find('h5').text().trim(),
        url,
        thumb,
        rarete,
        element: linkEl.find('div.elementor-element-c40c4b3 img').attr('alt'),
        classe: linkEl.find('div.elementor-element-c8d236c img').attr('alt'),
        stat: linkEl.find('div.elementor-element-73c3fb1 img').attr('alt'),
        howManyRoles:
            $$('.elementor-element-a58951b').length
                ? 1
                : ($$('.elementor-element-026d307').length
                    ? 2
                    : 3),
        role: $$('h3').first().text().trim(),
        buildImage,
        armes_conseillees: $$('.elementor-element-52edd3c, .elementor-element-c9f5115, .elementor-element-0e4697f')
            .find('ol:first li, ul:first li')
            .map((_, el) => $$(el).text()).toArray(),
        sets_conseilles: $$('.elementor-element-52edd3c, .elementor-element-c9f5115, .elementor-element-0e4697f')
            .find('ol:last li, ul:last li')
            .map((_, el) => $$(el).text()).toArray()
    };
}

module.exports = {
    // Définition de la commande slash avec autocomplétion
    data: new SlashCommandBuilder()
        .setName('build')
        .setDescription('Affiche les infos de build pour un personnage de Genshin Impact')
        .addStringOption(option =>
            option.setName('nom')
                .setDescription('Nom du personnage')
                .setRequired(true)
                .setAutocomplete(true)),

    // Fonction d'autocomplétion pour suggérer les noms de personnages
    async autocomplete(interaction) {
        // Récupérer la partie du nom que l'utilisateur a tapée
        const focused = await interaction.options.getFocused().toLowerCase();
        // Filtrer les personnages pour ne garder que ceux qui contiennent la partie tapée
        const suggestions = personnages
            .filter(p => p.toLowerCase().includes(focused))
            .slice(0, 25) // Limiter à 25 suggestions pour respecter la limite de Discord
            .map(s => ({ name: s, value: s }));
        // Envoyer les suggestions d'autocomplétion à Discord
        await interaction.respond(suggestions);
    },

    // Fonction d'exécution de la commande pour afficher les infos de build
    async execute(interaction) {
        // Récupérer le nom du personnage choisi par l'utilisateur
        const nom = await interaction.options.getString('nom');
        // Si aucun personnage n'est trouvé, afficher un message d'erreur
        if(!(personnages.includes(nom))) {
            await interaction.reply({
                content: `❌ Personnage introuvable: '${nom}' n'existe pas.`,
                flags: MessageFlags.Ephemeral
            });
            return; // Arrêter l'exécution si le personnage n'est pas trouvé
        }

        // Afficher une réponse différée pour donner le temps de récupérer les infos
        await interaction.deferReply();
        // Récupérer les infos de build du personnage à partir de son nom
        const perso = await fetchInfosPersonnage(nom);
        // Construire l'embed avec les infos de build du personnage
        const embed = new EmbedBuilder()
            .setTitle(`${perso.rarete} ${perso.nom}`) // Titre de l'embed avec la rareté et le nom du personnage
            .setURL(perso.url) // Lien vers la fiche de build complète sur le site de la Gazette de Teyvat
            // Description avec les infos de base du personnage et un message sur le nombre de rôles
            .setDescription(
                `**Élément :** ${perso.element}\n` +
                `**Classe :** ${perso.classe}\n` +
                `**Stat :** ${perso.stat}\n` +
                `**Rôle :** ${perso.role}\n` +
                `\n` +
                `${perso.howManyRoles > 1
                    ? `Ce personnage possède __${perso.howManyRoles} rôles__ différents, seul le premier est affiché ici.\n`
                    : `Ce personnage ne possède qu'__un seul rôle__.\n`}` +
                `Cliquez sur le lien ci-dessus pour consulter la fiche de build complète de **${perso.nom}** sur le site de la Gazette de Teyvat.`
            )
            // Couleur de l'embed basée sur l'élément du personnage, avec une couleur par défaut si l'élément n'est pas reconnu
            .setColor(elementColors[perso.element] ?? 0x5865F2)
            // Image principale de l'embed avec l'image de build du personnage
            .setImage(perso.buildImage)
            // Miniature de l'embed avec la miniature du personnage
            .setThumbnail(perso.thumb)
            .addFields(
                // Champs pour les armes conseillées et les sets conseillés, avec une numérotation pour chaque item
                {
                    name: 'Armes conseillées',
                    value: `${perso.armes_conseillees.map((s, i) =>
                        `**${i + 1}.** ` + s)
                        .join('\n')}`,
                    inline: true
                },
                {
                    name: 'Sets conseillés',
                    value: `${perso.sets_conseilles.map((s, i) =>
                        `**${i + 1}.** ` + s)
                        .join('\n')}`,
                    inline: true
                }
            )
            .setTimestamp();

        await interaction.followUp({
            embeds: [embed]
        });
    }
};
