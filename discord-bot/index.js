// require the discord.js module
const fs = require('fs');
const Discord = require('discord.js');
const { token } = require('./config.json');
// const db = require("./db.js");
// const cron = require('node-cron');
const db = require('./db');

// create a new Discord client and give it some variables
const { Client, Intents } = require('discord.js');
const myIntents = new Intents();
myIntents.add('GUILD_PRESENCES', 'GUILD_MEMBERS', 'GUILD_PRESENCES');

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_PRESENCES], partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
client.commands = new Discord.Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
const cooldowns = new Discord.Collection();

// Command Collections
for (const file of commandFiles) {
	const command = require(`./commands/${file}`);

	// set a new item in the Collection
	// with the key as the command name and the value as the exported module
	client.commands.set(command.name, command);
}

client.once('ready', async () => {
    const data = [];
	const admin_list = [];
	let permissions;
    client.commands.forEach(function(value, key) {
        data.push({
            name: key,
            description: value.description,
            options: value.options,
			defaultPermission: !value.admin,
        });
		if (value.admin === true) {
			admin_list.push(key);
		}
    });
    await client.guilds.cache.get('680864893552951306')?.commands.set(data);
	let perm_command;
	const command_list = await client.guilds.cache.get('680864893552951306')?.commands.cache.array();
	for (let i = 0; i < command_list.length; i++) {
		if (admin_list.includes(command_list[i].name)) {
			perm_command = await client.guilds.cache.get('680864893552951306')?.commands.fetch(command_list[i].id);
			permissions = [
				{
					id: '847223926782296064',
					type: 'ROLE',
					permission: true,
				},
			];
			await perm_command.setPermissions(permissions);
		}
	}

    console.log('Ready!');
    const date = new Date().toLocaleTimeString().replace("/.*(d{2}:d{2}:d{2}).*/", "$1");
    console.log(date);
});

// Listen for interactions (INTERACTION COMMAND HANDLER)
client.on('interaction', async interaction => {
	if (!interaction.isCommand()) return;

	await interaction.defer();

    let args;

    const command = client.commands.get(interaction.commandName);

	if (!cooldowns.has(command.name)) {
        cooldowns.set(command.name, new Discord.Collection());
    }
    
    const now = Date.now();
    const timestamps = cooldowns.get(command.name);
    const cooldownAmount = (command.cooldown || 0) * 1000;

    if (timestamps.has(interaction.user.id)) {
        const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return interaction.editReply(`please wait ${timeLeft.toFixed(0)} more second(s) before reusing the \`${command.name}\` command.`);
        }

    }

	timestamps.set(interaction.user.id, now);
	setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount); 

    try {
        await command.execute(interaction, client, args);
    } catch (error) {
        await console.error(error);
        await interaction.reply(`There was an error trying to execute that command!`);
    }
});


// Listen for messages
client.on('message', async message => {

    //Review Chat Filter
    if (db.server_settings.get(message.guild.id, 'review_filter') === true && `<#${message.channel.id}>` === db.server_settings.get(message.guild.id, 'review_channel')) {
        if (message.content.includes('(') || message.content.includes('!') || message.author.bot) {
            // Leave Empty
        } else {
            message.delete();
        }
    }

});


// login to Discord
client.login(token);