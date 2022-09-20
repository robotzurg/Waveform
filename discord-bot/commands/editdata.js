const db = require("../db.js");
const { parse_artist_song_data, get_user_reviews } = require("../func.js");
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('editdata')
		.setDescription('Edit the various data of a song or an EP/LP in the database.')
        .addSubcommand(subcommand =>
            subcommand.setName('song')
            .setDescription('Edit the various data of a song or remix.')
            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the artist(s).')
                    .setAutocomplete(true)
                    .setRequired(false))
            .addStringOption(option => 
                option.setName('song_name')
                    .setDescription('The old name of the song or EP/LP.')
                    .setAutocomplete(true)
                    .setRequired(false))
            .addStringOption(option => 
                option.setName('remixers')
                    .setDescription('The name of remixers on the original song, if any')
                    .setRequired(false))),
	async execute(interaction) {
        
        return interaction.reply('This command is currently under construction and is not currently up yet.');

        // eslint-disable-next-line no-unreachable
        let origArtistArray = interaction.options.getString('artist');
        let songName = interaction.options.getString('song_name');
        let rmxArtistArray = interaction.options.getString('remixers');

        let song_info = await parse_artist_song_data(interaction, origArtistArray, songName, rmxArtistArray);
        if (song_info == -1) return;

        origArtistArray = song_info.prod_artists;
        songName = song_info.song_name;
        let artistArray = song_info.all_artists;
        rmxArtistArray = song_info.remix_artists;
        let vocalistArray = song_info.vocal_artists;
        let displaySongName = song_info.display_song_name;
        let songArt;

        if (db.reviewDB.get(artistArray[0], `["${songName}"].art`) != false && db.reviewDB.get(artistArray[0], `["${songName}"].art`) != undefined) {
            songArt = db.reviewDB.get(artistArray[0], `["${songName}"].art`);
        }

        let remixers = db.reviewDB.get(artistArray[0], `["${songName}"].remixers`);
        let tags = db.reviewDB.get(artistArray[0], `["${songName}"].tags`);
        if (tags == undefined) tags = [];

        let userArray = get_user_reviews(db.reviewDB.get(artistArray[0], `["${songName}"]`));

        for (let i = 0; i < userArray.length; i++) {
            if (userArray[i] != 'EP') {
                if (db.reviewDB.get(artistArray[0], `["${songName}"].["${userArray[i]}"].starred`) == true) {
                    userArray[i] = `:star2: <@${userArray[i]}>`;
                } else {
                    userArray[i] = `<@${userArray[i]}>`;
                }
            }
        }

        // const editButtons = [
        //     new ActionRowBuilder()
        //     .addComponents(
        //         new ButtonBuilder()
        //             .setCustomId('artist').setLabel('Artists')
        //             .setStyle(ButtonStyle.Primary).setEmoji('📝'),
        //         new ButtonBuilder()
        //             .setCustomId('song').setLabel('Vocalists')
        //             .setStyle(ButtonStyle.Primary).setEmoji('📝'),
        //     ),
        //     new ActionRowBuilder()
        //     .addComponents(
        //         new ButtonBuilder()
        //             .setCustomId('artist').setLabel('Artists')
        //             .setStyle(ButtonStyle.Primary).setEmoji('📝'),
        //         new ButtonBuilder()
        //             .setCustomId('song').setLabel('Vocalists')
        //             .setStyle(ButtonStyle.Primary).setEmoji('📝'),
        //     ),
        // ];

        const editEmbed = new EmbedBuilder()
        .setColor(`${interaction.member.displayHexColor}`)
        .setThumbnail(songArt)
        .setDescription('`Song Information:`')
        .setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`)
        .addFields(
            { name: 'Artists:', value: `${origArtistArray.join('\n')}\n${rmxArtistArray.join('\n')}`, inline: true },
            { name: 'Vocalists:', value: `${vocalistArray.length != 0 ? vocalistArray.join(' & ') : `N/A`}`, inline: true },
            { name: 'Remixers:', value: `${remixers.length != 0 ? remixers.join(' & ') : `N/A`}`, inline: true },
            { name: 'Song Name:', value: `${songName}`, inline: true },
            { name: 'Song Type:', value: `${songName.includes('Remix') ? '`Remix`' : '`Single`'}`, inline: true },
            { name: 'Tags:', value: `${tags.length != 0 ? `\`${tags.join('\n')}\`` : `N/A`}`, inline: true },
        );

        if (userArray.length != 0) {
            editEmbed.addFields([{ name: 'Reviewers:', value: userArray.join('\n') }]);
        }

        interaction.reply({ embeds: [editEmbed] });
	},
};