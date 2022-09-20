const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, SlashCommandBuilder, ButtonStyle } = require('discord.js');
const db = require("../db.js");
const { handle_error, create_ep_review, parse_artist_song_data } = require('../func.js');
const wait = require("wait");
const Spotify = require('node-spotify-api');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('epmerge')
        .setDescription('Merge a set of songs into an EP/LP in the database.')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the main artist(s) of the EP/LP.')
                .setAutocomplete(true)
                .setRequired(true))

        .addStringOption(option => 
            option.setName('ep_name')
                .setDescription('The name of the EP/LP you would like to assign the songs to.')
                .setRequired(true))

        .addStringOption(option => 
            option.setName('ep_art')
                .setDescription('Art link for the EP/LP.')
                .setRequired(false)),
	async execute(interaction, client) {
        try {

        let artists = interaction.options.getString('artist');
        let ep = interaction.options.getString('ep_name');
        let song_info = await parse_artist_song_data(interaction, artists, ep);
        if (song_info == -1) return;

        let epName = song_info.song_name;
        let artistArray = song_info.all_artists;
        let epType = epName.includes(' LP') ? `LP` : `EP`;
        let ep_art = interaction.options.getString('ep_art');
        let songArray = [];

        // Grab ep_art from server spotify
        if (ep_art == false || ep_art == undefined || ep_art == null) {
            const client_id = process.env.SPOTIFY_API_ID; // Your client id
            const client_secret = process.env.SPOTIFY_CLIENT_SECRET; // Your secret
            let search = epName.replace(' EP', '');
            search = search.replace(' LP', '');
            const song = `${artistArray[0]} ${search}`;

            const spotify = new Spotify({
                id: client_id,
                secret: client_secret,
            });

            await spotify.search({ type: "track", query: song }).then(function(data) {  
                let results = data.tracks.items;
                let songData = data.tracks.items[0];
                for (let i = 0; i < results.length; i++) {
                    if (`${results[i].album.artists.map(v => v.name)[0].toLowerCase()} ${results[i].album.name.toLowerCase()}` == `${song.toLowerCase()}`) {
                        songData = results[i];
                        break;
                    } else if (`${results[i].album.artists.map(v => v.name)[0].toLowerCase()} ${results[i].name.toLowerCase()}` == `${song.toLowerCase()}`) {
                        songData = results[i];
                    }
                }

                (results.length == 0 ? ep_art = false : ep_art = songData.album.images[0].url);
            });
        }

        // Place EP by default if EP or LP is not included in the title.
        if (!epName.includes(' EP') && !epName.includes(' LP')) epName = `${epName} EP`;
        if (db.reviewDB.get(artistArray[0], `["${epName}"]`) != undefined) return interaction.reply(`The ${epType} ${artistArray.join(' & ')} - ${epName} already exists in the database.`); 
        
        const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('finish')
                .setLabel('Finish')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('delete')
                .setLabel('Delete')
                .setStyle(ButtonStyle.Danger), 
        );

        let epEmbed = new EmbedBuilder()
        .setColor(`${interaction.member.displayHexColor}`)
        .setTitle(`Songs included in the ${epType} ${artistArray.join(' & ')} - ${epName}`);

        if (ep_art != false) {
            epEmbed.setThumbnail(ep_art);
        }

        interaction.reply({ content: `Type in the songs in the ${epType} song list order, one by one.\n` +
        'Make sure they are **JUST** the song name, no features that would be in the song name should be included here.\n' + 
        '(Remember that remixes are not currently supported.)\n' + 
        'When you are finished, click on the "Finish" button, or click the "Delete" button to revert everything you\'ve done.', embeds: [epEmbed], components: [row] });

        const msg_filter = m => m.author.id == interaction.user.id;
        const msg_collector = interaction.channel.createMessageCollector({ filter: msg_filter, time: 10000000 });

        msg_collector.on('collect', async m => {
            if (db.reviewDB.get(artistArray[0], `["${m.content}"]`) != undefined) {
                songArray.push(m.content);
                epEmbed.setDescription(`${songArray.join('\n')}`);
                interaction.editReply({ embeds: [epEmbed], components: [row] });
                m.delete();
            } else {
                m.delete();
                m.channel.send({ content: `The song \`${m.content}\` was not found in the database, please check your spelling!`, ephemeral: true }).then(async msg => {
                    await wait(6000);
                    msg.delete();
                });
            }
        });

        const filter = i => i.user.id == interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, max: 1, time: 10000000 });

        collector.on('collect', async int => {
            if (int.customId == 'finish') {
                msg_collector.stop();
                
                await create_ep_review(interaction, client, artistArray, songArray, epName, ep_art);

                int.update({ content: `Merging complete:`, components: [], embeds: [epEmbed] });
            } else {
                msg_collector.stop();
                interaction.deleteReply();
            }
        });

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};