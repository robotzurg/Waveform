const db = require("../db.js");
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require('discord.js');
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
            
        let tagList = [];
        let tag = interaction.options.getString('tag');

        let tagArray = db.tags.keyArray();

        for (let i = 0; i < tagArray.length; i++) {
            if (tagArray[i] != tag) continue;
            tagList = db.tags.get(tagArray[i]);
        }

        if (tagList.length == 0) return interaction.editReply(`There are no songs with the tag \`${tag}\`.`);

        let pagedTagList = _.chunk(tagList, 10);
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

        for (let i = 0; i < pagedTagList.length; i++) {

            for (let j = 0; j < pagedTagList[i].length; j++) {
                pagedTagList[i][j] = `• ` + `[${pagedTagList[i][j]}](https://www.google.com)`;
            }

            pagedTagList[i] = pagedTagList[i].join('\n');
        }  

        const tagListEmbed = new Discord.MessageEmbed()
            .setColor(`${interaction.member.displayHexColor}`)
            .setAuthor({ name: `List of songs with the tag ${tag}` })
            .setDescription(pagedTagList[page_num]);
            if (pagedTagList.length > 1) {
                tagListEmbed.setFooter({ text: `Page 1 / ${pagedTagList.length} • ${tagList.length} song(s) with the tag ${tag}` });
                interaction.editReply({ embeds: [tagListEmbed], components: [row] });
            } else {
                tagListEmbed.setFooter({ text: `${tagList.length} song(s) with the tag ${tag}` });
                interaction.editReply({ embeds: [tagListEmbed], components: [] });
            }
        
        if (pagedTagList.length > 1) {
            let message = await interaction.fetchReply();
        
            const collector = message.createMessageComponentCollector({ time: 120000 });

            collector.on('collect', async i => {
                (i.customId == 'left') ? page_num -= 1 : page_num += 1;
                page_num = _.clamp(page_num, 0, pagedTagList.length - 1);
                tagListEmbed.setDescription(pagedTagList[page_num]);
                tagListEmbed.setFooter({ text: `Page ${page_num + 1} / ${pagedTagList.length} • ${tagList.length} song(s) with the tag ${tag}` });
                i.update({ embeds: [tagListEmbed] });
            });

            collector.on('end', async () => {
                interaction.editReply({ embeds: [tagListEmbed], components: [] });
            });
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};