const db = require("../db.js");
const { capitalize } = require("../func.js");
const { SlashCommandBuilder } = require('@discordjs/builders');

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
		let args = [];

        await interaction.options._hoistedOptions.forEach(async (value) => {
            args.push(capitalize(value.value));
        });

		db.reviewDB.delete(args[0]);
		interaction.editReply(`${args[0]} deleted from the database.`);
	},
};