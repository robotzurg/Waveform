const db = require("../db.js");
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { parse_artist_song_data, hall_of_fame_check, handle_error, find_review_channel } = require('../func.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setstar')
		.setDescription('Toggle a star on a review you have made.')
        .setDMPermission(false)
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setAutocomplete(true)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('name')
                .setDescription('The name of the song or EP/LP.')
                .setAutocomplete(true)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('Remix artists on the song.')
                .setAutocomplete(true)
                .setRequired(false)),
    help_desc: `TBD`,
	async execute(interaction) {
        try {

        let artists = interaction.options.getString('artist');
        let song = interaction.options.getString('name');
        let remixers = interaction.options.getString('remixers');
        let song_info = await parse_artist_song_data(interaction, artists, song, remixers);
        if (song_info == -1) {
            await interaction.reply('Waveform ran into an issue pulling up song data.');
            return;
        }
        
        let origArtistArray = song_info.prod_artists;
        let origSongName = song_info.song_name;
        let songName = song_info.song_name;
        let artistArray = song_info.all_artists;
        let rmxArtistArray = song_info.remix_artists;
        let vocalistArray = song_info.vocal_artists;
        let songArt;
        // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
        let setterSongName = songName.includes('.') ? `["${songName}"]` : songName;

        if (!db.reviewDB.has(artistArray[0])) return interaction.reply(`${artistArray[0]} not found in database.`);
        let songObj = db.reviewDB.get(artistArray[0])[songName];
        if (songObj == undefined) return interaction.reply(`${origArtistArray.join(' & ')} - ${songName} not found in database.`);
        let songReviewObj = songObj[interaction.user.id];
        if (songReviewObj == undefined) return interaction.reply(`You haven't reviewed ${origArtistArray.join(' & ')} - ${songName}.`);
        if (songReviewObj.rating != false) {
            if (songReviewObj.rating < 8) return interaction.reply(`You haven't rated ${origArtistArray.join(' & ')} - ${songName} an 8/10 or higher!`);
        }

        let star_check = songReviewObj.starred;
        if (star_check == undefined) star_check = false;

        if (songObj.art != false) {
            songArt = songObj.art;
        } else {
            songArt = interaction.user.avatarURL({ extension: "png" });
        }

        for (let i = 0; i < artistArray.length; i++) {
            if (star_check == true) {
                await db.reviewDB.set(artistArray[i], false, `${setterSongName}.${interaction.user.id}.starred`);
            } else if (star_check == false) {
                db.reviewDB.set(artistArray[i], true, `${setterSongName}.${interaction.user.id}.starred`);
            } else {
                handle_error(interaction, `Error in starring process`);
            }
        }

        if (star_check == false) {
            db.user_stats.push(interaction.user.id, `${origArtistArray.join(' & ')} - ${songName}${vocalistArray.length != 0 ? ` (ft. ${vocalistArray})` : '' }`, 'star_list');
            interaction.reply(`Star added to **${origArtistArray.join(' & ')} - ${songName}${vocalistArray.length != 0 ? ` (ft. ${vocalistArray})` : '' }**!`);
        } else {
            db.user_stats.remove(interaction.user.id, `${origArtistArray.join(' & ')} - ${songName}${vocalistArray.length != 0 ? ` (ft. ${vocalistArray.join(' & ')})` : '' }`, 'star_list');
            interaction.reply(`Unstarred **${origArtistArray.join(' & ')} - ${songName}${vocalistArray.length != 0 ? ` (ft. ${vocalistArray.join(' & ')})` : '' }**.`);
        }
        
        // Hall of Fame stuff
        // Create display song name variable
        let displaySongName = (`${origSongName}` + 
        `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}` +
        `${(rmxArtistArray.length != 0) ? ` (${rmxArtistArray.join(' & ')} Remix)` : ``}`);
   
        await hall_of_fame_check(interaction, artistArray, origArtistArray, songName, displaySongName, songArt, true);

        let msgtoEdit = songReviewObj.msg_id;

        if (msgtoEdit != false && msgtoEdit != undefined) {
            let channelsearch = await find_review_channel(interaction, interaction.user.id, msgtoEdit);
            if (channelsearch != undefined) {
                await channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                    let msgEmbed = EmbedBuilder.from(msg.embeds[0]);
                    let msgEmbedTitle = msgEmbed.data.title;
                    if (star_check == false) {
                        if (!msgEmbedTitle.includes(':star2:')) {
                            msgEmbed.setTitle(`:star2: ${msgEmbedTitle} :star2:`);
                        }
                    } else {
                        if (msgEmbedTitle.includes(':star2:')) {
                            while (msgEmbed.data.title.includes(':star2:')) {
                                msgEmbed.setTitle(msgEmbed.data.title.replace(':star2:', ''));
                            }
                        }
                    }
                    msg.edit({ embeds: [msgEmbed] });   
                }).catch((err) => {
                    handle_error(interaction, err);
                });
            }
        }

        let ep_from = songObj.ep;
        if (ep_from != false && ep_from != undefined) {
            if (db.reviewDB.get(artistArray[0])[ep_from][interaction.user.id] != undefined) {
                let epMsgToEdit = db.reviewDB.get(artistArray[0])[ep_from][interaction.user.id].msg_id;
                let channelsearch = await find_review_channel(interaction, interaction.user.id, epMsgToEdit);

                channelsearch.messages.fetch(`${epMsgToEdit}`).then(msg => {
                    let msgEmbed = EmbedBuilder.from(msg.embeds[0]);
                    let msg_embed_fields = msgEmbed.data.fields;
                    let field_num = -1;
                    for (let i = 0; i < msg_embed_fields.length; i++) {
                        if (msg_embed_fields[i].name.includes(songName)) {
                            field_num = i;
                        }
                    }

                    if (star_check == false) {
                        if (!msg_embed_fields[field_num].name.includes('🌟')) {
                            msg_embed_fields[field_num].name = `🌟 ${msg_embed_fields[field_num].name} 🌟`;
                        }
                    } else {
                        if (msg_embed_fields[field_num].name.includes('🌟')) {
                            while (msg_embed_fields[field_num].name.includes('🌟')) {
                                msg_embed_fields[field_num].name = msg_embed_fields[field_num].name.replace('🌟', '');
                            }
                        }
                    }

                    msg.edit({ embeds: [msgEmbed] });
                }).catch((err) => {
                    handle_error(interaction, err);
                });
            } 
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};