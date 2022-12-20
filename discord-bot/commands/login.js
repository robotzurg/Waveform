/* eslint-disable no-unreachable */
const { SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
const db = require('../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('login')
        .setDescription('Connect your Spotify account to Waveform.')
        .setDMPermission(false),
    help_desc: `TBD`,
	async execute(interaction) {

        interaction.reply('Here is how you login to Waveform with Spotify!\nGo to [this website](https://nimble-kataifi-dbceca.netlify.app/), then with the refresh token it returns, send the refresh token here (as a message), and you\'ll be all set!');

        const filter = m => m.author.id == interaction.user.id && m.content.length > 15;
        const collector = interaction.channel.createMessageCollector({ filter: filter, max: 1, time: 60000 });

        collector.on('collect', async token => {
            await db.user_stats.set(interaction.user.id, token.content, 'refresh_token');
            interaction.editReply('Authentication successful! You can now use the Spotify API with Waveform.\n' + 
            'Make sure to use `/setupmailbox` to setup your Waveform Mailbox, now that you have logged in!');
            token.delete();
        });
        
        collector.on('end', () => {
            interaction.editReply('Passed maximum time to enter the token. Run `/login` again and you\'ll get another chance!');
        });

    },
};
