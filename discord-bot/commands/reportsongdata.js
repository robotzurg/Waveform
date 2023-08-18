/* eslint-disable no-unreachable */
const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { handle_error, getEmbedColor } = require('../func');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reportsongdata')
        .setDescription('Report incorrect song data that needs to be edited.')
        .setDMPermission(false),
    help_desc: `Creates a modal form that allows you to fill out a song data edit form to send to Jeffdev, Waveform's Developer.`,
	async execute(interaction, client) {
        try {

        let modalID = Math.random().toString(36).slice(2, 7);
        const modal = new ModalBuilder()
			.setCustomId(`songDataModal-${modalID}`)
			.setTitle('Report song/EP/LP data changes');

		// Create the text input components
        const artistsInput = new TextInputBuilder()
            .setCustomId('artists')
            .setLabel("What are the current listed artists on this?")
            .setPlaceholder('Artists involved (including remixers, if applicable)')
            .setStyle(TextInputStyle.Short);

		const songInput = new TextInputBuilder()
			.setCustomId('song')
			.setLabel("What is the current listed song/EP/LP name?")
            .setPlaceholder('Full song name')
			.setStyle(TextInputStyle.Short);

		const changesInput = new TextInputBuilder()
			.setCustomId('changes')
			.setLabel("What changes need to be made?")
			.setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

		// An action row only holds one text input,
		// so you need one action row per text input.
		const firstRow = new ActionRowBuilder().addComponents(artistsInput);
		const secondRow = new ActionRowBuilder().addComponents(songInput);
		const thirdRow = new ActionRowBuilder().addComponents(changesInput);

		// Add inputs to the modal
		modal.addComponents(firstRow, secondRow, thirdRow);
        await interaction.showModal(modal);

        const submitted = await interaction.awaitModalSubmit({
            time: 240000,
            max: 1,
            filter: i => i.user.id === interaction.user.id && i.customId == `songDataModal-${modalID}`,
        }).catch(() => {
            return null;
        });
          
        if (submitted) {
            let artists = submitted.fields.getTextInputValue('artists');
            let song = submitted.fields.getTextInputValue('song');
            let changes = submitted.fields.getTextInputValue('changes');

            await submitted.reply('Successfully submitted a bug report!');
            
            // These are from the official waveform server
            let guild = client.guilds.cache.get('1119885734913003551');
            let changeChannel = guild.channels.cache.get('1119916990975447121');

            let changeEmbed = new EmbedBuilder()
            .setColor(`${getEmbedColor(interaction.member)}`)
            .setThumbnail(interaction.member.avatarURL({ extension: "png" }))
            .setAuthor({ name: `Song Data Report by ${interaction.user.username}`, iconURL: interaction.user.avatarURL({ extension: "png" }) })
            .setDescription(`**Artists:** \`${artists}\`\n` + 
            `**Song:** \`${song}\`\n` + 
            `**User ID:** \`${interaction.user.id}\``)
            .addFields({ name: 'Changes Requested:', value: changes });
        
            changeChannel.send({ content: `**New Song Edit Report!**`, embeds: [changeEmbed] });
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};