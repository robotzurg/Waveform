const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const db = require("../db.js");
const { parse_artist_song_data, handle_error, get_review_channel, getEmbedColor, convertToSetterName } = require('../func.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getreview')
        .setDescription('Get a song review from a user.')
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
            
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User who made the review. Defaults to yourself.')
                .setRequired(false))

        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('Remix artists on the song.')
                .setAutocomplete(true)
                .setRequired(false)),
    help_desc: `Pulls up an individual server users song review.\n` +
    `The remixers argument should have the remixer specified if you are trying to pull up a remix, the remixer should be put in the song_name or artists arguments.\n\n` +
    `Leaving the artist, song_name, and remixers arguments blank will pull from your spotify playback to fill in the arguments (if you are logged into Waveform with Spotify)\n\n` +
    `Putting in a user into the user argument will allow you to view another users ratings of the specified artist, otherwise leaving it blank will default to yourself.`,
	async execute(interaction, client) {
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
            let setterSongName = convertToSetterName(songName);
            let artistArray = song_info.db_artists;
            let displaySongName = song_info.display_song_name;

            let taggedUser = interaction.options.getUser('user');
            let taggedMember;
            if (taggedUser == null) {
                taggedUser = interaction.user;
                taggedMember = interaction.member;
            } else {
                taggedMember = await interaction.guild.members.fetch(taggedUser.id);
            }

            let rreview;
            let rscore;
            let rsentby;
            let rstarred;
            let rurl;
            let usrSentBy;
            let rtimestamp;
            let songObj = db.reviewDB.get(artistArray[0], `${setterSongName}`);
            if (songObj == undefined) return interaction.reply(`\`${origArtistArray.join(' & ')} - ${displaySongName}\` not found in the database.`);
            let songReviewObj = songObj[taggedUser.id];
            if (songReviewObj == undefined) return interaction.reply(`No review found for \`${origArtistArray.join(' & ')} - ${displaySongName}\`. *Note that for EP/LP reviews, you need to use \`/getepreview\`.*`);

            let epfrom = songObj.ep;
            let setterEpName = false;
            if (epfrom != false && epfrom != undefined) {
                setterEpName = convertToSetterName(epfrom);
            }
            if (db.reviewDB.get(artistArray[0], `${setterEpName}`) == undefined) epfrom = false; 
            let songArt = songObj.art;

            rreview = songReviewObj.review;
            if (rreview == '-') rreview = false;
            rscore = songReviewObj.rating;
            rsentby = songReviewObj.sentby;
            rstarred = songReviewObj.starred;
            rurl = songReviewObj.url;
            if (rsentby != false) {
                usrSentBy = await interaction.guild.members.cache.get(rsentby);            
                if (usrSentBy == undefined) rsentby = false;
            }

            // If we don't have a single review link, we can check for an EP/LP review link
            if (rurl == false && (epfrom != false && epfrom != undefined)) {
                let songEPObj = db.reviewDB.get(artistArray[0], `${setterEpName}`);
                if (songEPObj[interaction.user.id].url != false) {
                    rurl = songEPObj[interaction.user.id].url;
                }
            }
            
            if (songArt != false) {
                songArt = songObj.art;
            } else {
                songArt = taggedUser.avatarURL({ extension: "png" });
            }

            if (rreview == 'No written review.' || rreview == "This was from a ranking, so there is no written review for this song.") rreview = '-';

            const reviewEmbed = new EmbedBuilder()
            .setColor(`${getEmbedColor(taggedMember)}`);

            if (rstarred == false) {
                reviewEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
            } else {
                reviewEmbed.setTitle(`:star2: ${origArtistArray.join(' & ')} - ${displaySongName} :star2:`);
            }

            reviewEmbed.setAuthor({ name: `${taggedMember.displayName}'s review`, iconURL: `${taggedUser.avatarURL({ extension: "png" })}` });

            if (rscore !== false) reviewEmbed.addFields([{ name: 'Rating: ', value: `**${rscore}/10**`, inline: true }]);
            if (rreview != false) reviewEmbed.setDescription(rreview);

            let reviewMsgID = songReviewObj.msg_id;
            let timestamp = songReviewObj.timestamp;
            if (reviewMsgID != false && reviewMsgID != undefined && timestamp == undefined) {
                let channelsearch = await get_review_channel(client, songReviewObj.guild_id, songReviewObj.channel_id, reviewMsgID);
                if (channelsearch != undefined) {
                    await channelsearch.messages.fetch(`${reviewMsgID}`).then(async msg => {
                        reviewEmbed.setTimestamp(msg.createdTimestamp);
                    });
                }
            } else if (timestamp != undefined) {
                reviewEmbed.setTimestamp(timestamp);
            }

            reviewEmbed.setThumbnail((songArt == false) ? interaction.user.avatarURL({ extension: "png" }) : songArt);

            if (rsentby != false) {
                reviewEmbed.setFooter({ text: `Sent by ${usrSentBy.displayName}`, iconURL: `${usrSentBy.user.avatarURL({ extension: "png" })}` });
            } else if (epfrom != undefined && epfrom != false) {
                reviewEmbed.setFooter({ text: `from ${epfrom}`, iconURL: db.reviewDB.get(artistArray[0], `${setterEpName}`).art });
            }

            if ((rurl == undefined && rtimestamp == undefined) || rurl == false) {
                interaction.reply({ embeds: [reviewEmbed] });
            } else {
                interaction.reply({ content: `[View Review Message](${rurl})`, embeds: [reviewEmbed] });
            }

        } catch (err) {
            console.log(err);
            let error = err;
            handle_error(interaction, client, error);
        }
	},
};
