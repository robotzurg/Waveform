const db = require('../db.js');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, SlashCommandBuilder, ButtonStyle, DMChannel } = require('discord.js');
const _ = require('lodash');
const { getEmbedColor } = require('../func.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('viewmail')
        .setDescription('View all songs in your personal Waveform mailbox that you have not reviewed yet.')
        .setDMPermission(true)
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to see mail from. (Optional, Defaults to yourself)')
                .setRequired(false)),
    help_desc: `View a list of every song you currently have in your mailbox that you have not reviewed yet.`,
	async execute(interaction, client) {

        let user = interaction.options.getUser('user');
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

        let mail_list = db.user_stats.get(user.id, 'mailbox_list');

        if (!(interaction.channel instanceof DMChannel)) {
            const guild = client.guilds.cache.get(interaction.guild.id);
            let res = await guild.members.fetch();
            let guildUsers = [...res.keys()];
            mail_list = mail_list.filter(v => guildUsers.includes(v.user_who_sent));
        }
        mail_list = mail_list.map(v => `• [**${v.display_name}**](${v.spotify_url}) sent by <@${v.user_who_sent}>\n`);

        if (mail_list == undefined || mail_list == false) {
            return interaction.reply('You have nothing in your mailbox.');
        } else if (mail_list.length == 0) {
            return interaction.reply('You have nothing in your mailbox.');
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

        const mailEmbed = new EmbedBuilder()
            .setColor(`${getEmbedColor(taggedMember)}`)
            .setThumbnail(user.avatarURL({ extension: "png" }))
            .setTitle(`${taggedMember.displayName}'s Waveform Spotify Mailbox`)
            .setDescription(paged_mail_list[page_num].join(''));
            if (paged_mail_list.length > 1) {
                mailEmbed.setFooter({ text: `Page 1 / ${paged_mail_list.length}` });
                interaction.reply({ embeds: [mailEmbed], components: [row] });
            } else {
                interaction.reply({ embeds: [mailEmbed], components: [] });
            }
        
        if (paged_mail_list.length > 1) {
            let message = await interaction.fetchReply();
        
            const collector = message.createMessageComponentCollector({ time: 360000 });

            collector.on('collect', async i => {
                (i.customId == 'left') ? page_num -= 1 : page_num += 1;
                page_num = _.clamp(page_num, 0, paged_mail_list.length - 1);
                mailEmbed.setDescription(paged_mail_list[page_num].join(''));
                mailEmbed.setFooter({ text: `Page ${page_num + 1} / ${paged_mail_list.length}` });
                i.update({ embeds: [mailEmbed] });
            });

            collector.on('end', async () => {
                interaction.editReply({ embeds: [mailEmbed], components: [] });
            });
        }
        
    },
};