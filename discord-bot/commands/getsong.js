const Discord = require('discord.js');
const db = require("../db.js");
const { average, get_user_reviews, parse_artist_song_data } = require('../func.js');
const numReacts = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getsong')
        .setDescription('Get all the data about a song and displays it in an embed message.')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setRequired(true))

        .addStringOption(option => 
            option.setName('song')
                .setDescription('The name of the song.')
                .setRequired(true))
            
        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('Remix artists on the song, if any.')
                .setRequired(false)),
	admin: false,
	async execute(interaction) {
        
        let parsed_args = parse_artist_song_data(interaction);

        let artistArg = parsed_args[0];
        let songArg = parsed_args[1];
        let artistArray = parsed_args[2];
        let songName = parsed_args[3];
        let rmxArtistArray = parsed_args[4];
        let vocalistArray = parsed_args[5];

        let songObj;
        let songEP = false;
        let remixArray;
        let remixes = [];
        let starCount = 0;

        songObj = db.reviewDB.get(artistArray[0], `["${songName}"]`);
        if (songObj === undefined) return interaction.editReply(`The requested song \`${artistArg} - ${songName}\` does not exist.\nUse \`/getArtist\` to get a full list of this artist's songs.`);
        songEP = songObj.ep;
        remixArray = songObj.remixers;

        if (remixArray.length != 0) {
            for (let i = 0; i < remixArray.length; i++) {
                remixes.push(`\`${remixArray[i]} Remix\``);
            }
        }
        if (songEP === undefined || songEP === false) songEP = false;
        
        let userArray = get_user_reviews(songObj);
        let userIDList = userArray;

        const rankNumArray = [];
        const songEmbed = new Discord.MessageEmbed()
            .setColor(`${interaction.member.displayHexColor}`);

            if (vocalistArray.length != 0) {
                songEmbed.setTitle(`${artistArg} - ${songName} (ft. ${vocalistArray.join(' & ')})`);
            } else {
                songEmbed.setTitle(`${artistArg} - ${songName}`);
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
                        userArray[i] = [parseFloat(rating) + 1, `${numReacts[i + 1]} :star2: <@${userArray[i]}> \`${rating}/10\``];
                        userIDList[i] = [parseFloat(rating) + 1, userIDList[i]];
                    } else {
                        userArray[i] = [parseFloat(rating), `${numReacts[i + 1]} <@${userArray[i]}> \`${rating}/10\``];
                        userIDList[i] = [parseFloat(rating), userIDList[i]];
                    }
                }
            }
            
            if (rankNumArray.length != 0) {
                if (starCount != 0) {
                    songEmbed.setDescription(`*The average rating of this song is* ***${Math.round(average(rankNumArray) * 10) / 10}!***\n:star2: **This song has ${starCount} star${starCount === 1 ? '' : 's'}!** :star2:`);
                } else {
                    songEmbed.setDescription(`*The average rating of this song is* ***${Math.round(average(rankNumArray) * 10) / 10}!***`);
                }
            } else {
                songEmbed.setDescription(`*The average rating of this song is N/A*`);
            }

            if (userArray != 0) { // Sort it by highest to lowest rating

                userArray = userArray.sort(function(a, b) {
                    return b[0] - a[0];
                });

                userIDList = userIDList.sort(function(a, b) {
                    return b[0] - a[0];
                });
    
                userArray = userArray.flat(1);
                userIDList = userIDList.flat(1);
    
                for (let i = 0; i <= userArray.length; i++) {
                    userArray.splice(i, 1);
                }

                for (let i = 0; i <= userIDList.length; i++) {
                    userIDList.splice(i, 1);
                }

                let songText;
                for (let i = 0; i < userArray.length; i++) {
                    songText = userArray[i].split(' ');
                    songText[0] = numReacts[i + 1];
                    userArray[i] = songText.join(' ');
                }
                
            
                songEmbed.addField('Reviews:', userArray.join('\n'));
            } else {
                songEmbed.addField('Reviews:', 'No reviews :(');
            }

            if (remixes.length != 0) {
                songEmbed.addField('Remixes:', remixes.join('\n'));
            } 

            if ((db.reviewDB.get(artistArray[0], `["${songName}"].art`)) === false) {
                songEmbed.setThumbnail(interaction.user.avatarURL({ format: "png" }));
                if (songEP != false) {
                    songEmbed.setFooter(`from ${songEP}`, db.reviewDB.get(artistArray[0], `["${songEP}"].art`));
                }
            } else {
                songEmbed.setThumbnail(db.reviewDB.get(artistArray[0], `["${songName}"].art`));
                if (songEP != false) {
                    songEmbed.setFooter(`from ${songEP}`, db.reviewDB.get(artistArray[0], `["${songEP}"].art`));
                }
            }

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

        interaction.editReply({ embeds: [songEmbed], components: [row] });
       
        // const filter = i => i.user.id === interaction.user.id;
		const collector = interaction.channel.createMessageComponentCollector({ time: 60000 });

		collector.on('collect', async i => {
			if (i.customId === 'select') { // Select Menu

                if (i.values[0] === 'back') { // Back Selection
                    return await i.update({ embeds: [songEmbed], components: [row] });
                }
                
                const taggedMember = await interaction.guild.members.fetch(i.values[0]);
                const taggedUser = taggedMember.user;

                const reviewEmbed = new Discord.MessageEmbed()
                .setColor(`${taggedMember.displayHexColor}`);
    
                if (vocalistArray.length != 0) {
                    if (db.reviewDB.get(artistArray[0], `["${songName}"].["${i.values[0]}"].starred`) === false) {
                        reviewEmbed.setTitle(`${artistArray.join(' & ')} - ${songName} (ft. ${vocalistArray})`);
                    } else {
                        reviewEmbed.setTitle(`:star2: ${artistArray.join(' & ')} - ${songName} (ft. ${vocalistArray}) :star2:`);
                    }
                } else {
                    if (db.reviewDB.get(artistArray[0], `["${songName}"].["${i.values[0]}"].starred`) === false) {
                        reviewEmbed.setTitle(`${artistArray.join(' & ')} - ${songName}`);
                    } else {
                        reviewEmbed.setTitle(`:star2: ${artistArray.join(' & ')} - ${songName} :star2:`);
                    }
                }
    
                reviewEmbed.setAuthor(`${taggedMember.displayName}'s review`, `${taggedUser.avatarURL({ format: "png" })}`);
    
                if (db.reviewDB.get(artistArray[0], `["${songName}"].["${i.values[0]}"].review`) != '-') {
                    reviewEmbed.setDescription(db.reviewDB.get(artistArray[0], `["${songName}"].["${i.values[0]}"].review`));
                } else {
                    reviewEmbed.setDescription(`Rating: **${db.reviewDB.get(artistArray[0], `["${songName}"].["${i.values[0]}"].rating`)}/10**`);
                }
    
                if ((db.reviewDB.get(artistArray[0], `["${songName}"].art`)) === false) {
                    reviewEmbed.setThumbnail(interaction.user.avatarURL({ format: "png" }));
                } else {
                    reviewEmbed.setThumbnail(db.reviewDB.get(artistArray[0], `["${songName}"].art`));
                }
    
                if (db.reviewDB.get(artistArray[0], `["${songName}"].["${i.values[0]}"].review`) != '-') reviewEmbed.addField('Rating: ', `**${db.reviewDB.get(artistArray[0], `["${songName}"].["${i.values[0]}"].rating`)}/10**`, true);
    
                await i.update({ embeds: [reviewEmbed], components: [row] });

			} 
		});

		collector.on('end', async collected => {
            console.log(`Collected ${collected.size} items`);
            await interaction.editReply({ embeds: [songEmbed], components: [] });
        });
	},
};
