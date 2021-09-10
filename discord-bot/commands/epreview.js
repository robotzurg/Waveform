const Discord = require('discord.js');
const db = require("../db.js");
const { capitalize } = require('../func.js');
const { mailboxes } = require('../arrays.json');
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

        if (mailboxes.includes(interaction.channel.name)) return interaction.editReply('Mailboxes are NOT currently supported with EP Reviews.');

        let artistArray = capitalize(interaction.options.getString('artists'));
        let ep_name = capitalize(interaction.options.getString('ep_name'));
        let art = interaction.options.getString('art');
        let overall_rating = interaction.options.getString('overall_rating');
        let overall_review = interaction.options.getString('overall_review');
        let user_sent_by = interaction.options.getString('user_sent_by');
        let taggedMember = false;
        let taggedUser = false;

        if (user_sent_by === null) {
            user_sent_by = false;
        }

        if (art === null) {
            art === false;
        }

        if (overall_rating === null) {
            overall_rating = false;
        }

        if (overall_review === null) {
            overall_review = false;
        }

        if (!ep_name.includes('EP') && !ep_name.includes('LP')) {
            ep_name = `${ep_name} EP`;
        }

        artistArray = [artistArray.split(' & ')];
        artistArray = artistArray.flat(1);

        console.log(artistArray);

        if (user_sent_by != null && user_sent_by != undefined) {
            taggedMember = await interaction.guild.members.fetch(user_sent_by);
            taggedUser = taggedMember.user;
        }

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

            console.log(artistArray);
            console.log(artistArray[i]);

            let epObject = {
                [ep_name]: {
                    [interaction.user.id]: {
                        msg_id: false,
                        name: interaction.member.displayName,
                        rating: overall_rating,
                        review: overall_review,
                        sentby: user_sent_by,
                        ranking: [],
                    },
                    art: art,
                    collab: artistArray.filter(word => artistArray[i] != word),
                    songs: [],
                },
            }; 

            let reviewObject = {
                msg_id: false,
                name: interaction.member.displayName,
                rating: overall_rating,
                review: overall_review,
                sentby: user_sent_by,
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
        if (db.reviewDB.has(artistArray[0]) && art === false) {
            art = db.reviewDB.get(artistArray[0], `["${ep_name}"].art`);
            if (art === undefined || art === false) {
                if (db.reviewDB.get(artistArray[0], 'Image') === false || db.reviewDB.get(artistArray[0], 'Image') === undefined) {
                    art = interaction.user.avatarURL({ format: "png", dynamic: false });
                }
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
            epEmbed.setDescription(`*Overall Rating:* ***${overall_rating}/10***\n*${overall_review}*`);
        } else if (overall_rating != false) {
            epEmbed.setDescription(`*Overall Rating:* ***${overall_rating}/10***`);
        } else if (overall_review != false) {
            epEmbed.setDescription(`*${overall_review}*`);
        }

        if (taggedUser != false && taggedUser != undefined) {
            epEmbed.setFooter(`Sent by ${taggedMember.displayName}`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
        }

        interaction.editReply({ embeds: [epEmbed] });

        const rankingEmbed = new Discord.MessageEmbed()
        .setColor(`${interaction.member.displayHexColor}`)
        .addField(`Ranking`, `This part of the review will be updated/deleted as needed.`);

        // Grab message id to put in user_stats and the ep object
        const msg = await interaction.fetchReply();

        await interaction.channel.send({ embeds: [rankingEmbed] }).then(async rank_msg => {
            db.user_stats.set(interaction.user.id, [msg.id, rank_msg.id], 'current_ep_review');
        });

        // Set message ids
        if (!mailboxes.includes(interaction.channel.name)) {
            for (let i = 0; i < artistArray.length; i++) {
                db.reviewDB.set(artistArray[i], msg.id, `["${ep_name}"].["${interaction.user.id}"].msg_id`);
            }
        } else {
            for (let i = 0; i < artistArray.length; i++) {
                db.reviewDB.set(artistArray[i], false, `["${ep_name}"].["${interaction.user.id}"].msg_id`);
            }
        }

    },
};