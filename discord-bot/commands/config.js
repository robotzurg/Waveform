const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');
const { spotify_api_setup, getEmbedColor } = require('../func.js');
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Your personal Waveform config menu.')
        .setDMPermission(false),
    help_desc: `Configure your personal preferences on Waveform, including privacy, mailbox, customization, and other features.\n\n` + 
    `For configuring a spotify account, look at the /login command.`,
	async execute(interaction) {

        // Main Configuration Select Menu
        let configMenu = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('config')
                    .setPlaceholder('Change your main Waveform configs.')
                    .addOptions(
                        {
                            label: 'Mailbox Filter',
                            description: 'Change your Waveform Mailbox filter.',
                            value: 'mail_filter',
                        },
                        {
                            label: 'Mailbox Review Ping',
                            description: 'Set whether you want to be pinged when your sent song is reviewed in Waveform Mailbox.',
                            value: 'review_ping',
                        },
                        {
                            label: 'Mailbox DM',
                            description: 'Set whether you want to be DM\'d if someone sends you a song through Waveform Mailbox.',
                            value: 'mailbox_dm',
                        },
                        {
                            label: 'Embed Color',
                            description: 'Set the color you would like your embeds to have.',
                            value: 'embed_color',
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
        }
        if (config_data.mailbox_dm == undefined) {
            config_data.mailbox_dm = true;
        }

        if (config_data.embed_color == undefined) {
            config_data.embed_color = false;
        }

        db.user_stats.set(interaction.user.id, config_data, `config`);

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
        `**Mailbox DM:** \`${config_data.mailbox_dm}\``,
        `**Embed Color:** \`${config_data.embed_color == false ? 'Role Color' : config_data.embed_color}\``,
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
        .setColor(`${getEmbedColor(interaction.member)}`)
        .setThumbnail(interaction.user.avatarURL({ extension: "png" }))
        .setTitle('⚙️ Waveform Config Menu ⚙️')
        .setDescription(config_desc.join('\n'));
        await interaction.reply({ content: null, embeds: [configEmbed], components: [configMenu] });

        let msg_filter = m => m.author.id == interaction.user.id;
        let msg_collector = interaction.channel.createMessageCollector({ filter: msg_filter, time: 720000 });
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

                } else if (sel.values[0] == 'mailbox_dm') {

                    await db.user_stats.set(interaction.user.id, !(user_profile.config.mailbox_dm), 'config.mailbox_dm');
                    config_desc[2] = `**Mailbox DM:** \`${db.user_stats.get(interaction.user.id, 'config.mailbox_dm')}\``;
                    user_profile = db.user_stats.get(interaction.user.id);
                    configEmbed.setDescription(config_desc.join('\n'));
                    await sel.update({ content: null, embeds: [configEmbed], components: [configMenu] });

                } else if (sel.values[0] == 'embed_color') {

                    await sel.update({ content: 'Type in the new color you\'d like your reviews to have, in the hexcode format!', embeds: [], components: [] });

                    await msg_collector.on('collect', async m => { 
                        let hexCheck = new RegExp('^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$');
                        if (hexCheck.test(m.content) == false) {
                            await interaction.followUp({ ephemeral: true, content: 'Please make sure you use a valid hexcode for the color!' });
                            await m.delete();
                        } else {
                            await db.user_stats.set(interaction.user.id, m.content, 'config.embed_color');
                            config_desc[3] = `**Embed Color:** \`${db.user_stats.get(interaction.user.id, 'config.embed_color')}\``;
                            user_profile = db.user_stats.get(interaction.user.id);
                            configEmbed.setDescription(config_desc.join('\n'));
                            await interaction.editReply({ content: null, embeds: [configEmbed], components: [configMenu] });
                            await m.delete();
                        }
                    });

                    await msg_collector.on('end', async () => {
                        await interaction.editReply({ content: null, embeds: [configEmbed], components: [configMenu] });
                        await msg_collector.stop();
                    });

                    

                } else if (sel.values[0] == 'star_playlist') {
                    const spotifyApi = await spotify_api_setup(interaction.user.id);
                    if (spotifyApi == false) {
                        await sel.update({ content: 'You do not have a spotify connection setup with Waveform. Please run `/login` to set one up!' });
                        return;
                    }

                    let starIDList = [];

                    await sel.update({ content: `Setting up your star spotify playlist... (This usually takes up to 1 minute, so please be patient!)\n`
                    + `Please keep in mind that this playlist generation may not get every song 100%. Feel free to manually change things yourself to fix it!`, embeds: [], components: [] });
                    await spotifyApi.createPlaylist('Waveform Stars', { 'description': 'This is an auto updated playlist of your Waveform stars, to give you an easier idea of what songs you have starred!', 'public': true })
                    .then(async data => {
                        db.user_stats.set(interaction.user.id, data.body.id, `config.star_spotify_playlist`);
                        let starList = db.user_stats.get(interaction.user.id, `stats.star_list`);

                        for (let starData of starList) {
                            await spotifyApi.searchTracks(`${starData.orig_artists[0]} ${starData.db_song_name}`).then(function(song_data) {  
                                let results = song_data.tracks.items;
                                let pushed = false;

                                for (let result of results) {
                                    console.log(result.album.artists, starData.orig_artists);
                                    if (result.album.artists.map(v => v.name.toLowerCase()).includes(starData.orig_artists[0].toLowerCase()) && result.name.toLowerCase() == `${starData.db_song_name.toLowerCase()}`) {
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
                    });

                    starIDList = _.chunk(starIDList, 100);
                    for (let list of starIDList) {
                        await spotifyApi.addTracksToPlaylist(db.user_stats.get(interaction.user.id, `config.star_spotify_playlist`), list); 
                    }
                     
                    config_desc[4] = `**Star Spotify Playlist:** \`Setup!\``;
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
