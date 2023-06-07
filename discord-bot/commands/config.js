const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');
const { spotify_api_setup, get_user_reviews } = require('../func.js');
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Your personal Waveform config menu.')
        .setDMPermission(false),
    help_desc: `View and edit your personal configuration for Waveform.`,
	async execute(interaction) {

        // Main Configuration Select Menu
        let configMenu = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('config')
                    .setPlaceholder('Change your main Waveform configs.')
                    .addOptions(
                        {
                            label: 'Mail Filter',
                            description: 'Change your receiving song mail filter.',
                            value: 'mail_filter',
                        },
                        {
                            label: 'Mailbox Review Ping',
                            description: 'Set whether you want to be pinged if someone reviews a song you sent to them in mailbox.',
                            value: 'review_ping',
                        },
                        {
                            label: 'Star Spotify Playlist',
                            description: 'Setup your starred songs spotify playlist',
                            value: 'star_playlist',
                        },
                    ),
            );

        let user_profile = db.user_stats.get(interaction.user.id);
        let config_data = user_profile.config;
        if (config_data.star_spotify_playlist == undefined) {
            config_data.star_spotify_playlist = {
                playlist_id: false,
                playlist_list: [],
            };
            db.user_stats.set(interaction.user.id, config_data, `config`);
        }

        let config_desc = [`**Mail Filter:**\n${Object.entries(config_data.mail_filter).map(v => {
            switch(v[0]) {
                case 'apple': v[0] = 'Apple'; break;
                case 'sc': v[0] = 'SoundCloud'; break;
                case 'sp': v[0] = 'Spotify Singles'; break;
                case 'sp_ep': v[0] = 'Spotify EPs'; break;
                case 'sp_lp': v[0] = 'Spotify LPs'; break;
                case 'yt': v[0] = 'YouTube'; break;
            }

            if (v[1] == true) v[1] = '✅';
            if (v[1] == false) v[1] = '❌';
            v = v.join(': ');
            return v;
        }).join('\n')}\n`,
        `**Mailbox Review Ping:** \`${config_data.review_ping}\``,
        `**Star Spotify Playlist:** \`${config_data.star_spotify_playlist != false ? 'Setup!' : 'Not Setup.'}\``];

        let mailFilterSel = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('mail_filter_sel')
                    .setPlaceholder('Change your mail filter settings')
                    .addOptions(
                        {
                            label: 'Apple Music',
                            description: `Toggle filter of songs from Apple Music.`,
                            value: 'apple',
                            emoji: '<:applelogo:1083272391381225542>',
                        },
                        {
                            label: 'SoundCloud',
                            description: 'Toggle filter of songs from SoundCloud.',
                            value: 'sc',
                            emoji: '<:soundcloud:1083272493072142337>',
                        },
                        {
                            label: 'Spotify Singles',
                            description: 'Toggle filter of singles/remixes from Spotify.',
                            value: 'sp',
                            emoji: '<:spotify:961509676053323806>',
                        },
                        {
                            label: 'Spotify EPs',
                            description: 'Toggle filter of EPs from Spotify.',
                            value: 'sp_ep',
                            emoji: '<:spotify:961509676053323806>',
                        },
                        {
                            label: 'Spotify LPs',
                            description: 'Toggle filter of LPs from Spotify.',
                            value: 'sp_lp',
                            emoji: '<:spotify:961509676053323806>',
                        },
                        {
                            label: 'YouTube',
                            description: 'Toggle filter of songs from YouTube.',
                            value: 'yt',
                            emoji: '<:youtube:1083272437489221783>',
                        },
                    ),
            );

        let configEmbed = new EmbedBuilder()
        .setColor(`${interaction.member.displayHexColor}`)
        .setThumbnail(interaction.user.avatarURL({ extension: "png" }))
        .setTitle('⚙️ Waveform Config Menu ⚙️')
        .setDescription(config_desc.join('\n'));
        await interaction.reply({ content: null, embeds: [configEmbed], components: [configMenu] });

        const collector = interaction.channel.createMessageComponentCollector({ time: 360000 });
        await collector.on('collect', async sel => {
            if (sel.customId == 'config') {

                if (sel.values[0] == 'mail_filter') {
                    await sel.update({ content: 'Select the filter option you\'d like to change.', embeds: [], components: [mailFilterSel] });
                } else if (sel.values[0] == 'review_ping') {
                    await db.user_stats.set(interaction.user.id, !(user_profile.config.review_ping), 'config.review_ping');
                    config_desc[1] = `**Mailbox Review Ping:** \`${db.user_stats.get(interaction.user.id, 'config.review_ping')}\``;
                    user_profile = db.user_stats.get(interaction.user.id);
                    configEmbed.setDescription(config_desc.join('\n'));
                    await sel.update({ content: null, embeds: [configEmbed], components: [configMenu] });
                } else if (sel.values[0] == 'star_playlist') {
                    const spotifyApi = await spotify_api_setup(interaction.user.id);
                    if (spotifyApi == false) {
                        await sel.update({ content: 'You do not have a spotify connection setup with Waveform. Please run `/login` to set one up!' });
                        return;
                    }

                    const Spotify = require('node-spotify-api');
                    const client_id = process.env.SPOTIFY_API_ID; // Your client id
                    const client_secret = process.env.SPOTIFY_CLIENT_SECRET; // Your secret
        
                    const spotify = new Spotify({
                        id: client_id,
                        secret: client_secret,
                    });

                    let starIDList = [];

                    await sel.update({ content: `Setting up your star spotify playlist...`, embeds: [], components: [] });
                    await spotifyApi.createPlaylist('Waveform Stars', { 'description': 'This is an auto updated playlist of your Waveform stars, to give you an easier idea of what songs you have starred!', 'public': true })
                    .then(async data => {
                        db.user_stats.set(interaction.user.id, data.body.id, `config.star_spotify_playlist`);
                        let songSkip = [];
                        let artistArray = db.reviewDB.keyArray();
                        for (let i = 0; i < artistArray.length; i++) {
                            let songArray = Object.keys(db.reviewDB.get(artistArray[i]));
                            songArray = songArray.filter(v => v != 'pfp_image');
                            songArray = songArray.filter(v => !v.includes(' EP'));
                            songArray = songArray.filter(v => !v.includes(' LP'));
    
                            for (let j = 0; j < songArray.length; j++) {
                                let songObj = db.reviewDB.get(artistArray[i])[songArray[j]];
                                let userArray;
                                if (songObj != null && songObj != undefined) {
                                    userArray = get_user_reviews(songObj);
                                    userArray = userArray.filter(v => v == interaction.user.id);
                                } else {
                                    userArray = [];
                                }
    
                                if (songSkip.includes(`${artistArray[i]} - ${songArray[j]}`)) continue;
    
                                let otherArtists = [artistArray[i], songObj.collab].flat(1);
    
                                let allArtists = otherArtists.map(v => {
                                    if (v == undefined) {
                                        return [];
                                    }
                                    return v;
                                });
                                allArtists = allArtists.flat(1);
    
                                for (let k = 0; k < userArray.length; k++) {
                                    let userData = songObj[userArray[k]];
                                    // Add to playlist if its starred
                                    if (userData.starred) {
                                        await spotify.search({ type: "track", query: `${artistArray[i]} ${songArray[j]}` }).then(function(song_data) {  
                                            let results = song_data.tracks.items;
                                            let pushed = false;

                                            for (let result of results) {
                                                if (result.album.artists.map(v => v.name.toLowerCase()).includes(artistArray[i].toLowerCase()) && result.name.toLowerCase() == `${songArray[j].toLowerCase()}`) {
                                                    starIDList.push(result.uri);
                                                    pushed = true;
                                                    break;
                                                }
                                            }

                                            if (pushed == false) {
                                                starIDList.push(results[0].uri);
                                            }
                                        });
                                    }
                                }
    
                                for (let v = 0; v < allArtists.length; v++) {
                                    if (!songSkip.includes(`${allArtists[v]} - ${songArray[j]}`)) {
                                        songSkip.push(`${allArtists[v]} - ${songArray[j]}`);
                                    }
                                }
                            }
                        }
                    });

                    starIDList = _.chunk(starIDList, 100);
                    for (let list of starIDList) {
                        await spotifyApi.addTracksToPlaylist(db.user_stats.get(interaction.user.id, `config.star_spotify_playlist`), list); 
                    }
                     
                    config_desc[2] = `**Star Spotify Playlist:** \`Setup!\``;
                    configEmbed.setDescription(config_desc.join('\n'));
                    await interaction.editReply({ content: `Playlist has been created and starred songs have been added to it.`, embeds: [configEmbed], components: [configMenu] });                
                }

            } else if (sel.customId == 'mail_filter_sel') {
                user_profile.config.mail_filter[sel.values[0]] = !user_profile.config.mail_filter[sel.values[0]];
                db.user_stats.set(interaction.user.id, user_profile.config.mail_filter, 'config.mail_filter');
                config_desc[0] = `**Mail Filter:**\n${Object.entries(user_profile.config.mail_filter).map(v => {
                    switch(v[0]) {
                        case 'apple': v[0] = 'Apple'; break;
                        case 'sc': v[0] = 'SoundCloud'; break;
                        case 'sp': v[0] = 'Spotify Singles'; break;
                        case 'sp_ep': v[0] = 'Spotify EPs'; break;
                        case 'sp_lp': v[0] = 'Spotify LPs'; break;
                        case 'yt': v[0] = 'YouTube'; break;
                    }

                    if (v[1] == true) v[1] = '✅';
                    if (v[1] == false) v[1] = '❌';
                    v = v.join(': ');
                    return v;
                }).join('\n')}\n`;
                configEmbed.setDescription(config_desc.join('\n'));
                await sel.update({ content: null, embeds: [configEmbed], components: [configMenu] });
            }
        });

        await collector.on('end', async () => {
            interaction.editReply({ embeds: [configEmbed], components: [] });
        });
    },
};
