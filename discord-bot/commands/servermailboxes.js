const db = require('../db.js');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, SlashCommandBuilder, ButtonStyle } = require('discord.js');
const { getEmbedColor } = require('../func.js');
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('servermailboxes')
        .setDescription('View all users with a mailbox setup in your server on Waveform.')
        .setDMPermission(false),
    help_desc: `View a list of every user who has setup a mailbox, and if it is a Spotify or non-Spotify mailbox. Useful for seeing if you can send someone a song!`,
	async execute(interaction) {
        await interaction.deferReply();
        let res = await interaction.guild.members.fetch();
        let guildUsers = [...res.keys()];

        let waveformUsers = Array.from(db.user_stats.keys());
        let mailUsers = [];
        for (let user of waveformUsers) {
            if (guildUsers.includes(user)) {
                let userData = db.user_stats.get(user);
                if (userData.spotify_mailbox == true || userData.mailbox_playlist_id != false) {
                    mailUsers.push({ id: user, type: 'spotify' });
                } else if (userData.has_mailbox == true) {
                    mailUsers.push({ id: user, type: 'non-spotify' });
                }
            }
        }

        if (mailUsers.length == 0) return interaction.editReply('This server does not have any mailboxes setup.');

        const mailEmbed = new EmbedBuilder()
        .setColor(`${getEmbedColor(interaction.member)}`)
        .setThumbnail(interaction.guild.iconURL({ extension: 'png' }))
        .setTitle(`All Users with Mailboxes setup in ${interaction.guild.name}`);

        mailUsers = mailUsers.map(v => `- ${v.type == 'spotify' ? `<:spotify:899365299814559784> ` : `<:waveform:1250704468236832798>`}<@${v.id}>`);

        let paged_mail_list = _.chunk(mailUsers, 10);
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

        mailEmbed.setDescription(paged_mail_list[page_num].join('\n'));
            if (paged_mail_list.length > 1) {
                mailEmbed.setFooter({ text: `Page 1 / ${paged_mail_list.length}` });
                interaction.editReply({ embeds: [mailEmbed], components: [row] });
            } else {
                interaction.editReply({ embeds: [mailEmbed], components: [] });
            }
        
        if (paged_mail_list.length > 1) {
            let message = await interaction.fetchReply();
            const collector = message.createMessageComponentCollector({ idle: 120000 });

            collector.on('collect', async i => {
                (i.customId == 'left') ? page_num -= 1 : page_num += 1;
                page_num = _.clamp(page_num, 0, paged_mail_list.length - 1);
                mailEmbed.setDescription(paged_mail_list[page_num].join('\n'));
                mailEmbed.setFooter({ text: `Page ${page_num + 1} / ${paged_mail_list.length}` });
                i.update({ embeds: [mailEmbed] });
            });

            collector.on('end', async () => {
                interaction.editReply({ embeds: [mailEmbed], components: [] });
            });
        }

        
    },
};