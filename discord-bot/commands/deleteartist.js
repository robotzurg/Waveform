const db = require("../db.js");
const { SlashCommandBuilder } = require('discord.js');
const { handle_error } = require("../func.js");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('deleteartist')
		.setDescription('Deletes an artist from the database.')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist.')
                .setAutocomplete(true)
                .setRequired(true)),
    admin: true,
	async execute(interaction) {
        try {
            
        // TODO: Make this command also delete any collaborative songs this artist was involved in, in the database.

        let artist = interaction.options.getString('artist');
		db.reviewDB.delete(artist);
		interaction.reply(`${artist} deleted from the database.`);

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
	},
};