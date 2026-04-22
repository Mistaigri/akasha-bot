const axios = require('axios');
const cheerio = require('cheerio');
const BASE_URL = 'https://lagazettedeteyvat.fr';
const fs = require('fs');
const { log } = require('./logger');

// Récupère les données d'une catégorie et les sauvegarde dans un fichier JSON
async function fetchCategorie(categorie) {
    const res = await axios.get(`${BASE_URL}/${categorie}`);
    const $ = cheerio.load(res.data);
    const noms = $('a.elementor-element h5')
        .map((_, el) => $(el).text().trim())
        .get();
    fs.writeFileSync(`./data/${categorie}.json`, JSON.stringify(noms), 'utf-8');
    log(`${fs.readFileSync(`./data/${categorie}.json`, 'utf-8').split(',').length} items fetched for category: ${categorie}`);
}

// Récupère les données de toutes les catégories et les sauvegarde dans des fichiers JSON
async function fetchAll() {
    log('Starting data fetching...');
    for (const categorie of ['personnages', 'armes', 'artefacts', 'ennemis']) {
        log(`Fetching data for category: ${categorie}`);
        await fetchCategorie(categorie);
    }
    log('Data fetching completed.');
}

module.exports = { fetchAll };
