const Discord = require('discord.js');
const db = require("../db.js");
const { capitalize } = require('../func.js');

module.exports = {
    name: 'getreviewep',
    description: 'Get an EP review from a user on the server that they have written!',
    options: [
        {
            name: 'artist',
            type: 'STRING',
            description: 'The name of the artist.',
            required: true,
        }, {
            name: 'ep_name',
            type: 'STRING',
            description: 'The name of the EP.',
            required: true,
        }, {
            name: 'user',
            type: 'STRING',
            description: 'The user who wrote the EP review (Defaults to yourself)',
            required: false,
        },
    ],
    admin: false,
	async execute(interaction) {

        let args = [];
        let taggedUser = interaction.user;
        let taggedMember = interaction.member;

        await interaction.options._hoistedOptions.forEach(async (value) => {
            args.push(value.value.trim());
            if (value.name === 'user') {
                taggedMember = await interaction.guild.members.fetch(value.value);
                taggedUser = taggedMember.user;
            }
        });

        args[0] = capitalize(args[0]);
        args[1] = capitalize(args[1]);

        let origArtistArray = args[0].split(' & ');
        let epName = args[1];

        let artistArray = origArtistArray;

        const artistObj = db.reviewDB.get(artistArray[0]);
        if (artistObj === undefined) {
            return interaction.editReply('No artist found.');
        }

        let artistsEmbed;
        let vocalistsEmbed;
        let rname;
        let rreview;
        let rscore;
        let rsentby = false;
        let rstarred;
        let usrSentBy = interaction.author;

        const ep_object = db.reviewDB.get(artistArray[0], `${epName}`);
        if (ep_object === undefined) return interaction.editReply('EP not found. *(EP Object not found in database.)*');
        const ep_overall_rating = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].ep_rating`);
        const ep_overall_review = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].ep_review`);
        let ep_ranking = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].ep_ranking`);
        if (ep_ranking === undefined) ep_ranking = []; // This is handling for any odd scenarios where this never gets set

        let ep_art = db.reviewDB.get(artistArray[0], `${epName}.art`);
        let ep_songs = db.reviewDB.get(artistArray[0], `${epName}.songs`);
        if (ep_songs === false || ep_songs === undefined) ep_songs = [];
        rname = db.reviewDB.get(artistArray[0], `${epName}.${taggedUser.id}.name`);

        if (ep_art === false) {
            ep_art = taggedUser.avatarURL({ format: "png" });
        }

        const epEmbed = new Discord.MessageEmbed();
        if (ep_songs.length != 0) {
            for (let i = 0; i < ep_songs.length; i++) {
                let songName = ep_songs[i];
                artistsEmbed = [];
                vocalistsEmbed = [];

                // Look into adding in adding remix support later
                /*if (songName.toString().toLowerCase().includes('remix')) {
                    fullSongName = songName;
                    songName = fullSongName.substring(0, fullSongName.length - 7).split(' [')[0];
                    rmxArtist = fullSongName.substring(0, fullSongName.length - 7).split(' [')[1];
                }*/

                rname = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].name`);
                if (rname === undefined) return interaction.editReply(`No review found for song ${songName}`);
                rreview = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].review`);
                rscore = `${db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].rating`)}/10`;
                rsentby = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].sentby`);
                rstarred = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].starred`);
                if (rsentby != false) {
                    usrSentBy = interaction.guild.members.cache.get(rsentby);              
                }

                // This is for adding in collaborators/vocalists into the name inputted into the embed title, NOT for getting data out.
                if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`) != undefined) {
                    if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`).length != 0) {
                        artistsEmbed = [];
                        artistsEmbed.push(db.reviewDB.get(artistArray[0], `["${songName}"].collab`));
                        artistsEmbed = artistsEmbed.flat(1);
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

                epEmbed.addField(`${rstarred === true ? `🌟 ${songName} 🌟` : songName }${artistsEmbed.length != 0 ? ` (with ${artistsEmbed}) ` : ' '}${vocalistsEmbed.length != 0 ? `(ft. ${vocalistsEmbed}) ` : ''}(${rscore})`, `${rreview}`);
            }
        }

        if (ep_ranking.length != 0 && ep_ranking != undefined) {
            epEmbed.addField('Ranking:', `\`\`\`${ep_ranking.join('\n')}\`\`\``);
        }

        if (ep_overall_review != false && ep_overall_review != undefined && ep_ranking.length === 0) {
            if (ep_overall_rating === false || ep_overall_rating === undefined) {
                epEmbed.addField('Overall Thoughts:', ep_overall_review);
            } else {
                epEmbed.addField(`Overall Thoughts (${ep_overall_rating})`, ep_overall_review);
            }
        } else if (ep_overall_review != false && ep_overall_review != undefined && ep_ranking.length != 0) {
            if (ep_overall_rating === false || ep_overall_rating === undefined) {
                epEmbed.setDescription(ep_overall_review);
            } else {
                epEmbed.setDescription(ep_overall_review);
                epEmbed.setFooter(`Rating: ${ep_overall_rating}`);
            }
        }

        epEmbed.setColor(`${taggedMember.displayHexColor}`);
        epEmbed.setTitle(`${origArtistArray} - ${epName}`);
        epEmbed.setAuthor(rsentby != false ? `${rname}'s mailbox review` : `${rname}'s review`, `${taggedUser.avatarURL({ format: "png" })}`);
        if (epName.includes('EP')) {
            epEmbed.setAuthor(rsentby != false && rsentby != undefined && ep_songs.length != 0 ? `${rname}'s mailbox EP review` : `${rname}'s EP review`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
        } else if (epName.includes('LP')) {
            epEmbed.setAuthor(rsentby != false && rsentby != undefined && ep_songs.length != 0 ? `${rname}'s mailbox LP review` : `${rname}'s LP review`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
        }
        epEmbed.setThumbnail(ep_art);
        if (rsentby != false && rsentby != undefined && ep_overall_rating === false) {
            epEmbed.setFooter(`Sent by ${usrSentBy.displayName}`, `${usrSentBy.user.avatarURL({ format: "png" })}`);
        }
        
        interaction.editReply({ embeds: [epEmbed] });
	},
};