// Commande pour afficher les infos de farm d'un personnage de Genshin Impact

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

// Fonction pour récupérer les infos de farm d'un personnage à partir de son nom
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

    // Aller chercher les infos de farm sur la page du personnage
    const pagePerso = await axios.get(url);
    const $$ = cheerio.load(pagePerso.data);

    // Récupérer la rareté, l'image du farm et les autres infos nécessaires pour l'embed
    const rarete = $$('.elementor-post-info__terms-list-item')
        .filter((_, el) => $$(el).text()?.includes('★'))
        .first().text().trim();
    const farmImage = $$('img')
        .filter((_, el) => $$(el).attr('data-src')?.includes('farm'))
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
        role: $$('h3').first().text().trim(),
        farmImage,
        materiaux_personnage: $$('.elementor-element-fa24de3')
            .find('ul:first li')
            .map((_, el) => $$(el).text()).toArray(),
        materiaux_aptitudes: $$('.elementor-element-fa24de3')
            .find('ul:last li')
            .map((_, el) => $$(el).text()).toArray()
    };
}

module.exports = {
    // Définition de la commande slash avec autocomplétion
    data: new SlashCommandBuilder()
        .setName('farm')
        .setDescription('Affiche les infos de farm pour un personnage de Genshin Impact')
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

    // Fonction d'exécution de la commande pour afficher les infos de farm
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
        // Récupérer les infos de farm du personnage à partir de son nom
        const perso = await fetchInfosPersonnage(nom);
        // Construire l'embed avec les infos de farm du personnage
        const embed = new EmbedBuilder()
            .setTitle(`${perso.rarete} ${perso.nom}`) // Titre de l'embed avec la rareté et le nom du personnage
            .setURL(perso.url) // Lien vers la fiche de farm complète sur le site de la Gazette de Teyvat
            // Description avec les infos de base du personnage
            .setDescription(
                `**Élément :** ${perso.element}\n` +
                `**Classe :** ${perso.classe}\n` +
                `**Stat :** ${perso.stat}\n` +
                '\n' +
                `Cliquez sur le lien ci-dessus pour consulter la fiche de farm complète de **${perso.nom}** sur le site de la Gazette de Teyvat.`
            )
            // Couleur de l'embed basée sur l'élément du personnage, avec une couleur par défaut si l'élément n'est pas reconnu
            .setColor(elementColors[perso.element] ?? 0x5865F2)
            // Image principale de l'embed avec l'image de farm du personnage
            .setImage(perso.farmImage)
            // Miniature de l'embed avec la miniature du personnage
            .setThumbnail(perso.thumb)
            .addFields(
                // Champs pour les matériaux d'élévation de personnage et les matériaux d'élévation d'aptitude
                {
                    name: `Matériaux d\'élévation de personnage`,
                    value: `${perso.materiaux_personnage
                        .map(s => '**•** ' + s
                            // Mettre en gras le contenu des parenthèses
                            .replaceAll('(', '(**')
                            .replaceAll(')', '**)'))
                        .join('\n')}`,
                    inline: true
                },
                {
                    name: 'Matériaux d\'élévation d\'aptitude',
                    value: `${perso.materiaux_aptitudes
                        .map(s => '**•** ' + s
                            // Mettre en gras le contenu des parenthèses
                            .replaceAll('(', '(**')
                            .replaceAll(')', '**)')
                        )
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
