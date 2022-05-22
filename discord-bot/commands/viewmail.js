const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../db.js');
const Discord = require('discord.js');
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('viewmail')
        .setDescription('View your mailbox and who has sent you what!'),
	async execute(interaction) {
        let mail_list = db.user_stats.get(interaction.user.id, 'mailbox_list');
        if (mail_list == undefined || mail_list == false) {
            return interaction.editReply('You have nothing in your mailbox.');
        } else if (mail_list.length == 0) {
            return interaction.editReply('You have nothing in your mailbox.');
        }
        mail_list = mail_list.map(v => `• ${v[0]} sent by <@${v[1]}>\n`);

        let paged_mail_list = _.chunk(mail_list, 10);
        console.log(paged_mail_list);
        let page_num = 0;
        const row = new Discord.MessageActionRow()
        .addComponents(
            new Discord.MessageButton()
                .setCustomId('left')
                .setStyle('PRIMARY')
                .setEmoji('⬅️'),
            new Discord.MessageButton()
                .setCustomId('right')
                .setStyle('PRIMARY')
                .setEmoji('➡️'),
        );

        const mailEmbed = new Discord.MessageEmbed()
            .setColor(`${interaction.member.displayHexColor}`)
            .setThumbnail(interaction.user.avatarURL({ format: "png" }))
            .setTitle(`${interaction.member.displayName}'s Mailbox`)
            .setDescription(paged_mail_list[page_num].join(''));
            if (paged_mail_list.length > 1) {
                mailEmbed.setFooter({ text: `Page 1 / ${paged_mail_list.length}` });
                interaction.editReply({ embeds: [mailEmbed], components: [row] });
            } else {
                interaction.editReply({ embeds: [mailEmbed], components: [] });
            }
        
        if (paged_mail_list.length > 1) {
            let message = await interaction.fetchReply();
        
            const collector = message.createMessageComponentCollector({ time: 120000 });

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
        
        interaction.editReply({ embeds: [mailEmbed] });
        
    },
};