const db = require('../db.js');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, SlashCommandBuilder, ButtonStyle } = require('discord.js');
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('viewmail')
        .setDescription('View your Waveform Mailbox list.')
        .setDMPermission(false),
    help_desc: `View a list of every song you currently have in your mailbox that you have not reviewed yet.\n` + 
    `This command will only properly work with Spotify mailboxes. If you do not have a spotify Waveform mailbox, you can still use this, but it won't auto update, so you will have to manually update it with /deletemail.`,
	async execute(interaction) {
        let mail_list = db.user_stats.get(interaction.user.id, 'mailbox_list');
        if (mail_list == undefined || mail_list == false) {
            return interaction.reply('You have nothing in your mailbox.');
        } else if (mail_list.length == 0) {
            return interaction.reply('You have nothing in your mailbox.');
        }
        mail_list = mail_list.map(v => `• [**${v.display_name}**](${v.spotify_url}) sent by <@${v.user_who_sent}>\n`);

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
            .setColor(`${interaction.member.displayHexColor}`)
            .setThumbnail(interaction.user.avatarURL({ extension: "png" }))
            .setTitle(`${interaction.member.displayName}'s Mailbox`)
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