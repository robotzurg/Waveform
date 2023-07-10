const db = require('../db.js');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, SlashCommandBuilder, ButtonStyle } = require('discord.js');
const _ = require('lodash');
const { handle_error, getEmbedColor } = require('../func.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('starlist')
        .setDescription('Get a list of all stars a user has given.')
        .setDMPermission(false)
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to see stars from. (Optional, Defaults to yourself)')
                .setRequired(false)),
    help_desc: `TBD`,
	async execute(interaction) {

        try {
        
        await interaction.reply('Loading star list, this takes a moment so please be patient!');
        let user = interaction.options.getUser('user');

        if (user == null) user = interaction.user;
        let taggedMember;

        if (user != null) {
            taggedMember = await interaction.guild.members.fetch(user.id);
        } else {
            taggedMember = interaction.member;
        }

        let starList = db.user_stats.get(user.id, 'stats.star_list');
        let paged_star_list = _.chunk(starList, 10);
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

        for (let i = 0; i < paged_star_list.length; i++) {
            for (let j = 0; j < paged_star_list[i].length; j++) {

                let songUrl = paged_star_list[i][j].spotify_uri;
                if (songUrl == false) {
                    songUrl = 'https://www.google.com/';
                } else {
                    if (paged_star_list[i][j].db_song_name.includes(' EP') || paged_star_list[i][j].db_song_name.includes(' LP')) {
                        songUrl = `https://open.spotify.com/album/${songUrl.replace('spotify:album:', '').replace('spotify:track:', '')}`;
                    } else {
                        songUrl = `https://open.spotify.com/track/${songUrl.replace('spotify:track:', '').replace('spotify:album:', '')}`;
                    }
                }
                paged_star_list[i][j] = `• **[${paged_star_list[i][j].orig_artists.join(' & ')} - ${paged_star_list[i][j].db_song_name}](<${songUrl}>)**`;
            }

            paged_star_list[i] = paged_star_list[i].join('\n');
        }  

        const starCommandEmbed = new EmbedBuilder()
            .setColor(`${getEmbedColor(taggedMember)}`)
            .setThumbnail(user.avatarURL({ extension: "png" }))
            .setTitle(`🌟 ${taggedMember.displayName}'s Stars 🌟`)
            .setDescription(paged_star_list[page_num]);
            if (paged_star_list.length > 1) {
                starCommandEmbed.setFooter({ text: `Page 1 / ${paged_star_list.length} • ${starList.length} stars given` });
                await interaction.editReply({ content: ` `, embeds: [starCommandEmbed], components: [row] });
            } else {
                starCommandEmbed.setFooter({ text: `${starList.length} stars given` });
                await interaction.editReply({ content: ` `, embeds: [starCommandEmbed], components: [] });
            }
        
        if (paged_star_list.length > 1) {
            let message = await interaction.fetchReply();
        
            const collector = message.createMessageComponentCollector({ time: 360000 });

            collector.on('collect', async i => {
                (i.customId == 'left') ? page_num -= 1 : page_num += 1;
                page_num = _.clamp(page_num, 0, paged_star_list.length - 1);
                starCommandEmbed.setDescription(paged_star_list[page_num]);
                starCommandEmbed.setFooter({ text: `Page ${page_num + 1} / ${paged_star_list.length} • ${starList.length} stars given` });
                i.update({ embeds: [starCommandEmbed] });
            });

            collector.on('end', async () => {
                interaction.editReply({ embeds: [starCommandEmbed], components: [] });
            });
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
	},
};