const db = require("../db.js");
const { SlashCommandBuilder } = require('@discordjs/builders');
const { handle_error } = require("../func.js");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('deleteartist')
		.setDescription('Deletes an artist from the database.')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist.')
                .setRequired(true)),
    admin: true,
	async execute(interaction) {
        try {

        let artist = interaction.options.getString('artist');
		db.reviewDB.delete(artist);
		interaction.editReply(`${artist} deleted from the database.`);

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
	},
};