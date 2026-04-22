require('dotenv').config();
const { Client, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const fs = require('fs');
const { log } = require('./utils/logger');
const { fetchAll } = require('./utils/data-builder');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

client.once('ready', async () => {
    await fetchAll(); // Récupérer les données de tous les personnages, armes, artefacts et ennemis au démarrage du bot
    client.user.setActivity('Genshin Impact', { type: ActivityType.Playing });
    log(`Akasha est en ligne ! Connecté en tant que ${client.user.tag}`);
});

// Gestion autocomplétion
client.on('interactionCreate', async interaction => {
    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error(error);
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
    }
});

// Gestion des événements

// Gestion manuelle des crashs
client.on('error', err => log('Erreur client Discord', err));
process.on('unhandledRejection', err => log('Rejection non capturée', err));
process.on('uncaughtException', err => log('Exception non capturée', err));

client.login(process.env.TOKEN);

// --- Serveur Express pour UptimeRobot ---
const express = require('express');
const app = express();

// Route de test pour vérifier que le bot est en ligne
app.get('/', (req, res) => {
    res.status(200).send('✅ Akasha bot is alive and running!');
});

// Écoute sur le port fourni par Render (ou 3000 en local)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Serveur web actif sur le port ${PORT}`);
});
