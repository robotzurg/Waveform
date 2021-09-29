const db = require("../db.js");
const { capitalize } = require("../func.js");
const { SlashCommandBuilder } = require('@discordjs/builders');
//const forAsync = require('for-async');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('editartist')
		.setDescription('Edits an artist name in the database.')
        .addStringOption(option => 
            option.setName('old_artist')
                .setDescription('The old name of the artist.')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('new_artist')
                .setDescription('The new name of the artist.')
                .setRequired(true)),
    admin: true,
	async execute(interaction) {
        const old_artist = capitalize(interaction.options.getString('old_artist'));
        const new_artist = capitalize(interaction.options.getString('new_artist'));

        if (old_artist === new_artist) return interaction.editReply('Old and new artist names can\'t be the same thing!');
        if (!db.reviewDB.has(old_artist)) return interaction.editReply('This artist doesn\'t exist in the database.');

        const artistObj = db.reviewDB.get(old_artist);
        db.reviewDB.set(new_artist, artistObj);
        db.reviewDB.delete(old_artist);

		interaction.editReply(`${old_artist} changed to ${new_artist}.`);
	},
};