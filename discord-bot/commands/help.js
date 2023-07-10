/* eslint-disable no-unreachable */
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { getEmbedColor } = require('../func');
// const db = require('../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Get help with Waveform.')
        .setDMPermission(false),
    help_desc: `Get help with all the various Waveform commands, and view guides on how to do song/EP/LP reviews and use Waveform Mailbox.`,
	async execute(interaction, client) {

        const help_buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('command_help')
                    .setLabel('Command Help')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('review_help')
                    .setLabel('Review Help')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('mailbox_help')
                    .setLabel('Mailbox Help')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true),
            );

        const helpEmbed = new EmbedBuilder()
        .setColor(`${getEmbedColor(interaction.member)}`)
        .setThumbnail(client.user.displayAvatarURL())
        .setTitle(`Waveform Help Desk 🗂️`)
        .setDescription(`Use the buttons below to select through the categories to get help on specific things!\n\n` + 
        `If you see something that isn't talked about in here that you need help with, let Jeff know and he can add it here!`);

        // Setup the commandEmbed and commandList and the commandSelectMenu
        let commandSelectOptions = [];
        let commandList = [];
        commandSelectOptions[0] = [];
        commandSelectOptions[1] = [];
        let counter = 0;
        for (let cmd of client.commands) {
            commandList.push(cmd);
            commandSelectOptions[(counter <= 24 ? 0 : 1)].push({
                label: `/${cmd[0]}`,
                description: `${cmd[1].data.description}`,
                value: `${counter}`,
            });
            counter += 1;
        }

        const commandSelectMenu_1 = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('command_list')
                    .setPlaceholder('Commands 1-25')
                    .setOptions(commandSelectOptions[0]),
            );

        const commandSelectMenu_2 = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('command_list_2')
                    .setPlaceholder(`Commands 26-${commandSelectOptions[1].length + 25}`)
                    .setOptions(commandSelectOptions[1]),
            );

        const commandEmbed = new EmbedBuilder()
        .setColor(`${getEmbedColor(interaction.member)}`)
        .setThumbnail(client.user.displayAvatarURL())
        .setTitle(`${commandList[0][0]}`)
        .setDescription(`${commandList[0][1].help_desc}`);

        interaction.reply({ content: null, embeds: [helpEmbed], components: [help_buttons] });

        const help_collector = interaction.channel.createMessageComponentCollector({ componentType: ComponentType.Button });
        const cmd_collector = interaction.channel.createMessageComponentCollector({ componentType: ComponentType.StringSelect });

        help_collector.on('collect', i => {
            let sel = i.customId;
            switch (sel) {
                case 'command_help':
                    help_buttons.components[0].setDisabled(true);
                    i.update({ content: null, embeds: [commandEmbed], components: [commandSelectMenu_1, commandSelectMenu_2, help_buttons] });

                    cmd_collector.on('collect', j => {
                        let cmd_idx = parseInt(j.values[0]);
                        commandEmbed.setTitle(`/${commandList[cmd_idx][0]}`);
                        commandEmbed.setDescription(`${commandList[cmd_idx][1].help_desc}`);
                        j.update({ embeds: [commandEmbed] });
                    });
                    
                break;
                case 'review_help':
                    cmd_collector.stop();
                break;
                case 'mailbox_help':
                    cmd_collector.stop();
                break;
            }
        });
    },
};
