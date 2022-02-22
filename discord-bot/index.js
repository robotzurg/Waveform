// require the discord.js module
const fs = require('fs');
const Discord = require('discord.js');
const { token_dev } = require('./config.json');
const db = require('./db');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

// create a new Discord client and give it some variables
const { Client, Intents } = require('discord.js');
const myIntents = new Intents();
myIntents.add('GUILD_PRESENCES', 'GUILD_MEMBERS', 'GUILD_PRESENCES');

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS, 
                            Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_PRESENCES], partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
client.commands = new Discord.Collection();
const registerCommands = [];
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
    if (command.type === undefined) {
        // Slash Commands
        client.commands.set(command.data.name, command);
        registerCommands.push(command.data.toJSON());
    } else {
        // Context Menu Commands (these have a different structure)
        client.commands.set(command.name, command);
        registerCommands.push(command);
    }
}

const rest = new REST({ version: '9' }).setToken(token_dev);

(async () => {
	try {
		console.log('Started refreshing application (/) commands.');

		await rest.put(
			Routes.applicationGuildCommands(devClientId, devGuildId),
			{ body: registerCommands },
		);

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
            
            if (focused[0].name == 'artist' || focused[0].name == 'vocalist') {
                let artist_names = db.reviewDB.keyArray();

                // Search filters
                artist_names = artist_names.filter(letter_filter);
                if (artist_names.length > 25) artist_names = artist_names.slice(artist_names.length - 25, artist_names.length).reverse();
                artist_names = artist_names.map(v => v = { name: v, value: v });

                if (artist_names.length == 1 && interaction.commandName != 'getartist') {
                    artist_collab = Object.keys(db.reviewDB.get(artist_names[0].name));
                    artist_collab = artist_collab.filter(v => v != 'Image');
                    if (artist_collab != undefined) {
                        for (let i = 0; i < artist_collab.length; i++) {
                            if (artist_collab[i].includes('Remix')) {
                                artist_collab[i] = [];
                                continue;
                            }
                            artist_collab[i] = db.reviewDB.get(artist_names[0].name, `["${artist_collab[i]}"].collab`);
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
                    }
                }

                interaction.respond(artist_names);
            } else if (focused[0].name == 'song' || focused[0].name == 'old_song' || focused[0].name == 'ep_name') {
                let artist_songs = db.reviewDB.get(val_artist.split(' & ')[0]);
                if (artist_songs == undefined) {
                    interaction.respond([]); 
                    return;
                } 

                artist_songs = Object.keys(artist_songs);
                let collab_artist_songs = [];
                artist_songs = artist_songs.filter(v => v != 'Image');
                artist_songs = artist_songs.reverse();
                if (focused[0].name != 'ep_name') {
                    artist_songs = artist_songs.filter(v => !v.includes(' EP'));
                    artist_songs = artist_songs.filter(v => !v.includes(' LP'));
                } else {
                    artist_songs = artist_songs.filter(v => v.includes(' EP') || v.includes('LP'));
                }

                for (let i = 0; i < artist_songs.length; i++) {
                    let val_artist_array = val_artist.split(' & ');
                    if (val_artist_array.length <= 1) {
                        break;
                    } else {
                        if (db.reviewDB.get(val_artist_array[0], `["${artist_songs[i]}"].collab`) == undefined) return interaction.respond([]);
                        if (db.reviewDB.get(val_artist_array[0], `["${artist_songs[i]}"].collab`).includes(`${val_artist_array[1]}`)) {
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
                    let artist_remixers = db.reviewDB.get(val_artist.split(' & ')[0], `["${val_song}"].remixers`);
                    if (artist_remixers == undefined) {
                        interaction.respond([]);
                        return;   
                    }

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

	if (!interaction.isCommand() && !interaction.isContextMenu()) return;

	await interaction.deferReply();

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction, client);
    } catch (error) {
        await console.error(error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
    
});

// login to Discord
client.login(token_dev);