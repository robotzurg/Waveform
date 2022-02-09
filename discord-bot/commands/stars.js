const Discord = require('discord.js');
const db = require('../db.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const _ = require('lodash');
const { handle_error } = require('../func.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stars')
        .setDescription('See a full list of all the stars a user has on songs in the database.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to see stars from. (Optional, Defaults to yourself)')
                .setRequired(false)),
    admin: false,
	async execute(interaction) {

        try {
        
        let user = interaction.options.getUser('user');

        if (user == null) user = interaction.user;
        let taggedMember;

        if (user != null) {
            taggedMember = await interaction.guild.members.fetch(user.id);
        } else {
            taggedMember = interaction.member;
        }

        let star_list = db.user_stats.get(user.id, `star_list`);
        let paged_star_list = _.chunk(star_list, 10);
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

        for (let i = 0; i < paged_star_list.length; i++) {

            for (let j = 0; j < paged_star_list[i].length; j++) {
                paged_star_list[i][j] = `• ` + paged_star_list[i][j];
            }

            paged_star_list[i] = paged_star_list[i].join('\n');
        }  

        const starCommandEmbed = new Discord.MessageEmbed()
            .setColor(`${interaction.member.displayHexColor}`)
            .setThumbnail(user.avatarURL({ format: "png" }))
            .setTitle(`🌟 ${taggedMember.displayName}'s Stars 🌟`)
            .setDescription(paged_star_list[page_num]);
            if (paged_star_list.length > 1) {
                starCommandEmbed.setFooter({ text: `Page 1 / ${paged_star_list.length}` });
                interaction.editReply({ embeds: [starCommandEmbed], components: [row] });
            } else {
                interaction.editReply({ embeds: [starCommandEmbed], components: [] });
            }
        
        if (paged_star_list.length > 1) {
            let message = await interaction.fetchReply();
        
            const collector = message.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async i => {
                (i.customId == 'left') ? page_num -= 1 : page_num += 1;
                page_num = _.clamp(page_num, 0, paged_star_list.length - 1);
                starCommandEmbed.setDescription(paged_star_list[page_num]);
                starCommandEmbed.setFooter({ text: `Page ${page_num + 1} / ${paged_star_list.length}` });
                i.update({ embeds: [starCommandEmbed] });
            });

            collector.on('end', async () => {
                interaction.editReply({ embeds: [starCommandEmbed], components: [] });
            });
        }

        } catch (err) {
            let error = new Error(err).stack;
            handle_error(interaction, error);
        }
	},
};