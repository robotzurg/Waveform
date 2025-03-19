/* eslint-disable no-unreachable */
const { SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
const db = require('../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logout')
        .setDescription('Logout your Spotify or Last.fm account on Waveform.')
        .addSubcommand(subcommand =>
			subcommand.setName('spotify')
				.setDescription('Logout from Spotify.'))
        .addSubcommand(subcommand =>
            subcommand.setName('lastfm')
                .setDescription('Logout from Last.fm.')),
    help_desc: `Logout from your Last.fm or Spotify account on Waveform, effectively disconnecting`,
	async execute(interaction) {
        let logoutType = interaction.options.getSubcommand();
        
        if (logoutType == 'spotify') {
            await interaction.reply({ content: 'Logged out of Spotify.', ephemeral: true });
            await db.user_stats.set(interaction.user.id, false, 'refresh_token');
            await db.user_stats.set(interaction.user.id, 'na', 'access_token');
        } else {
            db.user_stats.set(interaction.user.id, false, 'lfm_username');
            interaction.reply({ content: `Logged out of Last.fm.`, ephemeral: true });
        }

    },
};
