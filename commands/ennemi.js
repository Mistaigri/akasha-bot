const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');

const visions = [
    // Noms des éléments
    'Anémo',
    'Géo',
    'Électro',
    'Dendro',
    'Hydro',
    'Pyro',
    'Cryo'
];

async function fetchNomsEnnemis() {
    const res = await axios.get('https://lagazettedeteyvat.fr/ennemis');
    const $ = cheerio.load(res.data);
    return $('a.elementor-element h5')
        .map((_, el) => $(el).text().trim())
        .get();
}

async function fetchInfosEnnemi(nomRecherche) {
    const res = await axios.get('https://lagazettedeteyvat.fr/ennemis');
    const $ = cheerio.load(res.data);
    const linkEl = $('a.elementor-element').filter((_, el) =>
        $(el).find('h5').text().trim().toLowerCase()
        === nomRecherche.toLowerCase())
        .first();
    if (!linkEl.length) return;

    const url = linkEl.attr('href');
    const thumb = linkEl.find('.elementor-element-9f2ca69 img').first().attr('data-src');

    // Aller chercher dans la page de l'ennemi
    const pageEnnemi = await axios.get(url);
    const $$ = cheerio.load(pageEnnemi.data);
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
    data: new SlashCommandBuilder()
        .setName('ennemi')
        .setDescription('Affiche les infos pour un ennemi de Genshin Impact')
        .addStringOption(option =>
            option.setName('nom')
                .setDescription('Nom de l\'ennemi')
                .setRequired(true)
                .setAutocomplete(true)),

    // Cette fonction est spécifique pour gérer l'autocomplétion
    async autocomplete(interaction) {
        const ennemis = await fetchNomsEnnemis();
        const focused = interaction.options.getFocused().toLowerCase();
        // Filtrer les suggestions selon ce que l'utilisateur tape
        const suggestions = ennemis
            .filter(n => n
                .toLowerCase()
                .includes(focused))
            .slice(0, 25) // Limite de 25 suggestions
            .map(s => ({ name: s, value: s }));
        await interaction.respond(suggestions);
    },

    async execute(interaction) {
        // ••• *Bot* réfléchit...
        await interaction.deferReply();

        const nom = interaction.options.getString('nom');
        const ennemi = await fetchInfosEnnemi(nom);
        if (!ennemi) {
            return interaction.editReply({
                content: '❌ Ennemi introuvable.',
                flags: MessageFlags.Ephemeral
            });
        }

        const elision = ('aâeéiou'.includes(ennemi.nom.toLowerCase()[0])) ? '\'' : 'e ';
        const embed = new EmbedBuilder()
            .setTitle(ennemi.nom)
            .setURL(ennemi.url)
            .setDescription(
                `**Région :** ${ennemi.region}\n` +
                `**Type d\'ennemi :** ${ennemi.type}\n\n` +
                `Cliquez sur le lien ci-dessus pour consulter la fiche complète d${elision}**${ennemi.nom}** sur le site de la Gazette de Teyvat.`
            )
            .setColor(0x1e2a38) // couleur sombre evoquant la resine
            .setImage(ennemi.ennemiImage)
            .setThumbnail(ennemi.thumb)
            .addFields(
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

        await interaction.editReply({
            embeds: [embed]
        });
    }
};
