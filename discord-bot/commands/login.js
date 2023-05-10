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
        
        await interaction.reply({ content: 'Sent a DM about logging in to Waveform with Spotify!' });
        let dmMsg = await interaction.user.send('Here is how you login to Waveform with Spotify!\nGo to [this website](https://nimble-kataifi-dbceca.netlify.app/), then with the refresh token it returns, send the refresh token here (as a message), and you\'ll be all set!');
        const collector = await dmMsg.channel.createMessageCollector({ max: 1, time: 120000 });

        collector.on('collect', async token => {
            await db.user_stats.set(interaction.user.id, token.content, 'refresh_token');
            await db.user_stats.set(interaction.user.id, 'na', 'access_token');
            dmMsg.edit('✅ Authentication successful! You can now use the Spotify API with Waveform.\nTry out using `/setupmailbox` to setup a waveform spotify mailbox!\n\n' +
            `**For security reasons and because I am unable to delete your message, please delete the message with your token, and don't share this refresh token with ANYONE!**\n` +
            `**If you are concerned about the security of this command, please reach out to the bot developer Jeffdev or review the GitHub page to see how your token is used within Waveform.**`);
            interaction.editReply('Login was successful!');
        });
        
        collector.on('end', () => {
            dmMsg.edit('Passed maximum time to enter the token. Run `/login` again and you\'ll get another chance!');
            interaction.editReply('Login was unsuccessful.');
        });

    },
};
