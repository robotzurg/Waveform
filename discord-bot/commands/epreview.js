const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, SlashCommandBuilder, ButtonStyle } = require('discord.js');
const db = require("../db.js");
const { handle_error, review_ep, grab_spotify_art, parse_artist_song_data, isValidURL, spotify_api_setup, grab_spotify_artist_art, update_art, updateStats, getEmbedColor, convertToSetterName, getTrackList } = require('../func.js');
const SpotifyWebApi = require('spotify-web-api-node');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('epreview')
        .setDescription('Review an EP/LP.')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand.setName('with_spotify')
            .setDescription('Review an EP/LP by utilizing the album of your currently playing spotify song. (requires login)')
            .addStringOption(option => 
                option.setName('overall_rating')
                    .setDescription('Overall Rating of the EP/LP. Out of 10, decimals allowed. Can be added later.')
                    .setRequired(false)
                    .setMaxLength(3))
    
            .addStringOption(option => 
                option.setName('overall_review')
                    .setDescription('Overall Review of the EP/LP. Can be added later.')
                    .setRequired(false))
    
            .addStringOption(option => 
                option.setName('art')
                    .setDescription('Art for the EP/LP. (Leave blank for automatic spotify searching.)')
                    .setRequired(false))
    
            .addUserOption(option => 
                option.setName('user_who_sent')
                    .setDescription('User who sent you this EP/LP in Mailbox. Ignore if not a mailbox review.')
                    .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand.setName('manually')
            .setDescription('Review an EP/LP by putting in the information manually.')
            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the MAIN EP/LP artist(s). (separate with &, Do not put any one-off collaborators here.)')
                    .setAutocomplete(true)
                    .setRequired(true))
    
            .addStringOption(option => 
                option.setName('ep_name')
                    .setDescription('The name of the EP/LP. (INCLUDE EP OR LP IN THE TITLE!)')
                    .setAutocomplete(true)
                    .setRequired(true))
    
            .addStringOption(option => 
                option.setName('overall_rating')
                    .setDescription('Overall Rating of the EP/LP. Out of 10, decimals allowed. Can be added later.')
                    .setRequired(false)
                    .setMaxLength(3))
    
            .addStringOption(option => 
                option.setName('overall_review')
                    .setDescription('Overall Review of the EP/LP. Can be added later.')
                    .setRequired(false))
    
            .addStringOption(option => 
                option.setName('art')
                    .setDescription('Art for the EP/LP. (Leave blank for automatic spotify searching.)')
                    .setRequired(false))
    
            .addUserOption(option => 
                option.setName('user_who_sent')
                    .setDescription('User who sent you this EP/LP in Mailbox. Ignore if not a mailbox review.')
                    .setRequired(false)))

            .addSubcommand(subcommand =>
                subcommand.setName('spotify_link')
                .setDescription('Review an EP/LP by entering a spotify link.')
    
                .addStringOption(option =>
                    option.setName('spotify_link')
                        .setDescription('Spotify link of the EP/LP. Must be an "open.spotify.com" link.')
                        .setRequired(true)
                        .setMinLength(15))
    
                .addStringOption(option => 
                    option.setName('overall_rating')
                        .setDescription('Overall Rating of the EP/LP. Out of 10, decimals allowed. Can be added later.')
                        .setRequired(false)
                        .setMaxLength(3))
        
                .addStringOption(option => 
                    option.setName('overall_review')
                        .setDescription('Overall Review of the EP/LP. Can be added later.')
                        .setRequired(false))
    
                .addUserOption(option => 
                    option.setName('user_who_sent')
                        .setDescription('User who sent you this EP/LP in Mailbox. Ignore if not a mailbox review.')
                        .setRequired(false))
    
                .addStringOption(option => 
                    option.setName('art')
                        .setDescription('Image link of the EP/LP art. Leaving blank will pull from Spotify.')
                        .setRequired(false))),
    help_desc: `Start or create an EP/LP (aka album) review on Waveform. See the "EP/LP Review Guide" button to find out how this works.\n\n`
    + `The subcommand \`with_spotify\` pulls from your spotify playback to fill in arguments (if logged into Waveform with Spotify)` + 
    ` while the \`manually\` subcommand allows you to manually type in the EP/LP name yourself.` + 
    ` and the \`spotify_link\` subcommand allows you to review by placing in a valid open.spotify.com EP/LP link.`,
	async execute(interaction, client) {
        try {
            // Check if we have an existing EP/LP review running, and back out immediately if we do.
            if (db.user_stats.get(interaction.user.id, 'current_ep_review') != false) {
                let epReviewUserData = db.user_stats.get(interaction.user.id, 'current_ep_review');
                let type = epReviewUserData.ep_name.includes(' LP') ? 'LP' : 'EP'; 
                return interaction.reply(`You already have an ${type} review for ${epReviewUserData.artist_array.join(' & ')} - ${epReviewUserData.ep_name} in progress.\n` + 
                `Please finish reviewing all songs on the ${type} review before starting a new one, or run \`/epdone\` to manually end the review.`);
            }
            let spotifyUri;
            let art = interaction.options.getString('art');
            let artists = interaction.options.getString('artist');
            let ep = interaction.options.getString('ep_name');
            let trackList = false;
            let passesChecks = true;

            // Handle spotify link if we have one
            if (interaction.options.getSubcommand() == 'spotify_link') {
                // Create the api object with the credentials
                let spotifyApi = new SpotifyWebApi({
                    redirectUri: process.env.SPOTIFY_REDIRECT_URI,
                    clientId: process.env.SPOTIFY_API_ID,
                    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
                });
                
                // Retrieve an access token.
                await spotifyApi.clientCredentialsGrant().then(
                    function(data) {
                        // Save the access token so that it's used in future calls
                        spotifyApi.setAccessToken(data.body['access_token']);
                    },
                    function(err) {
                        console.log('Something went wrong when retrieving an access token', err);
                    },
                );
                let trackLink = interaction.options.getString('spotify_link');
                if (trackLink.includes('spotify.link')) return interaction.reply('The link type `spotify.link` is not supported on Waveform. Please use a valid `open.spotify.com` link instead.');
                let mainId = trackLink.split('/')[4].split('?')[0];

                if (trackLink.includes("album")) {
                    await spotifyApi.getAlbum(mainId).then(async data => {
                        data = data.body;
                        spotifyUri = `spotify:album:${data.id}`;
                        art = data.images[0].url;
                        ep = `${data.name} ${data.type == 'album' ? `LP` : `EP`}`;
                        artists = data.artists.map(artist => artist.name);
                        artists = artists.map(a => {
                            if (a.includes(' & ')) {
                                return a.replace(' & ', ' \\& ');
                            } else {
                                return a;
                            }
                        });
                        artists = artists.join(' & ');
                        trackList = getTrackList(data, artists.split(' & '), []);
                        passesChecks = trackList[1];
                        trackList = trackList[0];
                    }).catch((err) => {
                        console.log(`failed to read link because of ${err}`);
                    });

                    if (passesChecks == 'length') {
                        return interaction.reply('This is not on an EP/LP, this is a single. As such, you cannot use this with EP/LP reviews.');
                    }

                } else if (trackLink.includes("track")) {
                    return interaction.reply('You must use `/review` to review an single/remix, and you have input an EP/LP link. Please input a EP/LP link.');
                }
            }

            let song_info = await parse_artist_song_data(interaction, artists, ep, null, trackList);
            if (song_info.error != undefined) {
                await interaction.reply(song_info.error);
                db.user_stats.set(interaction.user.id, false, 'current_ep_review');
                return;
            }

            let origArtistArray = song_info.prod_artists;
            let epName = song_info.song_name;
            let artistArray = song_info.db_artists;
            // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
            let setterEpName = convertToSetterName(epName);
            let epType = epName.includes(' LP') ? `LP` : `EP`;
            spotifyUri = song_info.spotify_uri;
            let currentEpReviewData = song_info.current_ep_review_data;
            if (art == null) art = song_info.art;
            let epPassesChecks = song_info.passes_checks;
        
            let overallRating = interaction.options.getString('overall_rating');
            if (overallRating == null) {
                overallRating = false;
            } else {
                if (overallRating.includes('/10')) overallRating = overallRating.replace('/10', '');
                overallRating = parseFloat(overallRating);
                if (isNaN(overallRating)) return interaction.reply('The rating you put in is not valid, please make sure you put in an integer or decimal rating!');
            }

            let overallReview = interaction.options.getString('overall_review');
            if (overallReview == null) overallReview = false;
            if (overallReview != false) {
                if (overallReview.includes('\\n')) {
                    overallReview = overallReview.split('\\n').join('\n');
                }
            }
            
            let user_who_sent = interaction.options.getUser('user_who_sent');
            if (user_who_sent == null) user_who_sent = false;
            let taggedMember = false;
            let taggedUser = false;
            let starred = false;
            let row2;
            let mailbox_data = false;

            // Check to make sure "EP" or "LP" is in the ep/lp name
            if (!epName.includes(' EP') && !epName.includes(' LP')) {
                return interaction.reply(`You did not add EP or LP (aka album) to the name of the thing you are reviewing, make sure to do that!\n` + 
                `For example: \`${epName} EP\` or \`${epName} LP\``);
            }

            let is_mailbox = false;
            let ping_for_review = false;
            let temp_mailbox_list;
            let mailbox_list = db.user_stats.get(interaction.user.id, 'mailbox_list');
            let spotifyApi;
            // Check if we are in a spotify mailbox
            spotifyApi = await spotify_api_setup(interaction.user.id);
            if (mailbox_list.some(v => v.spotify_id == spotifyUri.replace('spotify:album:', '')) && spotifyApi != false) {
                is_mailbox = true;
            }

            // If we are in the mailbox and don't specify a user who sent, try to pull it from the mailbox list
            if (user_who_sent == false && is_mailbox == true) {
                temp_mailbox_list = mailbox_list.filter(v => v.spotify_id == spotifyUri.replace('spotify:album:', ''));
                if (temp_mailbox_list.length != 0) {
                    mailbox_data = temp_mailbox_list[0];
                    if (mailbox_data.user_who_sent != interaction.user.id) {
                        await interaction.guild.members.fetch(mailbox_data.user_who_sent).then(() => {
                            user_who_sent = client.users.cache.get(mailbox_data.user_who_sent);
                            if (db.user_stats.get(mailbox_data.user_who_sent, 'config.review_ping') == true) ping_for_review = true;
                        }).catch(() => {
                            user_who_sent = false;
                            ping_for_review = false;
                            is_mailbox = false;
                        });
                    } else {
                        is_mailbox = true;
                        user_who_sent = false;
                        ping_for_review = false;
                    }
                }
            }

            if (user_who_sent.id != null && user_who_sent.id != undefined && user_who_sent.id != false) {
                taggedMember = await interaction.guild.members.fetch(user_who_sent.id);
                taggedUser = user_who_sent;
            } else {
                taggedUser = { id: false };
            }

            // Art grabbing
            if (art == false || art == null || art == undefined) {
                art = await grab_spotify_art(origArtistArray, epName);
                if (db.reviewDB.has(artistArray[0])) {
                    if (db.reviewDB.get(artistArray[0], `${setterEpName}`) != undefined) {
                        if (db.reviewDB.get(artistArray[0], `${setterEpName}`).art != false && db.reviewDB.get(artistArray[0], `${setterEpName}`).art != undefined) {
                            art = await db.reviewDB.get(artistArray[0], `${setterEpName}`).art;
                        }
                    }
                }
            } else {
                if (!isValidURL(art)) return interaction.reply(`This ${epType} art URL is invalid.`);
            }

            // Also grab artist images, to set if there is not already an image set.
            let artistImgs = await grab_spotify_artist_art(artistArray);

            // Setup buttons
            const row = new ActionRowBuilder();

            if (interaction.options.getSubcommand() == 'manually') {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('artist')
                        .setLabel('Artist')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📝'),
                    new ButtonBuilder()
                        .setCustomId('ep')
                        .setLabel('Name')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📝'),
                );
            }

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('rating').setLabel('Rating')
                    .setStyle(ButtonStyle.Primary).setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('review').setLabel('Review')
                    .setStyle(ButtonStyle.Primary).setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('star')
                    .setStyle(ButtonStyle.Secondary).setLabel('Favorite').setEmoji('🌟'),
            );


            // Setup bottom row
            if (overallRating == false && overallReview == false) {
                row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('begin')
                        .setLabel(`Begin ${epType} Review`)
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('delete')
                        .setLabel('Delete')
                        .setStyle(ButtonStyle.Danger),
                );
            } else {
                row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('begin')
                        .setLabel(`Begin ${epType} Review`)
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('done')
                        .setLabel(`Review ${epType} Without Individual Song Reviews`)
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('delete')
                        .setLabel('Delete')
                        .setStyle(ButtonStyle.Danger),
                );
            }

            // Set up the embed
            const epEmbed = new EmbedBuilder()
            .setColor(`${getEmbedColor(interaction.member)}`)
            .setTitle(`${artistArray.join(' & ')} - ${epName}`)
            .setAuthor({ name: `${interaction.member.displayName}'s ${epType} review`, iconURL: `${interaction.user.avatarURL({ extension: "png", dynamic: true })}` });

            if (art == false) {
                epEmbed.setThumbnail(interaction.user.avatarURL({ extension: "png", dynamic: true }));
            } else {
                epEmbed.setThumbnail(art);
            }

            if (overallRating !== false && overallReview != false) {
                epEmbed.setDescription(`*${overallReview}*`);
                epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName} (${overallRating}/10)`);
            } else if (overallRating !== false) {
                epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName} (${overallRating}/10)`);
            } else if (overallReview != false) {
                epEmbed.setDescription(`*${overallReview}*`);
            }

            if (taggedUser.id != false) {
                epEmbed.setFooter({ text: `Sent by ${taggedMember.displayName}`, iconURL: `${taggedUser.avatarURL({ extension: "png", dynamic: true })}` });
            }

            await interaction.reply({ embeds: [epEmbed], components: [row, row2] });

            // Grab message id to put in user_stats and the ep object
            const msg = await interaction.fetchReply();

            const filter = i => i.user.id == interaction.user.id;
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 });
            let ra_collector;
            let re_collector;
            let a_collector;
            let name_collector;

            collector.on('collect', async i => {

                switch (i.customId) {
                    case 'artist': {
                        await i.deferUpdate();
                        await i.editReply({ content: 'Type in the artist name(s) (separated with & or x)', components: [] });
                        const a_filter = m => m.author.id == interaction.user.id;
                        a_collector = interaction.channel.createMessageCollector({ filter: a_filter, max: 1, time: 60000 });
                        a_collector.on('collect', async m => {
                            if (m.content.includes(' x ')) {
                                m.content = m.content.replace(' & ', ' \\& ');
                                artistArray = m.content;
                            } else {
                                artistArray = m.content.split(' & ');
                            }

                            // Re-grab artist images with new artists
                            artistImgs = await grab_spotify_artist_art(artistArray);
                            
                            if (starred == false) {
                                epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName}`);
                            } else {
                                epEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${epName} 🌟`);
                            }

                            // Thumbnail image handling
                            if (art == undefined || art == false) {
                                // If we don't have art for the edited ep info, search it on the spotify API.
                                art = await grab_spotify_art(artistArray, epName);
                                if (art == false) art = interaction.user.avatarURL({ extension: "png", dynamic: true });
                            } else {
                                if (db.reviewDB.has(artistArray[0])) art = db.reviewDB.get(artistArray[0], `${setterEpName}`).art;
                                if (art == undefined || art == false) art = interaction.user.avatarURL({ extension: "png", dynamic: true });
                            }
                            epEmbed.setThumbnail(art);

                            await i.editReply({ embeds: [epEmbed], components: [row, row2] });
                            db.user_stats.set(interaction.user.id, artistArray, 'current_ep_review.artist_array');      
                            m.delete();
                        });
                        
                        a_collector.on('end', async () => {
                            await i.editReply({ content: null, embeds: [epEmbed], components: [row, row2] });
                        });
                    } break;
                    case 'ep': {
                        await i.deferUpdate();
                        await i.editReply({ content: 'Type in the new EP/LP name!', components: [] });

                        const name_filter = m => m.author.id == interaction.user.id && (m.content.includes(' EP') || m.content.includes(' LP'));
                        name_collector = interaction.channel.createMessageCollector({ filter: name_filter, max: 1, time: 60000 });
                        name_collector.on('collect', async m => {
                            epName = m.content;
                            if (starred == false) {
                                epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName}`);
                            } else {
                                epEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${epName} 🌟`);
                            }

                            // Thumbnail image handling
                            if (art == undefined || art == false) {
                                // If we don't have art for the edited ep info, search it on the spotify API.
                                art = await grab_spotify_art(artistArray, epName);
                                if (art == false) art = interaction.user.avatarURL({ extension: "png", dynamic: true });
                            } else {
                                if (db.reviewDB.has(artistArray[0])) art = db.reviewDB.get(artistArray[0], `${setterEpName}`).art;
                                if (art == undefined || art == false) art = interaction.user.avatarURL({ extension: "png", dynamic: true });
                            }
                            epEmbed.setThumbnail(art);

                            await i.editReply({ content: null, embeds: [epEmbed], components: [row, row2] });
                            db.user_stats.set(interaction.user.id, epName, 'current_ep_review.ep_name');      
                            m.delete();
                        });
                        
                        name_collector.on('end', async () => {
                            await i.editReply({ content: null, embeds: [epEmbed], components: [row, row2] });
                        });
                    } break;
                    case 'rating': {
                        await i.deferUpdate();
                        await i.editReply({ content: `Type in the overall ${epType} rating (DO NOT ADD \`/10\`!)`, components: [] });

                        const ra_filter = m => m.author.id == interaction.user.id;
                        ra_collector = interaction.channel.createMessageCollector({ filter: ra_filter, max: 1, time: 60000 });
                        ra_collector.on('collect', async m => {
                            overallRating = m.content;
                            if (overallRating == '-') overallRating = false;
                            if (overallRating !== false) {
                                if (overallRating.includes('/10')) overallRating = overallRating.replace('/10', '');
                                overallRating = parseFloat(overallRating);
                                if (isNaN(overallRating)) i.editReply('The rating you put in is not valid, please make sure you put in an integer or decimal rating for your replacement rating!');
                                epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName} (${overallRating}/10)`);
                            } else {
                                epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName}`);
                            }

                            row2 = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('begin')
                                    .setLabel(`Begin ${epType} Review`)
                                    .setStyle(ButtonStyle.Success),
                                new ButtonBuilder()
                                    .setCustomId('done')
                                    .setLabel('Send to Database with No Song Reviews')
                                    .setStyle(ButtonStyle.Success),
                                new ButtonBuilder()
                                    .setCustomId('delete')
                                    .setLabel('Delete')
                                    .setStyle(ButtonStyle.Danger),
                            );
                            
                            await i.editReply({ content: null, embeds: [epEmbed], components: [row, row2] });
                            m.delete();
                        });
                        
                        ra_collector.on('end', async () => {
                            await i.editReply({ content: null, embeds: [epEmbed], components: [row, row2] });
                        });
                    } break;
                    case 'review': {
                        await i.deferUpdate();
                        await i.editReply({ content: `Type in the new overall ${epType} review.`, components: [] });

                        const re_filter = m => m.author.id == interaction.user.id;
                        re_collector = interaction.channel.createMessageCollector({ filter: re_filter, max: 1, time: 120000 });
                        re_collector.on('collect', async m => {
                            overallReview = m.content;

                            if (overallReview.includes('\\n')) {
                                overallReview = overallReview.split('\\n').join('\n');
                            }

                            if (overallReview == '-') overallReview = false;
                            if (overallReview !== false) {
                                epEmbed.setDescription(`*${overallReview}*`);
                            } else {
                                epEmbed.setDescription(null);
                            }

                            row2 = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('begin')
                                    .setLabel(`Begin ${epType} Review`)
                                    .setStyle(ButtonStyle.Success),
                                new ButtonBuilder()
                                    .setCustomId('done')
                                    .setLabel('Send to Database with No Song Reviews')
                                    .setStyle(ButtonStyle.Success),
                                new ButtonBuilder()
                                    .setCustomId('delete')
                                    .setLabel('Delete')
                                    .setStyle(ButtonStyle.Danger),
                            );

                            await i.editReply({ embeds: [epEmbed], components: [row, row2] });
                            m.delete();
                        });
                        
                        re_collector.on('end', async () => {
                            await i.editReply({ content: null, embeds: [epEmbed], components: [row, row2] });
                        });
                    } break;
                    case 'star': {
                        if (starred == false) {
                            if (overallRating !== false) {
                                epEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${epName} (${overallRating}/10) 🌟`);
                            } else {
                                epEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${epName} 🌟`);
                            }
                            starred = true;
                        } else {
                            if (overallRating !== false) {
                                epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName} (${overallRating}/10)`);
                            } else {
                                epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName}`);
                            }
                            starred = false;
                        }

                        await i.update({ embeds: [epEmbed], components: [row, row2] });
                    } break;
                    case 'delete': {
                        db.user_stats.set(interaction.user.id, false, 'current_ep_review');
                        try {
                            await interaction.deleteReply();
                        } catch (err) {
                            console.log(err);
                        }

                        if (ra_collector != undefined) ra_collector.stop();
                        if (re_collector != undefined) re_collector.stop();
                        if (a_collector != undefined) a_collector.stop();
                        if (name_collector != undefined) name_collector.stop();
                        if (collector != undefined) collector.stop(); // Collector for all buttons
                    } break;
                    case 'done': {
                        if (ra_collector != undefined) ra_collector.stop();
                        if (re_collector != undefined) re_collector.stop();
                        if (a_collector != undefined) a_collector.stop();
                        if (name_collector != undefined) name_collector.stop();
                        if (collector != undefined) collector.stop(); // Collector for all buttons
                        
                        db.user_stats.set(interaction.user.id, currentEpReviewData, 'current_ep_review');
                        db.user_stats.set(interaction.user.id, msg.id, 'current_ep_review.msg_id');
                        db.user_stats.set(interaction.user.id, msg.channelId, 'current_ep_review.channel_id');
                        db.user_stats.set(interaction.user.id, msg.guildId, 'current_ep_review.guild_id');

                        await review_ep(interaction, artistArray, epName, overallRating, overallReview, taggedUser, art, starred, spotifyUri);
                        let timestamp = msg.createdTimestamp;

                        // Set message ids and setup artist images
                        for (let j = 0; j < artistArray.length; j++) {
                            db.reviewDB.set(artistArray[j], msg.id, `${setterEpName}.${interaction.user.id}.msg_id`);
                            db.reviewDB.set(artistArray[j], interaction.channel.id, `${setterEpName}.${interaction.user.id}.channel_id`);
                            db.reviewDB.set(artistArray[j], interaction.guild.id, `${setterEpName}.${interaction.user.id}.guild_id`);
                            db.reviewDB.set(artistArray[j], msg.url, `${setterEpName}.${interaction.user.id}.url`);
                            db.reviewDB.set(artistArray[j], timestamp, `${setterEpName}.${interaction.user.id}.timestamp`);
                            db.reviewDB.set(artistArray[j], true, `${setterEpName}.${interaction.user.id}.no_songs`);

                            // Deal with artist images
                            let cur_img = db.reviewDB.get(artistArray[j], 'pfp_image');
                            if (cur_img == undefined || cur_img == false) {
                                db.reviewDB.set(artistArray[j], artistImgs[j], `pfp_image`); 
                            }
                        }

                        // Update user stats
                        await updateStats(interaction, interaction.guild.id, origArtistArray, artistArray, [], epName, epName, db.reviewDB.get(artistArray[0], `${setterEpName}`), true);
                        db.user_stats.set(interaction.user.id, false, 'current_ep_review');

                        if (overallReview !== false || overallRating !== false || starred === false) {
                            if (overallReview != false) await epEmbed.setDescription(`${overallReview}`);
                            if (overallRating !== false) await epEmbed.addFields([{ name: `Rating`, value: `**${overallRating}/10**` }]);
                            if (starred == false) {
                                await epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName}`);
                            } else {
                                await epEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${epName} 🌟`);
                            }
                            
                            await i.update({ embeds: [epEmbed], components: [] });
                        } else {
                            await i.update({ embeds: [epEmbed], components: [] });
                        }

                        //Fix artwork on all reviews for this song
                        if (art != false && db.reviewDB.has(artistArray[0])) {
                            await update_art(interaction, client, artistArray[0], epName, art);
                        }

                        // If this is a mailbox review, attempt to remove the song from the mailbox spotify playlist
                        if (is_mailbox == true) {
                            let tracks = [];
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
                            if (spotifyApi != false) {
                                mailbox_list = mailbox_list.filter(v => v.spotify_id != spotifyUri.replace('spotify:album:', ''));
                            } else {
                                mailbox_list = mailbox_list.filter(v => v.display_name != `${origArtistArray.join(' & ')} - ${epName}`);
                            }
                            db.user_stats.set(interaction.user.id, mailbox_list, `mailbox_list`);
                        }
                    } break;
                    case 'begin': {
                        if (epPassesChecks == "too_long") {
                            return interaction.followUp({ content: 'You cannot review this album with individual song reviews, as it has more than 25 songs in it. You can only review this with an overall rating/review.', ephemeral: true });
                        }
                        if (ra_collector != undefined) ra_collector.stop();
                        if (re_collector != undefined) re_collector.stop();
                        if (a_collector != undefined) a_collector.stop();
                        if (name_collector != undefined) name_collector.stop();
                        if (collector != undefined) collector.stop(); // Collector for all buttons

                        db.user_stats.set(interaction.user.id, currentEpReviewData, 'current_ep_review');
                        db.user_stats.set(interaction.user.id, msg.id, 'current_ep_review.msg_id');
                        db.user_stats.set(interaction.user.id, msg.channelId, 'current_ep_review.channel_id');
                        db.user_stats.set(interaction.user.id, msg.guildId, 'current_ep_review.guild_id');

                        await review_ep(interaction, artistArray, epName, overallRating, overallReview, taggedUser, art, starred, spotifyUri);
                        let timestamp = msg.createdTimestamp;

                        let epSongs = await (db.user_stats.get(interaction.user.id, 'current_ep_review.track_list') != false 
                        ? db.user_stats.get(interaction.user.id, `current_ep_review.track_list`) : db.reviewDB.get(artistArray[0], `${setterEpName}`).songs);
                        if (epSongs == false || epSongs == undefined) epSongs = [];

                        // Set message ids and set artist images
                        for (let j = 0; j < artistArray.length; j++) {
                            db.reviewDB.set(artistArray[j], msg.id, `${setterEpName}.${interaction.user.id}.msg_id`);
                            db.reviewDB.set(artistArray[j], msg.channelId, `${setterEpName}.${interaction.user.id}.channel_id`);
                            db.reviewDB.set(artistArray[j], msg.guildId, `${setterEpName}.${interaction.user.id}.guild_id`);
                            db.reviewDB.set(artistArray[j], msg.url, `${setterEpName}.${interaction.user.id}.url`);
                            db.reviewDB.set(artistArray[j], timestamp, `${setterEpName}.${interaction.user.id}.timestamp`);
                            db.reviewDB.set(artistArray[j], true, `${setterEpName}.${interaction.user.id}.no_songs`);
    
                            // Deal with artist images
                            let cur_img = db.reviewDB.get(artistArray[j], 'pfp_image');
                            if (cur_img == undefined || cur_img == false) {
                                db.reviewDB.set(artistArray[j], artistImgs[j], `pfp_image`); 
                            }
                        }
                        
                        // Update user stats
                        await updateStats(interaction, interaction.guild.id, origArtistArray, artistArray, [], epName, epName, db.reviewDB.get(artistArray[0], `${setterEpName}`), true);
                        await i.update({ embeds: [epEmbed], components: [] });
                        
                        // Fix artwork on all reviews for this song
                        if (art != false && db.reviewDB.has(artistArray[0])) {
                            update_art(interaction, client, artistArray[0], epName, art);
                        }

                        if (epSongs.length != 0) {
                            await i.followUp({ content: `With this button, you must now review each song on this ${epType} in order.\nHere is the order in which you should review the songs on this ${epType}:\n\n**${epSongs.join('\n')}**\n\nMake sure to use \`/review\` to review these songs, one by one!\n` +
                            `Note: You can use \`/epdone\` to end the ${epType} review, if you run into issues or need to end your review early for whatever reason.\n`, ephemeral: true });
                        } else if (interaction.options.getSubcommand() == 'manually') {
                            await i.followUp({ content: `With this button, you must now review each song on this ${epType} in order.\nMake sure to use \`/review\` to review the ${epType} songs, one by one!\nWhen you are finished with this ${epType} review, type \`/epdone\` to finalize the EP/LP review fully! You can also type this command if you run into any issues and need to restart the ${epType} review.`, ephemeral: true });
                        }

                        // Do it again, cause for some reason it sometimes doesn't remove the buttons properly.
                        interaction.editReply({ embeds: [epEmbed], components: [] });
                    } break;
                }
            });

            collector.on('end', async (collected) => {
                if (collected.size == 0) {
                    try {
                        await interaction.deleteReply();
                    } catch (err) {
                        console.log(err);
                    }

                    db.user_stats.set(interaction.user.id, false, 'current_ep_review');
                }

                if (ra_collector != undefined) ra_collector.stop();
                if (re_collector != undefined) re_collector.stop();
                if (a_collector != undefined) a_collector.stop();
                if (name_collector != undefined) name_collector.stop();
            });

        } catch (err) {
            let error = err;
            handle_error(interaction, client, error);
        }
    },
};
