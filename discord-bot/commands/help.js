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

        const guide_select_menu = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('guides')
                    .setPlaceholder('Usage Guides')
                    .setDisabled(true)
                    .setOptions([
                        {
                            label: `Song Reviews`,
                            description: `Learn how to create reviews for singles or remixes.`,
                            value: `song_review_help`,
                        },
                        {
                            label: `EP/LP Reviews`,
                            description: `Learn how to create reviews for EPs or albums (LPs).`,
                            value: `ep_review_help`,
                        },
                        {
                            label: `Edit Reviews`,
                            description: `Learn how to edit a review you made.`,
                            value: `edit_review_help`,
                        },
                        {
                            label: `Waveform Mailbox`,
                            description: `Learn how to properly utilize the Waveform Mailbox system.`,
                            value: `mailbox_help`,
                        },
                    ]),
            );

        const other_buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('command_help')
                    .setLabel('Commands')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('bugreport_help')
                    .setLabel('Reporting Issues')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true),
            );

        const helpEmbed = new EmbedBuilder()
        .setColor(`${getEmbedColor(interaction.member)}`)
        .setThumbnail(client.user.displayAvatarURL())
        .setTitle(`Waveform Help Desk 🗂️`)
        .setDescription(`Use the buttons below to select through the categories to get help on specific things!`);

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
        .setTitle(`/${commandList[0][0]}`)
        .addFields({ name: `Description`, value: `${commandList[0][1].help_desc}` });
        if (commandList[0][1].data.options.length != 0) {
            let argList = commandList[0][1].data.options.map(v => {
                let output = '';
                if (v.options == undefined) {
                    return `- \`${v.name}\`${v.required == true ? '' : ' *[optional]*'}`;
                } else {
                    output += `- \`${v.name}\`\n`;
                    for (let sub_idx = 0; sub_idx < v.options.length; sub_idx++) {
                        output += ` - \`${v.options[sub_idx].name}\`${v.options[sub_idx].required == true ? '' : ' *[optional]*'}\n`;
                    }
                    return output;
                }
            });
            argList = argList.join('\n');
            commandEmbed.addFields({ name: 'Arguments', value: argList });
        }

        interaction.reply({ content: null, embeds: [helpEmbed], components: [guide_select_menu, other_buttons] });

        const help_collector = interaction.channel.createMessageComponentCollector({ componentType: ComponentType.Button });
        const cmd_collector = interaction.channel.createMessageComponentCollector({ componentType: ComponentType.StringSelect });

        help_collector.on('collect', i => {
            let sel = i.customId;
            switch (sel) {
                case 'command_help':
                    other_buttons.components[0].setDisabled(true);
                    i.update({ content: null, embeds: [commandEmbed], components: [commandSelectMenu_1, commandSelectMenu_2, guide_select_menu, other_buttons] });

                    cmd_collector.on('collect', j => {
                        if (isNaN(parseInt(j.values[0]))) return;
                        let cmd_idx = parseInt(j.values[0]);
                        commandEmbed.setTitle(`/${commandList[cmd_idx][0]}`);
                        commandEmbed.setFields([]);
                        commandEmbed.addFields({ name: `Description`, value: `${commandList[cmd_idx][1].help_desc}` });
                        if (commandList[cmd_idx][1].data.options.length != 0) {
                            let argList = commandList[cmd_idx][1].data.options.map(v => {
                                let output = '';
                                if (v.options == undefined) {
                                    return `- \`${v.name}\`${v.required == true ? '' : ' *[optional]*'}`;
                                } else {
                                    output += `- \`${v.name}\`\n`;
                                    for (let sub_idx = 0; sub_idx < v.options.length; sub_idx++) {
                                        output += ` - \`${v.options[sub_idx].name}\`${v.options[sub_idx].required == true ? '' : ' *[optional]*'}\n`;
                                    }
                                    return output;
                                }
                            });
                            argList = argList.join('\n');
                            commandEmbed.addFields({ name: 'Arguments', value: argList });
                        }
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
