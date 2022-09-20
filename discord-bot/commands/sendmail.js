const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
const db = require('../db.js');
const { spotify_api_setup } = require('../func.js');
const fetch = require('isomorphic-unfetch');
const { getData } = require('spotify-url-info')(fetch);

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
                .setRequired(false)),
	async execute(interaction, client) {

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
            return interaction.reply(`You must either specify a user in the user argument to send this song to, or be in a mailbox chat!`);
        }

        const spotifyApi = await spotify_api_setup(taggedUser.id);
    
        if (spotifyApi == false) {
            return interaction.reply('This user may not have a mailbox setup. Tell them to set one up with `/setupmailbox`!');
        }

        let playlistId = db.user_stats.get(taggedUser.id, 'mailbox_playlist_id');
        let trackLink = interaction.options.getString('link');
        let trackUris = []; 
        let name;
        let artists;
        let url;
        let songArt;

        if (!trackLink.includes('spotify')) return interaction.reply('The link you put in is not a valid spotify link!');
        await getData(trackLink).then(data => {
            url = data.external_urls.spotify;
            data.type == 'track' ? songArt = data.coverArt.sources[0].url : songArt = data.coverArt.sources[0].url;
            name = data.name;
            artists = data.artists.map(artist => artist.name);
            if (data.type == 'track' || data.type == 'single') {
                trackUris.push(data.uri); // Used to add to playlist
            } else if (data.type == 'album') {
                for (let i = 0; i < data.tracks.items.length; i++) {
                    trackUris.push(data.tracks.items[i].uri);
                }
                if (!name.includes(' EP') && !name.includes(' LP')) {
                    name = (data.album_type == 'single') ? name += ' EP' : name += ' LP';
                }
            }
        }).catch((err) => {
            console.log(err);
        });

        // Add tracks to the mailbox playlist
        await spotifyApi.addTracksToPlaylist(playlistId, trackUris)
        .then(() => {
            const mailEmbed = new EmbedBuilder()
            .setColor(`${interaction.member.displayHexColor}`)
            .setTitle(`${artists.join(' & ')} - ${name}`)
            .setDescription(`This music mail was sent to you by <@${interaction.user.id}>!`)
            .setThumbnail(songArt);

            if (interaction.channel.id != db.user_stats.get(taggedUser.id, 'mailbox')) {
                interaction.reply(`Sent [**${artists.join(' & ')} - ${name}**](${url}) to ${taggedMember.displayName}'s Waveform Mailbox!`);
                let mail_channel = interaction.guild.channels.cache.get(db.user_stats.get(taggedUser.id, 'mailbox'));
                mail_channel.send({ content: `You've got mail! 📬`, embeds: [mailEmbed] });
            } else {
                interaction.reply({ content: `You've got mail! 📬`, embeds: [mailEmbed] });
            }

            // Put the song we just mailboxed into a mailbox list for the user, so it can be pulled up with /viewmail
            if (db.user_stats.get(taggedUser.id, 'mailbox_list') == undefined) {
                db.user_stats.set(taggedUser.id, [[`**${artists.join(' & ')} - ${name}**`, `${interaction.user.id}`]], 'mailbox_list');
            } else {
                db.user_stats.push(taggedUser.id, [`**${artists.join(' & ')} - ${name}**`, `${interaction.user.id}`], 'mailbox_list');
            }
        }).catch(() => {
            return interaction.reply(`Waveform ran into an issue sending this mail. Make sure they have set music mailbox setup by using \`/setupmailbox\`!`);
        });
    },
};
