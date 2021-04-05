// require the discord.js module
const fs = require('fs');
const Discord = require('discord.js');
const { prefix, token } = require('./config.json');
const { ogreList, memberIDList } = require('./arrays.json');
const db = require("./db.js");
const cron = require('node-cron');
const { msg_delete_timeout } = require('./func');

// Set up random number function
function randomNumber(min, max) {  
    return Math.random() * (max - min) + min; 
}  

// create a new Discord client and give it some variables
const client = new Discord.Client();
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

// when the client is ready, run this code
// this event will only trigger one time after logging in
client.once('ready', () => {
    console.log('Ready!');
    const date = new Date().toLocaleTimeString().replace("/.*(d{2}:d{2}:d{2}).*/", "$1");
    console.log(date);
});

// Change avatar at 9:00am and set pea of the day
cron.schedule('00 9 * * *', () => { 
    const ogrePick = ogreList[Math.floor(Math.random() * ogreList.length)];
    const myUserRole = client.guilds.cache.find(guild => guild.id === '680864893552951306').roles.cache.find(role => role.name === "Hotdog Water Bot");
    client.user.setAvatar(ogrePick);
    switch (ogrePick) {
        case './Ogres/ogreGold.png': myUserRole.setColor('#FFEF00'); client.user.setActivity('with hotdogs!', { type: 'PLAYING' }); break;
        case './Ogres/ogreHappy.png': myUserRole.setColor('#83FF39'); client.user.setActivity('Hotdog Water', { type: 'LISTENING' }); break;
        case './Ogres/ogreMad.png': myUserRole.setColor('#FF0000'); client.user.setActivity('Ultimate Pea Warfare', { type: 'COMPETING' }); break;
        case './Ogres/ogreSad.png': myUserRole.setColor('#3A41F9'); client.user.setActivity('all of you peas!', { type: 'WATCHING' }); break;
        case './Ogres/ogreSmug.png': myUserRole.setColor('#7E3BFF'); client.user.setActivity('live pea viewings', { type: 'STREAMING' }); break;
        case './Ogres/ogreSnow.png': myUserRole.setColor('#FFFFFF'); client.user.setActivity('with colddogs!', { type: 'PLAYING' }); break;
    }

    const channel = client.channels.cache.get('680864894006067263');
    channel.send('Hello everyone! I\'m here to tell you all today\'s **Pea of the Day** which is...');
    
}, {
    scheduled: true,
});


