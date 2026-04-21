// Commande pour afficher les infos d'un artefact de Genshin Impact

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');
const artefacts = require('../data/artefacts.json');

// Fonction pour récupérer les infos d'un artefact à partir de son nom
async function fetchInfosArtefact(nomRecherche) {
    // Aller chercher le lien de l'artefact sur la page de la Gazette de Teyvat
    const res = await axios.get('https://lagazettedeteyvat.fr/artefacts');
    // Utiliser Cheerio pour parser le HTML et trouver le lien de l'artefact
    const $ = cheerio.load(res.data);
    // Trouver le lien de l'artefact en comparant les noms (en ignorant la casse)
    const linkEl = $('a.elementor-element').filter((_, el) =>
        $(el).find('h5').text().trim().toLowerCase()
        === nomRecherche.toLowerCase()
    ).first(); // Prendre le premier résultat trouvé (s'il y en a plusieurs, on prend le premier)
    if (!linkEl.length) return;

    // Récupérer l'URL de l'artefact et sa miniature
    const url = linkEl.attr('href');
    const thumb = linkEl.find('.elementor-element-9f2ca69 img')
        .first().attr('data-src');

    // Aller chercher les infos sur la page de l'artefact
    const pageArtefact = await axios.get(url);
    const $$ = cheerio.load(pageArtefact.data);

    // Récupérer l'image de l'artefact et les autres infos nécessaires pour l'embed
    const artefactImage = $$('div.elementor-element-daf6008 img')
        .first().attr('data-src');
    const conseils = $$('div.elementor-element-737bbe6')
        .find('ul:last li')
        .map((_, el) => $$(el).text()).toArray();

    // Retourner un objet avec toutes les infos nécessaires pour construire l'embed
    return {
        nom: linkEl.find('h5').text().trim(),
        url,
        thumb,
        origine: $$('.elementor-post-info__terms-list').text().trim(),
        artefactImage,
        sources_obtention: $$('div.elementor-element-737bbe6')
            .find('ol:first li')
            .map((_, el) => $$(el).text()).toArray(),
        personnages_conseilles: {
            top: conseils.filter(s => s.toLowerCase().startsWith('top')),
            good: conseils.filter(s => s.toLowerCase().startsWith('good')),
            ok: conseils.filter(s => s.toLowerCase().startsWith('ok')),
        }
    };
}

module.exports = {
    // Définition de la commande slash avec autocomplétion
    data: new SlashCommandBuilder()
        .setName('artefact')
        .setDescription('Affiche les infos pour un set d\'artefacts de Genshin Impact')
        .addStringOption(option =>
            option.setName('nom')
                .setDescription('Nom du set d\'artefacts')
                .setRequired(true)
                .setAutocomplete(true)),

    // Fonction d'autocomplétion pour suggérer les noms d'artefacts
    async autocomplete(interaction) {
        // Récupérer la partie du nom que l'utilisateur a tapée
        const focused = await interaction.options.getFocused().toLowerCase();
        // Filtrer les artefacts pour ne garder que ceux qui contiennent la partie tapée
        const suggestions = artefacts
            .filter(n => n.toLowerCase().includes(focused))
            .slice(0, 25) // Limiter à 25 suggestions pour respecter la limite de Discord
            .map(s => ({ name: s, value: s }));
        // Envoyer les suggestions d'autocomplétion à Discord
        await interaction.respond(suggestions);
    },

    // Fonction d'exécution de la commande pour afficher les infos d'un artefact
    async execute(interaction) {
        // Récupérer le nom du personnage choisi par l'utilisateur
        const nom = await interaction.options.getString('nom');
        // Si aucun artefact n'est trouvé, afficher un message d'erreur
        if(!(artefacts.includes(nom))) {
            await interaction.reply({
                content: `❌ Set d'artéfacts introuvable: '${nom}' n'existe pas.`,
                flags: MessageFlags.Ephemeral
            });
            return; // Arrêter l'exécution si l'artefact n'est pas trouvé
        }

        // Afficher une réponse différée pour donner le temps de récupérer les infos
        await interaction.deferReply();
        // Récupérer les infos d'un artefact à partir de son nom
        const artefact = await fetchInfosArtefact(nom);
        // Construire l'embed avec les infos d'un artefact
        const embed = new EmbedBuilder()
            .setTitle(artefact.nom) // Titre de l'embed avec la rareté et le nom du personnage
            .setURL(artefact.url) // Lien vers la fiche d'artefact sur le site de la Gazette de Teyvat
            // Description avec les infos de base de l'artefact
            .setDescription(
                `**Origine :** ${artefact.origine}\n` +
                '\n' +
                `Cliquez sur le lien ci-dessus pour consulter la fiche complète du set d'artefacts **${artefact.nom}** sur le site de la Gazette de Teyvat.`
            )
            .setColor(0xD4AF37) // couleur 5★
            // Image principale de l'embed avec l'image de l'artefact
            .setImage(artefact.artefactImage)
            // Miniature de l'embed avec la miniature de l'artefact
            .setThumbnail(artefact.thumb)
            .addFields(
                // Champs pour les sources d'obtention et les personnages conseillés
                {
                    name: 'Sources d\'obtention',
                    value: `${artefact.sources_obtention.map((s, i) =>
                        `**${i + 1}.** ` + s)
                        .join('\n')}`,
                    inline: true
                },
                {
                    name: 'Personnages conseillés',
                    value:
                        `${artefact.personnages_conseilles.top.length ? `**•** ${artefact.personnages_conseilles.top}\n` : ''}` +
                        `${artefact.personnages_conseilles.good.length ? `**•** ${artefact.personnages_conseilles.good}\n` : ''}` +
                        `${artefact.personnages_conseilles.ok.length ? `**•** ${artefact.personnages_conseilles.ok}\n` : ''}`,
                    inline: true
                }
            )
            .setTimestamp();

        await interaction.followUp({
            embeds: [embed]
        });
    }
};
