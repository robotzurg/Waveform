const Discord = require('discord.js');
const db = require("../db.js");
const { capitalize } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('epreview')
        .setDescription('Review an EP or LP in Waveform.')
        .addStringOption(option => 
            option.setName('artists')
                .setDescription('The name of the MAIN EP/LP artist(s). (separate with &, Do not put any one-off collaborators here.)')
                .setRequired(true))

        .addStringOption(option => 
            option.setName('ep_name')
                .setDescription('The name of the EP/LP. (INCLUDE EP OR LP IN THE TITLE!)')
                .setRequired(true))

        .addStringOption(option => 
            option.setName('art')
                .setDescription('Art for the EP/LP. (type "s" or "spotify" for status art.)')
                .setRequired(false))

        .addStringOption(option => 
            option.setName('overall_rating')
                .setDescription('Overall Rating of the EP/LP. Out of 10, decimals allowed. Can be added later.')
                .setRequired(false))

        .addStringOption(option => 
            option.setName('overall_review')
                .setDescription('Overall Review of the EP/LP. Can be added later.')
                .setRequired(false))
    
        .addUserOption(option => 
            option.setName('user_who_sent')
                .setDescription('User who sent you this EP/LP in Mailbox. Ignore if not a mailbox review.')
                .setRequired(false)),
	admin: false,
	async execute(interaction) {

        let origArtistArray = capitalize(interaction.options.getString('artists')).split(' & ');
        let artistArray = origArtistArray.slice(0);
        let ep_name = capitalize(interaction.options.getString('ep_name'));
        let art = interaction.options.getString('art');
        let overall_rating = interaction.options.getString('overall_rating');
        let overall_review = interaction.options.getString('overall_review');
        let user_sent_by = interaction.options.getUser('user_who_sent');
        let taggedMember = false;
        let taggedUser = false;

        if (user_sent_by == null) {
            user_sent_by = false;
        }

        if (art === null) {
            art = false;
        }

        if (overall_rating === null) {
            overall_rating = false;
        }

        if (overall_review === null) {
            overall_review = false;
        }

        if (overall_review != false) {
            if (overall_review.includes('\\n')) {
                overall_review = overall_review.split('\\n').join('\n');
            }
        }

        // Place EP by default if EP or LP is not included in the title.
        if (!ep_name.includes('EP') && !ep_name.includes('LP')) {
            ep_name = `${ep_name} EP`;
        }

        console.log(user_sent_by);

        if (user_sent_by.id != null && user_sent_by.id != undefined && user_sent_by.id != false) {
            taggedMember = await interaction.guild.members.fetch(user_sent_by.id);
            taggedUser = user_sent_by;
        }

        console.log(taggedUser);
        console.log(taggedMember);

        // Spotify check (checks for both "spotify" and "s" as the image link)
        if (art != false && art != undefined) {
            if (art.toLowerCase().includes('spotify') || art.toLowerCase() === 's') {
                interaction.member.presence.activities.forEach((activity) => {
                    if (activity.type === 'LISTENING' && activity.name === 'Spotify' && activity.assets !== null) {
                        art = `https://i.scdn.co/image/${activity.assets.largeImage.slice(8)}`;
                    }
                });
            }
        }

        // Make sure we DON'T get any slip ups, where the bot lets spotify run through (if it can't find a status)
        if (art != undefined && art != false) {
            if (art.toLowerCase().includes('spotify') || art.toLowerCase() === 's') art = false;
        }

        // Add in the EP object/review
        for (let i = 0; i < artistArray.length; i++) {

            let epObject = {
                [ep_name]: {
                    [interaction.user.id]: {
                        url: false,
                        msg_id: false,
                        name: interaction.member.displayName,
                        rating: overall_rating,
                        review: overall_review,
                        sentby: taggedUser.id,
                        ranking: [],
                    },
                    art: art,
                    collab: artistArray.filter(word => artistArray[i] != word),
                    songs: [],
                },
            }; 

            let reviewObject = {
                url: false,
                msg_id: false,
                name: interaction.member.displayName,
                rating: overall_rating,
                review: overall_review,
                sentby: taggedUser.id,
                ranking: [],
            };

            if (!db.reviewDB.has(artistArray[i])) {

                db.reviewDB.set(artistArray[i], epObject);
                db.reviewDB.set(artistArray[i], false, 'Image');

            } else if (db.reviewDB.get(artistArray[i], `["${ep_name}"]`) === undefined) {

                let db_artist_obj = db.reviewDB.get(artistArray[i]);
                Object.assign(db_artist_obj, epObject);
                db.reviewDB.set(artistArray[i], db_artist_obj);

            } else {

                const db_song_obj = db.reviewDB.get(artistArray[i], `["${ep_name}"]`);

                let new_user_obj = {
                    [`${interaction.user.id}`]: reviewObject,
                };

                Object.assign(db_song_obj, new_user_obj);
                db.reviewDB.set(artistArray[i], db_song_obj, `["${ep_name}"]`);
                db.reviewDB.set(artistArray[i], art, `["${ep_name}"].art`);

            }

        }

        // Change our "default avatar review image" to the artists image in the database, if one exists
        if (db.reviewDB.has(artistArray[0]) && art == false) {
            art = db.reviewDB.get(artistArray[0], `["${ep_name}"].art`);
            if (art === undefined || art === false) {
                art = interaction.user.avatarURL({ format: "png", dynamic: false });
            }
        } else if (art === false || art === undefined) {
            // Otherwise set our review art to the users avatar.
            art = interaction.user.avatarURL({ format: "png", dynamic: false });
        }

        // Set up the embed
        const epEmbed = new Discord.MessageEmbed()
        .setColor(`${interaction.member.displayHexColor}`)
        .setTitle(`${artistArray.join(' & ')} - ${ep_name}`)
        .setAuthor(`${ep_name.includes('LP') ? `${interaction.member.displayName}'s LP review` : `${interaction.member.displayName}'s EP review`}`, `${interaction.user.avatarURL({ format: "png", dynamic: false })}`);

        epEmbed.setThumbnail(art);

        if (overall_rating != false && overall_review != false) {
            epEmbed.setDescription(`*${overall_review}*`);
            epEmbed.setTitle(`${artistArray.join(' & ')} - ${ep_name} (${overall_rating}/10)`);
        } else if (overall_rating != false) {
            epEmbed.setTitle(`${artistArray.join(' & ')} - ${ep_name} (${overall_rating}/10)`);
        } else if (overall_review != false) {
            epEmbed.setDescription(`*${overall_review}*`);
        }

        if (user_sent_by != false) {
            epEmbed.setFooter(`Sent by ${taggedMember.displayName}`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
        }

        interaction.editReply({ embeds: [epEmbed] });

        const rankingEmbed = new Discord.MessageEmbed()
        .setColor(`${interaction.member.displayHexColor}`)
        .addField(`Ranking`, `This part of the review will be updated/deleted as needed.`);

        // Grab message id to put in user_stats and the ep object
        const msg = await interaction.fetchReply();

        await interaction.channel.send({ embeds: [rankingEmbed] }).then(async rank_msg => {
            db.user_stats.set(interaction.user.id, [msg.id, rank_msg.id, artistArray], 'current_ep_review');
        });

        // Set message ids
        for (let i = 0; i < artistArray.length; i++) {
            db.reviewDB.set(artistArray[i], msg.id, `["${ep_name}"].["${interaction.user.id}"].msg_id`);
            db.reviewDB.set(artistArray[i], msg.url, `["${ep_name}"].["${interaction.user.id}"].url`);
        }

    },
};
