const Discord = require('discord.js');
const db = require("../db.js");
const { capitalize } = require('../func.js');
const numReacts = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

module.exports = {
    name: 'getsong',
    description: 'Get all the data about a song and displays it in an embed message.',
    options: [
        {
            name: 'artist',
            type: 'STRING',
            description: 'The name of the artist.',
            required: true,
        }, {
            name: 'song',
            type: 'STRING',
            description: 'The name of the song.',
            required: true,
        }, {
            name: 'remixers',
            type: 'STRING',
            description: 'Remix artists on the song.',
            required: false,
        }, 
    ],
	admin: false,
	async execute(interaction) {

        let args = [];
        let rmxArtists = [];

        await interaction.options._hoistedOptions.forEach(async (value) => {
            args.push(value.value);
            if (value.name === 'remixers') {
                rmxArtists.push(value.value.split(' & '));
                rmxArtists = rmxArtists.flat(1);
            }
        });

        args[0] = args[0].trim();
        args[1] = args[1].trim();

        let origArtistNames = args[0];
        let origSongName = args[1];
        
        origArtistNames = capitalize(origArtistNames);
        origSongName = capitalize(origSongName);
        
        if (origSongName.includes('EP') || origSongName.includes('LP') || origSongName.toLowerCase().includes('the remixes')) {
            return interaction.editReply('This isn\'t a single! EP reviews are coming soon.');
        }

        // Function to grab average of all ratings later
        let average = (array) => array.reduce((a, b) => a + b) / array.length;

        let artistArray = origArtistNames.split(' & ');
        let songName = origSongName;

        if (rmxArtists.length != 0) {
            artistArray = rmxArtists;
            songName = `${origSongName} (${rmxArtists.join(' & ')} Remix)`;
        }

        for (let i = 0; i < artistArray.length; i++) {
            if (!db.reviewDB.has(artistArray[i])) {
                return interaction.editReply(`The artist \`${artistArray[i]}\` is not in the database, therefore this song isn't either.`);
            }
        }
        
        let songObj;
        let songEP = false;
        let remixArray;
        let remixes = [];
        let fullSongName = false;
        let starCount = 0;

        let artistsEmbed = origArtistNames;
        let vocalistsEmbed = [];

        if (fullSongName === false) {
            fullSongName = songName;
        }

        //Adjust (VIP)
        if (songName.includes('(VIP)')) {
            songName = songName.split(' (');
            songName = `${songName[0]} ${songName[1].slice(0, -1)}`;
        }

        // This is for adding in collaborators/vocalists into the name inputted into the embed title, NOT for getting data out.
        if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`) != undefined) {
            if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`).length != 0) {
                artistsEmbed = [artistArray[0]];
                artistsEmbed.push(db.reviewDB.get(artistArray[0], `["${songName}"].collab`));
                artistsEmbed = artistsEmbed.flat(1);
                if (rmxArtists.length != 0) {
                    artistsEmbed = artistsEmbed.filter(v => !rmxArtists.includes(v));
                }

                artistsEmbed = artistsEmbed.join(' & ');
            }
        }

        if (db.reviewDB.get(artistArray[0], `["${songName}"].vocals`) != undefined) {
            if (db.reviewDB.get(artistArray[0], `["${songName}"].vocals`).length != 0) {
                vocalistsEmbed = [];
                vocalistsEmbed.push(db.reviewDB.get(artistArray[0], `["${songName}"].vocals`));
                vocalistsEmbed = vocalistsEmbed.flat(1);
                vocalistsEmbed = vocalistsEmbed.join(' & ');
            }
        }

        songObj = db.reviewDB.get(artistArray[0], `["${songName}"]`);
        if (songObj === undefined) return interaction.editReply('The requested song does not exist.\nUse `/getArtist` to get a full list of this artist\'s songs.');
        songEP = songObj.ep;
        remixArray = songObj.remixers;

        if (remixArray.length != 0) {
            for (let i = 0; i < remixArray.length; i++) {
                remixes.push(`\`${remixArray[i]} Remix\``);
            }
        }
        if (songEP === undefined || songEP === false) songEP = false;
        
        let userArray = Object.keys(songObj);
        
        userArray = userArray.filter(e => e !== 'ep');
        userArray = userArray.filter(e => e !== 'art');
        userArray = userArray.filter(e => e !== 'remixers');
        userArray = userArray.filter(e => e !== 'collab');
        userArray = userArray.filter(e => e !== 'vocals');
        userArray = userArray.filter(e => e !== 'hof_id');
        userArray = userArray.filter(e => e !== 'review_num');

        let userIDList = Object.keys(songObj);
        
        userIDList = userIDList.filter(e => e !== 'ep');
        userIDList = userIDList.filter(e => e !== 'art');
        userIDList = userIDList.filter(e => e !== 'remixers');
        userIDList = userIDList.filter(e => e !== 'collab');
        userIDList = userIDList.filter(e => e !== 'vocals');
        userIDList = userIDList.filter(e => e !== 'hof_id');
        userIDList = userIDList.filter(e => e !== 'review_num');

        const rankNumArray = [];
        const songEmbed = new Discord.MessageEmbed()
            .setColor(`${interaction.member.displayHexColor}`);

            if (vocalistsEmbed.length != 0) {
                songEmbed.setTitle(`${artistsEmbed} - ${songName} (ft. ${vocalistsEmbed})`);
            } else {
                songEmbed.setTitle(`${artistsEmbed} - ${songName}`);
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
            taggedMemberSel = await interaction.guild.members.fetch(userIDList[i]);
            taggedUserSel = taggedMemberSel.user;
            select_options.push({
                label: `${taggedMemberSel.displayName}`,
                description: `${taggedMemberSel.displayName}'s review of the song.`,
                value: `${taggedUserSel.id}`,
            });
        }

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
    
                if (vocalistsEmbed.length != 0) {
                    if (db.reviewDB.get(artistArray[0], `["${songName}"].["${i.values[0]}"].starred`) === false) {
                        reviewEmbed.setTitle(`${artistsEmbed} - ${songName} (ft. ${vocalistsEmbed})`);
                    } else {
                        reviewEmbed.setTitle(`:star2: ${artistsEmbed} - ${songName} (ft. ${vocalistsEmbed}) :star2:`);
                    }
                } else {
                    if (db.reviewDB.get(artistArray[0], `["${songName}"].["${i.values[0]}"].starred`) === false) {
                        reviewEmbed.setTitle(`${artistsEmbed} - ${songName}`);
                    } else {
                        reviewEmbed.setTitle(`:star2: ${artistsEmbed} - ${songName} :star2:`);
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