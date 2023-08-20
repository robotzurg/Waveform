/* eslint-disable no-unreachable */
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { getEmbedColor } = require('../func');
const _ = require('lodash');
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
                    .setOptions([
                        {
                            label: `Song Reviews`,
                            description: `Learn how to create reviews for singles or remixes.`,
                            emoji: '🎵',
                            value: `song_review_help`,
                        },
                        {
                            label: `EP/LP Reviews`,
                            description: `Learn how to create reviews for EPs or albums (LPs).`,
                            emoji: '🎶',
                            value: `ep_review_help`,
                        },
                        {
                            label: `Waveform Mailbox`,
                            description: `Learn how to properly utilize the Waveform Mailbox.`,
                            emoji: '📬',
                            value: `mailbox_help`,
                        },
                    ]),
            );

        const other_buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('basics_help')
                    .setLabel('The Basics')
                    .setStyle(ButtonStyle.Success),
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('command_help')
                    .setLabel('Commands')
                    .setStyle(ButtonStyle.Secondary),
            );

        const helpEmbed = new EmbedBuilder()
        .setColor(`${getEmbedColor(interaction.member)}`)
        .setThumbnail(client.user.displayAvatarURL())
        .setTitle(`Waveform Help Desk 🗂️`)
        .setDescription(`Use the buttons below to select through the categories to get help on specific things!\n` +
                        `\nIf you need more assistance than what these give you, you can join the official Waveform support server [here](https://discord.gg/sxmFRyZtUf) and ask the developer, Jeffdev, for assistance.` +
                        `You can also report things using the commands that begin with \`report\`.`);

        // Setup the commandEmbed and commandList and the commandSelectMenu
        let commandSelectOptions = [];
        let commandList = [];
        commandSelectOptions[0] = [];
        commandSelectOptions[1] = [];
        let counter = 0;
        let cmd_idx = 0;
        for (let cmd of client.commands) {
            if (cmd[0].includes('admin') || cmd[0] == 'editdata' || cmd[0] == 'testcommand') continue;
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

        const pageButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('left')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⬅️'),
            new ButtonBuilder()
                .setCustomId('right')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('➡️'),
        );

        // GUIDE VARIABLES

        // TL;DR guide
        let basics_guide = "To use Waveform, the main commands you need to know are:\n" +
        "- `/review`, which allows you to review a song or remix\n" +
        "- `/epreview`, which allows you to review an EP/LP\n" +
        "- `/editreview`, which allows you to edit a review\n" +
        "As well as the get and set commands, which are self explanatory.\n" +
        "\n" +
        "Before reviewing, I strongly recommend logging into Spotify as well, using `/login`. This will make your experience with Waveform much better. You can utilize Spotify with reviewing by playing a song on spotify, then using the review commands, and can use it on the get commands by leaving artist/song arguments blank. If you choose not to use this, you can review using the manual review commands, but you will have to fill in the artist/song information yourself.\n";
        
        // Song Review
        let song_review_guide = [
            // Page 1
            'To start with Spotify reviews, make sure you are logged into Spotify on Waveform. To do this, run `/login` and follow the instructions in the message and link to get setup with Spotify on Waveform.\n' +
            '\n' + 
            'After you have finished this, you are ready to begin reviewing with Spotify on Waveform! To start, play a song you want to review on spotify (doesn’t matter which platform you are on). After you have done so, type `/review with_spotify`, and you should see something like the below.',

            // Page 2
            'Your review can be setup either with a number rating and text review, or just a number rating, or just a text review. The rating argument and review argument are both optional, so all you need to do to leave one out is just leave it blank!\n' +
            '\n',

            // Page 3
            'After pressing enter to run the command, you’ll see this set of buttons pop up with your review.\n' +
            '- The 📝**Rating** and 📝**Review** buttons edit those values.\n' +
            '- The 🌟 button will give the review a star, giving it an extra accolade for the truly best songs. Can only be done for 8/10s or higher.\n' +
            '- The **Confirm Review** button is what you press to finish the review.\n' +
            '- The **Delete** button will delete the review entirely.\n' +
            'To finish your review, click the confirm review button. This will finalize your review, publishing it to Waveform!',
        ];

        let song_review_guide_images = [
            'https://media.discordapp.net/attachments/1142701807852859443/1142701955702071327/song_review_help_1.png?width=1028&height=428',
            'https://media.discordapp.net/attachments/1142701807852859443/1142701968402423868/song_review_help_2.png?width=781&height=70',
            'https://media.discordapp.net/attachments/1142701807852859443/1142701984244301845/song_review_help_3.png?width=681&height=497',
        ];

        // Spotify EP/LP Review
        let ep_review_guide = [
            // Page 1
            'This guide will help you review EPs/LPs (LPs are albums, for those who don’t know the lingo) through Waveform. The process for reviewing EPs/LPs is very similar to normal song reviews (same system with Spotify playback vs manual playback), however there are some extra bits to the process. Make sure you know how to review normal songs first, and understand how Spotify connection works.\n',

            // Page 2
            'You can review EPs/LPs in 2 distinct ways. You can either review them song by song, reviewing all songs by the end alongside the EP/LP (using `Begin EP Review`), or review it altogether without giving each song a review (using `Review EP Without Individual Song Reviews`). The other buttons work the same as in normal song reviews.\n' +
            '\n' +
            'It should be noted that you can review an EP/LP without a rating or a review at all, or you can just do one or the other. Just leave either argument (or both) blank to do so!',

            // Page 3
            'When clicking `Begin EP Review`, you will usually see something like the below image. This list tells you what order to review the songs, and the exact names for each song. Be sure to follow this order, and run the usual song review command for each song. After all are complete, a button to finalize the review will appear, which you can then click to end the review.\n' +
            '\n' +
            'If you are doing a manual EP/LP review, make sure you run `/epdone` to fully finish your EP/LP review, as a button may not appear when you finish writing out the review.',
        ];

        let ep_review_guide_images = [
            null,
            'https://media.discordapp.net/attachments/1142701807852859443/1142701997213093938/ep_review_help_1.png?width=938&height=440',
            'https://media.discordapp.net/attachments/1142701807852859443/1142702007602397264/ep_review_help_2.png?width=958&height=676',
        ];

        let mailbox_guide = [
            // Page 1
            "The Waveform Mailbox is a primarily Spotify focused feature that allows you to send users music through Waveform. It’s primarily useful because Waveform creates a Spotify playlist that auto updates to hold this for you, as well as being able to showcase who sent you a specific song automatically. Be sure you have run `/login` before this, if you are a Spotify user.\n" +
            "\n" +
            "To start using it, you will want to run the command `/setupmailbox`. After this command is run, your mailbox system will be setup internally, and if you have a spotify mailbox, you should see a new playlist setup called **Waveform Mailbox**, like below. This will be auto updated with new songs sent and auto removed as you review.",

            // Page 2
            "In order to send a song to someone through Waveform Mailbox, you will want to use the `/sendmail` command. It is important to note that if you are listening to a song on spotify, you can leave the `link` argument blank to send whatever song you are playing to a user. The user will be notified via DM when you send them a song.",

            // Page 3
            "You can also view a local mail list using `/viewmail`, and manually delete entries from your local mail list using `/deletemail` (or `/clearallmail` to clear it all out). These commands are particularly useful if using a non-spotify mailbox, as that will not create a playlist or auto update the local mail list.",

        ];

        let mailbox_guide_images = [
            'https://media.discordapp.net/attachments/1142701807852859443/1142702022949339166/mailbox_help_1.png?width=1210&height=310',
            'https://media.discordapp.net/attachments/1142701807852859443/1142702029387612230/mailbox_help_2.png?width=636&height=398',
            null,
        ];

        let page_num = 1;
        let sel_guide_pages;
        let sel_guide_images;

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
        const help_collector = interaction.channel.createMessageComponentCollector();
        let guideEmbed, basicsEmbed;

        help_collector.on('collect', async i => {
            let sel = i.customId;
            if (sel == 'guides') {
                sel = i.values[0];
            }
            
            switch (sel) {
                case 'command_help':
                    other_buttons.components[0].setDisabled(false);
                    other_buttons.components[1].setDisabled(true);
                    i.update({ content: null, embeds: [commandEmbed], components: [commandSelectMenu_1, commandSelectMenu_2, guide_select_menu, other_buttons] });
                break;
                case 'basics_help':
                    other_buttons.components[0].setDisabled(true);
                    other_buttons.components[1].setDisabled(false);

                    basicsEmbed = new EmbedBuilder()
                    .setColor(`${getEmbedColor(interaction.member)}`)
                    .setTitle(`Waveform Basics`)
                    .setDescription(basics_guide);

                    i.update({ content: null, embeds: [basicsEmbed], components: [guide_select_menu, other_buttons] });
                break;
                case 'song_review_help':
                    other_buttons.components[0].setDisabled(false);
                    other_buttons.components[1].setDisabled(false);

                    page_num = 0;
                    sel_guide_pages = song_review_guide;
                    sel_guide_images = song_review_guide_images;

                    guideEmbed = new EmbedBuilder()
                    .setColor(`${getEmbedColor(interaction.member)}`)
                    .setTitle(`🎵 Song Review Guide`)
                    .setDescription(sel_guide_pages[page_num])
                    .setImage(sel_guide_images[page_num])
                    .setFooter({ text: `Page 1 / ${sel_guide_pages.length}` });

                    i.update({ content: null, embeds: [guideEmbed], components: [pageButtons, guide_select_menu, other_buttons] });
                break;
                case 'ep_review_help':
                    other_buttons.components[0].setDisabled(false);
                    other_buttons.components[1].setDisabled(false);

                    page_num = 0;
                    sel_guide_pages = ep_review_guide;
                    sel_guide_images = ep_review_guide_images;

                    guideEmbed = new EmbedBuilder()
                    .setColor(`${getEmbedColor(interaction.member)}`)
                    .setTitle(`🎶 EP/LP Review Guide`)
                    .setDescription(sel_guide_pages[page_num])
                    .setImage(sel_guide_images[page_num])
                    .setFooter({ text: `Page 1 / ${sel_guide_pages.length}` });

                    i.update({ content: null, embeds: [guideEmbed], components: [pageButtons, guide_select_menu, other_buttons] });
                break;
                case 'mailbox_help':
                    other_buttons.components[0].setDisabled(false);
                    other_buttons.components[1].setDisabled(false);

                    page_num = 0;
                    sel_guide_pages = mailbox_guide;
                    sel_guide_images = mailbox_guide_images;

                    guideEmbed = new EmbedBuilder()
                    .setColor(`${getEmbedColor(interaction.member)}`)
                    .setTitle(`📬 Waveform Mailbox Guide`)
                    .setDescription(sel_guide_pages[page_num])
                    .setImage(sel_guide_images[page_num])
                    .setFooter({ text: `Page 1 / ${sel_guide_pages.length}` });

                    i.update({ content: null, embeds: [guideEmbed], components: [pageButtons, guide_select_menu, other_buttons] });
                break;
                case 'left':
                case 'right':
                    (i.customId == 'left') ? page_num -= 1 : page_num += 1;
                    page_num = _.clamp(page_num, 0, sel_guide_pages.length - 1);
                    guideEmbed.setDescription(sel_guide_pages[page_num]);
                    guideEmbed.setImage(sel_guide_images[page_num]);
                    guideEmbed.setFooter({ text: `Page ${page_num + 1} / ${sel_guide_pages.length}` });
                    i.update({ embeds: [guideEmbed] });
                break;
                default:
                    if (isNaN(parseInt(i.values[0]))) return;
                    cmd_idx = parseInt(i.values[0]);
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
                    i.update({ embeds: [commandEmbed] });
            }
        });
    },
};
