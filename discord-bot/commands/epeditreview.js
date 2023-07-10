const { SlashCommandBuilder } = require('discord.js');
const { handle_error } = require('../func.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('epeditreview')
        .setDescription('Edit/add a overall rating/review to an EP/LP review')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand.setName('with_spotify')
            .setDescription('Edit/add data to an EP/LP review with spotify playback data.')
            .addStringOption(option => 
                option.setName('rating')
                    .setDescription('The new rating of the EP/LP.')
                    .setRequired(false))
            .addStringOption(option => 
                option.setName('review')
                    .setDescription('The new written overall review of the EP/LP.')
                    .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand.setName('manually')
            .setDescription('Edit/add data to an EP/LP with manually entered information.')
            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the MAIN EP/LP artist(s). (separate with &, Do not put any one-off collaborators here.)')
                    .setAutocomplete(true)
                    .setRequired(true))
            .addStringOption(option => 
                option.setName('ep_name')
                    .setDescription('The name of the EP/LP. (INCLUDE EP OR LP IN THE TITLE!)')
                    .setAutocomplete(true)
                    .setRequired(true))
            .addStringOption(option => 
                option.setName('rating')
                    .setDescription('The new rating of the EP/LP.')
                    .setRequired(false))
            .addStringOption(option => 
                option.setName('review')
                    .setDescription('The new written overall review of the EP/LP.')
                    .setRequired(false))),
	help_desc: `TBD`,
	async execute(interaction, client) {
        try {
            // This command basically just runs /review, but instead of pulling from arguments for the review, it pulls from the database.
            // The reason its in a separate command is because that comes across better in usage of the bot, rather than
            // making it an optional argument for /review.
            let command = client.commands.get('editreview');
            command.execute(interaction, client, true);
        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};