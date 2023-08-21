const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
const db = require('../db.js');
const { spotify_api_setup, parse_artist_song_data, getEmbedColor } = require('../func.js');
const _ = require('lodash');
const SpotifyWebApi = require('spotify-web-api-node');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sendmail')
        .setDescription('Send a song/EP/LP to a users Waveform Mailbox.')
        .setDMPermission(false)
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User whose mailbox you would like to send a song to.')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('link')
                .setDescription('Link to the song you would like to send to the mailbox.')
                .setRequired(false)),
    help_desc: `Send a song to a users Waveform Mailbox, specified with the user argument.\n\n` + 
    `The songs are usually sent from Spotify (mainly), but you can also send YouTube, Apple Music, and SoundCloud links.\n\n` +
    `Leaving the link argument blank will pull from your currently playing song on spotify.`,
	async execute(interaction) {
        await interaction.deferReply();
        let taggedUser = interaction.options.getUser('user');
        let taggedMember = await interaction.guild.members.fetch(taggedUser.id);
        let spotifyCmdUserApi = await spotify_api_setup(interaction.user.id);
        let spotifyTaggedApi = await spotify_api_setup(taggedUser.id);

        let playlistId = db.user_stats.get(taggedUser.id, 'mailbox_playlist_id');
        let trackLink = interaction.options.getString('link');
        let trackUris = []; 
        let trackDurs = []; // Track durations
        let spotifyData;
        let name;
        let artists, displayName, origArtistArray, rmxArtistArray;
        let url;
        let songArt;
        let mainId; // The main ID of the spotify link (the album URI or the main track URI)
        let linkType = 'sp';
        let mailFilter = db.user_stats.get(taggedUser.id, 'config.mail_filter');
        let dmMailConfig = db.user_stats.get(taggedUser.id, 'config.mailbox_dm');
        if (dmMailConfig == undefined) dmMailConfig = true;
        let spotifyCheck = false;
        let passesChecks = true;

        // Pull from spotify playback if trackLink is null
        if (trackLink == null && spotifyCmdUserApi != false) {
            await spotifyCmdUserApi.getMyCurrentPlayingTrack().then(async data => {
                if (data.body.currently_playing_type == 'episode') { spotifyCheck = false; return; }
                trackLink = data.body.item.external_urls.spotify;
                spotifyCheck = true;
            });

            // Check if a podcast is being played, as we don't support that.
            if (spotifyCheck == false) {
                return interaction.reply('Spotify playback not detected. Please start playing a song on spotify before using this command in this way!');
            }
        } else if (spotifyCmdUserApi == false && trackLink == null) {
            return interaction.reply(`You are not logged into spotify with Waveform, so you must specify a track link in the link argument or use \`/login\` to use this command in this way!`);
        }

        // Check if we are in a spotify link, and if not, what kind of link we have
        if (trackLink.includes('spotify')) {
            // Create the api object with the credentials
            let spotifyApi = new SpotifyWebApi({
                redirectUri: process.env.SPOTIFY_REDIRECT_URI,
                clientId: process.env.SPOTIFY_API_ID,
                clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
            });
            
            // Retrieve an access token.
            spotifyApi.clientCredentialsGrant().then(
                function(data) {
                    // Save the access token so that it's used in future calls
                    spotifyApi.setAccessToken(data.body['access_token']);
                },
                function(err) {
                    console.log('Something went wrong when retrieving an access token', err);
                },
            );
            mainId = trackLink.split('/')[4].split('?')[0];

            if (db.user_stats.get(taggedUser.id, 'spotify_playlist') == false || spotifyTaggedApi == false) {
                return interaction.editReply('This user has not setup a spotify mailbox playlist, and thus cannot be sent spotify songs.');
            }

            if (trackLink.includes("track")) {
                await spotifyTaggedApi.getTrack(mainId).then(async data => {
                    data = data.body;
                    mainId = data.id;
                    url = trackLink;
                    songArt = data.album.images[0].url;
                    name = data.name;
                    artists = data.artists.map(artist => artist.name);
                    spotifyData = data;
                }).catch((err) => {
                    console.log(err);
                });
            } else if (trackLink.includes("album")) {
                await spotifyTaggedApi.getAlbum(mainId).then(async data => {
                    data = data.body;
                    mainId = data.id;
                    url = trackLink;
                    songArt = data.images[0].url;
                    name = data.name;
                    artists = data.artists.map(artist => artist.name);
                    spotifyData = data;

                    if (!name.includes(' EP') && !name.includes(' LP')) {
                        if (data.album_type == 'single') name = `${name} EP`;
                        if (data.album_type == 'album') name = `${name} LP`;
                    }
                }).catch((err) => {
                    console.log(err);
                });
            }

            if (spotifyData == undefined) {
                return interaction.editReply('Could not properly parse spotify link data due to an internal error. Please try again, or report this as a bug.');
            }

            artists = artists.map(v => v.replace(' & ', ' \\& '));
            let song_info = await parse_artist_song_data(interaction, artists.join(' & '), name);
            if (song_info.error != undefined) {
                await interaction.editReply(song_info.error);
                passesChecks = false;
                return;
            }

            origArtistArray = song_info.prod_artists;
            rmxArtistArray = song_info.remix_artists;
            artists = song_info.db_artists;
            name = song_info.song_name;
            displayName = song_info.display_song_name;

            if (spotifyData.type == 'track' || spotifyData.type == 'single') {
                trackUris.push(spotifyData.uri); // Used to add to playlist
                linkType = 'sp';
            } else if (spotifyData.type == 'album') {
                for (let i = 0; i < spotifyData.tracks.items.length; i++) {
                    trackUris.push(spotifyData.tracks.items[i].uri);
                    trackDurs.push(spotifyData.tracks.items[i].duration);
                }
                if (!name.includes(' EP') && !name.includes(' LP')) {
                    if (_.sum(trackDurs) >= 1.8e+6 || spotifyData.tracks.items.length >= 7) {
                        displayName += ' LP';
                        linkType = 'sp_lp';
                    } else {
                        displayName += ' EP';
                        linkType = 'sp_ep';
                    }
                } else if (name.includes(' EP')) {
                    linkType = 'sp_ep';
                } else if (name.includes(' LP')) {
                    linkType = 'sp_lp';
                }
            }
        } else if (trackLink.includes('music.apple.com')) {
            linkType = 'apple';
        } else if (trackLink.includes('soundcloud.com')) {
            linkType = 'sc';
        } else if (trackLink.includes('youtube.com') || trackLink.includes('youtu.be')) {
            linkType = 'yt';
        } else {
            return interaction.editReply('This link is not a valid mailbox link.\nValid mailbox links: ```\nSpotify\nSoundCloud\nApple Music\nYouTube```');
        }

        if (mailFilter[linkType] == false) {
            return interaction.editReply('This person has filtered out this type of mail, so this was not sent.');
        }

        if (linkType.includes('sp')) {
            if (passesChecks == false) return;
            if (db.user_stats.get(taggedUser.id, 'mailbox_history').includes(mainId)) {
                return interaction.editReply(`\`${taggedMember.displayName}\` has already been sent **${origArtistArray.join(' & ')} - ${displayName}** through Waveform Mailbox!`);
            }

            // Add tracks to the mailbox playlist
            await spotifyTaggedApi.addTracksToPlaylist(playlistId, trackUris)
            .then(() => {
                const mailEmbed = new EmbedBuilder()
                .setColor(`${getEmbedColor(interaction.member)}`)
                .setTitle(`${origArtistArray.join(' & ')} - ${displayName}`)
                .setDescription(`This music mail was sent to you by <@${interaction.user.id}>!`)
                .setThumbnail(songArt);

                interaction.editReply(`Sent [**${origArtistArray.join(' & ')} - ${displayName}**](${url}) to ${taggedMember.displayName}'s Waveform Mailbox!`);
                if (dmMailConfig == true && taggedUser.id != interaction.user.id) { 
                    taggedUser.send({ content: `**You've got mail! 📬**\n${origArtistArray.join(' & ')} - ${displayName}`, embeds: [mailEmbed] });
                }

                // Put the song we just mailboxed into a mailbox list for the user, so it can be pulled up with /viewmail
                if (db.user_stats.get(taggedUser.id, 'mailbox_list') == undefined) {
                    db.user_stats.set(taggedUser.id, [{ 
                        display_name: `${origArtistArray.join(' & ')} - ${displayName}`,
                        orig_artists: origArtistArray,
                        db_artists: artists,
                        db_song_name: name,
                        remix_artists: rmxArtistArray,
                        user_who_sent: interaction.user.id,
                        spotify_id: mainId, 
                        track_uris: trackUris,
                        spotify_url: url,
                    }], 'mailbox_list');
                } else {
                    db.user_stats.push(taggedUser.id, { 
                        display_name: `${origArtistArray.join(' & ')} - ${displayName}`,
                        orig_artists: origArtistArray,
                        db_artists: artists,
                        db_song_name: name,
                        remix_artists: rmxArtistArray,
                        user_who_sent: interaction.user.id,
                        spotify_id: mainId, 
                        track_uris: trackUris,
                        spotify_url: url,
                    }, 'mailbox_list');
                }

                // Add the spotify ID to mailbox history if we have one
                if (mainId != false) {
                    db.user_stats.push(taggedUser.id, mainId, 'mailbox_history');
                }
            }).catch(() => {
                return interaction.editReply(`Waveform ran into an issue sending this mail. This is either due to a spotify issue, or this user doesn't have a music mailbox setup.`);
            });
        } else { // If we have a non-spotify link

            if (db.user_stats.get(taggedUser.id, 'mailbox_history').includes(trackLink)) {
                return interaction.editReply(`\`${taggedMember.displayName}\` has already been sent this through Waveform Mailbox!`);
            }

            db.user_stats.push(taggedUser.id, trackLink, 'mailbox_history');

            interaction.editReply(`Sent a non-spotify [track](${trackLink}) to ${taggedMember.displayName}!\n\n`);
            if (dmMailConfig == true && interaction.user.id != taggedUser.id) { 
                taggedUser.send({ content: `**You've got mail!** 📬\nSent by **${interaction.member.displayName}**\n${trackLink}` });
            }
        }
    },
};
