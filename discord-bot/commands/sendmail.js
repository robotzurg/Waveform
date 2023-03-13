const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
const db = require('../db.js');
const { spotify_api_setup, parse_artist_song_data } = require('../func.js');
const fetch = require('isomorphic-unfetch');
const { getData } = require('spotify-url-info')(fetch);
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sendmail')
        .setDescription('Send a song/EP/LP to a users Waveform Mailbox.')
        .setDMPermission(false)
        .addStringOption(option => 
            option.setName('link')
                .setDescription('Link to the song you would like to send to the mailbox (MUST BE A SPOTIFY LINK)')
                .setRequired(true))
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User whose mailbox you would like to send a song to (MUST BE CONNECTED TO SPOTIFY)')
                .setRequired(false)),
    help_desc: `Send a song to a users Waveform Mailbox.\n` + 
    `The songs are usually sent from Spotify (mainly), but you can also send YouTube, Apple Music, and SoundCloud links.\n` +
    `Leaving the user argument (optional) blank will send a song to the users mailbox based on the chat you send the command in.\n` + 
    `For example, if you send a song in a mailbox chat, it'll send it to that users mailbox.`,
	async execute(interaction, client) {
        await interaction.deferReply();
        let taggedUser = interaction.options.getUser('user');
        let taggedMember;
        let mailboxes = db.server_settings.get(interaction.guild.id, 'mailboxes');

        // Check if we are reviewing in the right chat, if not, boot out
        if (mailboxes.some(v => v.includes(interaction.channel.id))) {
            taggedUser = client.users.cache.get(mailboxes.find(v => v[1] == interaction.channel.id)[0]);
            taggedMember = await interaction.guild.members.fetch(taggedUser.id);
        } else if (taggedUser != null) {
            taggedMember = await interaction.guild.members.fetch(taggedUser.id);
        } else if (taggedUser == null) {
            return interaction.editReply(`You must either specify a user in the user argument to send this song to, or be in a mailbox chat!`);
        }

        const spotifyApi = await spotify_api_setup(taggedUser.id);
    
        if (spotifyApi == false) {
            return interaction.editReply('This user either does not have a mailbox setup, or has a non-spotify mailbox, thus cannot have mail sent this way.');
        }

        let playlistId = db.user_stats.get(taggedUser.id, 'mailbox_playlist_id');
        let trackLink = interaction.options.getString('link');
        let trackUris = []; 
        let trackDurs = []; // Track durations
        let name;
        let artists, prodArtists, displayName;
        let url;
        let songArt;
        let mainId; // The main ID of the spotify link (the album URI or the main track URI)
        let linkType;
        let mailFilter = db.user_stats.get(taggedUser.id, 'config.mail_filter');

        if (!trackLink.includes('spotify')) return interaction.editReply('The link you put in is not a valid link!');
        await getData(trackLink).then(async data => {
            mainId = data.id;
            url = trackLink;
            songArt = data.coverArt.sources[0].url;
            name = data.name;
            if (data.type == 'album') {
                artists = [data.subtitle];
            } else {
                artists = data.artists.map(artist => artist.name);
            } 
            let song_info = await parse_artist_song_data(interaction, artists.join(' & '), name);
            if (song_info == -1) {
                await interaction.editReply('Waveform ran into an issue pulling up song data.\nError: `Failed to parse song data`');
                return;
            }

            artists = song_info.all_artists;
            prodArtists = song_info.prod_artists;
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

        if (mailFilter[linkType] == false) {
            return interaction.editReply('This person has filtered out this type of mail, so this was not sent.');
        }

        if (db.user_stats.get(interaction.user.id, 'mailbox_history').includes(mainId)) {
            return interaction.editReply(`This user has already been sent **${prodArtists.join(' & ')} - ${displayName}** through Waveform Mailbox!`);
        }

        // Add tracks to the mailbox playlist
        await spotifyApi.addTracksToPlaylist(playlistId, trackUris)
        .then(() => {
            const mailEmbed = new EmbedBuilder()
            .setColor(`${interaction.member.displayHexColor}`)
            .setTitle(`${prodArtists.join(' & ')} - ${displayName}`)
            .setDescription(`This music mail was sent to you by <@${interaction.user.id}>!`)
            .setThumbnail(songArt);

            if (interaction.channel.id != db.user_stats.get(taggedUser.id, 'mailbox')) {
                interaction.editReply(`Sent [**${prodArtists.join(' & ')} - ${displayName}**](${url}) to ${taggedMember.displayName}'s Waveform Mailbox!`);
                let mail_channel = interaction.guild.channels.cache.get(db.user_stats.get(taggedUser.id, 'mailbox'));
                mail_channel.send({ content: `You've got mail! 📬`, embeds: [mailEmbed] });
            } else {
                interaction.editReply({ content: `You've got mail! 📬`, embeds: [mailEmbed] });
            }

            // Put the song we just mailboxed into a mailbox list for the user, so it can be pulled up with /viewmail
            if (db.user_stats.get(taggedUser.id, 'mailbox_list') == undefined) {
                db.user_stats.set(taggedUser.id, [{ 
                    display_name: `${prodArtists.join(' & ')} - ${displayName}`,
                    user_who_sent: interaction.user.id,
                    spotify_id: mainId, 
                    track_uris: trackUris,
                    spotify_url: url,
                }], 'mailbox_list');
            } else {
                db.user_stats.push(taggedUser.id, { 
                    display_name: `${prodArtists.join(' & ')} - ${displayName}`,
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
            return interaction.editReply(`Waveform ran into an issue sending this mail. Make sure they have set music mailbox setup by using \`/setupmailbox\`!`);
        });
    },
};
