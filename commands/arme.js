// Commande pour afficher les infos d'une arme de Genshin Impact

// Couleurs associées à chaque rareté pour les embeds
const rarityColors = {
    '3★': 0x5EDFC5,
    '4★': 0x8A2BE2,
    '5★': 0xD4AF37
};
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');
const armes = require('../data/armes.json');

// Fonction pour récupérer les infos d'une arme à partir de son nom
async function fetchInfosArme(nomRecherche) {
    // Aller chercher le lien de l'arme sur la page de la Gazette de Teyvat
    const res = await axios.get('https://lagazettedeteyvat.fr/armes');
    // Utiliser Cheerio pour parser le HTML et trouver le lien de l'arme
    const $ = cheerio.load(res.data);
    // Trouver le lien de l'arme en comparant les noms (en ignorant la casse)
    const linkEl = $('a.elementor-element').filter((_, el) =>
        $(el).find('h5').text().trim().toLowerCase()
        === nomRecherche.toLowerCase()
    ).first(); // Prendre le premier résultat trouvé (s'il y en a plusieurs, on prend le premier)
    if (!linkEl.length) return;

    // Récupérer l'URL de l'arme et sa miniature
    const url = linkEl.attr('href');
    const thumb = linkEl.find('.elementor-element-9f2ca69 img')
        .first().attr('data-src');

    // Aller chercher les infos sur la page de l'arme
    const pageArme = await axios.get(url);
    const $$ = cheerio.load(pageArme.data);

    // Récupérer la rareté, l'image de l'arme et les autres infos nécessaires pour l'embed
    const rarete = $$('.elementor-post-info__terms-list-item')
        .filter((_, el) => $$(el).text()?.includes('★'))
        .first().text().trim();
    const armeImage = $$('div.elementor-element-319df57')
        .find('img').first().attr('data-src');
    const conseils = $$('div.elementor-element-bc4175c').find('ul:last li').map((_, el) => $$(el).text()).toArray();

    // Retourner un objet avec toutes les infos nécessaires pour construire l'embed
    return {
        nom: linkEl.find('h5').text().trim(),
        url,
        thumb,
        classe: linkEl.find('div.elementor-element-c8d236c img').attr('alt'),
        stat: linkEl.find('div.elementor-element-73c3fb1 img').attr('alt'),
        obtention: linkEl.find('div.elementor-element-5247fa5 img').attr('alt'),
        rarete,
        armeImage,
        materiaux_arme: $$('div.elementor-element-bc4175c')
            .find('ul:first li')
            .map((_, el) => $$(el).text()).toArray(),
        personnages_conseilles: {
            top: conseils.filter(s => s.toLowerCase().startsWith('top')),
            good: conseils.filter(s => s.toLowerCase().startsWith('good')),
            ok: conseils.filter(s => s.toLowerCase().startsWith('ok'))
        }
    };
}

module.exports = {
    // Définition de la commande slash avec autocomplétion
    data: new SlashCommandBuilder()
        .setName('arme')
        .setDescription('Affiche les infos pour une arme de Genshin Impact')
        .addStringOption(option =>
            option.setName('nom')
                .setDescription('Nom de l\'arme')
                .setRequired(true)
                .setAutocomplete(true)),

    // Fonction d'autocomplétion pour suggérer les noms d'armes
    async autocomplete(interaction) {
        // Récupérer la partie du nom que l'utilisateur a tapée
        const focused = await interaction.options.getFocused().toLowerCase();
        // Filtrer les armes pour ne garder que celles qui contiennent la partie tapée
        const suggestions = armes
            .filter(a => a.toLowerCase().includes(focused))
            .slice(0, 25) // Limiter à 25 suggestions pour respecter la limite de Discord
            .map(s => ({ name: s, value: s }));
        // Envoyer les suggestions d'autocomplétion à Discord
        await interaction.respond(suggestions);
    },

    // Fonction d'exécution de la commande pour afficher les infos d'arme
    async execute(interaction) {
        // Récupérer le nom de l'arme choisie par l'utilisateur
        const nom = await interaction.options.getString('nom');
        // Si aucune arme n'est trouvée, afficher un message d'erreur
        if(!(armes.includes(nom))) {
            await interaction.reply({
                content: `❌ Arme introuvable: '${nom}' n'existe pas.`,
                flags: MessageFlags.Ephemeral
            });
            return; // Arrêter l'exécution si l'arme n'est pas trouvée
        }

        // Afficher une réponse différée pour donner le temps de récupérer les infos
        await interaction.deferReply();
        // Récupérer les infos de l'arme à partir de son nom
        const arme = await fetchInfosArme(nom);
        // Construire l'embed avec les infos de l'arme
        const embed = new EmbedBuilder()
            .setTitle(`${arme.rarete} ${arme.nom}`) // Titre de l'embed avec la rareté et le nom de l'arme
            .setURL(arme.url) // Lien vers la fiche complète sur le site de la Gazette de Teyvat
            // Description avec les infos de base de l'arme
            .setDescription(
                `**Classe :** ${arme.classe}\n` +
                `**Stat :** ${arme.stat}\n` +
                `**Obtention :** ${arme.obtention}\n` +
                '\n' +
                `Cliquez sur le lien ci-dessus pour consulter la fiche complète de l'arme **${arme.nom}** sur le site de la Gazette de Teyvat.`
            )
            // Couleur de l'embed basée sur la rareté de l'arme, avec une couleur par défaut si la rareté n'est pas reconnue
            .setColor(rarityColors[arme.rarete] ?? 0x5865F2)
            // Image principale de l'embed avec l'image de l'arme
            .setImage(arme.armeImage)
            // Miniature de l'embed avec la miniature de l'arme
            .setThumbnail(arme.thumb)
            .addFields(
                // Champs pour les matériaux d'élévation et les personnages conseillés
                {
                    name: 'Matériaux d\'élévation d\'arme',
                    value: `${arme.materiaux_arme
                        .map(s => '**•** ' + s
                            // Simplifier le contenu
                            .replaceAll(/[^:]*\(|\)/g, ' '))
                        .join('\n')}`,
                    inline: true
                },
                {
                    name: 'Personnages conseillés',
                    value:
                        `${arme.personnages_conseilles.top.length ? `**•** ${arme.personnages_conseilles.top}\n` : ''}` +
                        `${arme.personnages_conseilles.good.length ? `**•** ${arme.personnages_conseilles.good}\n` : ''}` +
                        `${arme.personnages_conseilles.ok.length ? `**•** ${arme.personnages_conseilles.ok}\n` : ''}`,
                    inline: true
                }
            )
            .setTimestamp();

        await interaction.followUp({
            embeds: [embed]
        });
    }
};
