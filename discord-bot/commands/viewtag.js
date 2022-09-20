const db = require("../db.js");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, SlashCommandBuilder, ButtonStyle } = require('discord.js');
const { handle_error } = require("../func.js");
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('viewtag')
        .setDescription('View a list of all songs tagged with a specific tag!')
        .addStringOption(option => 
            option.setName('tag')
                .setDescription('What rating you want to see a list of.')
                .setAutocomplete(true)
                .setRequired(true)),

	async execute(interaction) {

        try {
            
        let tag = interaction.options.getString('tag');
        if (!db.tags.has(tag)) return interaction.reply(`The tag ${tag} does not exist.`);
        let songList = db.tags.get(tag, 'song_list');
        let tagArt = db.tags.get(tag, 'image');
        if (songList.length == 0) return interaction.reply(`There are no songs with the tag \`${tag}\`.`);

        let pagedSongList = _.chunk(songList, 10);
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

        for (let i = 0; i < pagedSongList.length; i++) {

            for (let j = 0; j < pagedSongList[i].length; j++) {
                pagedSongList[i][j] = `• ` + `[${pagedSongList[i][j]}](https://www.google.com)`;
            }

            pagedSongList[i] = pagedSongList[i].join('\n');
        }  

        const songListEmbed = new EmbedBuilder()
            .setColor(`${interaction.member.displayHexColor}`)
            .setAuthor({ name: `List of songs with the tag ${tag}` })
            .setDescription(pagedSongList[page_num]);
            if (tagArt != false) {
                songListEmbed.setThumbnail(tagArt);
            }

            if (pagedSongList.length > 1) {
                songListEmbed.setFooter({ text: `Page 1 / ${pagedSongList.length} • ${songList.length} song(s) with the tag ${tag}` });
                interaction.reply({ embeds: [songListEmbed], components: [row] });
            } else {
                songListEmbed.setFooter({ text: `${songList.length} song(s) with the tag ${tag}` });
                interaction.reply({ embeds: [songListEmbed], components: [] });
            }

        if (pagedSongList.length > 1) {
            let message = await interaction.fetchReply();
        
            const collector = message.createMessageComponentCollector({ time: 360000 });

            collector.on('collect', async i => {
                (i.customId == 'left') ? page_num -= 1 : page_num += 1;
                page_num = _.clamp(page_num, 0, pagedSongList.length - 1);
                songListEmbed.setDescription(pagedSongList[page_num]);
                songListEmbed.setFooter({ text: `Page ${page_num + 1} / ${pagedSongList.length} • ${songList.length} song(s) with the tag ${tag}` });
                i.update({ embeds: [songListEmbed] });
            });

            collector.on('end', async () => {
                interaction.editReply({ embeds: [songListEmbed], components: [] });
            });
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};