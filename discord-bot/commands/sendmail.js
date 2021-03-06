const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require('discord.js');
require('dotenv').config();
const db = require('../db.js');
const { spotify_api_setup } = require('../func.js');
const { getData } = require('spotify-url-info');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sendmail')
        .setDescription('Send a song to a users mailbox playlist! (THIS REQUIRES SPOTIFY AUTHENTICATION WITH /LOGIN)')
        .addStringOption(option => 
            option.setName('link')
                .setDescription('Link to the song you would like to send to the mailbox (MUST BE A SPOTIFY LINK)')
                .setRequired(true))
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User whose mailbox you would like to send a song to (MUST BE CONNECTED TO SPOTIFY)')
                .setRequired(true)),
	async execute(interaction) {

        let taggedUser = interaction.options.getUser('user');
        let taggedMember = await interaction.guild.members.fetch(taggedUser.id);  

        const spotifyApi = await spotify_api_setup(taggedUser.id);
    
        if (spotifyApi == false) {
            interaction.editReply('You must use `/login` to use Spotify related features!');
            return -1;
        }

        let playlistId = db.user_stats.get(taggedUser.id, 'mailbox_playlist_id');
        let trackLink = interaction.options.getString('link');
        let trackUris = [];
        let name;
        let artists;
        let url;
        let songArt;

        if (!trackLink.includes('spotify')) return interaction.editReply('The link you put in is not a valid spotify link!');
        await getData(trackLink).then(data => {
            url = data.external_urls.spotify;
            songArt = data.images[0].url;
            name = data.name;
            artists = data.artists.map(artist => artist.name);
            if (data.type == 'track' || data.type == 'single') {
                trackUris.push(data.uri); // Used to add to playlist
            } else if (data.type == 'album') {
                for (let i = 0; i < data.tracks.items.length; i++) {
                    trackUris.push(data.tracks.items[i].uri);
                }
            }
        }).catch((err) => {
            console.log(err);
            return interaction.editReply('This track threw an error. Yikes!');
        });

        // Add tracks to the mailbox playlist
        await spotifyApi.addTracksToPlaylist(playlistId, trackUris)
        .then(() => {

            const mailEmbed = new Discord.MessageEmbed()
            .setColor(`${interaction.member.displayHexColor}`)
            .setTitle(`${artists.join(' & ')} - ${name}`)
            .setDescription(`This song was sent to you by <@${interaction.user.id}>!`)
            .setThumbnail(songArt);

            if (interaction.channel.id != db.user_stats.get(taggedUser.id, 'mailbox')) {
                interaction.editReply(`Sent [**${artists.join(' & ')} - ${name}**](${url}) to ${taggedMember.displayName}'s Waveform Mailbox!`);
                let mail_channel = interaction.guild.channels.cache.get(db.user_stats.get(taggedUser.id, 'mailbox'));
                mail_channel.send({ content: `You've got mail! ????`, embeds: [mailEmbed] });
            } else {
                interaction.editReply({ content: `You've got mail! ????`, embeds: [mailEmbed] });
            }

            // Put the song we just mailboxed into a mailbox list for the user, so it can be pulled up with /viewmail
            if (db.user_stats.get(taggedUser.id, 'mailbox_list') == undefined) {
                db.user_stats.set(taggedUser.id, [[`**${artists.join(' & ')} - ${name}**`, `${interaction.user.id}`]], 'mailbox_list');
            } else {
                db.user_stats.push(taggedUser.id, [`**${artists.join(' & ')} - ${name}**`, `${interaction.user.id}`], 'mailbox_list');
            }
        }, async () => {
            interaction.editReply(`The user ${taggedMember.displayName} does not have a valid mailbox setup. Make sure they have set one up using \`/setupmailbox\`!`);
        });
    },
};
