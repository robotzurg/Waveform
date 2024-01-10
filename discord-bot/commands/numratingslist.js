const db = require("../db.js");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, SlashCommandBuilder, ButtonStyle } = require('discord.js');
const { handle_error, getEmbedColor } = require("../func.js");
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('numratingslist')
        .setDescription('View a list of all the amount of times a user has given specific number ratings.')
        .setDMPermission(false)
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User whose list you want to see. Defaults to yourself.')
                .setRequired(false)),
    help_desc: `Gets a full list of every rating a specified user has given, and how many times they have given that rating.`,
	async execute(interaction, client) {
        try {

        await interaction.deferReply();

        let taggedUser = interaction.options.getUser('user');
        let taggedMember;

        if (taggedUser != null) {
            taggedMember = await interaction.guild.members.fetch(taggedUser.id);
        } else {
            taggedMember = interaction.member;
            taggedUser = interaction.user;
        }

        let ratingList = db.user_stats.get(taggedUser.id, `stats.ratings_list`);
        if (Object.keys(ratingList).length == 0) return interaction.reply(`You have never rated a song before!`);
        ratingList = Object.entries(ratingList).sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));

        let pagedRatingList = _.chunk(ratingList, 10);
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

        for (let i = 0; i < pagedRatingList.length; i++) {

            for (let j = 0; j < pagedRatingList[i].length; j++) {
                pagedRatingList[i][j] = `• ${pagedRatingList[i][j][0]}: \`${pagedRatingList[i][j][1]}\``;
            }

            pagedRatingList[i] = pagedRatingList[i].join('\n');
        }  

        const ratingListEmbed = new EmbedBuilder()
            .setColor(`${getEmbedColor(taggedMember)}`)
            .setThumbnail(taggedUser.avatarURL({ extension: "png" }))
            .setAuthor({ name: `All ratings from all servers by ${taggedMember.displayName}`, iconURL: taggedUser.avatarURL({ extension: "png" }) })
            .setDescription(pagedRatingList[page_num]);
            if (pagedRatingList.length > 1) {
                ratingListEmbed.setFooter({ text: `Page 1 / ${pagedRatingList.length}` });
            }

            interaction.editReply({ content: null, embeds: [ratingListEmbed], components: [row] });
        
        if (pagedRatingList.length > 1) {
            let message = await interaction.fetchReply();
        
            const collector = message.createMessageComponentCollector({ time: 360000 });

            collector.on('collect', async i => {
                (i.customId == 'left') ? page_num -= 1 : page_num += 1;
                page_num = _.clamp(page_num, 0, pagedRatingList.length - 1);
                ratingListEmbed.setDescription(pagedRatingList[page_num]);
                ratingListEmbed.setFooter({ text: `Page ${page_num + 1} / ${pagedRatingList.length}` });
                i.update({ embeds: [ratingListEmbed] });
            });

            collector.on('end', async () => {
                interaction.editReply({ content: null, embeds: [ratingListEmbed], components: [] });
            });
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, client, error);
        }
    },
};