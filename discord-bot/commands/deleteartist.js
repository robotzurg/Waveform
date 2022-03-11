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

		let args = [];

        await interaction.options._hoistedOptions.forEach(async (value) => {
            args.push(value.value);
        });

		db.reviewDB.delete(args[0]);
		interaction.editReply(`${args[0]} deleted from the database.`);

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
	},
};