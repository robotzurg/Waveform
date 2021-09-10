const Discord = require('discord.js');
const db = require("../db.js");
const { capitalize } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('epdata')
        .setDescription('Add some data to an EP/LP review')
        .addStringOption(option => 
            option.setName('artists')
                .setDescription('The name of the MAIN EP/LP artist(s). (separate with &, Do not put any one-off collaborators here.)')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('ep_name')
                .setDescription('The name of the EP/LP. (INCLUDE EP OR LP IN THE TITLE!)')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('data_type')
                .setDescription('The type of data to add the EP/LP review')
                .setRequired(true)
                .addChoices([
					[
						'Overall Rating',
						'rating',
					], [
						'Overall Review',
						'review',
					],
				]))
        .addStringOption(option => 
            option.setName('data')
                .setDescription('The data to insert (a number if rating, text if review)')
                .setRequired(true)),


	admin: false,
	async execute(interaction) {
        interaction.editReply('This is not added yet.');
        /*let artistArray = capitalize(interaction.options.getString('artists'));
        let ep_name = capitalize(interaction.options.getString('ep_name'));
        let data_type = interaction.options.getString('data_type');
        let data = interaction.options.getString('data');

        for (let i = 0; i < artistArray.length; i++) {
            if (!db.reviewDB.has(artistArray[i])) return interaction.editReply(`Artist \`${artistArray[i]}\``);
        }
        

        await interaction.channel.messages.fetch().then(msg => {
            console.log(msg);
            embed_data = msg.embeds;
            msgEmbed = embed_data[0];
            msgEmbed.image.url = thumbnailImage;
            msg.edit({ embeds: [msgEmbed] });
            resolve();
        });*/
    },
};