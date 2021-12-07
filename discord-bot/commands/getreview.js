const Discord = require('discord.js');
const db = require("../db.js");
const { capitalize, parse_spotify } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getreview')
        .setDescription('Get a review someone has written in the database!')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setRequired(true))

        .addStringOption(option => 
            option.setName('song')
                .setDescription('The name of the song.')
                .setRequired(true))
            
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User who made the review. Defaults to yourself.')
                .setRequired(false))

        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('Remix artists on the song.')
                .setRequired(false)),
                
	admin: false,
	async execute(interaction) {
        let args = [];
        let taggedUser = interaction.user;
        let taggedMember = interaction.member;
        let rmxArtists = [];
        let spotifyCheck = false;

        await interaction.options._hoistedOptions.forEach(async (value) => {
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

        // Spotify Check
        if (args[0].toLowerCase() === 's' || args[1].toLowerCase() === 's') {
            interaction.member.presence.activities.forEach((activity) => {
                if (activity.type === 'LISTENING' && activity.name === 'Spotify' && activity.assets !== null) {
                    let sp_data = parse_spotify(activity);
                    
                    if (args[0].toLowerCase() === 's') args[0] = sp_data[0];
                    if (args[1].toLowerCase() === 's') args[1] = sp_data[1];
                    spotifyCheck = true;
                }
            });
        }

        if (spotifyCheck === false && (args[0].toLowerCase() === 's' || args[1].toLowerCase() === 's')) {
            return interaction.editReply('Spotify status not detected, please type in the artist/song name manually or fix your status!');
        }

        let origArtistNames = args[0];
        if (Array.isArray(origArtistNames)) origArtistNames = origArtistNames.join(' & ');
        let songName = args[1];

        console.log(origArtistNames);
        console.log(songName);

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
            return interaction.editReply(`The artist \`${artistArray[0]}\` was not found in the database.`);
        }

        let rname;
        let rreview;
        let rscore;
        let rsentby;
        let rstarred;
        let rurl;
        let usrSentBy;
        let thumbnailImage;
        let artistsEmbed = origArtistNames;
        let vocalistsEmbed = [];
        let epfrom = db.reviewDB.get(rmxArtists.length === 0 ? artistArray[0] : rmxArtists, `["${songName}"].ep`);

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
        rurl = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].url`);
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
                reviewEmbed.setFooter(`Sent by ${usrSentBy.displayName}${rurl != undefined}`, `${usrSentBy.user.avatarURL({ format: "png" })}`);
            } else if (epfrom != undefined && epfrom != false) {
                if (db.reviewDB.get(artistArray[0], `["${epfrom}"].Image`) != false && db.reviewDB.get(artistArray[0], `["${epfrom}"].Image`) != undefined) {
                    reviewEmbed.setFooter(`from ${epfrom}`, db.reviewDB.get(artistArray[0], `["${epfrom}"].Image`));
                } else {
                    reviewEmbed.setFooter(`from ${epfrom}`, thumbnailImage);
                }
            }
            
            if (rurl === undefined) {
                interaction.editReply({ embeds: [reviewEmbed] });
            } else {
                interaction.editReply({ content: `[View Review Message](${rurl})`, embeds: [reviewEmbed] });
            }
	},
};
