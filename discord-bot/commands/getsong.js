const db = require("../db.js");
const { average, get_user_reviews, parse_artist_song_data, sort, handle_error, find_review_channel } = require('../func.js');
const numReacts = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '**11**', '**12**', '**13**', '**14**', '**15**', '**16**', '**17**', '**18**', '**19**', '**20**'];
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getsong')
        .setDescription('Get data about a song.')
        .setDMPermission(false)
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setAutocomplete(true)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('song_name')
                .setDescription('The name of the song.')
                .setAutocomplete(true)
                .setRequired(false))
            
        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('Remix artists on the song, if any.')
                .setAutocomplete(true)
                .setRequired(false)),
    help_desc: `TBD`,
	async execute(interaction) {
        try {

        let artists = interaction.options.getString('artist');
        let song = interaction.options.getString('song_name');
        let remixers = interaction.options.getString('remixers');
        let song_info = await parse_artist_song_data(interaction, artists, song, remixers);
        if (song_info.error != undefined) {
            await interaction.reply(song_info.error);
            return;
        }

        let origArtistArray = song_info.prod_artists;
        let songName = song_info.song_name;
        let artistArray = song_info.db_artists;
        let displaySongName = song_info.display_song_name;

        let songObj;
        let songEP = false;
        let remixArray;
        let remixes = [];
        let starCount = 0;

        songObj = db.reviewDB.get(artistArray[0])[songName];
        if (songObj == undefined) { return interaction.reply(`The requested song \`${origArtistArray.join(' & ')} - ${songName}\` does not exist.` + 
        `\nUse \`/getArtist\` to get a full list of this artist's songs.`); }

        // See if we have any VIPs
        let artistSongs = Object.keys(db.reviewDB.get(artistArray[0]));
        let songVIP = false;
        for (let s of artistSongs) {
            if (s.includes('VIP') && s.includes(songName) && s != songName) songVIP = s;
        }

        songEP = songObj.ep;
        remixArray = songObj.remixers;
        if (remixArray == undefined) {
            remixArray = [];
        }

        if (remixArray.length != 0) {
            for (let i = 0; i < remixArray.length; i++) {
                remixes.push(`\`${remixArray[i]} Remix\``);
            }
        }
        if (songEP == undefined || songEP == false) songEP = false;
        
        let userArray = get_user_reviews(songObj);
        let userIDList = userArray.slice(0); //.slice(0) is there to create a COPY, not a REFERENCE.
        const songArt = songObj.art;

        const rankNumArray = [];
        const songEmbed = new EmbedBuilder()
        .setColor(`${interaction.member.displayHexColor}`)
        .setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);

        for (let i = 0; i < userArray.length; i++) {
            if (userArray[i] != 'EP') {
                let rating;
                let ratingDisplay;
                let starred = false;
                rating = songObj[userArray[i]].rating;
                if (songObj[userArray[i]].starred == true) {
                    starCount++;
                    starred = true;
                }

                if (rating === false) {
                    ratingDisplay = 'No Rating';
                    rating = -100 - i; // To put it on the bottom of the rating list.
                } else {
                    rankNumArray.push(parseFloat(rating)); 
                    ratingDisplay = `${rating}/10`;
                }

                if (starred == true) {
                    userArray[i] = [parseFloat(rating) + 1, `:star2: <@${userArray[i]}> \`${ratingDisplay}\``];
                    userIDList[i] = [parseFloat(rating) + 1, userIDList[i]];
                } else {
                    userArray[i] = [parseFloat(rating), `<@${userArray[i]}> \`${ratingDisplay}\``];
                    userIDList[i] = [parseFloat(rating), userIDList[i]];
                }
            }
        }
        
        if (rankNumArray.length != 0) {
            songEmbed.setDescription(`*The average rating of this song is* ***${Math.round(average(rankNumArray) * 10) / 10}!***` + 
            `${(starCount == 0 ? `` : `\n:star2: **This song has ${starCount} star${starCount == 1 ? '' : 's'}!** :star2:`)}`);
        } else {
            songEmbed.setDescription(`*The average rating of this song is N/A*`);
        }

        if (userArray != 0) { // Sort it by highest to lowest rating
            
            userArray = sort(userArray);
            userIDList = sort(userIDList);

            for (let i = 0; i < userArray.length; i++) {
                userArray[i] = `${numReacts[i + 1]} `.concat(userArray[i]);
            }

            songEmbed.addFields([{ name: 'Reviews:', value: userArray.join('\n') }]);
        } else {
            songEmbed.addFields([{ name: 'Reviews:', value: 'No reviews :(' }]);
        }

        if (remixes.length != 0) songEmbed.addFields([{ name: 'Remixes:', value: remixes.join('\n') }]);
        if (songVIP != false) songEmbed.addFields([{ name: 'VIP:', value: `\`${songVIP}\`` }]);

        if (songArt == false) {
            songEmbed.setThumbnail(interaction.user.avatarURL({ extension: "png" }));
        } else {
            songEmbed.setThumbnail(songArt);
        }

        if (songEP != false) {
            songEmbed.setFooter({ text: `from ${songEP}`, iconURL: db.reviewDB.get(artistArray[0])[songEP].art });
        }

        // Button/Select Menu setup
        let select_options = [];
        let taggedMemberSel;
        let taggedUserSel;

        for (let i = 0; i < userIDList.length; i++) {
            taggedMemberSel = await interaction.guild.members.fetch(userIDList[i])
            .catch(() => taggedMemberSel = 'Invalid Member (They have left the server)');
            if (taggedMemberSel != 'Invalid Member (They have left the server)') {
                taggedUserSel = taggedMemberSel.user;
            }

            if (taggedMemberSel != 'Invalid Member (They have left the server)') {
                select_options.push({
                    label: `${taggedMemberSel.displayName}`,
                    description: `${taggedMemberSel.displayName}'s review of the song.`,
                    value: `${taggedUserSel.id}`,
                });
            }
        }

        select_options.push({
            label: `Back`,
            description: `Go back to the main song data menu.`,
            value: `back`,
        });

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select')
                    .setPlaceholder('See other reviews by clicking on me!')
                    .addOptions(select_options),
            );

        interaction.reply({ embeds: [songEmbed], components: [row] });

        let message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({ time: 360000 });
        collector.on('collect', async i => {
            if (i.customId == 'select') { // Select Menu

                if (i.values[0] == 'back') { // Back Selection
                    return await i.update({ content: ` `, embeds: [songEmbed], components: [row] });
                }
                
                const taggedMember = await interaction.guild.members.fetch(i.values[0]);
                const taggedUser = taggedMember.user;
                let starred = songObj[i.values[0]].starred;
                let review = songObj[i.values[0]].review;
                let rating = songObj[i.values[0]].rating;
                let sentby = songObj[i.values[0]].sentby;
                let url = songObj[i.values[0]].url;
                
                // If we don't have a single review link, we can check for an EP/LP review link
                if (url == false && (songEP != false && songEP != undefined)) {
                    let songEPObj = db.reviewDB.get(artistArray[0])[songEP];
                    if (songEPObj[`${interaction.user.id}`] != undefined) {
                        if (songEPObj[`${interaction.user.id}`].url != false) {
                            url = songEPObj[`${interaction.user.id}`].url;
                        }
                    }
                }

                if (sentby != false) {
                    sentby = await interaction.guild.members.cache.get(sentby);              
                }

                const reviewEmbed = new EmbedBuilder()
                .setColor(`${taggedMember.displayHexColor}`);
    
                if (starred == false) {
                    reviewEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                } else {
                    reviewEmbed.setTitle(`:star2: ${origArtistArray.join(' & ')} - ${displaySongName} :star2:`);
                }
    
                reviewEmbed.setAuthor({ name: `${taggedMember.displayName}'s review`, iconURL: `${taggedUser.avatarURL({ extension: "png" })}` });
    
                if (rating !== false) reviewEmbed.addFields([{ name: 'Rating: ', value: `**${rating}/10**`, inline: true }]);
                if (review != false) reviewEmbed.setDescription(review);
    
                reviewEmbed.setThumbnail((songArt == false) ? interaction.user.avatarURL({ extension: "png" }) : songArt);

                if (sentby != false) {
                    reviewEmbed.setFooter({ text: `Sent by ${sentby.displayName}`, iconURL: `${sentby.user.avatarURL({ extension: "png" })}` });
                } else if (songEP != undefined && songEP != false) {
                    reviewEmbed.setFooter({ text: `from ${songEP}`, iconURL: db.reviewDB.get(artistArray[0])[songEP].art });
                }

                let reviewMsgID = songObj[i.values[0]][`msg_id`];
                if (reviewMsgID != false && reviewMsgID != undefined) {
                    let channelsearch = await find_review_channel(interaction, i.values[0], reviewMsgID);
                    if (channelsearch != undefined) {
                        await channelsearch.messages.fetch(`${reviewMsgID}`).then(async msg => {
                            reviewEmbed.setTimestamp(msg.createdTimestamp);
                        });
                    }
                }

                if (url == undefined || url == false) {
                    await i.update({ embeds: [reviewEmbed], components: [row] });
                } else {
                    await i.update({ content: `[View Review Message](${url})`, embeds: [reviewEmbed], components: [row] });
                }

            } 
        });

        collector.on('end', async () => {
            interaction.editReply({ content: ` `, embeds: [songEmbed], components: [] });
        });

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
	},
};
