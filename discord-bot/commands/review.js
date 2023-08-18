const db = require("../db.js");
const { update_art, review_song, handle_error, get_review_channel, grab_spotify_art, parse_artist_song_data, isValidURL, spotify_api_setup, grab_spotify_artist_art, updateStats, getEmbedColor, hallOfFameCheck, convertToSetterName } = require('../func.js');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, SlashCommandBuilder, ButtonStyle, Embed } = require('discord.js');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('review')
        .setDescription('Review a song.')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand.setName('with_spotify')
            .setDescription('Review a song by utilizing your currently playing spotify song (requires login).')
            .addStringOption(option => 
                option.setName('rating')
                    .setDescription('Rating for the song (1-10, decimals allowed.)')
                    .setRequired(false)
                    .setMaxLength(3))

            .addStringOption(option => 
                option.setName('review')
                    .setDescription('Your review of the song')
                    .setRequired(false))

            .addUserOption(option => 
                option.setName('user_who_sent')
                    .setDescription('Manually specify who sent you a song through mailbox.')
                    .setRequired(false))

            .addStringOption(option => 
                option.setName('art')
                    .setDescription('Image link of the song art (Leave blank for automatic spotify searching.)')
                    .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand.setName('manually')
            .setDescription('Review a song by manually entering information.')

            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the artist(s). (DO NOT PUT ANY REMIXERS HERE)')
                    .setAutocomplete(true)
                    .setRequired(true))

            .addStringOption(option => 
                option.setName('song_name')
                    .setDescription('The name of the song. (Do not include any features or remixers in here!)')
                    .setAutocomplete(true)
                    .setRequired(true))

            .addStringOption(option => 
                option.setName('rating')
                    .setDescription('Rating for the song (1-10, decimals allowed.)')
                    .setRequired(false)
                    .setMaxLength(3))

            .addStringOption(option => 
                option.setName('review')
                    .setDescription('Your review of the song')
                    .setRequired(false))

            .addStringOption(option => 
                option.setName('remixers')
                    .setDescription('Put remixers here, if you reviewing a remix of the original song. (NOT IN ARTISTS ARGUMENT)')
                    .setAutocomplete(true)
                    .setRequired(false))

            .addUserOption(option => 
                option.setName('user_who_sent')
                    .setDescription('User who sent you this song in Mailbox. Ignore if not a mailbox review.')
                    .setRequired(false))

            .addStringOption(option => 
                option.setName('art')
                    .setDescription('Image link of the song art (put \'s\' here if you want to use your spotify playback.)')
                    .setRequired(false))),
    help_desc: `Create an song/remix review on Waveform. See the "Song Review Guide" button to find out how this works.\n\n`
    + `The subcommand \`with_spotify\` pulls from your spotify playback to fill in arguments (if logged into Waveform with Spotify)` + 
    ` while the \`manually\` subcommand allows you to manually type in the song name yourself.`,
	async execute(interaction, client) {
        try {
        await interaction.deferReply();

        // Mailbox related variables
        let int_channel = interaction.channel;
        let is_mailbox = false;
        let spotifyApi = false;
        let mailbox_list = db.user_stats.get(interaction.user.id, 'mailbox_list');
        let temp_mailbox_list;
        let ping_for_review = false;

        let artists = interaction.options.getString('artist');
        let song = interaction.options.getString('song_name');
        let rmxArtistArray = interaction.options.getString('remixers');

        // Songname check to avoid not using the arguments properly.
        if (song != null) {
            if (song.includes('Remix)') || song.includes('ft.') || song.includes('feat.')) {
                await interaction.editReply('Please make sure that no artist names are placed in the song name argument.\n' + 
                'For example, do not put `Song (Dude Remix)`, just put `Song`, and put the remixer in the Remixers argument.');
                return;
            }
        }

        let song_info = await parse_artist_song_data(interaction, artists, song, rmxArtistArray);
        if (song_info.error != undefined) {
            await interaction.editReply(song_info.error);
            return;
        }

        let origArtistArray = song_info.prod_artists;
        let songName = song_info.song_name;
        let artistArray = song_info.db_artists;
        rmxArtistArray = song_info.remix_artists;
        let allArtistArray = song_info.all_artists; // This is used for grabbing the artist images of every artist involved.
        let displaySongName = song_info.display_song_name;
        let origSongName = song_info.main_song_name;
        let spotifyUri = song_info.spotify_uri;
        // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
        let setterSongName = convertToSetterName(songName);

        // Check if we are in a spotify mailbox
        spotifyApi = await spotify_api_setup(interaction.user.id);
        if (interaction.options.getSubcommand() == 'manually') spotifyApi = false;
        if (mailbox_list.some(v => v.spotify_id == spotifyUri.replace('spotify:track:', '')) && spotifyApi != false) {
            is_mailbox = true;
        }

        let rating = interaction.options.getString('rating');
        if (rating == null) rating = false;
        let review = interaction.options.getString('review');
        if (review == null) review = false;
        let songArt = interaction.options.getString('art');
        let user_who_sent = interaction.options.getUser('user_who_sent');
        let mailbox_data = false;
        
        // If we are in the mailbox and don't specify a user who sent, try to pull it from the mailbox list
        if (user_who_sent == null && is_mailbox == true) {
            temp_mailbox_list = mailbox_list.filter(v => v.spotify_id == spotifyUri.replace('spotify:track:', ''));
            if (temp_mailbox_list.length != 0) {
                mailbox_data = temp_mailbox_list[0];
                await interaction.guild.members.fetch(mailbox_data.user_who_sent).then(async user_data => {
                    user_who_sent = user_data.user; //await client.users.cache.get(mailbox_data.user_who_sent);
                    if (db.user_stats.get(mailbox_data.user_who_sent, 'config.review_ping') == true) ping_for_review = true;
                }).catch(() => {
                    user_who_sent = null;
                    ping_for_review = false;
                    is_mailbox = false;
                });
            }
        }

        let starred = false;
        let taggedUser = false;
        let taggedMember = false;

        // EP/LP check to see if "og" is listed as the artist name, so replace it with EP/LP artist
        if (db.user_stats.get(interaction.user.id, 'current_ep_review.ep_name') != undefined) {
            if (db.user_stats.get(interaction.user.id, 'current_ep_review.ep_name').includes(' EP') || db.user_stats.get(interaction.user.id, 'current_ep_review.ep_name').includes(' LP')) {
                for (let i = 0; i < origArtistArray.length; i++) {
                    if (origArtistArray[i].toLowerCase() == 'og') {
                        origArtistArray[i] = db.user_stats.get(interaction.user.id, `current_ep_review.artist_array`);
                        origArtistArray = origArtistArray.flat(1);
                    }   
                }
            }
        }

        if (user_who_sent != null) {
            taggedUser = user_who_sent;
            taggedMember = await interaction.guild.members.fetch(taggedUser.id);
        }

        // Setup review editing buttons
        const editButtons = new ActionRowBuilder();

        if (interaction.options.getSubcommand() == 'manually') {
            editButtons.addComponents(
                new ButtonBuilder()
                    .setCustomId('artist').setLabel('Artist')
                    .setStyle(ButtonStyle.Primary).setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('song').setLabel('Song')
                    .setStyle(ButtonStyle.Primary).setEmoji('📝'),
            );
        }

        editButtons.addComponents(
            new ButtonBuilder()
                .setCustomId('rating').setLabel('Rating')
                .setStyle(ButtonStyle.Primary).setEmoji('📝'),
            new ButtonBuilder()
                .setCustomId('review').setLabel('Review')
                .setStyle(ButtonStyle.Primary).setEmoji('📝'),
            new ButtonBuilder()
                .setCustomId('star')
                .setStyle(ButtonStyle.Secondary).setEmoji('🌟'),
        );

        // Setup review submit button row
        const reviewButtons = new ActionRowBuilder();

        // If we're in an EP/LP review, stick in a button to push to EP review instead of a send to database button.
        if (db.user_stats.get(interaction.user.id, 'current_ep_review') != false) {
            if (origArtistArray.includes(db.user_stats.get(interaction.user.id, 'current_ep_review.artist_array')[0])) {
                reviewButtons.addComponents( 
                    new ButtonBuilder()
                    .setCustomId('ep_done').setLabel('Push to EP Review')
                    .setStyle(ButtonStyle.Success),
                );
            } else {
                reviewButtons.addComponents( 
                    new ButtonBuilder()
                    .setCustomId('done').setLabel('Confirm Review')
                    .setStyle(ButtonStyle.Success),
                );
            }
        } else {
            reviewButtons.addComponents( 
                new ButtonBuilder()
                .setCustomId('done').setLabel('Confirm Review')
                .setStyle(ButtonStyle.Success),
            );
        }

        // Add the delete button
        reviewButtons.addComponents(
            new ButtonBuilder()
                .setCustomId('delete').setLabel('Delete')
                .setStyle(ButtonStyle.Danger),
        );

        // Grab song art if we don't directly specify one
        if (songArt == false || songArt == null || songArt == undefined) {
            songArt = await grab_spotify_art(origArtistArray, songName);
            if (db.reviewDB.has(artistArray[0])) {
                if (db.reviewDB.get(artistArray[0])[songName] != undefined) {
                    if (db.reviewDB.get(artistArray[0])[songName].art != false && db.reviewDB.get(artistArray[0])[songName].art != undefined) {
                        songArt = await db.reviewDB.get(artistArray[0])[songName].art;
                    }
                }
            }
        } else {
            if (!isValidURL(songArt)) return await interaction.editReply('This song art URL is invalid.');
        }

        // Also grab artist images, to set if there is not already an image set.
        let artistImgs = await grab_spotify_artist_art(allArtistArray);

        // Start creation of embed
        let reviewEmbed = new EmbedBuilder()
        .setColor(`${getEmbedColor(interaction.member)}`)
        .setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`)
        .setAuthor({ name: `${interaction.member.displayName}'s review`, iconURL: `${interaction.user.avatarURL({ extension: "png", dynamic: false })}` });

        // Check rating input to ensure we have a valid number.
        if (rating !== false) {
            if (rating.includes('/10')) rating = rating.replace('/10', '');
            rating = parseFloat(rating);
            if (isNaN(rating)) return await interaction.editReply(`The rating \`${rating}\` is not valid, please make sure you put in an integer or decimal rating!`);
            if (rating < 0 || rating > 10) return await interaction.editReply(`The rating \`${rating}\` is not a number in between 0 and 10. It must be between those 2 numbers.`);
        }

        // \n parse handling, to allow for line breaks in reviews on Discord PC
        // I wish I knew why Discord wouldn't just let you do this on the client, but whatever
        if (review != false) {
            if (review.includes('\\n')) {
                review = review.split('\\n').join('\n');
            }
        }

        if (interaction.commandName != 'pushtoepreview') {
            if (review == false && rating === false) {
                return await interaction.editReply('Your song review must either have a rating or review, it cannot be missing both.');
            } else {
                if (rating !== false) reviewEmbed.addFields([{ name: 'Rating: ', value: `**${rating}/10**`, inline: true }]);
                if (review != false) reviewEmbed.setDescription(review);
            }
        } else if (interaction.commandName == 'pushtoepreview') { // If we are using this command through /pushtoepreview, pull from the existing songs rating and review, if they exist
            let songObj = db.reviewDB.get(artistArray[0], `${setterSongName}`);
            if (songObj == undefined) {
                return interaction.editReply(`No review found for \`${origArtistArray.join(' & ')} - ${displaySongName}\`.`);
            } else if (songObj[interaction.user.id] == undefined) {
                return interaction.editReply(`No review found for \`${origArtistArray.join(' & ')} - ${displaySongName}\`.`);
            }

            let songReviewObj = songObj[interaction.user.id];
            rating = songReviewObj.rating;
            review = songReviewObj.review;
            starred = songReviewObj.starred;
            if (rating !== false) reviewEmbed.addFields([{ name: 'Rating: ', value: `**${rating}/10**`, inline: true }]);
            if (review != false) reviewEmbed.setDescription(review);
            if (starred != false) reviewEmbed.setTitle(`🌟 ${origArtistArray.join(' & ')} - ${displaySongName} 🌟`);
        }
        
        if (songArt == false || songArt == undefined) {
            reviewEmbed.setThumbnail(interaction.user.avatarURL({ extension: "png", dynamic: false }));
        } else {
            reviewEmbed.setThumbnail(songArt);
        }
        
        if (taggedUser != false && taggedUser != undefined) {
            if (taggedUser.id != interaction.user.id) { // Don't add the sent by if it's sent by ourselves
                reviewEmbed.setFooter({ text: `Sent by ${taggedMember.displayName}`, iconURL: taggedUser.avatarURL({ extension: "png", dynamic: false }) });
            }
        }
        // End of Embed Code

        //Quick thumbnail image check to assure we aren't putting in an avatar, songArt should be set to what we put in the database.
        if (songArt == undefined || songArt == false || songArt.includes('avatar')) { 
            songArt = false;
        }

        // Send the review embed
        await interaction.editReply({ embeds: [reviewEmbed], components: [editButtons, reviewButtons] });

        const filter = i => i.user.id == interaction.user.id;
        const collector = int_channel.createMessageComponentCollector({ filter, time: 100000000 });
        let a_collector;
        let s_collector;
        let ra_collector;
        let re_collector;

        collector.on('collect', async i => {
            switch (i.customId) {
                // Artist edit button
                case 'artist': {
                    await i.deferUpdate();
                    await i.editReply({ content: 'Type in the artist name(s) (separated with & or x, DO NOT PUT REMIXERS HERE!)', components: [] });
                    const a_filter = m => m.author.id == interaction.user.id;
                    a_collector = await int_channel.createMessageCollector({ filter: a_filter, max: 1, time: 60000 });
                    await a_collector.on('collect', async m => {
                        if (m.content.includes(' x ')) {
                            m.content = m.content.replace(' & ', ' \\& ');
                            origArtistArray = m.content;
                        } else {
                            origArtistArray = m.content.split(' & ');
                        }

                        songArt = false;
                        if (rmxArtistArray.length == 0) {
                            artistArray = [origArtistArray];
                            artistArray = artistArray.flat(1);
                        }

                        // Regrab artist images
                        artistImgs = await grab_spotify_artist_art(rmxArtistArray.length == 0 ? artistArray : [origArtistArray, rmxArtistArray].flat(1));
                        
                        if (starred == false) {
                            reviewEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                        } else {
                            reviewEmbed.setTitle(`🌟 ${origArtistArray.join(' & ')} - ${displaySongName} 🌟`);
                        }

                        // Check if we have art for the edited song info in the database
                        if (songArt == undefined || songArt == false) {
                            // If we don't have art for the edited song info, search it on the spotify API.
                            songArt = await grab_spotify_art(artistArray, songName);
                            if (songArt == false) songArt = interaction.user.avatarURL({ extension: "png", dynamic: false });
                        } else {
                            if (db.reviewDB.has(artistArray[0])) songArt = db.reviewDB.get(artistArray[0])[songName].art;
                            if (songArt == undefined || songArt == false) songArt = interaction.user.avatarURL({ extension: "png", dynamic: false });
                        }
                        reviewEmbed.setThumbnail(songArt);

                        await i.editReply({ content: null, embeds: [reviewEmbed], components: [editButtons, reviewButtons] });
                        m.delete();
                    });
                    
                    a_collector.on('end', async () => {
                        await i.editReply({ content: null, embeds: [reviewEmbed], components: [editButtons, reviewButtons] });
                    });
                } break;
                case 'song': {
                    await i.deferUpdate();
                    await i.editReply({ content: 'Type in the song name (NO FT. OR REMIXERS SHOULD BE INCLUDED)', components: [] });

                    const s_filter = m => m.author.id == interaction.user.id;
                    s_collector = int_channel.createMessageCollector({ filter: s_filter, max: 1, time: 60000 });
                    await s_collector.on('collect', async m => {
                        songName = m.content;
                        songArt = false;
                        displaySongName = (`${songName}` + 
                        `${(rmxArtistArray.length != 0) ? ` (${rmxArtistArray.join(' & ')} Remix)` : ``}`);

                        if (starred == false) {
                            reviewEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                        } else {
                            reviewEmbed.setTitle(`🌟 ${origArtistArray.join(' & ')} - ${displaySongName} 🌟`);
                        }

                        // Check if we have art for the edited song info in the database
                        if (songArt == undefined || songArt == false) {
                            // If we don't have art for the edited song info, search it on the spotify API.
                            songArt = await grab_spotify_art(artistArray, songName);
                            if (songArt == false) songArt = interaction.user.avatarURL({ extension: "png", dynamic: false });
                        } else {
                            if (db.reviewDB.has(artistArray[0])) songArt = db.reviewDB.get(artistArray[0])[songName].art;
                            if (songArt == undefined || songArt == false) songArt = interaction.user.avatarURL({ extension: "png", dynamic: false });
                        }
                        reviewEmbed.setThumbnail(songArt);

                        await i.editReply({ content: null, embeds: [reviewEmbed], components: [editButtons, reviewButtons] });
                        m.delete(); 
                    });
                    
                    s_collector.on('end', async () => {
                        await i.editReply({ content: null, embeds: [reviewEmbed], components: [editButtons, reviewButtons] });
                    });
                } break;
                case 'rating': {
                    await i.deferUpdate();
                    await i.editReply({ content: 'Type in the rating (DO NOT WRITE /10)', components: [] });

                    const ra_filter = m => m.author.id == interaction.user.id;
                    ra_collector = int_channel.createMessageCollector({ filter: ra_filter, max: 1, time: 60000 });
                    ra_collector.on('collect', async m => {
                        if (rating == false) reviewEmbed.addFields({ name: 'Rating', value: `TBA` });
                        rating = parseFloat(m.content);
                        if (m.content.includes('/10')) rating = parseFloat(m.content.replace('/10', ''));
                        if (isNaN(rating)) {
                            i.editReply('The rating you put in is not valid, please make sure you put in an integer or decimal rating for your replacement rating!'); return;
                        }
                        reviewEmbed.data.fields[0] = { name : 'Rating', value : `**${rating}/10**` };
                        await i.editReply({ content: null, embeds: [reviewEmbed], components: [editButtons, reviewButtons] });
                        m.delete();
                    });
                    
                    ra_collector.on('end', async () => {
                        await i.editReply({ content: null, embeds: [reviewEmbed], components: [editButtons, reviewButtons] });
                    });
                } break;
                case 'review': {
                    await i.deferUpdate();
                    await i.editReply({ content: 'Type in the new review.', components: [] });

                    const re_filter = m => m.author.id == interaction.user.id;
                    re_collector = int_channel.createMessageCollector({ filter: re_filter, max: 1, time: 120000 });
                    re_collector.on('collect', async m => {
                        review = m.content;

                        if (review.includes('\\n')) {
                            review = review.split('\\n').join('\n');
                        }

                        reviewEmbed.setDescription(review);
                        await i.editReply({ embeds: [reviewEmbed], components: [editButtons, reviewButtons] });
                        m.delete();
                    });
                    
                    re_collector.on('end', async () => {
                        await i.editReply({ content: null, embeds: [reviewEmbed], components: [editButtons, reviewButtons] });
                    });
                } break;
                case 'star': {
                    // If we don't have a 10 rating, the button does nothing.
                    if (rating < 8 && rating != false && rating != null) return await i.update({ embeds: [reviewEmbed], components: [editButtons, reviewButtons] });

                    if (starred == false) {
                        reviewEmbed.setTitle(`🌟 ${origArtistArray.join(' & ')} - ${displaySongName} 🌟`);
                        starred = true;
                    } else {
                        reviewEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                        starred = false;
                    }

                    await i.update({ embeds: [reviewEmbed], components: [editButtons, reviewButtons] });
                } break;
                case 'delete': {
                    try {
                        await interaction.deleteReply();
                    } catch (err) {
                        console.log(err);
                    }

                    if (a_collector != undefined) a_collector.stop();
                    if (s_collector != undefined) s_collector.stop();
                    if (ra_collector != undefined) ra_collector.stop();
                    if (re_collector != undefined) re_collector.stop();
                    if (collector != undefined) collector.stop(); // Collector for all buttons
                } break;
                case 'ep_done': { // EP review handling
                    if (a_collector != undefined) a_collector.stop();
                    if (s_collector != undefined) s_collector.stop();
                    if (ra_collector != undefined) ra_collector.stop();
                    if (re_collector != undefined) re_collector.stop();
                    if (collector != undefined) collector.stop(); // Collector for all buttons
                    interaction.deleteReply();

                    let msgID = db.user_stats.get(interaction.user.id, 'current_ep_review.msg_id');
                    let msgGuildID = db.user_stats.get(interaction.user.id, 'current_ep_review.guild_id');
                    let msgChannelID = db.user_stats.get(interaction.user.id, 'current_ep_review.channel_id');
                    let channelsearch = await get_review_channel(client, msgGuildID, msgChannelID, msgID);

                    let msgEmbed;
                    let epArtists;
                    let ep_name = db.user_stats.get(interaction.user.id, 'current_ep_review.ep_name');
                    let setterEpName = convertToSetterName(ep_name);
                    let collab;
                    let field_name;
                    let type = db.user_stats.get(interaction.user.id, 'current_ep_review.review_type'); // Type A is when embed length is under 2000 characters, type B is when its over 2000
                    let ep_songs = db.user_stats.get(interaction.user.id, 'current_ep_review.track_list');
                    let next_song = db.user_stats.get(interaction.user.id, 'current_ep_review.next');
                    if (ep_songs == false) ep_songs = [];
                    let ep_last_song_rows = [
                        new ActionRowBuilder()
                            .addComponents( 
                                new ButtonBuilder()
                                    .setCustomId('ep_rating')
                                    .setLabel('Overall Rating')
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji('📝'),
                                new ButtonBuilder()
                                    .setCustomId('ep_review')
                                    .setLabel('Overall Review')
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji('📝'),
                            ), 
                        new ActionRowBuilder()
                            .addComponents( 
                                new ButtonBuilder()
                                .setCustomId('finish_ep_review')
                                .setLabel('Finalize the EP/LP Review')
                                .setStyle(ButtonStyle.Success),
                            ),
                    ];

                    // If the song we are reviewing is not the same as our next song up, then quit out
                    if (spotifyApi != false || db.user_stats.get(interaction.user.id, 'current_ep_review.next') != false) {
                        if (next_song != songName && next_song != undefined) {
                            return;
                        } else {
                            for (let ind = 0; ind < ep_songs.length; ind++) {
                                if (ep_songs[ind] == next_song) {
                                    next_song = ep_songs[ind + 1];
                                    db.user_stats.set(interaction.user.id, next_song, 'current_ep_review.next');
                                    break;
                                }
                            }
                        }
                    }

                    // Review the song
                    await review_song(interaction, artistArray, origArtistArray, songName, origSongName, review, rating, starred, rmxArtistArray, songArt, taggedUser.id, spotifyUri, ep_name);

                    // Add or remove this song from the users star spotify playlist, if they have one
                    let starPlaylistId = db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist');
                    if (starred == true) {
                        if (spotifyApi != false && db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist') != false && db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist') != undefined && spotifyUri != false) {
                            // Add to spotify playlist
                            await spotifyApi.addTracksToPlaylist(starPlaylistId, [spotifyUri]).then(() => {}, function(err) { console.log('Something went wrong!', err); });
                        }
                    } else {
                        if (spotifyApi != false && db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist') != false && db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist') != undefined && spotifyUri != false) {
                            // Remove from spotify playlist
                            await spotifyApi.removeTracksFromPlaylist(starPlaylistId, [{ uri: spotifyUri }]).then(() => {}, function(err) { console.log('Something went wrong!', err); });
                        }
                    }

                    // Edit the EP embed
                    await channelsearch.messages.fetch(`${msgID}`).then(msg => {

                        msgEmbed = EmbedBuilder.from(msg.embeds[0]);
                        epArtists = db.user_stats.get(interaction.user.id, 'current_ep_review.artist_array');

                        for (let j = 0; j < artistArray.length; j++) {
                            db.reviewDB.set(artistArray[j], ep_name, `${setterSongName}.ep`);
                        }

                        if (msgEmbed.data.thumbnail != undefined && msgEmbed.data.thumbnail != null && msgEmbed.data.thumbnail != false && songArt == false) {
                            songArt = msgEmbed.data.thumbnail.url;
                        }

                        collab = origArtistArray.filter(x => !epArtists.includes(x)); // Filter out the specific artist in question
                        if (starred == true) {
                            field_name = `🌟 ${displaySongName}${collab.length != 0 ? ` (with ${collab.join(' & ')})` : ''}${rating !== false ? ` (${rating}/10)` : ``} 🌟`;
                        } else {
                            field_name = `${displaySongName}${collab.length != 0 ? ` (with ${collab.join(' & ')})` : ''}${rating !== false ? ` (${rating}/10)` : ``}`;
                        }

                        // If the entire EP/LP review is over 5250 characters, set EP/LP review type to "B" (aka hide any more reviews from that point)
                        if (new Embed(msgEmbed.toJSON()).length > 5250 && type == 'A') {
                            db.user_stats.set(interaction.user.id, 'B', 'current_ep_review.review_type');
                            type = 'B';
                        }

                        // Check what review type we are and add in reviews to the EP/LP review message accordingly
                        if (type == 'A') {
                            if (review.length <= 1000) {
                                msgEmbed.addFields({
                                    name: field_name,
                                    value: `${review}`,
                                    inline: false,
                                });
                            } else {
                                msgEmbed.addFields({
                                    name: field_name,
                                    value: (review != false) ? `*Review hidden to save space*` : `*No review written*`,
                                    inline: false,
                                });
                            }
                        } else {
                            msgEmbed.addFields({
                                name: field_name,
                                value: (review != false) ? `*Review hidden to save space*` : `*No review written*`,
                                inline: false,
                            });
                        }

                        // If we are on the last one, setup a collector to finish up an EP/LP review and some buttons for editing the overall rating/review of it.
                        if (ep_songs[ep_songs.length - 1] == songName) {
                            msg.edit({ embeds: [msgEmbed], components: ep_last_song_rows });

                            const ep_final_filter = int => int.user.id == interaction.user.id;
                            const msg_filter = m => m.author.id == interaction.user.id;
                            let ep_final_collector = int_channel.createMessageComponentCollector({ filter: ep_final_filter, time: 120000 });
                            let overallRating, overallReview;

                            interaction.followUp({ content: `Make sure you click Finalize Review button to finalize your EP/LP review, and add/edit an overall rating/review of it if you'd like!`, ephemeral: true });

                            ep_final_collector.on('collect', async j => {
                                switch (j.customId) {
                                    case 'ep_rating':
                                        await j.deferUpdate();
                                        await j.editReply({ content: `Type in the overall rating (DO NOT ADD \`/10\`!)`, embeds: [], components: [] });
                
                                        ra_collector = interaction.channel.createMessageCollector({ filter: msg_filter, max: 1, time: 60000 });
                                        ra_collector.on('collect', async m => {
                                            overallRating = m.content;
                                            if (overallRating.includes('/10')) overallRating = overallRating.replace('/10', '');
                                            overallRating = parseFloat(overallRating);
                                            if (isNaN(overallRating)) j.editReply('The rating you put in is not valid, please make sure you put in an integer or decimal rating for your replacement rating!');
                                            msgEmbed.setTitle(`${epArtists} - ${ep_name} (${overallRating}/10)`);
                                            for (let artist of epArtists) {
                                                db.reviewDB.set(artist, overallRating, `${setterEpName}.${interaction.user.id}.rating`);
                                            }
                                            
                                            await j.editReply({ content: null, embeds: [msgEmbed], components: ep_last_song_rows });
                                            m.delete();
                                        });
                                        
                                        ra_collector.on('end', async () => {
                                            await j.editReply({ content: null, embeds: [msgEmbed], components: ep_last_song_rows });
                                        });
                                    break;
                                    case 'ep_review':
                                        await j.deferUpdate();
                                        await j.editReply({ content: `Type in the new overall review.`, embeds: [], components: [] });

                                        re_collector = interaction.channel.createMessageCollector({ filter: msg_filter, max: 1, time: 120000 });
                                        re_collector.on('collect', async m => {
                                            overallReview = m.content;
                                            if (overallReview.includes('\\n')) {
                                                overallReview = overallReview.split('\\n').join('\n');
                                            }

                                            msgEmbed.setDescription(`*${overallReview}*`);
                                            for (let artist of epArtists) {
                                                db.reviewDB.set(artist, overallReview, `${setterEpName}.${interaction.user.id}.review`);
                                            }

                                            await j.editReply({ embeds: [msgEmbed], components: ep_last_song_rows });
                                            m.delete();
                                        });
                                        
                                        re_collector.on('end', async () => {
                                            await j.editReply({ content: null, embeds: [msgEmbed], components: ep_last_song_rows });
                                        });
                                    break;
                                    case 'finish_ep_review':
                                        db.user_stats.set(interaction.user.id, false, 'current_ep_review');
                                        // If this is a mailbox review, attempt to remove the song from the mailbox spotify playlist
                                        if (is_mailbox == true) {
                                            let tracks = [];
        
                                            temp_mailbox_list = mailbox_list.filter(v => v.display_name == `${origArtistArray.join(' & ')} - ${ep_name}`);
                                            if (temp_mailbox_list.length != 0) {
                                                mailbox_data = temp_mailbox_list[0];
                                                if (db.user_stats.get(mailbox_data.user_who_sent, 'config.review_ping') == true) ping_for_review = true;
                                            }
        
                                            for (let track_uri of mailbox_data.track_uris) {
                                                tracks.push({ uri: track_uri });
                                            } 
                                            
                                            let playlistId = db.user_stats.get(interaction.user.id, 'mailbox_playlist_id');
                                            // Ping the user who sent the review, if they have the ping for review config setting
                                            if (ping_for_review) {
                                                interaction.channel.send(`<@${mailbox_data.user_who_sent}>`).then(ping_msg => {
                                                    ping_msg.delete();
                                                });
                                            }
        
                                            // Remove from spotify playlist
                                            spotifyApi.removeTracksFromPlaylist(playlistId, tracks)
                                            .then(() => {}, function(err) {
                                                console.log('Something went wrong!', err);
                                            });
        
                                            // Remove from local playlist
                                            mailbox_list = mailbox_list.filter(v => v.display_name != `${origArtistArray.join(' & ')} - ${ep_name}`);
                                            db.user_stats.set(interaction.user.id, mailbox_list, `mailbox_list`);
                                        }
        
                                        msg.edit({ components: [] });
                                        ep_final_collector.stop();
                                    break;
                                }
                                
                            });

                            ep_final_collector.on('end', async () => {
                                msg.edit({ components: [] });
                            });

                        } else {
                            msg.edit({ embeds: [msgEmbed], components: [] });
                        }

                    }).catch((err) => {
                        handle_error(interaction, err);
                    });

                    for (let ii = 0; ii < epArtists.length; ii++) {
                        // Update EP details
                        if (!ep_songs.includes(ep_name)) {
                            await db.reviewDB.push(epArtists[ii], songName, `${setterEpName}.songs`);
                        }
                    }

                    // Set the IDs for this review to false (because we don't want to edit it), since its part of the EP review message.
                    for (let ii = 0; ii < artistArray.length; ii++) {
                        db.reviewDB.set(artistArray[ii], false, `${setterSongName}.${interaction.user.id}.msg_id`);
                        db.reviewDB.set(artistArray[ii], false, `${setterSongName}.${interaction.user.id}.channel_id`);
                        db.reviewDB.set(artistArray[ii], interaction.guild.id, `${setterSongName}.${interaction.user.id}.guild_id`);
                    }

                    // Set artist images
                    for (let j = 0; j < allArtistArray.length; j++) {
                        let cur_img = db.reviewDB.get(allArtistArray[j], 'pfp_image');
                        if (cur_img == undefined || cur_img == false) {
                            db.reviewDB.set(allArtistArray[j], artistImgs[j], `pfp_image`); 
                        }
                    }

                    // Update user stats
                    await updateStats(interaction, interaction.guild.id, origArtistArray, artistArray, rmxArtistArray, songName, displaySongName, db.reviewDB.get(artistArray[0], `${songName}`), false);

                    // Update hall of fame
                    await hallOfFameCheck(interaction, client, interaction.guild.id, artistArray, origArtistArray, songName, displaySongName);

                } break;
                case 'done': { // Send the review to the database
                    await i.update({ content: null, embeds: [reviewEmbed], components: [] });

                    // Review the song
                    await review_song(interaction, artistArray, origArtistArray, songName, origSongName, review, rating, starred, rmxArtistArray, songArt, taggedUser.id, spotifyUri);
                    const msg = await interaction.fetchReply();

                    // Add or remove this song from the users star spotify playlist, if they have one
                    let starPlaylistId = await db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist');
                    if (starred == true) {
                        if (spotifyApi != false && db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist') != false && db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist') != undefined && spotifyUri != false) {
                            // Add to spotify playlist
                            await spotifyApi.addTracksToPlaylist(starPlaylistId, [spotifyUri]).then(() => {}, function(err) { console.log('Something went wrong!', err); });
                        }
                    } else {
                        if (spotifyApi != false && db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist') != false && db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist') != undefined && spotifyUri != false) {
                            // Remove from spotify playlist
                            await spotifyApi.removeTracksFromPlaylist(starPlaylistId, [{ uri: spotifyUri }]).then(() => {}, function(err) { console.log('Something went wrong!', err); });
                        }
                    }

                    // Setting the message id, channel id, guild id, and message url for the message we just sent
                    for (let ii = 0; ii < artistArray.length; ii++) {
                        db.reviewDB.set(artistArray[ii], msg.id, `${setterSongName}.${interaction.user.id}.msg_id`); 
                        db.reviewDB.set(artistArray[ii], interaction.channel.id, `${setterSongName}.${interaction.user.id}.channel_id`); 
                        db.reviewDB.set(artistArray[ii], interaction.guild.id, `${setterSongName}.${interaction.user.id}.guild_id`); 
                        db.reviewDB.set(artistArray[ii], msg.url, `${setterSongName}.${interaction.user.id}.url`);
                    }

                    // Set artist images
                    for (let j = 0; j < allArtistArray.length; j++) {
                        let cur_img = db.reviewDB.get(allArtistArray[j], 'pfp_image');
                        if (cur_img == undefined || cur_img == false) {
                            db.reviewDB.set(allArtistArray[j], artistImgs[j], `pfp_image`); 
                        }
                    }

                    // Fix artwork on all reviews for this song
                    if (songArt != false && db.reviewDB.has(artistArray[0])) {
                        update_art(interaction, client, artistArray[0], songName, songArt);
                    }

                    // Update user stats
                    await updateStats(interaction, interaction.guild.id, origArtistArray, artistArray, rmxArtistArray, songName, displaySongName, db.reviewDB.get(artistArray[0], `${songName}`), false);

                    // Update hall of fame
                    await hallOfFameCheck(interaction, client, interaction.guild.id, artistArray, origArtistArray, songName, displaySongName);

                    // If this is a mailbox review, attempt to remove the song from the mailbox spotify playlist
                    if (is_mailbox == true) {
                        let tracks = [{ uri: mailbox_data.track_uris[0] }];
                        let playlistId = db.user_stats.get(interaction.user.id, 'mailbox_playlist_id');
                        // Ping the user who sent the review, if they have the ping for review config setting
                        if (ping_for_review) {
                            interaction.channel.send(`<@${mailbox_data.user_who_sent}>`).then(ping_msg => {
                                ping_msg.delete();
                            });
                        }

                        // Remove from spotify playlist
                        spotifyApi.removeTracksFromPlaylist(playlistId, tracks)
                        .then(() => {}, function(err) {
                            console.log('Something went wrong!', err);
                        });

                        // Remove from local playlist
                        if (spotifyApi != false) {
                            mailbox_list = mailbox_list.filter(v => v.spotify_id != spotifyUri.replace('spotify:track:', '').replace('spotify:album:', ''));
                        } else {
                            mailbox_list = mailbox_list.filter(v => v.display_name != `${origArtistArray.join(' & ')} - ${displaySongName}`);
                        }

                        db.user_stats.set(interaction.user.id, mailbox_list, `mailbox_list`);
                    }
                
                    // End the collector
                    collector.stop();
                } break;
            }
        });

        collector.on('end', async () => {
            if (a_collector != undefined) a_collector.stop();
            if (s_collector != undefined) s_collector.stop();
            if (ra_collector != undefined) ra_collector.stop();
            if (re_collector != undefined) re_collector.stop();
        });

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};
