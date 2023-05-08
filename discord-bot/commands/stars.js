const db = require('../db.js');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, SlashCommandBuilder, ButtonStyle } = require('discord.js');
const _ = require('lodash');
const { handle_error, get_user_reviews } = require('../func.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stars')
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

        let starList = [];
        let artistCount = [];
        let songSkip = [];

        let artistArray = db.reviewDB.keyArray();

        for (let i = 0; i < artistArray.length; i++) {
            let songArray = Object.keys(db.reviewDB.get(artistArray[i]));
            songArray = songArray.filter(v => v != 'pfp_image');

            for (let j = 0; j < songArray.length; j++) {
                let songObj = db.reviewDB.get(artistArray[i])[songArray[j]];
                let userArray;
                if (songObj != null && songObj != undefined) {
                    userArray = get_user_reviews(songObj);
                    userArray = userArray.filter(v => v == user.id);
                } else {
                    userArray = [];
                }

                if (songSkip.includes(`${artistArray[i]} - ${songArray[j]}`)) continue;

                let mainArtistArray = [artistArray[i], db.reviewDB.get(artistArray[i])[songArray[j]].collab].flat(1);
                let vocalistArray = db.reviewDB.get(artistArray[i])[songArray[j]].vocals;
                let rmxArtistArray = [];
                if (vocalistArray == undefined) vocalistArray = [];

                let allArtists = mainArtistArray.map(v => {
                    if (v == undefined) {
                        return [];
                    }
                    return v;
                });
                allArtists = allArtists.flat(1);

                mainArtistArray = mainArtistArray.filter(v => !vocalistArray.includes(v));
                if (songArray[j].includes(' Remix)')) {
                    let temp = songArray[j].split(' Remix)')[0].split('(');
                    let rmxArtist = temp[temp.length - 1];
                    rmxArtist = rmxArtist.replace(' VIP', '');
                    rmxArtistArray = [rmxArtist.split(' & ')].flat(1);
                    mainArtistArray = mainArtistArray.filter(v => !rmxArtistArray.includes(v));
                }

                if (userArray.length != 0) {
                    artistCount.push(artistArray[i]);
                    if (songObj[userArray[0]].starred == true) {
                        starList.push(`${mainArtistArray.join(' & ')} - ${songArray[j]}` + 
                        `${vocalistArray.length != 0 ? ` (ft. ${vocalistArray.join(' & ')})` : ``}`);
                    } 
                }

                for (let v = 0; v < allArtists.length; v++) {
                    if (!songSkip.includes(`${allArtists[v]} - ${songArray[j]}`)) {
                        songSkip.push(`${allArtists[v]} - ${songArray[j]}`);
                    }
                }
            }
        }

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
                paged_star_list[i][j] = `• **[${paged_star_list[i][j]}](<https://www.google.com>)**`;
            }

            paged_star_list[i] = paged_star_list[i].join('\n');
        }  

        const starCommandEmbed = new EmbedBuilder()
            .setColor(`${interaction.member.displayHexColor}`)
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