const { SlashCommandBuilder } = require('discord.js');
const { handle_error, queryReviewDatabase } = require("../func.js");
const { DatabaseQuery } = require('../enums.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('albumreviews')
        .setDescription('View all your album reviews on Waveform!')
        .setDMPermission(false),
    help_desc: `Test`,
	async execute(interaction, client) {
        try {

        if (interaction.user.id != '122568101995872256') return interaction.reply('Not for you!');

        await interaction.deferReply();
        await interaction.editReply('Getting all reviewed albums on Waveform... This may take a couple seconds, please be patient!');

        let albumReviewList = await queryReviewDatabase(DatabaseQuery.GlobalAllAlbums);
        let epReviewList = await queryReviewDatabase(DatabaseQuery.GlobalAllEPs);
        console.log(albumReviewList);

        await interaction.editReply(`This command successfully ran. Found ${albumReviewList.length} albums and ${epReviewList.length} EPs in the database!`);

        } catch (err) {
            let error = err;
            handle_error(interaction, client, error);
        }
    },
};