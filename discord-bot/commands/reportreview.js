/* eslint-disable no-unreachable */
const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { handle_error, getEmbedColor } = require('../func');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reportreview')
        .setDescription('Report inappropriate reviews to Jeffdev (does not guarantee removal).')
        .setDMPermission(false),
    help_desc: `Creates a modal form that allows you to fill out a review report form to send to Jeffdev, Waveform's Developer.`,
	async execute(interaction, client) {
        try {

        let modalID = Math.random().toString(36).slice(2, 7);
        const modal = new ModalBuilder()
			.setCustomId(`reviewReportModal-${modalID}`)
			.setTitle('Report a review');

		// Create the text input components
        const artistsInput = new TextInputBuilder()
            .setCustomId('artists')
            .setLabel("Listed artists on this review")
            .setPlaceholder('Artists involved (including remixers, if applicable)')
            .setStyle(TextInputStyle.Short);

		const songInput = new TextInputBuilder()
			.setCustomId('song')
			.setLabel("song/EP/LP name on this review")
            .setPlaceholder('Full song name')
			.setStyle(TextInputStyle.Short);

		const IDInput = new TextInputBuilder()
			.setCustomId('user_id')
			.setLabel("User ID of the infringing User")
            .setPlaceholder('Must a valid discord user ID, use Discord dev mode')
			.setStyle(TextInputStyle.Short)
            .setRequired(true);

		// An action row only holds one text input,
		// so you need one action row per text input.
		const firstRow = new ActionRowBuilder().addComponents(artistsInput);
		const secondRow = new ActionRowBuilder().addComponents(songInput);
		const thirdRow = new ActionRowBuilder().addComponents(IDInput);

		// Add inputs to the modal
		modal.addComponents(firstRow, secondRow, thirdRow);
        await interaction.showModal(modal);

        const submitted = await interaction.awaitModalSubmit({
            time: 240000,
            max: 1,
            filter: i => i.user.id === interaction.user.id && i.customId == `reviewReportModal-${modalID}`,
        }).catch(() => {
            return null;
        });
          
        if (submitted) {
            let artists = submitted.fields.getTextInputValue('artists');
            let song = submitted.fields.getTextInputValue('song');
            let user_id = submitted.fields.getTextInputValue('user_id');

            await submitted.reply('Successfully submitted a review report!');
            
            // These are from the official waveform server
            let guild = client.guilds.cache.get('1119885734913003551');
            let changeChannel = guild.channels.cache.get('1142353601138806825');

            let reviewReportEmbed = new EmbedBuilder()
            .setColor(`${getEmbedColor(interaction.member)}`)
            .setThumbnail(interaction.member.avatarURL({ extension: "png" }))
            .setAuthor({ name: `Review Report by ${interaction.user.username} (ID: ${interaction.user.id})`, iconURL: interaction.user.avatarURL({ extension: "png" }) })
            .setDescription(`**Artists:** \`${artists}\`\n` + 
            `**Song:** \`${song}\`\n` + 
            `**Reported User ID:** \`${user_id}\``);
        
            changeChannel.send({ content: `**New Review Report!**`, embeds: [reviewReportEmbed] });
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, client, error);
        }
    },
};