// Listen for messages
client.on('message', async message => {

    if (message.content.includes('‘')) {
        message.content = message.content.replace('‘', '\'');
    }

    if (message.channel.name === 'server-playlist-voting' && message.content.includes('-')) {
        message.react('✅');
        message.react('❌');
    }

    // Set pea of the day
    if (message.author.id === '784993334330130463' && message.content.includes('here to tell you all')) {
        const previousUser = db.potdID.get('ID');
        const chosenUser = memberIDList[Math.floor(Math.random() * memberIDList.length)];
        const myRole = client.guilds.cache.find(guild => guild.id === '680864893552951306').roles.cache.find(role => role.name === "Pea of the Day");
        message.guild.members.fetch(previousUser).then(a => a.roles.remove(myRole));
        message.guild.members.fetch(chosenUser).then(a => a.roles.add(myRole));
        message.channel.send(`<@${chosenUser}>! Congratulations!`);

        const peachannel = client.channels.cache.get('802077628756525086');
        peachannel.send(`<@${chosenUser}>, congrats on becoming pea of the day! In this chat, you'll get a chance to send a random message in this *s p e c i a l* chatroom!
        \nYou only get a limited amount though, so make it count!`).then(msg => {
            msg.delete({ timeout: 3.6e+6 });
        });

        db.potdID.set('ID', chosenUser);
    }

    // NON-COMMAND CHECKS
    if (Math.round(randomNumber(1, 500)) == 1 && message.channel.name != 'serious-events' && message.author.id != db.potdID.get('ID')) {
        message.react('<:pepehehe:784594747406286868>');
        const date = new Date().toLocaleTimeString().replace("/.*(d{2}:d{2}:d{2}).*/", "$1");
        console.log(`Deploying pepehehe at ${date}`);
    } else if (Math.round(randomNumber(1, 100)) == 1 && message.channel.name != 'serious-events' && message.author.id === db.potdID.get('ID')) {
        message.react('<:pepehehe:784594747406286868>');
        const date = new Date().toLocaleTimeString().replace("/.*(d{2}:d{2}:d{2}).*/", "$1");
        console.log(`Deploying pepehehe at ${date}`);
    }

    if (message.content.toLowerCase().includes('wth') && message.content.length <= 4 && message.channel.name != 'serious-events') {
        message.react('<:pepehehe:784594747406286868>');
    }

    if (message.content.toLowerCase().includes('craig') && message.channel.name != 'serious-events') {
        message.react('<:craig:714689464760533092>');
    }

    if (message.content.toLowerCase().includes('friday 🏀 we ball') && message.channel.name != 'serious-events') {
        message.react('🏀');
    }

        //#reviews Filter
    if (message.channel.name === 'reviews') {
        if (message.content.includes('(') || message.content.includes('!') || message.author.bot) {
            // Leave Empty
        } else {
            message.delete();
        }
    }

    if (!message.content.startsWith(prefix) || message.author.bot) return;

    let args = message.content.slice(prefix.length).trim().split(/ +/);
    let commandName = args.shift().toLowerCase();

    if (args.length > 1) {
        args = message.content.slice(prefix.length).trim().split(/ \| +/);
        const firstargs = args[0].split(/ +/);
        commandName = firstargs.shift().toLowerCase();  
        args[0] = args[0].slice(commandName.length + 1).trim(); 
    }
    

    // Genre Roulette GameStatus Stuff
    if (message.content.startsWith(`${prefix}gamestatus`)) {
        if (message.member.hasPermission('ADMINISTRATOR')) {
            const statusList = ['**Genre Roulette Game Status**'];

                db.genreRoulette.forEach((prop, key) => {
                    const statusString = `${prop.status === 'alive' ? ':white_check_mark:' : ':x:'} **${key}** *(${prop.genre})*`;
                    statusList.push(statusString);
                });
                
            (message.channel.send(statusList)).then((msg) => {
                db.genreID.set(`genreID`, msg.id);
                console.log(db.genreID.get('genreID'));
            });
        } else { return message.reply('You don\'t have the perms to use this command!'); }
    }

    module.exports.updateGenreGameData = function() {
        if (message.channel.type === 'dm') return;
        const genreIDmsg = db.genreID.get('genreID');
        const channeltoSearch = message.guild.channels.cache.get('731919003219656795');
        (channeltoSearch.messages.fetch(genreIDmsg)).then((msg) => {

            const statusList = ['**Genre Roulette Game Status**'];

            db.genreRoulette.forEach((prop, key) => {
                const statusString = `${prop.status === 'alive' ? ':white_check_mark:' : ':x:'} **${key}** *(${prop.genre})*`;
                statusList.push(statusString);
            });

            msg.edit(statusList);
        });
    };

    module.exports.updateFridayListData = function() {
        if (message.channel.type === 'dm') return;
        const singleID = db.friID.get('singleID');
        const epID = db.friID.get('epID');
        const lpID = db.friID.get('lpID');
        const compID = db.friID.get('compID');
        const channeltoSearch = message.guild.channels.cache.get('786071855454224404');

        const epList = [];
        const lpList = [];
        const compList = [];
        const singleList = [];

        db.friList.forEach((prop) => {
            if (prop.friday === false) {
                let artistName = prop.artist.replace('*', '\\*');
                let songName = prop.song.replace('*', '\\*');
                const songString = `**--** ${artistName} - ${songName}`;

                if (!prop.song.includes('EP') && !prop.song.includes('LP') && !prop.song.toLowerCase().includes('comp')) {
                    singleList.push(songString);
                } else if (prop.song.includes('EP')) {
                    epList.push(songString);
                } else if (prop.song.includes('LP')) {
                    lpList.push(songString);
                } else if (prop.song.toLowerCase().includes('comp')) {
                    compList.push(songString.substring(0, songString.length - 5));
                }
            } else if (prop.friday === true) {
                let artistName = prop.artist.replace('*', '\\*');
                let songName = prop.song.replace('*', '\\*');
                const songString = `**--** :regional_indicator_f: **${artistName} - ${songName}**`;

                if (!prop.song.includes('EP') && !prop.song.includes('LP') && !prop.song.toLowerCase().includes('comp')) {
                    singleList.unshift(songString);
                } else if (prop.song.includes('EP')) {
                    epList.unshift(songString);
                } else if (prop.song.includes('LP')) {
                    lpList.unshift(songString);
                } else if (prop.song.toLowerCase().includes('comp')) {
                    compList.push(songString.substring(0, songString.length - 6) + '**');
                }
            }
        });

        compList.join('\n');
        compList.unshift('**Compilations**');
        compList.unshift(' ');
        compList.push('----------------------------------------------------------------------------------------------------------------');

        lpList.join('\n');
        lpList.unshift('**LPs**');
        lpList.unshift(' ');
        lpList.push('----------------------------------------------------------------------------------------------------------------');

        epList.join('\n');
        epList.unshift('**EPs**');
        epList.unshift(' ');
        epList.push('----------------------------------------------------------------------------------------------------------------');

        singleList.join('\n');
        singleList.unshift('**Singles**');
        singleList.unshift(' ');
        singleList.push('----------------------------------------------------------------------------------------------------------------');

        (channeltoSearch.messages.fetch(singleID)).then((msg) => {
            msg.edit(singleList);
        });

        (channeltoSearch.messages.fetch(epID)).then((msg) => {
            msg.edit(epList);
        });

        (channeltoSearch.messages.fetch(lpID)).then((msg) => {
            msg.edit(lpList);
        });

        (channeltoSearch.messages.fetch(compID)).then((msg) => {
            msg.edit(compList);
        });
    };

    // Friday Music Listening Stuff
    if (message.content.startsWith(`${prefix}fridaylist`)) {
        if (message.member.hasPermission('ADMINISTRATOR')) {
            const introList = [];
            const singleList = [];
            const epList = [];
            const lpList = [];
            const compList = [];

            db.friList.forEach((prop) => {
                if (prop.friday === false) {
                    const songString = `**--** ${prop.artist} - ${prop.song}`;

                    if (!prop.song.includes('EP') && !prop.song.includes('LP') && !prop.song.toLowerCase().includes('comp')) {
                        singleList.push(songString);
                    } else if (prop.song.includes('EP')) {
                        epList.push(songString);
                    } else if (prop.song.includes('LP')) {
                        lpList.push(songString);
                    } else if (prop.song.toLowerCase().includes('comp')) {
                        compList.push(songString.substring(0, songString.length - 5));
                    }
                } else if (prop.friday === true) {
                    const songString = `**--** :regional_indicator_f: **${prop.artist} - ${prop.song}**`;

                    if (!prop.song.includes('EP') && !prop.song.includes('LP') && !prop.song.toLowerCase().includes('comp')) {
                        singleList.unshift(songString);
                    } else if (prop.song.includes('EP')) {
                        epList.unshift(songString);
                    } else if (prop.song.includes('LP')) {
                        lpList.unshift(songString);
                    } else if (prop.song.toLowerCase().includes('comp')) {
                        compList.push(songString.substring(0, songString.length - 6) + '**');
                    }
                }
            });

            db.friID.inc(`Week`);

            compList.join('\n');
            compList.unshift('**Compilations**');
            compList.unshift(' ');
            compList.push('----------------------------------------------------------------------------------------------------------------');

            lpList.join('\n');
            lpList.unshift('**LPs**');
            lpList.unshift(' ');
            lpList.push('----------------------------------------------------------------------------------------------------------------');

            epList.join('\n');
            epList.unshift('**EPs**');
            epList.unshift(' ');
            epList.push('----------------------------------------------------------------------------------------------------------------');

            singleList.join('\n');
            singleList.unshift('**Singles**');
            singleList.unshift(' ');
            singleList.push('----------------------------------------------------------------------------------------------------------------');

            introList.unshift('(:regional_indicator_f: means that it is on the Friday Playlist for this week.)');
            introList.unshift(`**Music Listening Playlist (Week ${db.friID.get('Week')})**`);
            introList.push('----------------------------------------------------------------------------------------------------------------');
            
            message.channel.send(introList);

            (message.channel.send(singleList)).then((msg) => {
                db.friID.set(`singleID`, msg.id);
            });

            (message.channel.send(epList)).then((msg) => {
                db.friID.set(`epID`, msg.id);
            });

            (message.channel.send(lpList)).then((msg) => {
                db.friID.set(`lpID`, msg.id);
            });

            (message.channel.send(compList)).then((msg) => {
                db.friID.set(`compID`, msg.id);
            });

        message.delete();
       } else { return message.reply('You don\'t have the perms to use this command!'); }
    }

    //Update the databases whenever a command is used, just to make sure we're good at most times
    module.exports.updateGenreGameData();
    module.exports.updateFridayListData();
    
	const command = client.commands.get(commandName) ||	client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
	if (!command) return;

    if (command.args && !args.length) {
        let reply = `You didn't provide any arguments, ${message.author}!`;

		if (command.usage) {
			reply += `\nThe proper usage would be: \`${command.usage}\``;
		}

		return message.channel.send(reply);	
    } else if (command.arg_num != undefined) {
        if (args.length > command.arg_num) {
            msg_delete_timeout(message, 10000);
            return msg_delete_timeout(message, 10000, `Too many arguments! See \`!help ${command.name}\` for more assistance.`);
        } 
    }

    if (!cooldowns.has(command.name)) {
        cooldowns.set(command.name, new Discord.Collection());
    }
    
    const now = Date.now();
    const timestamps = cooldowns.get(command.name);
    const cooldownAmount = (command.cooldown || 0) * 1000;
    
    if (timestamps.has(message.author.id)) {
        const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return message.reply(`please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${command.name}\` command.`);
        }

    }

    timestamps.set(message.author.id, now);
    setTimeout(() => timestamps.delete(message.author.id), cooldownAmount); 

    try {
        command.execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply(`There was an error trying to execute that command!\nMessage sent: \`${message.content}\`\nPing Jeff and tell him to look into it!`);
    }

});


// login to Discord
client.login(token);