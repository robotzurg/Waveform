const db = require("../db.js");
const { update_art, review_song, hall_of_fame_check, handle_error, find_review_channel, grab_spotify_art, parse_artist_song_data, isValidURL } = require('../func.js');
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

            /*.addStringOption(option => 
                option.setName('tag')
                    .setDescription('Put a tag you want to set the song to here!')
                    .setAutocomplete(true)
                    .setRequired(false))*/

            .addUserOption(option => 
                option.setName('user_who_sent')
                    .setDescription('User who sent you this song in Mailbox. Ignore if not a mailbox review.')
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

            /*.addStringOption(option => 
                option.setName('tag')
                    .setDescription('Put a tag you want to set the song to here!')
                    .setAutocomplete(true)
                    .setRequired(false))*/

            .addUserOption(option => 
                option.setName('user_who_sent')
                    .setDescription('User who sent you this song in Mailbox. Ignore if not a mailbox review.')
                    .setRequired(false))

            .addStringOption(option => 
                option.setName('art')
                    .setDescription('Image link of the song art (put \'s\' here if you want to use your spotify playback.)')
                    .setRequired(false))

            .addStringOption(option => 
                option.setName('vocalist')
                    .setDescription('If you want the song name to have a (ft.) in it for artists, use this argument.')
                    .setAutocomplete(true))),
    help_desc: `TBD`,
	async execute(interaction) {
        try {
        await interaction.deferReply();
        // These variables are here so that we can start a review from anywhere else
        let int_channel = interaction.channel;
        let mailboxes = db.server_settings.get(interaction.guild.id, 'mailboxes');

        // Check if we are reviewing in the right chat, if not, boot out
        if (`<#${int_channel.id}>` != db.server_settings.get(interaction.guild.id, 'review_channel') && !mailboxes.some(v => v.includes(int_channel.id))) {
            return await interaction.editReply(`You can only send reviews in ${db.server_settings.get(interaction.guild.id, 'review_channel')} or mailboxes!`);
        }

        let vocalistArray = interaction.options.getString('vocalist');
        let rmxArtistArray = interaction.options.getString('remixers');

        let artists = interaction.options.getString('artist');
        let song = interaction.options.getString('song_name');
        
        // Songname check to avoid not using the arguments properly.
        if (song != null) {
            if (song.includes('Remix)') || song.includes('ft.') || song.includes('feat.')) {
                await interaction.editReply('Please make sure that no artist names are placed in the song name argument.\n' + 
                'For example, do not put `Song (Dude Remix)`, just put `Song`, and put the remixer in the Remixers argument.');
                return;
            }
        }

        let song_info = await parse_artist_song_data(interaction, artists, song, rmxArtistArray, vocalistArray);
        if (song_info == -1) {
            await interaction.editReply('Waveform ran into an issue pulling up song data.');
            return;
        } 

        let origArtistArray = song_info.prod_artists;
        let songName = song_info.song_name;
        let artistArray = song_info.all_artists;
        rmxArtistArray = song_info.remix_artists;
        vocalistArray = song_info.vocal_artists;
        let displaySongName = song_info.display_song_name;
        let origSongName = song_info.main_song_name;
        // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
        let setterSongName = songName.includes('.') ? `["${songName}"]` : songName;

        let rating = interaction.options.getString('rating');
        if (rating == null) rating = false;
        let review = interaction.options.getString('review');
        if (review == null) review = false;
        let tag = interaction.options.getString('tag');
        let songArt = interaction.options.getString('art');
        let user_who_sent = interaction.options.getUser('user_who_sent');
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
        const editButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('artist').setLabel('Artist')
                .setStyle(ButtonStyle.Primary).setEmoji('📝'),
            new ButtonBuilder()
                .setCustomId('song').setLabel('Song')
                .setStyle(ButtonStyle.Primary).setEmoji('📝'),
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
                    .setCustomId('done').setLabel('Send to Database')
                    .setStyle(ButtonStyle.Success),
                );
            }
        } else {
            reviewButtons.addComponents( 
                new ButtonBuilder()
                .setCustomId('done').setLabel('Send to Database')
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
            songArt = await grab_spotify_art(origArtistArray, songName, interaction);
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

        // Start creation of embed
        let reviewEmbed = new EmbedBuilder()
        .setColor(`${interaction.member.displayHexColor}`)
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

        if (review == false && rating === false) {
            return await interaction.editReply('Your song review must either have a rating or review, it cannot be missing both.');
        } else {
            if (rating !== false) reviewEmbed.addFields([{ name: 'Rating: ', value: `**${rating}/10**`, inline: true }]);
            if (review != false) reviewEmbed.setDescription(review);
        }
        
        if (songArt == false || songArt == undefined) {
            await reviewEmbed.setThumbnail(interaction.user.avatarURL({ extension: "png", dynamic: false }));
        } else {
            await reviewEmbed.setThumbnail(songArt);
        }
        
        if (taggedUser != false && taggedUser != undefined) {
            reviewEmbed.setFooter({ text: `Sent by ${taggedMember.displayName}`, iconURL: taggedUser.avatarURL({ extension: "png", dynamic: false }) });
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
                            artistArray = [origArtistArray, vocalistArray];
                            artistArray = artistArray.flat(1);
                        }
                        
                        if (starred == false) {
                            reviewEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                        } else {
                            reviewEmbed.setTitle(`🌟 ${origArtistArray.join(' & ')} - ${displaySongName} 🌟`);
                        }

                        // Check if we have art for the edited song info in the database
                        if (songArt == undefined || songArt == false) {
                            // If we don't have art for the edited song info, search it on the spotify API.
                            songArt = await grab_spotify_art(artistArray, songName, interaction);
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
                        `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}` +
                        `${(rmxArtistArray.length != 0) ? ` (${rmxArtistArray.join(' & ')} Remix)` : ``}`);

                        if (starred == false) {
                            reviewEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                        } else {
                            reviewEmbed.setTitle(`🌟 ${origArtistArray.join(' & ')} - ${displaySongName} 🌟`);
                        }

                        // Check if we have art for the edited song info in the database
                        if (songArt == undefined || songArt == false) {
                            // If we don't have art for the edited song info, search it on the spotify API.
                            songArt = await grab_spotify_art(artistArray, songName, interaction);
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
                    await i.editReply({ content: 'Type in the rating (DO NOT WRITE /10!)', components: [] });

                    const ra_filter = m => m.author.id == interaction.user.id;
                    ra_collector = int_channel.createMessageCollector({ filter: ra_filter, max: 1, time: 60000 });
                    ra_collector.on('collect', async m => {
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
                    if (rating < 8) return await i.update({ embeds: [reviewEmbed], components: [editButtons, reviewButtons] });

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

                    let msgtoEdit = db.user_stats.get(interaction.user.id, 'current_ep_review.msg_id');
                    let channelsearch = await find_review_channel(interaction, interaction.user.id, msgtoEdit);

                    let msgEmbed;
                    let mainArtists;
                    let ep_name;
                    let collab;
                    let field_name;
                    let type = db.user_stats.get(interaction.user.id, 'current_ep_review.review_type'); // Type A is when embed length is under 2000 characters, type B is when its over 2000
                    let ep_songs;
                    let ep_last_song_button = new ActionRowBuilder()
                    .addComponents( 
                        new ButtonBuilder()
                        .setCustomId('finish_ep_review')
                        .setLabel('Finalize the EP/LP Review')
                        .setStyle(ButtonStyle.Success),
                    );

                    // Review the song
                    await review_song(interaction, artistArray, origArtistArray, songName, origSongName, review, rating, rmxArtistArray, vocalistArray, songArt, taggedUser.id, ep_name, tag);

                    // Edit the EP embed
                    await channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {

                        msgEmbed = EmbedBuilder.from(msg.embeds[0]);
                        mainArtists = [msgEmbed.data.title.replace('🌟 ', '').trim().split(' - ')[0].split(' & ')];
                        mainArtists = mainArtists.flat(1);
                        ep_name = db.user_stats.get(interaction.user.id, 'current_ep_review.ep_name');
                        ep_songs = db.user_stats.get(interaction.user.id, 'current_ep_review.track_list');
                        if (ep_songs == false) ep_songs = [];

                        for (let j = 0; j < artistArray.length; j++) {
                            db.reviewDB.set(artistArray[j], ep_name, `${setterSongName}.ep`);
                        }

                        if (msgEmbed.data.thumbnail != undefined && msgEmbed.data.thumbnail != null && msgEmbed.data.thumbnail != false && songArt == false) {
                            songArt = msgEmbed.data.thumbnail.url;
                        }

                        collab = origArtistArray.filter(x => !mainArtists.includes(x)); // Filter out the specific artist in question
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

                        if (ep_songs[ep_songs.length - 1] == songName) {
                            msg.edit({ embeds: [msgEmbed], components: [ep_last_song_button] });

                            const ep_final_filter = int => int.user.id == interaction.user.id;
                            let ep_final_collector = int_channel.createMessageComponentCollector({ filter: ep_final_filter, max: 1, time: 60000 });

                            ep_final_collector.on('collect', async () => {
                                db.user_stats.set(interaction.user.id, false, 'current_ep_review');
                                msg.edit({ components: [] });
                            });

                            ep_final_collector.on('end', async () => {
                                msg.edit({ components: [] });
                            });

                        } else {
                            msg.edit({ embeds: [msgEmbed], components: [] });
                        }

                        // Star reaction stuff for hall of fame
                        if (rating >= 8 && starred == true) {
                            for (let x = 0; x < artistArray.length; x++) {
                                db.reviewDB.set(artistArray[x], true, `${setterSongName}.${interaction.user.id}.starred`);
                            }

                            db.user_stats.push(interaction.user.id, `${origArtistArray.join(' & ')} - ${songName}${vocalistArray.length != 0 ? ` (ft. ${vocalistArray})` : '' }`, 'star_list');
                            hall_of_fame_check(interaction, artistArray, origArtistArray, songName, displaySongName, songArt);
                        }
                    }).catch((err) => {
                        handle_error(interaction, err);
                    });

                    // Update user stats
                    db.user_stats.set(interaction.user.id, `${origArtistArray.join(' & ')} - ${displaySongName}`, 'recent_review');

                    for (let ii = 0; ii < mainArtists.length; ii++) {
                        // Update EP details
                        if (!ep_songs.includes(ep_name)) {
                            let setterEpName = ep_name.includes('.') ? `["${ep_name}"]` : ep_name;
                            await db.reviewDB.push(mainArtists[ii], songName, `${setterEpName}.songs`);
                        }
                    }

                    // Set msg_id for this review to false, since its part of the EP review message
                    for (let ii = 0; ii < artistArray.length; ii++) {
                        db.reviewDB.set(artistArray[ii], false, `${setterSongName}.${interaction.user.id}.msg_id`);
                    }

                } break;
                case 'done': { // Send the review to the database
                    await i.update({ content: null, embeds: [reviewEmbed], components: [] });

                    // Review the song
                    await review_song(interaction, artistArray, origArtistArray, songName, origSongName, review, rating, rmxArtistArray, vocalistArray, songArt, taggedUser.id, false, tag);

                    // Update user stats
                    db.user_stats.set(interaction.user.id, `${artistArray.join(' & ')} - ${displaySongName}`, 'recent_review');
                    
                    const msg = await interaction.fetchReply();

                    // Setup tags if necessary
                    if (tag != null) {
                        if (db.tags.has(tag)) {
                            db.tags.push(tag, `${origArtistArray.join(' & ')} - ${displaySongName}`, 'song_list');
                        } else {
                            db.tags.set(tag, [`${origArtistArray.join(' & ')} - ${displaySongName}`], 'song_list');
                            db.tags.set(tag, false, 'image');
                        }
                    }

                    // Setting the message id and url for the message we just sent
                    for (let ii = 0; ii < artistArray.length; ii++) {
                        db.reviewDB.set(artistArray[ii], msg.id, `${setterSongName}.${interaction.user.id}.msg_id`); 
                        db.reviewDB.set(artistArray[ii], msg.url, `${setterSongName}.${interaction.user.id}.url`); 
                    }

                    // Star reaction stuff for hall of fame
                    if (rating >= 8 && starred == true) {
                        for (let x = 0; x < artistArray.length; x++) {
                            db.reviewDB.set(artistArray[x], true, `${setterSongName}.${interaction.user.id}.starred`);
                        }

                        db.user_stats.push(interaction.user.id, `${origArtistArray.join(' & ')} - ${songName}${vocalistArray.length != 0 ? ` (ft. ${vocalistArray.join(' & ')})` : '' }`, 'star_list');
                        await hall_of_fame_check(interaction, artistArray, origArtistArray, songName, displaySongName, songArt);
                    }

                    // Fix artwork on all reviews for this song
                    if (songArt != false && db.reviewDB.has(artistArray[0])) {
                        await update_art(interaction, artistArray[0], songName, songArt);
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
