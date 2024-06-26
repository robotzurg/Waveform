const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, EmbedBuilder, ButtonStyle } = require('discord.js');
const db = require('../db.js');
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hall-of-fame')
        .setDescription('View the server hall of fame!')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
			subcommand.setName('list_view')
				.setDescription('View the server hall of fame in list view.'))
        .addSubcommand(subcommand =>
            subcommand.setName('card_view')
                .setDescription('View the server hall of fame in card view.')),
    help_desc: 'Pulls up the servers hall of fame, which is compromised of all songs reviewed in the server that have 3 or more favorites from server members.\n\n' + 
    `Can be viewed in a card view (leaving the list_view argument blank), which displays each song one by one in a fancy card view, or can be viewed in a list view using the \`list_view\` argument for a more concise viewing.`,
	async execute(interaction) {
        await interaction.deferReply();
        
        let hofList = db.server_settings.get(interaction.guild.id, 'hall_of_fame');
        let subcommand = interaction.options.getSubcommand();
        let listView = (subcommand == 'list_view' ? true : false);

        if (hofList.length == 0) {
            interaction.editReply('There are no songs in your servers hall of fame.');
            return;
        }

        let page_num = 0;
        let row;
        let hofCommandEmbed;
        let pagedHofList;

        hofList.sort((a, b) => {
            return b.star_count - a.star_count;
        });

        row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('left')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⬅️'),
                new ButtonBuilder()
                    .setCustomId('choose')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('right')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('➡️'),
            );

        if (listView == true) {
            hofList = hofList.map(v => `-  \`${v.star_count}⭐\` **[${v.orig_artists.join(' & ')} - ${v.db_song_name}](${v.song_url})**`);
            pagedHofList = _.chunk(hofList, 10);

            hofCommandEmbed = new EmbedBuilder()
                .setColor(`#ffff00`)
                .setTitle(`Hall of Fame for ${interaction.guild.name}`)
                .setThumbnail(interaction.guild.iconURL())
                .setDescription(pagedHofList[0].join('\n'))
                .setFooter({ text: `Page 1 / ${pagedHofList.length}` });
        } else {
            pagedHofList = hofList;
            hofCommandEmbed = new EmbedBuilder()
                .setColor(`#ffff00`)
                .setTitle(`${hofList[0].orig_artists.join(' & ')} - ${hofList[0].db_song_name}`)
                .setDescription(`This song currently has **${hofList[0].star_count}** favorites 🌟` + 
                `${hofList[0].song_url == false ? `` : `\n<:spotify:899365299814559784> [Spotify](${hofList[0].song_url})`}`)
                .addFields({ name: 'Favorited Reviews:', value: hofList[0].user_stars.map(v => `🌟 <@${v.id}> \`${v.rating}/10\``).join('\n') })
                .setImage(hofList[0].art)
                .setFooter({ text: `Page 1 / ${hofList.length} • Use the middle button to select a page!` });
        }
        
        interaction.editReply({ content: null, embeds: [hofCommandEmbed], components:[row] });

        let message = await interaction.fetchReply();
        const collector = message.createMessageComponentCollector({ idle: 120000 });

        collector.on('collect', async i => {
            if (i.customId == 'left') { 
                page_num -= 1; 
                if (page_num < 0) page_num = hofList.length - 1;
            }
            else if (i.customId == 'right') { 
                page_num += 1;
                if (page_num > hofList.length - 1) page_num = 0;
            }
            else { // If its the choose your own page customId
                const filter = m => m.author.id == interaction.user.id;
                let pagenum_collector = interaction.channel.createMessageCollector({ filter: filter, max: 1, time: 60000 });
                i.update({ content: `Type in what page number you'd like to jump to, from 1-${listView == true ? pagedHofList.length : hofList.length}`, embeds: [], components: [] });

                pagenum_collector.on('collect', async m => {
                    let num = m.content;
                    if (isNaN(num)) num = 1;
                    page_num = parseInt(num) - 1;
                    page_num = _.clamp(page_num, 0, hofList.length - 1);

                    if (listView == true) {
                        hofCommandEmbed = new EmbedBuilder()
                            .setColor(`#ffff00`)
                            .setTitle(`Hall of Fame for ${interaction.guild.name}`)
                            .setDescription(pagedHofList[page_num].join('\n'))
                            .setThumbnail(interaction.guild.iconURL())
                            .setFooter({ text: `Page ${page_num + 1} / ${pagedHofList.length}` });
                    } else {
                        hofCommandEmbed = new EmbedBuilder()
                            .setColor(`#ffff00`)
                            .setTitle(`${hofList[page_num].orig_artists.join(' & ')} - ${hofList[page_num].db_song_name}`)
                            .setDescription(`This song currently has **${hofList[page_num].star_count}** favorites 🌟` + 
                            `${hofList[page_num].song_url == false ? `` : `\n<:spotify:899365299814559784> [Spotify](${hofList[page_num].song_url})`}`)
                            .addFields({ name: 'Favorited Reviews:', value: hofList[page_num].user_stars.map(v => `🌟 <@${v.id}> \`${v.rating}/10\``).join('\n') })
                            .setImage(hofList[page_num].art)
                            .setFooter({ text: `Page ${page_num + 1} / ${hofList.length} • Use the middle button to select a page!` });
                    }
                    
                    m.delete();
                    interaction.editReply({ content: null, embeds: [hofCommandEmbed], components: [row] });
                });
            }

            if (i.customId != 'choose') {
                page_num = _.clamp(page_num, 0, pagedHofList.length - 1);

                if (listView == true) {
                    hofCommandEmbed = new EmbedBuilder()
                        .setColor(`#ffff00`)
                        .setTitle(`Hall of Fame for ${interaction.guild.name}`)
                        .setDescription(pagedHofList[page_num].join('\n'))
                        .setThumbnail(interaction.guild.iconURL())
                        .setFooter({ text: `Page ${page_num + 1} / ${pagedHofList.length}` });
                } else {
                    hofCommandEmbed = new EmbedBuilder()
                        .setColor(`#ffff00`)
                        .setTitle(`${hofList[page_num].orig_artists.join(' & ')} - ${hofList[page_num].db_song_name}`)
                        .setDescription(`This song currently has **${hofList[page_num].star_count}** favorites 🌟` +
                        `${hofList[page_num].song_url == false ? `` : `\n<:spotify:899365299814559784> [Spotify](${hofList[page_num].song_url})`}`)
                        .addFields({ name: 'Favorited Reviews:', value: hofList[page_num].user_stars.map(v => `🌟 <@${v.id}> \`${v.rating}/10\``).join('\n') })
                        .setImage(hofList[page_num].art)
                        .setFooter({ text: `Page ${page_num + 1} / ${hofList.length} • Use the middle button to select a page!` });
                }
            
                i.update({ embeds: [hofCommandEmbed] });
            }
        });

        collector.on('end', async () => {
            interaction.editReply({ embeds: [hofCommandEmbed], components: [] });
        });
    },
};


