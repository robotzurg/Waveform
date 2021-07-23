const Discord = require('discord.js');
const db = require("../db.js");
const { capitalize } = require('../func.js');

module.exports = {
    name: 'editreview',
    type: 'Review DB',
    moreinfo: 'https://discord.com/channels/680864893552951306/794751896823922708/794771920717348874',
    aliases: ['editreview', 'editr'],
    description: 'Edit a pre-existing review of your own in the review DB.',
    args: true,
    arg_num: 5,
    usage: '<artist> | <song_name> | <rating> | <rate_desc> | [op] <user_who_sent_song>',
    admin: true,
	execute(message, args) {

        return;
        
        //Auto-adjustment to caps for each word
        args[0] = capitalize(args[0]);
        args[1] = capitalize(args[1]);

        let taggedUser = false;
        let taggedMember = false;
        let userSentSong = false;

        let rating = args[2].replace(/\s+/g, '');
        let review = args[3];

        if (args[2].length > 10) {
            rating = args[3].replace(/\s+/g, '');
            review = args[2];
        }

        if (rating.includes('(') && rating.includes(')')) {
            rating = rating.split('(');
            rating = rating.join(' ');
            rating = rating.split(')');
            rating = rating.join(' ');
            rating = rating.trim();
        } 

        if (args.length === 5) {
            userSentSong = args[4];
            taggedUser = message.mentions.users.first(); 
            taggedMember = message.mentions.members.first();
        }

        if (args[1].includes('Remix)')) {
            return message.channel.send('Please use [] for remixes, not ()!');
        }

        if (args[1].toLowerCase().includes('ep') || args[1].toLowerCase().includes('lp') || args[1].toLowerCase().includes('remixes')) {
            return message.channel.send('You can edit EP/LP/other reviews by simply using `!addReviewEP` or `!addRanking` with the same EP name, then just using it as normal.');
        }
        
        let artistArray = args[0].split(' & ');
        let songName = args[1];
        let rmxArtist = false;
        let featArtists = [];

        //Take out the ft./feat.
        if (args[1].includes('(feat')) {

            songName = args[1].split(` (feat`);
            if (songName[1].includes(`[`)) {
                featArtists = songName[1].split('[');
                featArtists = featArtists[0].slice(2).slice(0, -2).split(' & ');
            } else {
                featArtists = songName[1].slice(2).slice(0, -1).split(' & ');
            }
            if (args[1].toLowerCase().includes('remix')) { rmxArtist = songName[1].split(' [')[1].slice(0, -7); }
            songName = songName[0];

            if (Array.isArray(featArtists)) {
                for (let i = 0; i < featArtists.length; i++) {
                    featArtists[i] = capitalize(featArtists[i]);
                    artistArray.push(featArtists[i]);
                }
            } else if (featArtists != false) {
                featArtists = capitalize(featArtists);
                artistArray.push(featArtists);
            }

        } else if (args[1].includes('(ft')) {
            songName = args[1].split(` (ft`);
            if (songName[1].includes(`[`)) {
                featArtists = songName[1].split('[');
                featArtists = featArtists[0].slice(2).slice(0, -2).split(' & ');
            } else {
                featArtists = songName[1].slice(2).slice(0, -1).split(' & ');
            }
            if (args[1].toLowerCase().includes('remix')) { rmxArtist = songName[1].split(' [')[1].slice(0, -7); }
            songName = songName[0];

            if (Array.isArray(featArtists)) {
                for (let i = 0; i < featArtists.length; i++) {
                    featArtists[i] = capitalize(featArtists[i]);
                    artistArray.push(featArtists[i]);
                }
            } else {
                featArtists = capitalize(featArtists);
                artistArray.push(featArtists);
            }
        }

        //Remix preparation
        if (songName.toLowerCase().includes('remix')) {
            songName = args[1].split(` [`)[0];
            rmxArtist = args[1].split(' [')[1].slice(0, -7);
        } else if (songName.toLowerCase().includes('bootleg]')) {
            songName = args[1].substring(0, args[1].length - 9).split(' [')[0];
            rmxArtist = args[1].substring(0, args[1].length - 9).split(' [')[1];
        } else if (songName.toLowerCase().includes('flip]') || songName.toLowerCase().includes('edit]')) {
            songName = args[1].substring(0, args[1].length - 6).split(' [')[0];
            rmxArtist = args[1].substring(0, args[1].length - 6).split(' [')[1];
        }
        
        let rname;
        let rreview;
        let rscore;

        for (let i = 0; i < artistArray.length; i++) {
            if (rmxArtist === false || artistArray[i] === rmxArtist) {
                rname = db.reviewDB.get(artistArray[i], `["${songName}"].${message.author}.name`);
                if (rname === undefined) return message.channel.send('No review found.');

                db.reviewDB.set(artistArray[i], review, `["${songName}"].${message.author}.review`);
                rreview = db.reviewDB.get(artistArray[i], `["${songName}"].${message.author}.review`);

                db.reviewDB.set(artistArray[i], rating, `["${songName}"].${message.author}.rate`);
                rscore = db.reviewDB.get(artistArray[i], `["${songName}"].${message.author}.rate`);

                db.reviewDB.set(artistArray[i], userSentSong, `["${songName}"].${message.author}.sentby`);
            } else {
                rname = db.reviewDB.get(artistArray[i], `["${songName}"].Remixers.["${rmxArtist}"].${message.author}.name`);
                if (rname === undefined) return message.channel.send('No review found.');

                db.reviewDB.set(artistArray[i], review, `["${songName}"].Remixers.["${rmxArtist}"].${message.author}.review`);
                rreview = db.reviewDB.get(artistArray[i], `["${songName}"].Remixers.["${rmxArtist}"].${message.author}.review`);

                db.reviewDB.set(artistArray[i], rating, `["${songName}"].Remixers.["${rmxArtist}"].${message.author}.rate`);
                rscore = db.reviewDB.get(artistArray[i], `["${songName}"].Remixers.["${rmxArtist}"].${message.author}.rate`);

                db.reviewDB.set(artistArray[i], userSentSong, `["${songName}"].Remixers.["${rmxArtist}"].${message.author}.sentby`);
            }
        }

        let thumbnailImage;
        if (rmxArtist === false) {
            thumbnailImage = db.reviewDB.get(artistArray[0], `["${songName}"].Image`);
        } else {
            thumbnailImage = db.reviewDB.get(artistArray[0], `["${songName}"].Remixers.["${rmxArtist}"].Image`);
        }

		const exampleEmbed = new Discord.MessageEmbed()
            .setColor(`${message.member.displayHexColor}`)
            .setTitle(`${args[0]} - ${args[1]}`)
            .setAuthor(`${message.member.displayName}'s review`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);
            if (thumbnailImage === false) {
                exampleEmbed.setThumbnail(`${message.author.avatarURL({ format: "png", dynamic: false })}`);
            } else {
                exampleEmbed.setThumbnail(thumbnailImage);
            }

            if (rreview != '-') {
                exampleEmbed.setDescription(rreview);
            } else {
                exampleEmbed.setDescription(`Rating: **${rscore}**`);
            }

            if (taggedUser != false) {
                exampleEmbed.setFooter(`Sent by ${taggedMember.displayName}`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
            }
            
            if (rreview != '-') exampleEmbed.addField('Rating: ', `**${rscore}**`, true);

        message.channel.send('Review edited:', exampleEmbed);

        message.delete();
	},
};