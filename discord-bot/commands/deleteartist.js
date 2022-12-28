const db = require("../db.js");
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { handle_error } = require("../func.js");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('deleteartist')
		.setDescription('Delete an artist from the database.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist.')
                .setAutocomplete(true)
                .setRequired(true)),
    help_desc: `Deletes an artist from the review database, which will **permanently** delete any ties to the artist as well as all their songs from the database.\n\n` +
    `Not currently functional due to bugs.`,
	async execute(interaction) {
        try {
    
        // TODO: Make this command also delete any collaborative songs this artist was involved in, in the database.
        if (interaction.user.id != '122568101995872256') return interaction.reply('This command is under construction.');
        let artist = interaction.options.getString('artist');
		db.reviewDB.delete(artist);
		interaction.reply(`${artist} deleted from the database.`);

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
	},
};