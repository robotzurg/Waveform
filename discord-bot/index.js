// require the discord.js module
const fs = require('fs');
const Discord = require('discord.js');
const { token_dev } = require('./config.json');
const db = require('./db');
const { REST } = require('@discordjs/rest');
const { Routes, InteractionType } = require('discord-api-types/v9');

// create a new Discord client and give it some variables
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { convertToSetterName } = require('./func');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, 
    GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildPresences, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages], partials: [Partials.Channel, Partials.Message, Partials.Reaction] });
client.commands = new Discord.Collection();
client.cooldowns = new Discord.Collection();
const mainCommands = [];
const adminCommands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

// Place your client and guild ids here
// eslint-disable-next-line no-unused-vars
const mainClientId = '828651073136361472';
// eslint-disable-next-line no-unused-vars
const devClientId = "945476486171865128";
// eslint-disable-next-line no-unused-vars
const mainGuildId = '680864893552951306';
// eslint-disable-next-line no-unused-vars
const devGuildId = "945476095048814652";

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
    if (command.data.name.includes('admin')) {
        adminCommands.push(command.data.toJSON());
    } else {
        mainCommands.push(command.data.toJSON());
    }
}

const rest = new REST({ version: '9' }).setToken(token_dev);

(async () => {
	try {
		console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(devClientId),
            { body: mainCommands },
        );

		await rest.put(
			Routes.applicationGuildCommands(devClientId, devGuildId),
			{ body: adminCommands },
		);

        // await rest.put(
		// 	Routes.applicationGuildCommands(devClientId, "784994152189919264"),
		// 	{ body: registerCommands },
		// );

		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error(error);
	}
})();

client.once('ready', async () => {
    console.log('Ready!');
    const date = new Date().toLocaleTimeString().replace("/.*(d{2}:d{2}:d{2}).*/", "$1");
    console.log(date);
});

