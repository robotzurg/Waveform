const db = require('../db.js');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, SlashCommandBuilder, ButtonStyle, DMChannel } = require('discord.js');
const _ = require('lodash');
const { getEmbedColor } = require('../func.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('viewmail')
        .setDescription('View all songs in a users Spotify Waveform mailbox.')
        .setDMPermission(true)
        .addSubcommand(subcommand =>
            subcommand.setName('spotify')
            .setDescription('View all songs sent in a users Spotify Mailbox.')

            .addStringOption(option =>
                option.setName('filter')
                    .setDescription('Filter your mailbox to show specific types of music. (Leaving blank will show all types)')
                    .setRequired(false)
                    .addChoices(
                            { name: 'Songs', value: 'song' },
                            { name: 'EPs', value: 'ep' },
                            { name: 'Albums', value: 'album' },
                        ))

            .addUserOption(option =>
                option.setName('user_filter')
                    .setDescription('Filter your mailbox to only show music sent by a specific user.')
                    .setRequired(false))

            .addUserOption(option => 
                option.setName('mailbox_user')
                    .setDescription('What users mailbox to view (Optional, Defaults to yourself)')
                    .setRequired(false))

            .addStringOption(option => 
                option.setName('all_servers')
                    .setDescription('View songs sent from all servers, instead of just this one (names hidden for privacy)')
                    .setRequired(false)
                    .addChoices({ name: 'yes', value: 'yes' }))),
    help_desc: `View a list of every song you currently have in your mailbox that you have not reviewed yet.`,
	async execute(interaction) {

        let user = interaction.options.getUser('mailbox_user');
        let filterOption = interaction.options.getString('filter');
        let filterUser = interaction.options.getUser('user_filter');
        let filterMember;
        if (filterUser != null) {
            filterMember = await interaction.guild.members.fetch(filterUser.id);
        }
        let taggedMember;

        if (user == null) {
            user = interaction.user;
            taggedMember = interaction.member;

            // Do this for DMChannels
            if (taggedMember == null) {
                taggedMember = {
                    displayName: user.username,
                    user: {
                        id: user.id,
                    },
                    displayHexColor: '#000000',
                };
            }
        } else {
            if (interaction.channel instanceof DMChannel) {
                return interaction.reply('You cannot specify a user in a DM. You can only view your own mailbox list. Please leave the user argument blank, or specify yourself.');
            }
            taggedMember = await interaction.guild.members.fetch(user.id);
        }

        let allServers = interaction.options.getString('all_servers');
        allServers = (allServers == 'yes');
        let mail_list = db.user_stats.get(user.id, 'mailbox_list');

        const mailEmbed = new EmbedBuilder()
        .setColor(`${getEmbedColor(taggedMember)}`)
        .setThumbnail(user.avatarURL({ extension: "png" }))
        .setTitle(`${taggedMember.displayName}'s Waveform Spotify Mailbox`);

        let guildUsers = [];
        if (!(interaction.channel instanceof DMChannel)) {
            let res = await interaction.guild.members.fetch();
            guildUsers = [...res.keys()];
        }

        // If we are in a DM or allServers is true, don't filter the list. Otherwise, do.
        if (!(interaction.channel instanceof DMChannel) && allServers == false) {
            mail_list = mail_list.filter(v => guildUsers.includes(v.user_who_sent));
        } else {
            mailEmbed.setTitle(`${taggedMember.displayName}'s Waveform Spotify Mailbox (All Servers)`);
        }

        let tipMsg = ``;
        if (allServers == true && !(interaction.channel instanceof DMChannel)) {
            tipMsg = ' • Run this command in Waveform DMs to reveal all hidden users!';
        }

        if (filterOption != null) {
            switch (filterOption) {
                case 'song': 
                    mail_list = mail_list.filter(v => !v.display_name.includes(' EP') && !v.display_name.includes(' LP'));
                    mailEmbed.setFooter({ text: 'Displaying only songs' + tipMsg });
                break;
                case 'ep':
                    mail_list = mail_list.filter(v => v.display_name.includes(' EP'));
                    mailEmbed.setFooter({ text: 'Displaying only EPs' + tipMsg });
                break;
                case 'album':
                    mail_list = mail_list.filter(v => v.display_name.includes(' LP'));
                    mailEmbed.setFooter({ text: 'Displaying only albums' + tipMsg });
                break;
            }
        }

        if (filterUser != null) {
            mail_list = mail_list.filter(v => v.user_who_sent === filterUser.id);
        }

        mail_list = mail_list.map(v => `• [**${v.display_name}**](${v.spotify_url})\n${guildUsers.includes(v.user_who_sent) || interaction.channel instanceof DMChannel ? `Sent by <@${v.user_who_sent}>` : `Sent by a user outside this server`}\n\n`);

        if (mail_list == undefined || mail_list == false) {
            return interaction.reply(`You have nothing in your mailbox${filterUser != null ? ` from the user **${filterMember.displayName}**.` : `.`}`);
        } else if (mail_list.length == 0) {
            return interaction.reply(`You have nothing in your mailbox${filterUser != null ? ` from the user **${filterMember.displayName}**.` : `.`}`);
        }

        let paged_mail_list = _.chunk(mail_list, 10);
        let page_num = 0;
        const row = new ActionRowBuilder()
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

        mailEmbed.setDescription(paged_mail_list[page_num].join(''));
            if (paged_mail_list.length > 1) {
                mailEmbed.setFooter({ text: `Page 1 / ${paged_mail_list.length}` + tipMsg });
                interaction.reply({ content: tipMsg, embeds: [mailEmbed], components: [row] });
            } else {
                interaction.reply({ content: tipMsg, embeds: [mailEmbed], components: [] });
            }
        
        if (paged_mail_list.length > 1) {
            let message = await interaction.fetchReply();
        
            const collector = message.createMessageComponentCollector({ idle: 120000 });

            collector.on('collect', async i => {
                (i.customId == 'left') ? page_num -= 1 : page_num += 1;
                page_num = _.clamp(page_num, 0, paged_mail_list.length - 1);
                mailEmbed.setDescription(paged_mail_list[page_num].join(''));
                mailEmbed.setFooter({ text: `Page ${page_num + 1} / ${paged_mail_list.length}` + tipMsg });
                i.update({ embeds: [mailEmbed] });
            });

            collector.on('end', async () => {
                interaction.editReply({ content: tipMsg, embeds: [mailEmbed], components: [] });
            });
        }
        
    },
};