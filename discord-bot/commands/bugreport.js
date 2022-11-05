/* eslint-disable no-unreachable */
const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { handle_error } = require('../func');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bugreport')
        .setDescription('Report a bug to Jeffdev, Waveform\'s developer.'),
	async execute(interaction) {
        try {

        let modalID = Math.random().toString(36).slice(2, 7);
        const modal = new ModalBuilder()
			.setCustomId(`bugModal-${modalID}`)
			.setTitle('Report a bug with Waveform');

		// Create the text input components
		const commandInput = new TextInputBuilder()
			.setCustomId('cmd')
			.setLabel("What command caused this bug?")
            .setPlaceholder('Command name + extra arguments used.')
			.setStyle(TextInputStyle.Short);

        const songInput = new TextInputBuilder()
			.setCustomId('song')
			.setLabel("What song caused the bug?")
            .setPlaceholder('Please put the full song name in here!')
			.setStyle(TextInputStyle.Short);

        const typeInput = new TextInputBuilder()
			.setCustomId('type')
			.setLabel("How did you get the song data?")
            .setPlaceholder('Manual or Spotify.')
			.setStyle(TextInputStyle.Short);

		const descInput = new TextInputBuilder()
			.setCustomId('desc')
			.setLabel("Write any extra details that might help me.")
            .setRequired(false)
			.setStyle(TextInputStyle.Paragraph);

		// An action row only holds one text input,
		// so you need one action row per text input.
		const firstRow = new ActionRowBuilder().addComponents(commandInput);
		const secondRow = new ActionRowBuilder().addComponents(songInput);
		const thirdRow = new ActionRowBuilder().addComponents(typeInput);
		const fourthRow = new ActionRowBuilder().addComponents(descInput);

		// Add inputs to the modal
		modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);
        await interaction.showModal(modal);

        const submitted = await interaction.awaitModalSubmit({
            time: 120000,
            max: 1,
            filter: i => i.user.id === interaction.user.id && i.customId == `bugModal-${modalID}`,
        }).catch(() => {
            return null;
        });
          
        if (submitted) {
            let cmd = submitted.fields.getTextInputValue('cmd');
            let song = submitted.fields.getTextInputValue('song');
            let review_type = submitted.fields.getTextInputValue('type');
            let desc = submitted.fields.getTextInputValue('desc');
            if (desc == null) desc = 'N/A';

            await submitted.reply('Successfully submitted a bug report!');

            let bugChannel = interaction.guild.channels.cache.get('1038260795584303184');
            let bugEmbed = new EmbedBuilder()
            .setColor(`${interaction.member.displayHexColor}`)
            .setThumbnail(interaction.member.avatarURL({ extension: "png" }))
            .setAuthor({ name: `Bug report by ${interaction.member.displayName}`, iconURL: interaction.user.avatarURL({ extension: "png" }) })
            .setDescription(`**Cmd:** \`${cmd}\`\n` + 
            `**Song:** \`${song}\`\n` + 
            `**Type:** \`${review_type}\`\n\n`)
            .addFields({ name: 'Description', value: desc });
        
            bugChannel.send({ content: `**New Bug Report!**`, embeds: [bugEmbed] });
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};