// Listen for interactions (INTERACTION COMMAND HANDLER)
client.on('interactionCreate', async interaction => {

    if (interaction.isAutocomplete()) {

        try {
            let focused = interaction.options._hoistedOptions;
            let val_artist = focused[0].value;
            let val_song;
            let artist_collab;
            if (focused[1] != undefined) {
                val_song = focused[1].value;
            }
            focused = focused.filter(v => v.focused == true);

            let letter_filter = function(v) {
                let msg = interaction.options.getString(focused[0].name).toLowerCase();
                let search_segment = v.slice(0, focused[0].value.length).toLowerCase();
                return msg == search_segment;
            };
            
            if (focused[0].name == 'artist') {
                let artist_names = db.reviewDB.keyArray();

                // Search filters
                artist_names = artist_names.filter(letter_filter);
                if (artist_names.length > 25) artist_names = artist_names.slice(artist_names.length - 25, artist_names.length).reverse();
                let index = artist_names.indexOf(focused[0].value);
                if (index > 0) {
                    artist_names.unshift(artist_names.splice(index, 1)[0]);
                }
                
                artist_names = artist_names.map(v => v = { name: v, value: v });

                if (artist_names.length == 1 && interaction.commandName != 'getartist' && !interaction.commandName.includes('ep')) {
                    artist_collab = Object.keys(db.reviewDB.get(artist_names[0].name));
                    artist_collab = artist_collab.map(v => v = v.replace('_((', '[').replace('))_', ']'));
                    artist_collab = artist_collab.filter(v => v != 'pfp_image');
                    if (artist_collab != undefined) {
                        for (let i = 0; i < artist_collab.length; i++) {
                            if (artist_collab[i].includes('Remix')) {
                                artist_collab[i] = [];
                                continue;
                            }
                            let setterArtistCollab = convertToSetterName(artist_collab[i]);

                            artist_collab[i] = db.reviewDB.get(artist_names[0].name, `${setterArtistCollab}`).collab;
                            if (artist_collab[i] == undefined) artist_collab[i] = [];
                            if (artist_collab[i].length > 1) {
                                artist_collab[i] = artist_collab[i].join(' & ');
                            }
                        }
                        artist_collab = artist_collab.flat(1);
                        artist_collab = artist_collab.filter(v => v != undefined);
                        artist_collab = [...new Set(artist_collab)];
                        artist_collab = artist_collab.map(v => v = { name: `${artist_names[0].name} & ${v}`, value: `${artist_names[0].name} & ${v}` });
                        artist_names.push(artist_collab);
                        artist_names = artist_names.flat(1);
                        if (artist_names.length > 25) artist_names = artist_names.slice(artist_names.length - 25, artist_names.length).reverse();
                    }
                }
                interaction.respond(artist_names);
            } else if (focused[0].name == 'name' || focused[0].name == 'song_name' || focused[0].name == 'music_name' || focused[0].name == 'album_name') {
                let artist_songs = db.reviewDB.get(val_artist.split(' & ')[0]);
                if (artist_songs == undefined) {
                    interaction.respond([]); 
                    return;
                } 

                artist_songs = Object.keys(artist_songs);
                artist_songs = artist_songs.map(v => v = v.replace('_((', '[').replace('))_', ']'));
                let collab_artist_songs = [];
                artist_songs = artist_songs.filter(v => v != 'pfp_image');
                artist_songs = artist_songs.reverse();
                if (focused[0].name != 'old_name' && focused[0].name != 'name') {
                    if (focused[0].name != 'album_name') {
                        artist_songs = artist_songs.filter(v => !v.includes(' EP'));
                        artist_songs = artist_songs.filter(v => !v.includes(' LP'));
                    } else {
                        artist_songs = artist_songs.filter(v => v.includes(' EP') || v.includes('LP'));
                    }
                }

                for (let i = 0; i < artist_songs.length; i++) {
                    let val_artist_array = val_artist.split(' & ');
                    let setterArtistSong = convertToSetterName(artist_songs[i]);
                    if (val_artist_array.length <= 1) {
                        break;
                    } else {
                        if (db.reviewDB.get(val_artist_array[0], `${setterArtistSong}`).collab == undefined) return interaction.respond([]);
                        if (db.reviewDB.get(val_artist_array[0], `${setterArtistSong}`).collab.includes(`${val_artist_array[1]}`)) {
                            collab_artist_songs.push(artist_songs[i]);
                        }
                    }
                }

                if (collab_artist_songs.length == 0) {
                    // Search filters
                    artist_songs = artist_songs.filter(letter_filter);
                    if (artist_songs.length > 25) artist_songs = artist_songs.slice(0, 25);
                    artist_songs = artist_songs.map(v => v = { name: v, value: v });
                    interaction.respond(artist_songs);
                } else {
                    // Search filters
                    collab_artist_songs = collab_artist_songs.filter(letter_filter);
                    if (collab_artist_songs.length > 25) collab_artist_songs = collab_artist_songs.slice(0, 25);
                    collab_artist_songs = collab_artist_songs.map(v => v = { name: v, value: v });
                    interaction.respond(collab_artist_songs);
                }

            } else if (focused[0].name == 'remixers') {
                if (db.reviewDB.has(val_artist.split(' & ')[0])) {
                    let valSongSetter = convertToSetterName(val_song);
                    let artist_remixers = db.reviewDB.get(val_artist.split(' & ')[0], `${valSongSetter}`);
                    if (artist_remixers == undefined) {
                        interaction.respond([]);
                        return;   
                    }
                    artist_remixers = artist_remixers.remixers;

                    artist_remixers = artist_remixers.filter(letter_filter);
                    if (artist_remixers.length > 25) artist_remixers = artist_remixers.slice(artist_remixers.length - 25, artist_remixers.length);
                    artist_remixers = artist_remixers.map(v => v = { name: v, value: v });
                    interaction.respond(artist_remixers);
                }
            }
        } catch (err) {
            console.error(err);
            interaction.respond([]);
        }
    }

	if (interaction.type !== InteractionType.ApplicationCommand) return;

    if (!db.user_stats.has(interaction.user.id)) {
        db.user_stats.set(interaction.user.id, {
            lfm_username: false,
            access_token: "na",
            refresh_token: false,
            current_ep_review: false,
            fav_genres: [],
            fav_song: "N/A",
            fav_artist: "N/A",
            mailbox: false,
            mailbox_list: [],
            mailbox_playlist_id: false,
            mailbox_history: [],
            mailbox_blocklist: [],
            config: {
                mail_filter: { // Filter settings for what type of songs you want to be sent, all default to true
                    sp: true, // Spotify
                    sp_ep: true, // Spotify (EP)
                    sp_lp: true, // Spotify (LP)
                    sc: true, // SoundCloud
                    yt: true, // YouTube and Youtube Music
                    apple: true, // Apple Music
                },
                review_ping: false, // If you want to get pinged for a review if you are tagged as a user who sent it (default: false)
                star_spotify_playlist: false, // If you have a star spotify playlist setup (default: false)
                mailbox_dm: true, // If you want to be DM'd when you receive a mailbox send (default: true)
                mailbox_channel: false, // Mailbox channel to be sent music in (default: false, aka no channel)
                embed_color: false, // Embed color for review embeds (default: false)
                display_scrobbles: true, // Display scrobble counts on Waveform (default: true)
            },
            stats: {
                // These 2 were removed due to speed issues with my current hardware.
                // Could be re-added later when I get better hardware.
                // most_reviewed: ['N/A', 0], 
                // most_starred: ['N/A', 0],
                star_num: 0, // Number of stars given from reviews done by the user
                ten_num: 0, // Number of 10s given from reviews done by the user
                review_num: 0, // Number of reviews done by the user
                ep_review_num: 0, // Number of EP/LP reviews done by the user
                star_list: [],
                ratings_list: {},
            },
        });
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    if (!client.cooldowns.has(interaction.commandName)) {
        client.cooldowns.set(interaction.commandName, 0);
    }

    let ban_list = db.global_bot.get('ban_list');
    if (ban_list == undefined) ban_list = [];
    if (ban_list.includes(interaction.user.id)) {
        return interaction.reply(`You have been banned from Waveform. For more information or to appeal your ban, please contact \`@jeffdev\` on discord.`);
    }

    let serverConfig = db.server_settings.get(interaction.guild.id, 'config');
    if (serverConfig == undefined) {
        serverConfig = {
            disable_ratings: false,
        };
        db.server_settings.set(interaction.guild.id, serverConfig, 'config');
    }

    try {
        await command.execute(interaction, client, serverConfig);
    } catch (error) {
        await console.error(error);
        if (interaction.commandName != 'login') {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true }).catch(() => {
                interaction.editReply('There was an error while executing this command!');
            });
        } else if (interaction.commandName == 'login') {
            await interaction.reply({ content: 'Waveform failed to DM you, you must have your DMs open to login to Waveform with Spotify.', ephemeral: true }).catch(() => {
                interaction.editReply('Waveform failed to DM you, you must have your DMs open to login to Waveform with Spotify.');
            });
        }
    }
    
});

client.on('guildCreate', async (guild) => {
    if (!db.server_settings.has(guild.id)) {
        db.server_settings.set(guild.id, {
            stats: {
                // These 2 were removed due to speed issues with my current hardware.
                // Could be re-added later when I get better hardware.
                // most_reviewed: ['N/A', 0], 
                // most_starred: ['N/A', 0],
                star_num: 0, // Number of stars given from reviews done in the server
                ten_num: 0, // Number of 10s given from reviews done in the server
                review_num: 0, // Number of reviews done in the server
                ep_review_num: 0, // Number of EP/LP reviews done in the server
            },
            config: {
                disable_ratings: false,
                disable_global: false,
            },
        });
    }
});

// login to Discord
client.login(token_dev);
