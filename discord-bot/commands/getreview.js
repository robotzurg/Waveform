const Discord = require('discord.js');
const db = require("../db.js");
const { capitalize } = require('../func.js');

module.exports = {
    name: 'getreview',
    description: 'Get a review from a user on the server that they have written!',
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
            name: 'user',
            type: 'USER',
            description: 'User who made the review. Defaults to yourself.',
            required: false,
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
        let taggedUser = interaction.user;
        let taggedMember = interaction.member;
        let rmxArtists = [];

        await interaction.options.forEach(async (value) => {
            args.push(value.value.trim());
            if (value.name === 'user') {
                taggedMember = await interaction.guild.members.fetch(value.value);
                taggedUser = taggedMember.user;
            } else if (value.name === 'remixers') {
                rmxArtists.push(value.value.split(' & '));
                rmxArtists = rmxArtists.flat(1);
            }
        });

        args[0] = capitalize(args[0]);
        args[1] = capitalize(args[1]);

        let origArtistNames = args[0];
        let songName = args[1];

        /*if (origArtistNames.toLowerCase() === 's') {
            const dbKeyArray = db.reviewDB.keyArray();
            let options = [];
            
            for (let i = 0; i < dbKeyArray.length; i++) {
                let aI = dbKeyArray.length - 1 - i;
                let AsongArray = Object.keys(db.reviewDB.get(dbKeyArray[aI]));
                AsongArray = AsongArray.filter(item => item !== 'Image');

                for (let ii = 0; ii < AsongArray.length; ii++) {
                    let vocalCheck = [db.reviewDB.get(dbKeyArray[aI], `["${AsongArray[ii]}"].vocals`)].flat(1);
                    let collabCheck = db.reviewDB.get(dbKeyArray[aI], `["${AsongArray[ii]}"].collab`);

                    
                    if (Array.isArray(collabCheck)) {
                        collabCheck = collabCheck.toString();
                    }

                    if (AsongArray[ii] === args[1] && !vocalCheck.includes(dbKeyArray[aI]) && !options.includes(`${collabCheck} ${AsongArray[ii]}`)) {
                        origArtistNames = dbKeyArray[aI];
                        songName = AsongArray[ii];
                        options.push([origArtistNames, songName]);
                        options[options.length - 1] = options[options.length - 1].join(' ');
                    } 
                }

                if (options.length > 0) break;
            }
            
            if (options.length === 0) {
                return interaction.editReply('There is no song in the database that exists with this name.');
            } else if (options.length > 1) {
                return interaction.editReply(`Looks like multiple songs of the same name exist in the database. Please use \`/getReview <artist> <song>\` on one of these songs to get the review:\n\`\`\`${options.join('\n')}\`\`\``);
            }
        }*/

        // Format somethings to be more consistent.
        if (songName.includes('(VIP)')) {
            songName = songName.split(' (');
            songName = `${songName[0]} ${songName[1].slice(0, -1)}`;
        }


        let artistArray = origArtistNames.split(' & ');
        if (rmxArtists.length != 0) {
            songName = `${songName} (${rmxArtists.join(' & ')} Remix)`; 
            artistArray = rmxArtists;
        } 

        if (!db.reviewDB.has(artistArray[0])) {
            return interaction.editReply('No artist found.');
        }

        let rname;
        let rreview;
        let rscore;
        let rsentby;
        let rstarred;
        let usrSentBy;
        let thumbnailImage;
        let artistsEmbed = origArtistNames;
        let vocalistsEmbed = [];
        let epfrom = db.reviewDB.get(rmxArtists.length === 0 ? artistArray[0] : rmxArtists, `["${songName}"].EP`);

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

        rname = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].name`);
        if (rname === undefined) return interaction.editReply(`No review found for \`${origArtistNames} - ${songName}\`. *Note that for EP reviews, you need to use \`/getReviewEP\`.*`);
        rreview = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].review`);
        rscore = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].rating`);
        rsentby = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].sentby`);
        rstarred = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].starred`);
        if (rsentby != false) {
            usrSentBy = await interaction.guild.members.cache.get(rsentby);              
        }
        
        if (db.reviewDB.get(artistArray[0], `["${songName}"].art`) != false) {
            thumbnailImage = db.reviewDB.get(artistArray[0], `["${songName}"].art`);
        } else {
            thumbnailImage = taggedUser.avatarURL({ format: "png" });
        }

        const reviewEmbed = new Discord.MessageEmbed()
            .setColor(`${taggedMember.displayHexColor}`);
            if (vocalistsEmbed.length != 0) {
                reviewEmbed.setTitle(`${artistsEmbed} - ${songName} (ft. ${vocalistsEmbed})`);
                if (rstarred === true) {
                    reviewEmbed.setTitle(`:star2: ${artistsEmbed} - ${songName} (ft. ${vocalistsEmbed}) :star2:`);
                }
            } else {
                reviewEmbed.setTitle(`${artistsEmbed} - ${songName}`);
                if (rstarred === true) {
                    reviewEmbed.setTitle(`:star2: ${artistsEmbed} - ${songName} :star2:`);
                }
            }
            
            reviewEmbed.setAuthor(`${rname}'s review`, `${taggedUser.avatarURL({ format: "png" })}`);

            if (rreview != '-') {
                reviewEmbed.setDescription(rreview);
            } else {
                reviewEmbed.setDescription(`Rating: **${rscore}/10**`);
            }

            reviewEmbed.setThumbnail(thumbnailImage);

            if (rreview != '-') reviewEmbed.addField('Rating: ', `**${rscore}/10**`, true);

            if (rsentby != false) {
                reviewEmbed.setFooter(`Sent by ${usrSentBy.displayName}`, `${usrSentBy.user.avatarURL({ format: "png" })}`);
            } else if (epfrom != undefined && epfrom != false) {
                if (db.reviewDB.get(artistArray[0], `["${epfrom}"].Image`) != false && db.reviewDB.get(artistArray[0], `["${epfrom}"].Image`) != undefined) {
                    reviewEmbed.setFooter(`from ${epfrom}`, db.reviewDB.get(artistArray[0], `["${epfrom}"].Image`));
                } else {
                    reviewEmbed.setFooter(`from ${epfrom}`, thumbnailImage);
                }
            }
            
            interaction.editReply({ embeds: [reviewEmbed] });
	},
};