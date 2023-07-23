const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
const db = require('../db.js');
const { spotify_api_setup, parse_artist_song_data, getEmbedColor } = require('../func.js');
const fetch = require('isomorphic-unfetch');
const { getData } = require('spotify-url-info')(fetch);
const _ = require('lodash');

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
        const spotifyApi = await spotify_api_setup(taggedUser.id);

        let playlistId = db.user_stats.get(taggedUser.id, 'mailbox_playlist_id');
        let trackLink = interaction.options.getString('link');
        let trackUris = []; 
        let trackDurs = []; // Track durations
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
        if (trackLink == null && spotifyApi != false) {
            await spotifyApi.getMyCurrentPlayingTrack().then(async data => {
                if (data.body.currently_playing_type == 'episode') { spotifyCheck = false; return; }
                trackLink = data.body.item.external_urls.spotify;
                spotifyCheck = true;
            });

            // Check if a podcast is being played, as we don't support that.
            if (spotifyCheck == false) {
                return interaction.reply('Spotify playback not detected. Please start playing a song on spotify before using this command in this way!');
            }
        } else if (spotifyApi == false && trackLink == null) {
            return interaction.reply(`You are not logged into spotify with Waveform, so you must specify a track link in the link argument or use \`/login\` to use this command in this way!`);
        }

        // Check if we are not in a spotify link, and if so, what kind of link we have
        if (trackLink.includes('spotify')) {
            if (db.user_stats.get(taggedUser.id, 'spotify_playlist') == false || spotifyApi == false) {
                return interaction.editReply('This user has not setup a spotify mailbox playlist, and thus cannot be sent spotify songs.');
            }

            await getData(trackLink).then(async data => {
                mainId = data.id;
                url = trackLink;
                songArt = data.coverArt.sources[0].url;
                name = data.name;
                if (data.type == 'album') {
                    // Use the tracklist to figure out who is a collab artist on an EP/LP for the entire EP/LP (and not just a one off)
                    artists = [];
                    for (let tracks of data.trackList) {
                        artists.push(tracks.subtitle.split(', '));
                        artists = artists.flat(1);
                    }

                    let occurences = artists.reduce((acc, e) => acc.set(e, (acc.get(e) || 0) + 1), new Map());
                    occurences = [...occurences.entries()];
                    artists = [];
                    for (let a of occurences) {
                        if (a[1] == data.trackList.length) artists.push(a[0]);
                    }
                } else {
                    artists = data.artists.map(artist => artist.name);
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

                if (data.type == 'track' || data.type == 'single') {
                    trackUris.push(data.uri); // Used to add to playlist
                    linkType = 'sp';
                } else if (data.type == 'album') {
                    for (let i = 0; i < data.trackList.length; i++) {
                        trackUris.push(data.trackList[i].uri);
                        trackDurs.push(data.trackList[i].duration);
                    }
                    if (!name.includes(' EP') && !name.includes(' LP')) {
                        if (_.sum(trackDurs) >= 1.8e+6 || data.trackList.length >= 7) {
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
            }).catch((err) => {
                console.log(err);
            });
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
            await spotifyApi.addTracksToPlaylist(playlistId, trackUris)
            .then(() => {
                const mailEmbed = new EmbedBuilder()
                .setColor(`${getEmbedColor(interaction.member)}`)
                .setTitle(`${origArtistArray.join(' & ')} - ${displayName}`)
                .setDescription(`This music mail was sent to you by <@${interaction.user.id}>!`)
                .setThumbnail(songArt);

                interaction.editReply(`Sent [**${origArtistArray.join(' & ')} - ${displayName}**](${url}) to ${taggedMember.displayName}'s Waveform Mailbox!`);
                if (dmMailConfig == true && taggedUser.id != interaction.user.id) { 
                    taggedUser.send({ content: `**You've got mail!** 📬`, embeds: [mailEmbed] });
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
                return interaction.editReply(`\`${taggedMember.displayName}\` has already been sent this song through Waveform Mailbox!`);
            }

            db.user_stats.push(taggedUser.id, trackLink, 'mailbox_history');

            interaction.editReply(`Sent a non-spotify [track](${trackLink}) to ${taggedMember.displayName}'s Waveform Mailbox!`);
            if (dmMailConfig == true && interaction.user.id != taggedUser.id) { 
                taggedUser.send({ content: `**You've got mail!** 📬\nSent by **${interaction.member.displayName}**\n${trackLink}` });
            }
        }
    },
};
