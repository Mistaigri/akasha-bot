const axios = require('axios');
const cheerio = require('cheerio');
const BASE_URL = 'https://lagazettedeteyvat.fr';
const fs = require('fs');

async function fetchCategorie(categorie) {
    const res = await axios.get(`${BASE_URL}/${categorie}`);
    const $ = cheerio.load(res.data);
    const noms = $('a.elementor-element h5')
        .map((_, el) => $(el).text().trim())
        .get();
    fs.writeFileSync(`./data/${categorie}.json`, JSON.stringify(noms), 'utf-8');
}

async function fetchAll() {
    for (const categorie of ['personnages', 'armes', 'artefacts', 'ennemis']) {
        await fetchCategorie(categorie);
    }
}

module.exports = { fetchAll };