// // Func.js functions for hall of fame
// async function hallOfFameCheck(interaction, client, guild_id, dbArtistArray, origArtistArray, rmxArtistArray, songName) {
//     const { get_user_reviews, convertToSetterName } = require('./func.js');
//     // Check if the song was added to hall of fame
//     let setterSongName = convertToSetterName(songName);
//     let songObj = db.reviewDB.get(dbArtistArray[0], `${setterSongName}`);
//     if (songObj == undefined) {
//         return [false, {}];
//     }

//     let guild = client.guilds.cache.get(guild_id);
//     let userReviews = await get_user_reviews(songObj, guild);
//     let songUrl = songObj.spotify_uri;
//     if (songUrl == undefined || songUrl == false) {
//         songUrl = 'https://www.google.com';
//     } else {
//         songUrl = `https://open.spotify.com/track/${songUrl.replace('spotify:track:', '')}`;
//     }

//     let starCount = 0;
//     let ratingAvg = [];
//     let userStarList = [];
//     let userRevObj;
//     for (let userRev of userReviews) {
//         userRevObj = songObj[userRev];

//         //if (userRevObj.guild_id != guild_id) continue;
//         if (userRevObj.rating != false) ratingAvg.push(parseInt(userRevObj.rating));
//         if (userRevObj.starred == true) {
//             starCount += 1;
//             userStarList.push({ id: userRev, rating: parseInt(userRevObj.rating) });
//         }
//     }

//     // Check to see if its already in hall of fame
//     let hallOfFameServerList = db.server_settings.get(guild_id, 'hall_of_fame');
//     let inHof = false;
//     for (let hofData of hallOfFameServerList) {
//         if (`${hofData.orig_artists.join(' & ')} - ${hofData.db_song_name}` == `${origArtistArray.join(' & ')} - ${songName}`) {
//             inHof = true;
//             break;
//         }
//     }

//     let hallOfFameData = { 
//         db_artists: dbArtistArray,
//         orig_artists: origArtistArray,
//         rmx_artists: rmxArtistArray,
//         db_song_name: songName,
//         art: songObj.art,
//         rating_avg: _.mean(ratingAvg).toFixed(2), 
//         star_count: starCount,
//         user_stars: userStarList,
//         song_url: songUrl,
//     };

//     if (starCount >= 3 && inHof == false) {
//         db.server_settings.push(guild_id, hallOfFameData, 'hall_of_fame');
//     } else if (starCount < 3 && inHof == true) {
//         // Needs to be removed
//         for (let hofData of hallOfFameServerList) {
//             if (hofData.db_song_name == hallOfFameData.db_song_name) {
//                 hallOfFameServerList = hallOfFameServerList.filter(v => {
//                     v.db_song_name == hallOfFameData.db_song_name;
//                 });
//                 break;
//             }
//         }
        
//         db.server_settings.set(guild_id, hallOfFameServerList, 'hall_of_fame');
//     } else if (starCount >= 3 && inHof == true) { 
//         // Need to update the user list
//         for (let i = 0; i < hallOfFameServerList.length; i++) {
//             if (hallOfFameServerList[i].db_song_name == hallOfFameData.db_song_name) {
//                 hallOfFameServerList[i] = hallOfFameData;
//             }
//         }

//         db.server_settings.set(guild_id, hallOfFameServerList, 'hall_of_fame');
//     }
// };