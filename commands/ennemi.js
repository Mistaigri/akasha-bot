// Commande pour afficher les infos d'un ennemi de Genshin Impact

// Noms des éléments
const visions = [
    'Anémo',
    'Géo',
    'Électro',
    'Dendro',
    'Hydro',
    'Pyro',
    'Cryo'
];
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');
const ennemis = require('../data/ennemis.json');
const e = require('express');

// Fonction pour récupérer les infos d'un ennemi à partir de son nom
async function fetchInfosEnnemi(nomRecherche) {
    // Aller chercher le lien de l'ennemi sur la page de la Gazette de Teyvat
    const res = await axios.get('https://lagazettedeteyvat.fr/ennemis');
    // Utiliser Cheerio pour parser le HTML et trouver le lien de l'ennemi
    const $ = cheerio.load(res.data);
    // Trouver le lien de l'ennemi en comparant les noms (en ignorant la casse)
    const linkEl = $('a.elementor-element').filter((_, el) =>
        $(el).find('h5').text().trim().toLowerCase()
        === nomRecherche.toLowerCase()
    ).first(); // Prendre le premier résultat trouvé (s'il y en a plusieurs, on prend le premier)
    if (!linkEl.length) return;

    // Récupérer l'URL de l'ennemi et sa miniature
    const url = linkEl.attr('href');
    const thumb = linkEl.find('.elementor-element-9f2ca69 img')
        .first().attr('data-src');

    // Aller chercher les infos sur la page de l'ennemi
    const pageEnnemi = await axios.get(url);
    const $$ = cheerio.load(pageEnnemi.data);

    // Récupérer les infos nécessaires pour l'embed
    const region = $$('.elementor-post-info__terms-list-item')
        .filter((_, el) => !visions.includes($$(el).text()))
        .first().text().trim();
    const type = $$('h2:first').text().endsWith('boss')
        ? 'Boss'
        : 'Légende locale';
    const ennemiImage = $$('.elementor-element-a5051ac, .elementor-element-a3f2663').find('img').first().attr('data-src');
    const butin = type === 'Boss'
        ? $$('.elementor-element-823722d').find('ul:first li').map((_, el) => $$(el).text()).toArray()
        : ['Commun ou élite identique à la créature originelle'];
    const succes = type === 'Boss'
        ? $$('.elementor-element-823722d').find('ul:last li').map((_, el) => $$(el).text()).toArray()
        : $$('.elementor-element-980e285').find('b, strong').text().trim().split('.').slice(0, -1);

    // Retourner un objet avec toutes les infos nécessaires pour construire l'embed
    return {
        nom: linkEl.find('h5').text().trim(),
        url,
        thumb,
        region,
        type,
        ennemiImage,
        butin,
        succes
    };
}

module.exports = {
    // Définition de la commande slash avec autocomplétion
    data: new SlashCommandBuilder()
        .setName('ennemi')
        .setDescription('Affiche les infos pour un ennemi de Genshin Impact')
        .addStringOption(option =>
            option.setName('nom')
                .setDescription('Nom de l\'ennemi')
                .setRequired(true)
                .setAutocomplete(true)),

    // Fonction d'autocomplétion pour suggérer les noms d'ennemis
    async autocomplete(interaction) {
        // Récupérer la partie du nom que l'utilisateur a tapée
        const focused = interaction.options.getFocused().toLowerCase();
        // Filtrer les ennemis pour ne garder que ceux qui contiennent la partie tapée
        const suggestions = ennemis
            .filter(n => n.toLowerCase().includes(focused))
            .slice(0, 25) // Limiter à 25 suggestions pour respecter la limite de Discord
            .map(s => ({ name: s, value: s }));
        // Envoyer les suggestions d'autocomplétion à Discord
        await interaction.respond(suggestions);
    },

    // Fonction d'exécution de la commande pour afficher les infos d'un ennemi
    async execute(interaction) {
        // Récupérer le nom de l'ennemi choisi par l'utilisateur
        const nom = await interaction.options.getString('nom');
        // Si aucun ennemi n'est trouvé, afficher un message d'erreur
        if(!(ennemis.includes(nom))) {
            await interaction.reply({
                content: `❌ Ennemi introuvable: '${nom}' n'existe pas.`,
                flags: MessageFlags.Ephemeral
            });
            return; // Arrêter l'exécution si l'ennemi n'est pas trouvé
        }

        // Afficher une réponse différée pour donner le temps de récupérer les infos
        await interaction.deferReply();
        // Récupérer les infos de l'ennemi à partir de son nom
        const ennemi = await fetchInfosEnnemi(nom);
        // Construire l'embed avec les infos de l'ennemi
        const embed = new EmbedBuilder()
            .setTitle(ennemi.nom) // Titre de l'embed avec le nom de l'ennemi
            .setURL(ennemi.url) // Lien vers la fiche de l'ennemi sur le site de la Gazette de Teyvat
            // Description avec les infos de base de l'ennemi
            .setDescription(
                `**Région :** ${ennemi.region}\n` +
                `**Type d\'ennemi :** ${ennemi.type}\n` +
                '\n' +
                `Cliquez sur le lien ci-dessus pour consulter la fiche complète de **${ennemi.nom}** (${ennemi.type}) sur le site de la Gazette de Teyvat.`
            )
            .setColor(0x1e2a38) // Couleur sombre evoquant la resine
            // Image principale de l'embed avec l'image de build de l'ennemi
            .setImage(ennemi.ennemiImage)
            // Miniature de l'embed avec la miniature de l'ennemi
            .setThumbnail(ennemi.thumb)
            .addFields(
                // Champs pour les butins et les succès associés
                {
                    name: 'Butin',
                    value: `${ennemi.butin.map(s =>
                        '**•** ' + s
                    ).join('\n')}`,
                    inline: true
                },
                {
                    name: 'Succès associés',
                    value: `${ennemi.succes.map(s =>
                        `**•** *${s}*`
                    ).join('\n')}`,
                    inline: true
                }
            )
            .setTimestamp();

        await interaction.followUp({
            embeds: [embed]
        });
    }
};
