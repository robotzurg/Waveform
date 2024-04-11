const db = require('../db.js');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, SlashCommandBuilder, ButtonStyle } = require('discord.js');
const _ = require('lodash');
const { handle_error, getEmbedColor } = require('../func.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('favoritelist')
        .setDescription('Get a list of all favorites a user has given.')
        .setDMPermission(false)
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to see favorites from. (Optional, Defaults to yourself)')
                .setRequired(false)),
    help_desc: `View a list of every song a specified server user has favorited on Waveform.\n\n` + 
    `You can view another server users list of favorited songs using the \`user\` argument, leaving it blank will default to your own list.`,
	async execute(interaction, client) {

        try {
        let user = interaction.options.getUser('user');

        if (user == null) user = interaction.user;
        let taggedMember;

        if (user != null) {
            taggedMember = await interaction.guild.members.fetch(user.id);
        } else {
            taggedMember = interaction.member;
        }

        let starList = db.user_stats.get(user.id, 'stats.star_list');
        if (starList.length === 0) return interaction.reply('You don\'t currently have any songs favorited. To favorite a song, use `/setfavorite` or click on the star button when reviewing!\nA favorite is basically a marker to mark songs you really really like! Use it to mark your top favorite songs!');
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
            .setTitle(`🌟 ${taggedMember.displayName}'s Favorites 🌟`)
            .setDescription(paged_star_list[page_num]);
            if (paged_star_list.length > 1) {
                starCommandEmbed.setFooter({ text: `Page 1 / ${paged_star_list.length} • ${starList.length} favorites given` });
                await interaction.reply({ content: ` `, embeds: [starCommandEmbed], components: [row] });
            } else {
                starCommandEmbed.setFooter({ text: `${starList.length} favorites given` });
                await interaction.reply({ content: ` `, embeds: [starCommandEmbed], components: [] });
            }
        
        if (paged_star_list.length > 1) {
            let message = await interaction.fetchReply();
        
            const collector = message.createMessageComponentCollector({ idle: 120000 });

            collector.on('collect', async i => {
                (i.customId == 'left') ? page_num -= 1 : page_num += 1;
                page_num = _.clamp(page_num, 0, paged_star_list.length - 1);
                starCommandEmbed.setDescription(paged_star_list[page_num]);
                starCommandEmbed.setFooter({ text: `Page ${page_num + 1} / ${paged_star_list.length} • ${starList.length} favorites given` });
                i.update({ embeds: [starCommandEmbed] });
            });

            collector.on('end', async () => {
                interaction.editReply({ embeds: [starCommandEmbed], components: [] });
            });
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, client, error);
        }
	},
};