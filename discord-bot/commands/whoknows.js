/* eslint-disable no-unreachable */
const { SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
// const db = require('../db.js');
// const { spotify_api_setup } = require('../func.js');
// const lastfm = require('lastfm-njs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whoknows')
        .setDescription('See who has heard a specific type of music on Last.fm.')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand.setName('song')
            .setDescription('See who has heard a specific song on Last.fm, out of logged in Waveform users.')
            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the main artist(s).')
                    .setAutocomplete(true)
                    .setRequired(false))
    
            .addStringOption(option => 
                option.setName('name')
                    .setDescription('The name of the song.')
                    .setAutocomplete(true)
                    .setRequired(false))
                
            .addStringOption(option => 
                option.setName('remixers')
                    .setDescription('Remix artists on the song, if any.')
                    .setAutocomplete(true)
                    .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand.setName('ep-lp')
            .setDescription('See who has heard a specific EP/LP on Last.fm, out of logged in Waveform users.')
            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the main artist(s).')
                    .setAutocomplete(true)
                    .setRequired(false))
    
            .addStringOption(option => 
                option.setName('name')
                    .setDescription('The name of the EP/LP.')
                    .setAutocomplete(true)
                    .setRequired(false)))

            .addSubcommand(subcommand =>
                subcommand.setName('artist')
                .setDescription('See who has heard a specific artist on Last.fm, out of logged in Waveform users.')
                .addStringOption(option => 
                    option.setName('artist')
                        .setDescription('The name of the artist.')
                        .setAutocomplete(true)
                        .setRequired(false))),
    help_desc: ``,
	async execute(interaction) {
        interaction.reply('This command is not functional yet.');
    },
};
