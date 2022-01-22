const Discord = require('discord.js');
const db = require("../db.js");
const getAppleMusicLink = require('get-apple-music-link');
const { average, get_user_reviews, parse_artist_song_data, sort } = require('../func.js');
const numReacts = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '**11**', '**12**', '**13**', '**14**', '**15**', '**16**', '**17**', '**18**', '**19**', '**20**'];
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getsong')
        .setDescription('Get all the data about a song and displays it in an embed message.')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setAutocomplete(true)
                .setRequired(true))

        .addStringOption(option => 
            option.setName('song')
                .setDescription('The name of the song.')
                .setAutocomplete(true)
                .setRequired(true))
            
        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('Remix artists on the song, if any.')
                .setAutocomplete(true)
                .setRequired(false)),
	admin: false,
	async execute(interaction) {

        let parsed_args = parse_artist_song_data(interaction);

        let origArtistArray = parsed_args[0];
        let artistArray = parsed_args[2];
        let songName = parsed_args[3];
        let rmxArtistArray = parsed_args[4];
        let vocalistArray = parsed_args[5];

        if (rmxArtistArray == undefined) rmxArtistArray = [];
        if (rmxArtistArray.length != 0) artistArray = rmxArtistArray;

        let songObj;
        let songEP = false;
        let remixArray;
        let remixes = [];
        let starCount = 0;

        songObj = db.reviewDB.get(artistArray[0], `["${songName}"]`);
        if (songObj === undefined) { return interaction.editReply(`The requested song \`${origArtistArray} - ${songName}\` does not exist.` + 
        `\nUse \`/getArtist\` to get a full list of this artist's songs.`); }
        songEP = songObj.ep;
        remixArray = songObj.remixers;

        if (remixArray.length != 0) {
            for (let i = 0; i < remixArray.length; i++) {
                remixes.push(`\`${remixArray[i]} Remix\``);
            }
        }
        if (songEP === undefined || songEP === false) songEP = false;
        
        let userArray = get_user_reviews(songObj);
        let userIDList = userArray.slice(0); //.slice(0) is there to create a COPY, not a REFERENCE.
        const songArt = db.reviewDB.get(artistArray[0], `["${songName}"].art`);

        const rankNumArray = [];
        const songEmbed = new Discord.MessageEmbed()
            .setColor(`${interaction.member.displayHexColor}`);

            console.log(vocalistArray);
            if (vocalistArray.length != 0) {
                songEmbed.setTitle(`${origArtistArray.join(' & ')} - ${songName} (ft. ${vocalistArray.join(' & ')})`);
            } else {
                songEmbed.setTitle(`${origArtistArray.join(' & ')} - ${songName}`);
            }

            for (let i = 0; i < userArray.length; i++) {
                if (userArray[i] != 'EP') {
                    let rating;
                    let starred = false;
                    rating = db.reviewDB.get(artistArray[0], `["${songName}"].["${userArray[i]}"].rating`);
                    if (db.reviewDB.get(artistArray[0], `["${songName}"].["${userArray[i]}"].starred`) === true) {
                        starCount++;
                        starred = true;
                    }
                    rankNumArray.push(parseFloat(rating));

                    if (starred === true) {
                        userArray[i] = [parseFloat(rating) + 1, `:star2: <@${userArray[i]}> \`${rating}/10\``];
                        userIDList[i] = [parseFloat(rating) + 1, userIDList[i]];
                    } else {
                        userArray[i] = [parseFloat(rating), `<@${userArray[i]}> \`${rating}/10\``];
                        userIDList[i] = [parseFloat(rating), userIDList[i]];
                    }
                }
            }
            
            if (rankNumArray.length != 0) {
                songEmbed.setDescription(`*The average rating of this song is* ***${Math.round(average(rankNumArray) * 10) / 10}!***` + 
                `${(starCount == 0 ? `` : `\n:star2: **This song has ${starCount} star${starCount === 1 ? '' : 's'}!** :star2:`)}`);
            } else {
                songEmbed.setDescription(`*The average rating of this song is N/A*`);
            }

            if (userArray != 0) { // Sort it by highest to lowest rating
                
                userArray = sort(userArray);
                userIDList = sort(userIDList);

                for (let i = 0; i < userArray.length; i++) {
                    userArray[i] = `${numReacts[i + 1]} `.concat(userArray[i]);
                }
                
                songEmbed.addField('Reviews:', userArray.join('\n'));
            } else {
                songEmbed.addField('Reviews:', 'No reviews :(');
            }

            if (remixes.length != 0) songEmbed.addField('Remixes:', remixes.join('\n'));

            if (songArt == false) {
                songEmbed.setThumbnail(interaction.user.avatarURL({ format: "png" }));
            } else {
                songEmbed.setThumbnail(songArt);
            }

            if (songEP != false) songEmbed.setFooter(`from ${songEP}`, db.reviewDB.get(artistArray[0], `["${songEP}"].art`));

        // Button/Select Menu setup
        let select_options = [];
        let taggedMemberSel;
        let taggedUserSel;

        for (let i = 0; i < userIDList.length; i++) {
            taggedMemberSel = await interaction.guild.members.fetch(userIDList[i])
            // eslint-disable-next-line no-unused-vars
            .catch(x => taggedMemberSel = 'Invalid Member (They have left the server)');
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

        const row = new Discord.MessageActionRow()
            .addComponents(
                new Discord.MessageSelectMenu()
                    .setCustomId('select')
                    .setPlaceholder('See other reviews by clicking on me!')
                    .addOptions(select_options),
            );

        // Spotify / Apple Music stuff
         
        await getAppleMusicLink.track(`${songName}`, `${origArtistArray[0]}`, function(res, err) {
            if(err) {
                interaction.editReply({ embeds: [songEmbed], components: [row] });
            }
            else{
                interaction.editReply({ /*content: `[Apple Music Link](${res})`,*/ embeds: [songEmbed], components: [row] });
            }
        });

        let message = await interaction.fetchReply();
       
		const collector = message.createMessageComponentCollector({ componentType: 'SELECT_MENU', time: 60000 });

		collector.on('collect', async i => {
			if (i.customId === 'select') { // Select Menu

                if (i.values[0] === 'back') { // Back Selection
                    return await i.update({ content: ` `, embeds: [songEmbed], components: [row] });
                }
                
                const taggedMember = await interaction.guild.members.fetch(i.values[0]);
                const taggedUser = taggedMember.user;
                const starred = db.reviewDB.get(artistArray[0], `["${songName}"].["${i.values[0]}"].starred`);
                const review = db.reviewDB.get(artistArray[0], `["${songName}"].["${i.values[0]}"].review`);
                const rating = db.reviewDB.get(artistArray[0], `["${songName}"].["${i.values[0]}"].rating`);
                let sentby = db.reviewDB.get(artistArray[0], `["${songName}"].["${i.values[0]}"].sentby`);
                const url = db.reviewDB.get(artistArray[0], `["${songName}"].["${i.values[0]}"].url`);
                if (sentby != false) {
                    sentby = await interaction.guild.members.cache.get(sentby);              
                }

                const reviewEmbed = new Discord.MessageEmbed()
                .setColor(`${taggedMember.displayHexColor}`);
    
                if (starred === false) {
                    reviewEmbed.setTitle(`${origArtistArray.join(' & ')} - ${songName}${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}`);
                } else {
                    reviewEmbed.setTitle(`:star2: ${origArtistArray.join(' & ')} - ${songName}${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``} :star2:`);
                }
    
                reviewEmbed.setAuthor(`${taggedMember.displayName}'s review`, `${taggedUser.avatarURL({ format: "png" })}`);
    
                if (review != '-') {
                    reviewEmbed.setDescription(`${review}`);
                } else {
                    reviewEmbed.setDescription(`Rating: **${rating}/10**`);
                }
    
                reviewEmbed.setThumbnail((songArt == false) ? interaction.user.avatarURL({ format: "png" }) : songArt);
                if (review != '-') reviewEmbed.addField('Rating: ', `**${rating}/10**`, true);

                if (sentby != false) {
                    reviewEmbed.setFooter(`Sent by ${sentby.displayName}`, `${sentby.user.avatarURL({ format: "png" })}`);
                } else if (songEP != undefined && songEP != false) {
                    reviewEmbed.setFooter(`from ${songEP}`, db.reviewDB.get(artistArray[0], `["${songEP}"].art`));
                }

                let reviewMsgID = db.reviewDB.get(artistArray[0], `["${songName}"].["${i.values[0]}"].msg_id`);
                console.log(reviewMsgID);
                if (reviewMsgID != false && reviewMsgID != undefined) {
                    let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));
                    await channelsearch.messages.fetch(`${reviewMsgID}`).then(async msg => {
                        reviewEmbed.setTimestamp(msg.createdTimestamp);
                    }).catch(async () => {
                        channelsearch = interaction.guild.channels.cache.get(db.user_stats.get(i.values[0], 'mailbox'));
                        await channelsearch.messages.fetch(`${reviewMsgID}`).then(msg => {
                            reviewEmbed.setTimestamp(msg.createdTimestamp);
                        }).catch(() => {});
                    });
                }
                
                if (url === undefined) {
                    await i.update({ embeds: [reviewEmbed], components: [row] });
                } else {
                    await i.update({ content: `[View Review Message](${url})`, embeds: [reviewEmbed], components: [row] });
                }

			} 
		});

		collector.on('end', async () => {
            interaction.editReply({ content: ` `, embeds: [songEmbed], components: [] });
        });
	},
};
